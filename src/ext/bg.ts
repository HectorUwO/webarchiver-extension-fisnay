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
const API_DRAFT_ENDPOINT = "http://localhost:8000/hemeroteca/api/sources/draft";
const uploadInProgress = new Set<string>();
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
      popupHandler(port);
      break;
  }
});

// @ts-expect-error - TS7006 - Parameter 'port' implicitly has an 'any' type.
function popupHandler(port) {
  if (!port.sender || port.sender.url !== chrome.runtime.getURL("popup.html")) {
    return;
  }

  // @ts-expect-error - TS7034 - Variable 'tabId' implicitly has type 'any' in some locations where its type cannot be determined.
  let tabId = null;

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  port.onMessage.addListener(async (message) => {
    switch (message.type) {
      case "startUpdates":
        tabId = message.tabId;
        if (self.recorders[tabId]) {
          // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'BrowserRecorder'.
          self.recorders[tabId].port = port;
          self.recorders[tabId].doUpdateStatus();
        }
        port.postMessage(await listAllMsg(collLoader));
        break;

      case "startRecording": {
        const { collId, autorun } = message;
        // @ts-expect-error - TS2554 - Expected 2 arguments, but got 3.
        startRecorder(tabId, { collId, port, autorun }, message.url);
        break;
      }

      case "stopRecording":
        // @ts-expect-error - TS7005 - Variable 'tabId' implicitly has an 'any' type.
        await stopRecorder(tabId, { triggerDraft: true });
        break;

      case "toggleBehaviors":
        // @ts-expect-error - TS7005 - Variable 'tabId' implicitly has an 'any' type.
        toggleBehaviors(tabId);
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

  recorder.detach();

  try {
    await waitForRecorderToFlush(recorder);
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'BrowserRecorder'.
    const collId = recorder.collId;
    // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'BrowserRecorder'.
    const pageUrl = recorder.pageUrl;
    if (triggerDraft) {
      await uploadCollectionToApi(collId, pageUrl, tabId);
    }
  } catch (e) {
    console.warn("API upload failed:", e);
  }

  return true;
}

async function waitForRecorderToFlush(recorder: unknown, timeoutMs = 20000) {
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

async function postDraftForm(formData: FormData) {
  return await fetch(API_DRAFT_ENDPOINT, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    redirect: "follow",
  });
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

async function captureThumbnail(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.windowId) {
    throw new Error("thumbnail_window_missing");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
    quality: 100,
  });

  const base64Data = dataUrl.split(",")[1];
  const binaryData = atob(base64Data);
  const arrayBuffer = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    arrayBuffer[i] = binaryData.charCodeAt(i);
  }

  const blob = new Blob([arrayBuffer], { type: "image/png" });
  return new File([blob], "thumbnail.png", { type: "image/png" });
}

async function uploadCollectionToApi(
  collId: string,
  pageUrl: string,
  tabId: number,
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

    const dl = new Downloader({ coll, format: "wacz" });
    const dlResp = (await dl.download()) as ResponseWithFilename;
    if (!(dlResp instanceof Response)) {
      throw new Error("Failed to generate WACZ response");
    }

    const filename = ensureWaczFilename(dlResp.filename, collId);
    const blob = await dlResp.blob();

    const sourceUrl = await resolveCapturedSourceUrl(tabId, pageUrl);
    if (!sourceUrl) {
      throw new Error("captured_url_missing");
    }

    const pageText = await getPageText(tabId);
    const thumbnailFile = await captureThumbnail(tabId);

    const formData = new FormData();
    formData.append("url", sourceUrl);
    formData.append("text", pageText);
    formData.append("thumbnailFile", thumbnailFile);
    formData.append(
      "waczFile",
      new File([blob], filename, { type: "application/octet-stream" }),
    );

    const resp = await postDraftForm(formData);
    const { text: respText, data } = await readDraftResponseData(resp);

    if (!resp.ok) {
      const errorBody = data ? JSON.stringify(data) : respText;
      console.error("Draft upload failed", resp.status, errorBody);
      if (resp.status === 419) {
        throw new Error(`csrf_token_expired_419 (status ${resp.status}): ${errorBody}`);
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(`auth_required_${resp.status} (status ${resp.status}): ${errorBody}`);
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
      : new URL(rawOpenUrl, API_DRAFT_ENDPOINT).href;

    await chrome.tabs.create({ url: openUrl });

    console.log(`Draft form opened for collection ${collId}`);

    if (AUTO_DELETE_LOCAL_AFTER_UPLOAD) {
      await collLoader.deleteColl(collId);

      if (tabId) {
        await removeLocalOption(`${tabId}-collId`);
      }

      const metadata = { title: "My Archiving Session" };
      const next = await collLoader.initNewColl(metadata);
      if (next?.name) {
        defaultCollId = next.name;
        await setLocalOption("defaultCollId", defaultCollId);
      }
    }
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : String(e || "unknown_error");

    if (msg.includes("captured_url_missing")) {
      console.warn("No se pudo obtener la URL capturada de la pestana.");
    } else if (msg.includes("csrf_token_expired_419")) {
      console.warn("Source upload failed with 419 (Page Expired). La sesion existe pero la ruta requiere CSRF; el backend debe excluir /hemeroteca/sources del middleware CSRF o aceptar este flujo.");
    } else if (msg.includes("auth_required_401") || msg.includes("auth_required_403")) {
      console.warn("Source upload failed: sesion no valida en el dominio del backend. Inicia sesion en ese dominio y vuelve a intentar.");
    } else if (msg.includes("draft_response_missing_openUrl_or_draftToken")) {
      console.warn("Draft response is missing openUrl or draftToken. Payload:", msg);
    } else if (msg.includes("chrome_scripting_unavailable")) {
      console.warn("chrome.scripting is unavailable. Reload the extension after granting the scripting permission.");
    } else {
      console.warn("Source upload failed:", msg);
    }
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
