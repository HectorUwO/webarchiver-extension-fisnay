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
const API_EXTENSION_KEY_STORAGE_KEY = "apiExtensionKey";
const uploadInProgress = new Set<string>();
const PROTECTED_CAPTURE_HOSTS = new Set(["siaikevin.test", "www.siaikevin.test", "siai2"]);

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

async function getApiDraftEndpoint(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(API_BASE_URL_STORAGE_KEY);
    const stored = result?.[API_BASE_URL_STORAGE_KEY];
    if (typeof stored === "string" && /^https?:\/\/.+/.test(stored.trim())) {
      return stored.trim().replace(/\/$/, "") + "/hemeroteca/ext/sources/draft";
    }
  } catch (_e) {
    // ignore storage errors
  }
  return DEFAULT_API_BASE_URL + "/hemeroteca/ext/sources/draft";
}

async function getApiExtensionKey(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(API_EXTENSION_KEY_STORAGE_KEY);
    const stored = result?.[API_EXTENSION_KEY_STORAGE_KEY];
    if (typeof stored === "string") {
      return stored.trim();
    }
  } catch (_e) {
    // ignore storage errors
  }

  return "";
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

function toHttpUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.protocol = "http:";
    return parsed.href;
  } catch (_e) {
    return url;
  }
}

