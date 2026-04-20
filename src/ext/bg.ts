import { BrowserRecorder } from "./browser-recorder";

import { CollectionLoader } from "@webrecorder/wabac/swlib";
import { Downloader, type ResponseWithFilename } from "../sw/downloader";

import { listAllMsg } from "../utils";

import {
  getLocalOption,
  removeLocalOption,
  setLocalOption,
} from "../localstorage";

// ===========================================================================
self.recorders = {};
self.newRecId = null;

// @ts-expect-error - TS7034 - Variable 'newRecUrl' implicitly has type 'any' in some locations where its type cannot be determined.
let newRecUrl = null;
// @ts-expect-error - TS7034 - Variable 'newRecCollId' implicitly has type 'any' in some locations where its type cannot be determined.
let newRecCollId = null;

// @ts-expect-error - TS7034 - Variable 'defaultCollId' implicitly has type 'any' in some locations where its type cannot be determined.
let defaultCollId = null;
let autorun = false;

const openWinMap = new Map();

const collLoader = new CollectionLoader();
const DEFAULT_API_BASE_URL = "http://siaikevin.test";
const API_BASE_URL_STORAGE_KEY = "apiBaseUrl";
const uploadInProgress = new Set<string>();
const PROTECTED_CAPTURE_HOSTS = new Set(["siaikevin.test", "www.siaikevin.test", "siai2"]);

/** Pending captures waiting to be transferred to the register page via content script. */
const pendingCaptures = new Map<string, {
  arrayBuffer: ArrayBuffer;
  filename: string;
  url: string;
  text: string;
  thumbnailBase64: string | null;
}>();
const TRANSFER_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB base64 chunks

// Global upload state — persists across tab switches.
let globalUploadStatus: {
  progress: number;
  text: string;
  done: boolean;
  error: boolean;
  tabId: number;
} | null = null;

// All open popup ports so we can broadcast to all of them.
const popupPorts = new Set<{
  postMessage: (msg: Record<string, unknown>) => void;
}>();

/** Update the badge on the extension icon to reflect upload progress.
 * Throttled: only emits a Chrome API call when the displayed text changes
 * to avoid saturating the extension API at ~5 calls/second.
 */
let _lastBadgeText = "";
function setBadgeProgress(progress: number, done: boolean, error: boolean) {
  const text = done ? (error ? "✗" : "✓") : `${Math.round(progress)}%`;
  if (text === _lastBadgeText) return; // no-op if nothing changed
  _lastBadgeText = text;

  if (done) {
    chrome.action.setBadgeBackgroundColor({ color: error ? "#b91c1c" : "#4d7c0f" });
    chrome.action.setBadgeText({ text });
    // Clear the badge after 8 s (best-effort; SW may be killed before then).
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" });
      _lastBadgeText = "";
    }, 8_000);
  } else {
    chrome.action.setBadgeBackgroundColor({ color: "#1d4ed8" });
    chrome.action.setBadgeText({ text });
  }
}

/** Show a Chrome notification when the upload finishes (success or error). */
function notifyUploadDone(error: boolean, text: string) {
  chrome.notifications.create("upload-done", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title: error ? "Error al subir archivo" : "Archivo subido correctamente",
    message: text || (error ? "La subida falló." : "El archivo fue enviado al servidor."),
    priority: 1,
  });
}

function broadcastUploadStatus(
  status: { progress: number; text: string; done: boolean; error: boolean; tabId: number } | null,
) {
  if (!status) return;
  for (const port of popupPorts) {
    try {
      port.postMessage({ type: "uploadStatus", ...status });
    } catch (_e) {
      // port may have closed
    }
  }
}

async function getApiBaseUrl(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(API_BASE_URL_STORAGE_KEY);
    const stored = result?.[API_BASE_URL_STORAGE_KEY];
    if (typeof stored === "string" && /^https?:\/\/.+/.test(stored.trim())) {
      return stored.trim().replace(/\/$/, "");
    }
  } catch (_e) {
    // ignore storage errors
  }

  return DEFAULT_API_BASE_URL;
}

function getHostnameSafe(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_e) {
    return "";
  }
}

function isProtectedCaptureUrl(targetUrl: string, apiBaseUrl: string): boolean {
  const targetHost = getHostnameSafe(targetUrl);
  if (!targetHost) {
    return false;
  }

  if (PROTECTED_CAPTURE_HOSTS.has(targetHost)) {
    return true;
  }

  const apiHost = getHostnameSafe(apiBaseUrl);
  return apiHost !== "" && targetHost === apiHost;
}
const uploadStatusByTab = new Map<
  number,
  { progress: number; text: string; done: boolean; error: boolean }
>();

const disabledCSPTabs = new Set();

// ===========================================================================

function main() {
  chrome.action.setBadgeBackgroundColor({ color: "#4d7c0f" });

  chrome.contextMenus.create({
    id: "toggle-rec",
    title: "Start Recording",
    contexts: ["browser_action"],
  });
}

// @ts-expect-error - TS7006 - Parameter 'port' implicitly has an 'any' type.
chrome.runtime.onConnect.addListener((port) => {
  switch (port.name) {
    case "popup-port":
      popupPorts.add(port);
      port.onDisconnect.addListener(() => popupPorts.delete(port));
      popupHandler(port);
      break;
  }
});

// @ts-expect-error - TS7006 - Parameter 'port' implicitly has an 'any' type.
function popupHandler(port) {
  if (!port.sender || port.sender.url !== chrome.runtime.getURL("popup.html")) {
    return;
  }

  let tabId: number | null = null;

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  port.onMessage.addListener(async (message) => {
    switch (message.type) {
      case "startUpdates":
        tabId = message.tabId;
        if (tabId !== null && self.recorders[tabId]) {
          // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'BrowserRecorder'.
          self.recorders[tabId].port = port;
          self.recorders[tabId].doUpdateStatus();
        }
        port.postMessage(await listAllMsg(collLoader));
        // Always send the global upload status (if any) so any tab sees it.
        if (globalUploadStatus && !globalUploadStatus.done) {
          port.postMessage({ type: "uploadStatus", ...globalUploadStatus });
        } else if (tabId !== null && uploadStatusByTab.has(tabId)) {
          port.postMessage({
            type: "uploadStatus",
            ...uploadStatusByTab.get(tabId),
          });
        }
        break;

      case "startRecording": {
        const apiBaseUrl = await getApiBaseUrl();
        const recordingUrl = String(message.url || "");
        if (isProtectedCaptureUrl(recordingUrl, apiBaseUrl)) {
          sendUploadStatus(null, {
            progress: 100,
            text: "Por seguridad, no se permite archivar dentro del dominio de SIAI.",
            done: true,
            error: true,
          }, tabId ?? undefined);
          break;
        }

        // Block new recordings while a global upload is in progress.
        if (globalUploadStatus && !globalUploadStatus.done) {
          port.postMessage({ type: "uploadStatus", ...globalUploadStatus });
          break;
        }
        const { autorun } = message;
        // Always create a fresh collection for each recording so that each
        // capture produces exactly one WACZ with only the pages from that session.
        const sessionTitle = (() => {
          try {
            const host = new URL(message.url || "").hostname;
            return host || "Captura";
          } catch (_e) {
            return "Captura";
          }
        })();
        const { name: freshCollId } = await collLoader.initNewColl({ title: sessionTitle });
        defaultCollId = freshCollId;
        await setLocalOption("defaultCollId", freshCollId);
        // Notify popup so it shows the new collection immediately.
        port.postMessage(await listAllMsg(collLoader, { defaultCollId }));
        // @ts-expect-error - TS2554 - Expected 2 arguments, but got 3.
        startRecorder(tabId, { collId: freshCollId, port, autorun }, message.url);
        break;
      }

      case "stopRecording":
        if (tabId !== null) {
          await stopRecorder(tabId, { triggerDraft: true });
        }
        break;

      case "getApiBaseUrl": {
        try {
          const result = await chrome.storage.local.get(API_BASE_URL_STORAGE_KEY);
          const stored = result?.[API_BASE_URL_STORAGE_KEY];
          const url =
            typeof stored === "string" && stored.trim()
              ? stored.trim()
              : DEFAULT_API_BASE_URL;
          port.postMessage({ type: "apiBaseUrl", url });
        } catch (_e) {
          port.postMessage({ type: "apiBaseUrl", url: DEFAULT_API_BASE_URL });
        }
        break;
      }

      case "setApiBaseUrl": {
        const newUrl =
          typeof message.url === "string" ? message.url.trim().replace(/\/$/, "") : "";
        if (newUrl && /^https?:\/\/.+/.test(newUrl)) {
          await chrome.storage.local.set({ [API_BASE_URL_STORAGE_KEY]: newUrl });
          port.postMessage({ type: "apiBaseUrl", url: newUrl });
        }
        break;
      }

      case "toggleBehaviors":
        if (tabId !== null) {
          toggleBehaviors(tabId);
        }
        break;

      case "newColl": {
        const { name } = await collLoader.initNewColl({ title: message.title });
        defaultCollId = name;
        port.postMessage(await listAllMsg(collLoader, { defaultCollId }));
        await setLocalOption("defaultCollId", defaultCollId);
        break;
      }
    }
  });

  port.onDisconnect.addListener(() => {
    // @ts-expect-error - TS2538 - Type 'null' cannot be used as an index type.
    if (self.recorders[tabId]) {
      // @ts-expect-error - TS2538 - Type 'null' cannot be used as an index type.
      self.recorders[tabId].port = null;
    }
    popupPorts.delete(port);
  });
}

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tab' implicitly has an 'any' type. | TS7006 - Parameter 'reason' implicitly has an 'any' type.
chrome.debugger.onDetach.addListener((tab, reason) => {
  // target closed, delete recorder as this tab will not be used again
  if (reason === "target_closed") {
    delete self.recorders[tab.id];
  }
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tab' implicitly has an 'any' type.
chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.id) {
    return;
  }

  let openUrl = null;
  let start = false;
  let waitForTabUpdate = true;
  let collId = null;

  // start recording from extension in new tab use case
  // @ts-expect-error - TS7005 - Variable 'newRecUrl' implicitly has an 'any' type.
  if (newRecUrl && tab.pendingUrl === "about:blank") {
    start = true;
    openUrl = newRecUrl;
    // @ts-expect-error - TS7005 - Variable 'newRecCollId' implicitly has an 'any' type. | TS7005 - Variable 'defaultCollId' implicitly has an 'any' type.
    collId = newRecCollId || defaultCollId;
    newRecUrl = null;
    newRecCollId = null;
  } else if (
    tab.openerTabId &&
    (!tab.pendingUrl || isValidUrl(tab.pendingUrl)) &&
    // @ts-expect-error - TS2339 - Property 'running' does not exist on type 'BrowserRecorder'.
    self.recorders[tab.openerTabId]?.running
  ) {
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'BrowserRecorder'.
    collId = self.recorders[tab.openerTabId].collId;

    start = true;
    if (tab.pendingUrl) {
      waitForTabUpdate = false;
      openUrl = tab.pendingUrl;
    }
  }

  if (start) {
    if (openUrl && !isValidUrl(openUrl)) {
      return;
    }
    startRecorder(
      tab.id,
      { waitForTabUpdate, collId, openUrl, autorun },
      // @ts-expect-error - TS2554 - Expected 2 arguments, but got 3.
      openUrl,
    );
  }
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type. | TS7006 - Parameter 'changeInfo' implicitly has an 'any' type.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId && self.recorders[tabId]) {
    const recorder = self.recorders[tabId];
    if (changeInfo.url) {
      // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'BrowserRecorder'.
      recorder.failureMsg = null;
    }

    if (changeInfo.url && openWinMap.has(changeInfo.url)) {
      openWinMap.delete(changeInfo.url);
    }

    // @ts-expect-error - TS2339 - Property 'waitForTabUpdate' does not exist on type 'BrowserRecorder'.
    if (recorder.waitForTabUpdate) {
      if (isValidUrl(changeInfo.url)) {
        recorder.attach();
      } else {
        // @ts-expect-error - TS2339 - Property 'waitForTabUpdate' does not exist on type 'BrowserRecorder'.
        recorder.waitForTabUpdate = false;
        delete self.recorders[tabId];
        return;
      }
    }
  } else if (changeInfo.url && openWinMap.has(changeInfo.url)) {
    const collId = openWinMap.get(changeInfo.url);
    openWinMap.delete(changeInfo.url);
    if (!tabId || !isValidUrl(changeInfo.url)) {
      return;
    }
    // @ts-expect-error - TS2554 - Expected 2 arguments, but got 3.
    startRecorder(tabId, { collId, autorun }, changeInfo.url);
  }
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type.
chrome.tabs.onRemoved.addListener((tabId) => {
  delete self.recorders[tabId];
  uploadStatusByTab.delete(tabId);
  removeLocalOption(`${tabId}-collId`);
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'info' implicitly has an 'any' type. | TS7006 - Parameter 'tab' implicitly has an 'any' type.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "toggle-rec":
      if (!isRecording(tab.id)) {
        if (isValidUrl(tab.url)) {
          // @ts-expect-error - TS2554 - Expected 2 arguments, but got 1.
          startRecorder(tab.id);
        }
      } else {
        stopRecorder(tab.id);
      }
      break;
  }
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type. | TS7006 - Parameter 'opts' implicitly has an 'any' type.
async function startRecorder(tabId, opts) {
  const currentTabUrl = await getTabUrl(tabId);
  const apiBaseUrl = await getApiBaseUrl();
  if (isProtectedCaptureUrl(currentTabUrl, apiBaseUrl)) {
    sendUploadStatus(null, {
      progress: 100,
      text: "Grabación bloqueada en SIAI para proteger la sesión activa.",
      done: true,
      error: true,
    }, tabId);
    return "protected_capture_url";
  }

  if (!self.recorders[tabId]) {
    opts.collLoader = collLoader;
    opts.openWinMap = openWinMap;
    self.recorders[tabId] = new BrowserRecorder({ tabId }, opts);
  } else {
    self.recorders[tabId].setAutoRunBehavior(opts.autorun);
  }

  let err = null;

  const { waitForTabUpdate } = opts;

  // @ts-expect-error - TS2339 - Property 'running' does not exist on type 'BrowserRecorder'.
  if (!waitForTabUpdate && !self.recorders[tabId].running) {
    try {
      self.recorders[tabId].setCollId(opts.collId);
      await self.recorders[tabId].attach();
    } catch (e) {
      console.warn(e);
      err = e;
    }
    return err;
  }
}

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type.
async function stopRecorder(tabId, { triggerDraft = false } = {}) {
  const recorder = self.recorders[tabId];
  if (!recorder) {
    return false;
  }

  sendUploadStatus(recorder, {
    progress: 5,
    text: "Deteniendo archivado...",
    done: false,
  }, tabId);

  recorder.detach();

  try {
    // Poll flush progress and update the status message so the user sees
    // the indicator moving on slower machines while the recorder finalizes.
    const flushStart = Date.now();
    const flushMaxMs = 180_000;
    const flushTick = async () => {
      const rec = recorder as { running?: boolean; numPending?: number };
      while (Date.now() - flushStart < flushMaxMs) {
        if (!rec.running && (rec.numPending || 0) === 0) return;
        const elapsed = Math.round((Date.now() - flushStart) / 1000);
        sendUploadStatus(recorder, {
          progress: 10,
          text: `Finalizando captura… (${elapsed} s)`,
          done: false,
        }, tabId);
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    // Run the progress ticker alongside the actual flush wait.
    await Promise.all([waitForRecorderToFlush(recorder), flushTick()]);
    sendUploadStatus(recorder, {
      progress: 25,
      text: "Empaquetando archivo...",
      done: false,
    }, tabId);
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'BrowserRecorder'.
    const collId = recorder.collId;
    // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'BrowserRecorder'.
    const pageUrl = recorder.pageUrl;
    if (triggerDraft) {
      await prepareLocalCapture(collId, pageUrl, tabId, recorder);
    } else {
      sendUploadStatus(recorder, {
        progress: 100,
        text: "Archivado detenido.",
        done: true,
      }, tabId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e || "");
    const isFlushTimeout = msg.includes("recorder_flush_timeout");
    console.warn(isFlushTimeout ? "Recorder flush timeout:" : "Upload pipeline failed:", msg);
    sendUploadStatus(recorder, {
      progress: 100,
      text: isFlushTimeout
        ? "La página tardó demasiado en finalizar. Intenta archivar una página más pequeña."
        : "No se pudo completar la subida.",
      done: true,
      error: true,
    }, tabId);
  }

  return true;
}

function sendUploadStatus(
  recorder: unknown,
  {
    progress,
    text,
    done = false,
    error = false,
  }: {
    progress: number;
    text: string;
    done?: boolean;
    error?: boolean;
  },
  tabId?: number,
) {
  const rec = recorder as {
    tabId?: number;
    port?: { postMessage: (msg: Record<string, unknown>) => void };
  };

  const targetTabId = tabId || rec.tabId;
  if (targetTabId) {
    if (done) {
      uploadStatusByTab.delete(targetTabId);
    } else {
      uploadStatusByTab.set(targetTabId, { progress, text, done, error });
    }
  }

  // Keep the global upload status in sync so every popup port can show it.
  if (!done) {
    globalUploadStatus = {
      progress,
      text,
      done,
      error,
      tabId: targetTabId ?? 0,
    };
  } else {
    // Keep the final (done) state briefly so the popup can read it on reconnect,
    // then clear after 10 s so the next recording is not blocked.
    globalUploadStatus = {
      progress,
      text,
      done,
      error,
      tabId: targetTabId ?? 0,
    };
    setTimeout(() => {
      if (globalUploadStatus?.done) {
        globalUploadStatus = null;
      }
    }, 10_000);
  }

  // Broadcast to all open popup ports (works across tab switches).
  broadcastUploadStatus(globalUploadStatus);

  // Keep the extension icon badge in sync with upload state.
  setBadgeProgress(progress, done, error);
  if (done) {
    notifyUploadDone(error, text);
  }

  if (!rec?.port) {
    return;
  }

  rec.port.postMessage({
    type: "uploadStatus",
    progress,
    text,
    done,
    error,
  });
}

async function waitForRecorderToFlush(recorder: unknown, timeoutMs = 180_000) {
  const started = Date.now();
  const rec = recorder as { running?: boolean; numPending?: number };
  while (Date.now() - started < timeoutMs) {
    const isRunning = rec.running;
    const numPending = rec.numPending || 0;

    if (!isRunning && numPending === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  // Hard timeout: do NOT proceed — an incomplete WACZ will cause an EOF error
  // on the server. Surface it as a real error the user can see.
  throw new Error(
    `recorder_flush_timeout: el grabador tardó más de ${Math.round(timeoutMs / 1000)} s ` +
    `en finalizar (pending=${rec.numPending ?? '?'}). ` +
    `Es posible que la página sea demasiado grande o que el equipo esté muy cargado.`,
  );
}

function normalizeSourceUrl(input: string) {
  if (!input) {
    return "";
  }

  try {
    const parsed = new URL(input);
    let result = parsed.href;
    if (result.length > 2048) {
      result = parsed.origin + parsed.pathname;
    }
    if (result.length > 2048) {
      result = parsed.origin;
    }
    return result;
  } catch (_e) {
    return "";
  }
}

async function getTabUrl(tabId: number): Promise<string> {
  if (!tabId) {
    return "";
  }

  return await new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab: { url?: string } | undefined) => {
      if (chrome.runtime.lastError || !tab?.url) {
        resolve("");
        return;
      }
      resolve(tab.url);
    });
  });
}

async function resolveCapturedSourceUrl(tabId: number, pageUrl: string) {
  const normalizedRecorderUrl = normalizeSourceUrl(pageUrl || "");
  if (normalizedRecorderUrl) {
    return normalizedRecorderUrl;
  }

  const tabUrl = await getTabUrl(tabId);
  const normalizedTabUrl = normalizeSourceUrl(tabUrl);
  if (normalizedTabUrl) {
    return normalizedTabUrl;
  }

  return "";
}

function ensureWaczFilename(filename: string | undefined, collId: string) {
  const safeCollId = String(collId || "archive").replace(/[^a-zA-Z0-9-_]/g, "-");
  const baseName = filename || `${safeCollId}.wacz`;
  if (baseName.endsWith(".wacz") || baseName.endsWith(".wacz.zip")) {
    return baseName;
  }
  if (baseName.endsWith(".zip")) {
    return baseName.slice(0, -4) + ".wacz.zip";
  }
  return `${baseName}.wacz`;
}

async function getPageText(tabId: number) {
  try {
    if (!chrome.scripting?.executeScript) {
      throw new Error("chrome_scripting_unavailable");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText || "",
    });

    return results?.[0]?.result || "";
  } catch (e) {
    console.warn("Could not extract page text:", e);
    return "";
  }
}

async function makePlaceholderThumbnail(): Promise<File | null> {
  try {
    const canvas = new OffscreenCanvas(320, 180);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sin captura", 160, 90);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new File([blob], "thumbnail.png", { type: "image/png" });
  } catch (_e) {
    return null;
  }
}

async function captureThumbnail(tabId: number): Promise<File | null> {
  // Attempt 1: try without disturbing focus — avoids yanking the user to another tab.
  // Attempt 2 (retry): force window/tab focus first, then try again (fixes sites like
  // Facebook where captureVisibleTab only works on the active, focused tab).
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      // Only force focus on the retry, not on the first try.
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        await chrome.tabs.update(tabId, { active: true });
        await new Promise((resolve) => setTimeout(resolve, 400));
      } catch (_e) {
        // Not fatal — attempt capture anyway.
      }
    }

    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.windowId) break;

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
        quality: 90,
      });

      const base64Data = dataUrl.split(",")[1];
      const binaryData = atob(base64Data);
      const arrayBuffer = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        arrayBuffer[i] = binaryData.charCodeAt(i);
      }
      return new File(
        [new Blob([arrayBuffer], { type: "image/png" })],
        "thumbnail.png",
        { type: "image/png" },
      );
    } catch (e) {
      if (attempt === 0) {
        console.warn("captureThumbnail attempt 1 failed, retrying with focus:", e);
      } else {
        console.warn("captureThumbnail failed after 2 attempts, using placeholder:", e);
      }
    }
  }

  return makePlaceholderThumbnail();
}