function looksLikeCertificateVerificationPage(status: number, bodyText: string): boolean {
  if (![495, 496, 497, 499].includes(status)) {
    return false;
  }

  const lowered = bodyText.toLowerCase();
  return (
    lowered.includes("problema de verificación del certificado") ||
    lowered.includes("problema de verificacion del certificado") ||
    lowered.includes("certificate verification") ||
    lowered.includes("kaspersky")
  );
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
// Keep local data until the user finishes the final web form save.
const AUTO_DELETE_LOCAL_AFTER_UPLOAD = false;

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
      await uploadCollectionToApi(collId, pageUrl, tabId, recorder);
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
      tabId: (targetTabId as number) || 0,
    };
  } else {
    // Keep the final (done) state briefly so the popup can read it on reconnect,
    // then clear after 10 s so the next recording is not blocked.
    globalUploadStatus = {
      progress,
      text,
      done,
      error,
      tabId: (targetTabId as number) || 0,
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
    `en finalizar (pending=${(rec as any).numPending ?? '?'}). ` +
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

async function postDraftForm(
  formData: FormData,
  endpoint: string,
  extensionKey: string,
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<Response> {
  // Service workers don't have XMLHttpRequest; use fetch and simulate progress
  // by ticking a fake counter until the request resolves.
  let simulationTimer: ReturnType<typeof setInterval> | null = null;
  let simulatedLoaded = 0;

  if (onUploadProgress) {
    // Estimate total bytes from FormData entries (best-effort)
    let estimatedTotal = 0;
    for (const value of (formData as any).values()) {
      if (value instanceof Blob) {
        estimatedTotal += value.size;
      } else if (typeof value === "string") {
        estimatedTotal += value.length;
      }
    }
    if (estimatedTotal === 0) estimatedTotal = 5 * 1024 * 1024; // 5 MB fallback

    // Tick every 200 ms; advance ~4 % of remaining distance toward 95 %
    simulationTimer = setInterval(() => {
      const remaining = estimatedTotal * 0.95 - simulatedLoaded;
      simulatedLoaded += remaining * 0.08;
      onUploadProgress(Math.round(simulatedLoaded), estimatedTotal);
    }, 200);
  }

  const doFetch = async (targetEndpoint: string) => {
    return await fetch(targetEndpoint, {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(extensionKey ? { "X-Hemeroteca-Extension-Key": extensionKey } : {}),
      },
      body: formData,
    });
  };

  try {
    let resp = await doFetch(endpoint);

    if (!resp.ok && endpoint.startsWith("https://")) {
      const previewText = await resp.clone().text();
      if (looksLikeCertificateVerificationPage(resp.status, previewText)) {
        const insecureEndpoint = toHttpUrl(endpoint);
        console.warn("HTTPS certificate verification failed, retrying upload over HTTP:", insecureEndpoint);
        resp = await doFetch(insecureEndpoint);
      }
    }

    if (simulationTimer !== null) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
    // Report 100 % on completion
    if (onUploadProgress) {
      const total = simulatedLoaded > 0 ? simulatedLoaded / 0.95 : 1;
      onUploadProgress(Math.round(total), Math.round(total));
    }

    return resp;
  } catch (err) {
    if (simulationTimer !== null) {
      clearInterval(simulationTimer);
    }
    const msg = (err instanceof Error) ? err.message.toLowerCase() : "";
    if (msg.includes("abort")) throw new Error("upload_aborted");
    if (msg.includes("timeout")) throw new Error("upload_timeout");
    if (endpoint.startsWith("https://")) {
      try {
        const insecureEndpoint = toHttpUrl(endpoint);
        console.warn("Upload fetch failed over HTTPS, retrying over HTTP:", insecureEndpoint);
        return await doFetch(insecureEndpoint);
      } catch (_retryError) {
        // fall through to normalized error below
      }
    }
    throw new Error("network_error_during_upload");
  }
}

async function readDraftResponseData(resp: Response) {
  const text = await resp.text();
  const contentType = resp.headers.get("content-type") || "";

  if (!text) {
    return { text: "", data: null };
  }

  if (contentType.includes("application/json")) {
    return { text, data: JSON.parse(text) };
  }

  try {
    return { text, data: JSON.parse(text) };
  } catch (_e) {
    return { text, data: null };
  }
}

function extractDraftResult(data: unknown) {
  const asString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : "";

  const root = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const nested =
    (root.data as Record<string, unknown>) ||
    (root.result as Record<string, unknown>) ||
    (root.payload as Record<string, unknown>) ||
    (root.attributes as Record<string, unknown>) ||
    {};

  const rawOpenUrl = asString(
    root.openUrl ||
    root.open_url ||
    root.url ||
    root.formUrl ||
    root.form_url ||
    nested.openUrl ||
    nested.open_url ||
    nested.url ||
    nested.formUrl ||
    nested.form_url,
  );

  const draftToken = asString(
    root.draftToken ||
    root.draft_token ||
    root.token ||
    nested.draftToken ||
    nested.draft_token ||
    nested.token,
  );

  return { rawOpenUrl, draftToken };
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

async function uploadCollectionToApi(
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

    // Stream the WACZ body reporting real read progress (40% → 65%)
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
          const mapped = Math.round(40 + readPct * 20); // 40 → 60
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
      progress: 62,
      text: "Preparando datos para enviar...",
      done: false,
    }, tabId);

    const sourceUrl = await resolveCapturedSourceUrl(tabId, pageUrl);
    if (!sourceUrl) {
      throw new Error("captured_url_missing");
    }

    const pageText = await getPageText(tabId);
    const thumbnailFile = await captureThumbnail(tabId);
    const endpoint = await getApiDraftEndpoint();
    const extensionKey = await getApiExtensionKey();

    // Truncate to avoid sending megabytes of text for heavy pages.
    // Backend validation also enforces max:100000.
    const truncatedText = pageText.slice(0, 100_000);

    const formData = new FormData();
    formData.append("url", sourceUrl);
    formData.append("text", truncatedText);
    if (thumbnailFile) {
      formData.append("thumbnailFile", thumbnailFile);
    }
    formData.append(
      "waczFile",
      new File([blob], filename, { type: "application/octet-stream" }),
    );

    sendUploadStatus(recorder, {
      progress: 65,
      text: "Subiendo al servidor (0\u00a0%)...",
      done: false,
    }, tabId);

    const resp = await postDraftForm(formData, endpoint, extensionKey, (loaded, total) => {
      // Map real HTTP upload progress: 65% → 93%
      const pct = total > 0 ? Math.min(loaded / total, 1) : 0;
      const mapped = Math.round(65 + pct * 28);
      sendUploadStatus(recorder, {
        progress: mapped,
        text: `Subiendo al servidor (${Math.round(pct * 100)}\u00a0%)...`,
        done: false,
      }, tabId);
    });
    const { text: respText, data } = await readDraftResponseData(resp);

    if (!resp.ok) {
      const errorBody = data ? JSON.stringify(data) : respText;
      console.error("Draft upload failed", resp.status, errorBody);
      if (resp.status === 419) {
        throw new Error(`csrf_token_expired_419 (status ${resp.status}): ${errorBody}`);
      }
      if (resp.status === 401 || resp.status === 403) {
        const looksLikeUnauthenticated = /Unauthenticated|unauthenticated/i.test(errorBody);
        const authCause = looksLikeUnauthenticated
          ? "session_or_cookie_missing"
          : "user_permission_or_auth_required";
        throw new Error(
          `auth_required_${resp.status}_${authCause} (status ${resp.status}): ${errorBody}`,
        );
      }
      throw new Error(`API ${resp.status}: ${errorBody}`);
    }

    const { rawOpenUrl, draftToken } = extractDraftResult(data);

    if (!rawOpenUrl || !draftToken) {
      const payload = data ? JSON.stringify(data) : respText;
      throw new Error(`draft_response_missing_openUrl_or_draftToken: ${payload}`);
    }

    const openUrl = /^https?:\/\//i.test(rawOpenUrl)
      ? rawOpenUrl
      : new URL(rawOpenUrl, endpoint).href;

    sendUploadStatus(recorder, {
      progress: 95,
      text: "Subida completada. Abriendo formulario del servidor...",
      done: false,
    }, tabId);

    await chrome.tabs.create({ url: openUrl });

    sendUploadStatus(recorder, {
      progress: 100,
      text: "Formulario abierto en el servidor.",
      done: true,
    }, tabId);

    console.log(`Draft form opened for collection ${collId}`);

    if (AUTO_DELETE_LOCAL_AFTER_UPLOAD) {
      await collLoader.deleteColl(collId);
    } else {
      // Always delete the used collection after a successful upload so
      // the next recording starts clean and doesn't accumulate pages.
      await collLoader.deleteColl(collId);
    }

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
      console.warn("Recorder flush timed out before WACZ could be generated.");
      userFacingError = "La captura tardó demasiado en cerrar. Intenta con una página más pequeña o un equipo menos cargado.";
    } else if (msg.includes("captured_url_missing")) {
      console.warn("No se pudo obtener la URL capturada de la pestana.");
      userFacingError = "No se pudo obtener la URL de la página archivada.";
    } else if (msg.includes("csrf_token_expired_419")) {
      console.warn("Source upload failed with 419 (Page Expired). La sesion existe pero la ruta requiere CSRF.");
      userFacingError = "Sesión expirada (419). Recarga la página del servidor y vuelve a intentar.";
    } else if (
      msg.includes("auth_required_401_session_or_cookie_missing") ||
      msg.includes("auth_required_403_session_or_cookie_missing")
    ) {
      console.warn("Source upload failed: no viajo laravel_session en la solicitud al backend.");
      userFacingError = "Sesión no detectada. Verifica en Network que la request draft incluya Cookie con laravel_session.";
    } else if (
      msg.includes("auth_required_401_user_permission_or_auth_required") ||
      msg.includes("auth_required_403_user_permission_or_auth_required")
    ) {
      console.warn("Source upload failed: autenticado pero sin permiso para crear draft.");
      userFacingError = "El usuario autenticado no tiene permisos para crear borradores en el servidor.";
    } else if (msg.includes("auth_required_401") || msg.includes("auth_required_403")) {
      console.warn("Source upload failed: sesion/clave de extensión inválida en backend.");
      userFacingError = "No autorizado. Verifica apiBaseUrl y apiExtensionKey de la extensión.";
    } else if (msg.includes("api 499:") || msg.includes("certificate verification")) {
      console.warn("Source upload failed due to HTTPS certificate verification.");
      userFacingError = "Fallo de certificado HTTPS. Configura la extensión con http://siaikevin.test o instala un certificado confiable.";
    } else if (msg.includes("draft_response_missing_openUrl_or_draftToken")) {
      console.warn("Draft response is missing openUrl or draftToken. Payload:", msg);
      userFacingError = "El servidor respondió con un formato inesperado.";
    } else if (msg.includes("chrome_scripting_unavailable")) {
      console.warn("chrome.scripting is unavailable. Reload the extension after granting the scripting permission.");
      userFacingError = "Permiso de scripting no disponible. Recarga la extensión.";
    } else {
      console.warn("Source upload failed:", msg);
      userFacingError = "Error al subir el archivo al servidor.";
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