/**
 * Converts an ArrayBuffer chunk to a base64 string.
 * Used for transferring binary data over JSON-only port messages.
 */
function arrayBufferChunkToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a thumbnail File (image/png) to a base64 data URL string.
 * Returns null if the file is null.
 */
async function thumbnailToBase64(file: File | null): Promise<string | null> {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferChunkToBase64(buffer);
  return `data:${file.type};base64,${base64}`;
}

/**
 * Generate WACZ from collection, store in memory, and open the register page.
 * The content script (capture-bridge.ts) will connect back via port to receive
 * the file data in chunks and hand it to the page.
 */
async function prepareLocalCapture(
  collId: string,
  pageUrl: string,
  tabId: number,
  recorder?: unknown,
) {
  if (!collId || uploadInProgress.has(collId)) {
    return;
  }

  uploadInProgress.add(collId);

  try {
    const coll = await collLoader.loadColl(collId);
    if (!coll) {
      throw new Error("Collection not found");
    }

    sendUploadStatus(recorder, {
      progress: 40,
      text: "Generando archivos...",
      done: false,
    }, tabId);

    const dl = new Downloader({ coll, format: "wacz" });
    const dlResp = (await dl.download()) as ResponseWithFilename;
    if (!(dlResp instanceof Response)) {
      throw new Error("Failed to generate WACZ response");
    }

    const filename = ensureWaczFilename(dlResp.filename, collId);

    // Stream the WACZ body reporting real read progress (40% → 70%)
    let blob: Blob;
    if (dlResp.body) {
      const contentLength = parseInt(dlResp.headers.get("content-length") || "0", 10);
      const reader = dlResp.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (contentLength > 0) {
          const readPct = Math.min(received / contentLength, 1);
          const mapped = Math.round(40 + readPct * 30); // 40 → 70
          sendUploadStatus(recorder, {
            progress: mapped,
            text: `Generando archivo (${Math.round(readPct * 100)}\u00a0%)...`,
            done: false,
          }, tabId);
        }
      }

      const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      blob = new Blob([merged]);
    } else {
      blob = await dlResp.blob();
    }

    sendUploadStatus(recorder, {
      progress: 75,
      text: "Preparando captura...",
      done: false,
    }, tabId);

    const sourceUrl = await resolveCapturedSourceUrl(tabId, pageUrl);
    if (!sourceUrl) {
      throw new Error("captured_url_missing");
    }

    const pageText = await getPageText(tabId);
    const thumbnailFile = await captureThumbnail(tabId);
    const truncatedText = pageText.slice(0, 100_000);
    const thumbnailBase64 = await thumbnailToBase64(thumbnailFile);

    // Store the capture in memory for the content script to pick up
    const captureId = crypto.randomUUID();
    const arrayBuffer = await blob.arrayBuffer();
    pendingCaptures.set(captureId, {
      arrayBuffer,
      filename,
      url: sourceUrl,
      text: truncatedText,
      thumbnailBase64,
    });

    // Auto-expire after 30 minutes to prevent memory leaks
    setTimeout(() => { pendingCaptures.delete(captureId); }, 30 * 60 * 1000);

    sendUploadStatus(recorder, {
      progress: 85,
      text: "Abriendo formulario de registro...",
      done: false,
    }, tabId);

    const baseUrl = await getApiBaseUrl();
    const registerUrl = `${baseUrl}/hemeroteca/register?captureId=${captureId}`;
    await chrome.tabs.create({ url: registerUrl });

    sendUploadStatus(recorder, {
      progress: 100,
      text: "Formulario abierto. Completa los datos y guarda.",
      done: true,
    }, tabId);

    console.log(`Local capture ready for collection ${collId}, captureId=${captureId}`);

    // Clean up local collection
    await collLoader.deleteColl(collId);

    if (tabId) {
      await removeLocalOption(`${tabId}-collId`);
    }

    const metadata = { title: "Mi Archivado" };
    const next = await collLoader.initNewColl(metadata);
    if (next?.name) {
      defaultCollId = next.name;
      await setLocalOption("defaultCollId", defaultCollId);
    }
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : String(e || "unknown_error");

    let userFacingError: string;

    if (msg.includes("recorder_flush_timeout")) {
      userFacingError = "La captura tardó demasiado en cerrar. Intenta con una página más pequeña.";
    } else if (msg.includes("captured_url_missing")) {
      userFacingError = "No se pudo obtener la URL de la página archivada.";
    } else if (msg.includes("chrome_scripting_unavailable")) {
      userFacingError = "Permiso de scripting no disponible. Recarga la extensión.";
    } else {
      console.warn("Capture preparation failed:", msg);
      userFacingError = "Error al preparar la captura.";
    }

    sendUploadStatus(recorder, {
      progress: 100,
      text: userFacingError,
      done: true,
      error: true,
    }, tabId);
  } finally {
    uploadInProgress.delete(collId);
  }
}

/**
 * Handle port connections from the capture-bridge content script.
 * Streams the WACZ file as base64 chunks over the port.
 */
// @ts-expect-error - TS7006 - Parameter 'port' implicitly has an 'any' type.
chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("capture-transfer:")) return;

  const captureId = port.name.slice("capture-transfer:".length);

  port.onMessage.addListener((msg: Record<string, unknown>) => {
    if (msg.type !== "get-capture") return;

    const capture = pendingCaptures.get(captureId);
    if (!capture) {
      port.postMessage({ type: "error", error: "Captura no encontrada o expirada." });
      port.disconnect();
      return;
    }

    // Send metadata first
    port.postMessage({
      type: "metadata",
      url: capture.url,
      text: capture.text,
      filename: capture.filename,
      thumbnailBase64: capture.thumbnailBase64,
    });

    // Send file data in base64 chunks
    const buffer = capture.arrayBuffer;
    const totalChunks = Math.ceil(buffer.byteLength / TRANSFER_CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * TRANSFER_CHUNK_SIZE;
      const end = Math.min(start + TRANSFER_CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(start, end);
      const base64 = arrayBufferChunkToBase64(chunk);
      port.postMessage({ type: "chunk", index: i, total: totalChunks, data: base64 });
    }

    port.postMessage({ type: "done" });

    // Clean up after successful transfer
    pendingCaptures.delete(captureId);
  });
});

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type.
function toggleBehaviors(tabId) {
  if (self.recorders[tabId]) {
    self.recorders[tabId].toggleBehaviors();
    return true;
  }

  return false;
}

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type.
function isRecording(tabId) {
  // @ts-expect-error - TS2339 - Property 'running' does not exist on type 'BrowserRecorder'.
  return self.recorders[tabId]?.running;
}

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'url' implicitly has an 'any' type.
function isValidUrl(url) {
  return (
    url &&
    (url === "about:blank" ||
      url.startsWith("https:") ||
      url.startsWith("http:"))
  );
}

// ===========================================================================
chrome.runtime.onMessage.addListener(
  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  async (message /*sender, sendResponse*/) => {
    switch (message.msg) {
      case "startNew":
        newRecUrl = message.url;
        newRecCollId = message.collId;
        autorun = message.autorun;
        defaultCollId = await getLocalOption("defaultCollId");
        chrome.tabs.create({ url: "about:blank" });
        break;

      case "disableCSP":
        disableCSPForTab(message.tabId);
        break;
    }
  },
);

// ===========================================================================
// @ts-expect-error - TS7006 - Parameter 'tabId' implicitly has an 'any' type.
async function disableCSPForTab(tabId) {
  if (disabledCSPTabs.has(tabId)) {
    return;
  }

  await new Promise((resolve) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      // @ts-expect-error - TS2794 - Expected 1 arguments, but got 0. Did you forget to include 'void' in your type argument to 'Promise'?
      resolve();
    });
  });

  await new Promise((resolve) => {
    chrome.debugger.sendCommand(
      { tabId },
      "Page.setBypassCSP",
      { enabled: true },
      // @ts-expect-error - TS7006 - Parameter 'resp' implicitly has an 'any' type.
      (resp) => resolve(resp),
    );
  });

  disabledCSPTabs.add(tabId);

  // hacky: don't detach if any recorders are running, otherwise will disconnect
  for (const rec of Object.values(self.recorders)) {
    // @ts-expect-error - TS2339 - Property 'running' does not exist on type 'BrowserRecorder'.
    if (rec.running) {
      return;
    }
  }

  await new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      // @ts-expect-error - TS2794 - Expected 1 arguments, but got 0. Did you forget to include 'void' in your type argument to 'Promise'?
      resolve();
    });
  });
}

// ===========================================================================
chrome.runtime.onInstalled.addListener(main);

if (self.importScripts) {
  self.importScripts("sw.js");
}
