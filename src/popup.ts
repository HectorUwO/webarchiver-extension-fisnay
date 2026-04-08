import { LitElement, html, css, unsafeCSS } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import bulma from "bulma/bulma.sass";

import fasPlus from "@fortawesome/fontawesome-free/svgs/solid/plus.svg";
import fasBox from "@fortawesome/fontawesome-free/svgs/solid/square.svg";
import fasCheck from "@fortawesome/fontawesome-free/svgs/solid/check.svg";
import fasX from "@fortawesome/fontawesome-free/svgs/solid/times.svg";
import fasCaretDown from "@fortawesome/fontawesome-free/svgs/solid/caret-down.svg";

import fiscaliaLogo from "./assets/brand/fiscalia-icon-color.svg";

import prettyBytes from "pretty-bytes";

import {
  getLocalOption,
  removeLocalOption,
  setLocalOption,
} from "./localstorage";

const allCss = unsafeCSS(bulma);
// @ts-expect-error - TS7006 - Parameter 'custom' implicitly has an 'any' type.
function wrapCss(custom) {
  return [allCss, custom];
}

// ===========================================================================
class RecPopup extends LitElement {
  constructor() {
    super();

    // @ts-expect-error - TS2339 - Property 'collections' does not exist on type 'RecPopup'.
    this.collections = [];
    // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
    this.collTitle = "";
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
    this.collId = "";

    // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
    this.tabId = 0;
    // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
    this.recording = false;
    // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
    this.status = null;

    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port = null;

    // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
    this.pageUrl = "";
    // @ts-expect-error - TS2339 - Property 'pageTs' does not exist on type 'RecPopup'.
    this.pageTs = 0;
    // @ts-expect-error - TS2339 - Property 'replayUrl' does not exist on type 'RecPopup'.
    this.replayUrl = "";

    // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'.
    this.canRecord = false;
    // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
    this.failureMsg = null;

    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    this.collDrop = "";

    // @ts-expect-error - TS2339 - Property 'allowCreate' does not exist on type 'RecPopup'.
    this.allowCreate = true;

    // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
    this.waitingForStart = false;
    // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
    this.waitingForStop = false;

    // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
    this.uploadActive = false;
    // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
    this.uploadProgress = 0;
    // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
    this.uploadMessage = "";
    // @ts-expect-error - TS2339 - Property 'uploadError' does not exist on type 'RecPopup'.
    this.uploadError = false;
    // @ts-expect-error - TS2339 - Property 'uploadErrorMessage' does not exist on type 'RecPopup'.
    this.uploadErrorMessage = "";

    // @ts-expect-error - TS2339 - Property 'serverUrl' does not exist on type 'RecPopup'.
    this.serverUrl = "";
    // @ts-expect-error - TS2339 - Property 'showServerSettings' does not exist on type 'RecPopup'.
    this.showServerSettings = false;
    // @ts-expect-error - TS2339 - Property 'uploadSourceTabId' does not exist on type 'RecPopup'.
    this.uploadSourceTabId = 0;
  }

  static get properties() {
    return {
      collections: { type: Array },
      collId: { type: String },
      collTitle: { type: String },
      collDrop: { type: String },

      recording: { type: Boolean },
      status: { type: Object },
      waitingForStart: { type: Boolean },
      uploadActive: { type: Boolean },
      uploadProgress: { type: Number },
      uploadMessage: { type: String },
      uploadError: { type: Boolean },
      uploadErrorMessage: { type: String },
      uploadSourceTabId: { type: Number },

      serverUrl: { type: String },
      showServerSettings: { type: Boolean },

      replayUrl: { type: String },
      pageUrl: { type: String },
      pageTs: { type: Number },

      canRecord: { type: Boolean },
      failureMsg: { type: String },
    };
  }

  firstUpdated() {
    console.log("Hecho por Hector Medrano :D");

    document.addEventListener("click", () => {
      // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
      if (this.collDrop === "show") {
        // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
        this.collDrop = "";
      }
    });

    this.registerMessages();
  }

  registerMessages() {
    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port = chrome.runtime.connect({ name: "popup-port" });

    // @ts-expect-error - TS7006 - Parameter 'tabs' implicitly has an 'any' type.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length) {
        // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
        this.tabId = tabs[0].id;
        // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
        this.pageUrl = tabs[0].url;
        // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'. | TS7006 - Parameter 'result' implicitly has an 'any' type.
        chrome.action.getTitle({ tabId: this.tabId }, (result) => {
          // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
          this.recording = result.indexOf("Recording:") >= 0;
        });

        // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
        this.sendMessage({ tabId: this.tabId, type: "startUpdates" });
      }
    });

    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port.onMessage.addListener((message) => {
      this.onMessage(message);
    });

    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port.postMessage({ type: "getApiBaseUrl" });
  }

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  sendMessage(message) {
    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port.postMessage(message);
  }

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  async onMessage(message) {
    switch (message.type) {
      case "status": {
        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
        this.recording = message.recording;
        // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
        if (this.waitingForStart && message.firstPageStarted) {
          // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
          this.waitingForStart = false;
        }
        // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
        const waitingForStop = this.waitingForStop;
        // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
        const uploadActive = this.uploadActive;

        if (waitingForStop && !message.recording && !message.stopping && !uploadActive) {
          // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
          this.waitingForStop = false;
        }
        // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
        this.status = message;
        if (message.pageUrl) {
          // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
          this.pageUrl = message.pageUrl;
        }
        if (message.pageTs) {
          // @ts-expect-error - TS2339 - Property 'pageTs' does not exist on type 'RecPopup'.
          this.pageTs = message.pageTs;
        }
        // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
        this.failureMsg = message.failureMsg;
        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
        if (this.recording) {
          // Only clear upload state if this status update is for the same tab
          // that owns the upload; otherwise we'd wipe a cross-tab upload display.
          // @ts-expect-error - TS2339 - Property 'uploadSourceTabId' does not exist on type 'RecPopup'. | TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
          const uploadIsThisTab = !this.uploadSourceTabId || this.uploadSourceTabId === this.tabId;
          if (uploadIsThisTab) {
            // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
            this.uploadActive = false;
            // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
            this.uploadProgress = 0;
            // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
            this.uploadMessage = "";
          }
        }
        // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
        if (this.collId !== message.collId) {
          // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          this.collId = message.collId;
          // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'. | TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          this.collTitle = this.findTitleFor(this.collId);
          // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'. | TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          await setLocalOption(`${this.tabId}-collId`, this.collId);
        }
        break;
      }

      case "uploadStatus": {
        // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
        this.uploadActive = !message.done;
        // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
        this.uploadProgress = Math.max(0, Math.min(100, message.progress || 0));
        // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
        this.uploadMessage = message.text || "Subiendo archivo...";
        // Track which tab owns this upload so we don't accidentally clear it.
        if (!message.done && message.tabId) {
          // @ts-expect-error - TS2339 - Property 'uploadSourceTabId' does not exist on type 'RecPopup'.
          this.uploadSourceTabId = message.tabId;
        }

        if (message.done) {
          // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
          this.waitingForStop = false;
          if (message.error) {
            // @ts-expect-error - TS2339 - Property 'uploadError' does not exist on type 'RecPopup'.
            this.uploadError = true;
            // @ts-expect-error - TS2339 - Property 'uploadErrorMessage' does not exist on type 'RecPopup'.
            this.uploadErrorMessage = message.text || "Error al subir el archivo al servidor.";
          }
          // @ts-expect-error - TS2339 - Property 'uploadSourceTabId' does not exist on type 'RecPopup'.
          this.uploadSourceTabId = 0;
        }
        break;
      }

      case "apiBaseUrl": {
        // @ts-expect-error - TS2339 - Property 'serverUrl' does not exist on type 'RecPopup'.
        this.serverUrl = typeof message.url === "string" ? message.url : "";
        break;
      }

      case "collections":
        // @ts-expect-error - TS2339 - Property 'collections' does not exist on type 'RecPopup'.
        this.collections = message.collections;
        // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'. | TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
        this.collId = await getLocalOption(`${this.tabId}-collId`);
        // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
        this.collTitle = "";
        // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
        if (this.collId) {
          // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'. | TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          this.collTitle = this.findTitleFor(this.collId);
        }
        // may no longer be valid, try default id
        // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
        if (!this.collTitle) {
          // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          this.collId = message.collId;
          // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'. | TS2339 - Property 'collId' does not exist on type 'RecPopup'.
          this.collTitle = this.findTitleFor(this.collId);
        }
        // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
        if (!this.collTitle) {
          // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
          this.collTitle = "[Sin título]";
        }
        break;
    }
  }

  // @ts-expect-error - TS7006 - Parameter 'match' implicitly has an 'any' type.
  findTitleFor(match) {
    if (!match) {
      return "";
    }
    // @ts-expect-error - TS2339 - Property 'collections' does not exist on type 'RecPopup'.
    for (const coll of this.collections) {
      if (coll.id === match) {
        return coll.title;
      }
    }

    return "";
  }

  // @ts-expect-error - TS7006 - Parameter 'changedProperties' implicitly has an 'any' type.
  updated(changedProperties) {
    if (
      changedProperties.has("pageUrl") ||
      changedProperties.has("failureMsg")
    ) {
      // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'.
      this.canRecord =
        // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
        this.pageUrl &&
        // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
        (this.pageUrl === "about:blank" ||
          // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
          this.pageUrl.startsWith("http:") ||
          // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
          this.pageUrl.startsWith("https:"));
    }
  }

  get extRoot() {
    return chrome.runtime.getURL("");
  }

  get notRecordingMessage() {
    return "Esperando para archivar esta pestaña";
  }

  static get styles() {
    return wrapCss(css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 16px;
        overflow: hidden;
        font-size: initial !important;
        color: #0f172a;
        font-family: "Nunito Sans", "Segoe UI", sans-serif;
        --accent-color: #8f7f67;
        --accent-color-hover: #7c6e58;
        --accent-soft-bg: #f2eee8;
        --accent-soft-border: #d7cdbf;
        --accent-soft-text: #6d5f4c;
      }

      * {
        box-sizing: border-box;
      }

      .shell {
        background: #f3f4f6;
        padding: 14px;
        min-height: 100vh;
        border-radius: inherit;
      }

      .container {
        border: 1px solid #d9dde3;
        border-radius: 14px;
        background: #ffffff;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        padding: 12px;
      }

      .brand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .brand-title {
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }

      .brand-subtitle {
        margin-top: 2px;
        color: #64748b;
        font-size: 0.8rem;
      }

      .brand-logo-wrap {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(145deg, #ffffff, #f1f5f9);
        border: 1px solid #d9dde3;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
      }

      .brand-logo {
        width: 38px;
        height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .status-row {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 9px 10px;
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
      }

      .view-row {
        display: flex;
        gap: 8px;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
      }

      .rec-state {
        margin-right: 1em;
        flex: auto;
        font-size: 0.83rem;
        line-height: 1.35;
      }

      .pill {
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        padding: 3px 8px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #475569;
        white-space: nowrap;
      }

      .pill.is-recording {
        color: #166534;
        border-color: #86efac;
        background: #f0fdf4;
      }

      .pill.is-unarchivable {
        color: #991b1b;
        border-color: #fecaca;
        background: #fef2f2;
      }

      .pill.is-uploading {
        color: var(--accent-soft-text);
        border-color: var(--accent-soft-border);
        background: var(--accent-soft-bg);
      }

      .upload-wrap {
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
      }

      .upload-text {
        color: var(--accent-soft-text);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .upload-track {
        width: 100%;
        height: 7px;
        border-radius: 999px;
        background: var(--accent-soft-bg);
        border: 1px solid var(--accent-soft-border);
        overflow: hidden;
      }

      .upload-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--accent-color),
          var(--accent-color-hover)
        );
        transition: width 0.2s ease;
      }

      .upload-percent {
        color: var(--accent-soft-text);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .coll-select {
        display: flex;
        gap: 8px;
        align-items: center;
        flex: 1;
        min-width: 0;
      }

      .coll-select .is-size-7 {
        color: #64748b;
        font-size: 0.74rem !important;
        white-space: nowrap;
      }

      .dropdown-item {
        width: initial !important;
        font-size: 0.85rem;
      }

      .coll.button {
        max-width: 180px;
        background: #fff;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        min-height: 34px;
      }

      .dropdown-menu {
        min-width: 220px;
      }

      .dropdown-content {
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 8px 24px rgba(2, 6, 23, 0.1);
      }

      .coll.button span {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }

      .button {
        min-height: 34px !important;
        border-radius: 10px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #0f172a;
        padding: 0 10px;
        font-size: 0.83rem;
      }

      .button:hover {
        border-color: #94a3b8;
        background: #f8fafc;
      }

      .button:disabled {
        opacity: 0.6;
      }

      .action-button {
        background: var(--accent-color);
        color: #fff;
        border-color: var(--accent-color);
      }

      .action-button:hover {
        background: var(--accent-color-hover);
        color: #fff;
        border-color: var(--accent-color-hover);
      }

      .capture-btn {
        min-height: 40px !important;
        border-radius: 10px;
        border: 1px solid #1f3a5f;
        padding: 0 14px;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.16);
        transition: background-color 0.15s ease, border-color 0.15s ease,
          color 0.15s ease;
      }

      .capture-btn.is-start {
        background: var(--accent-color);
        border-color: var(--accent-color);
        color: #ffffff;
      }

      .capture-btn.is-stop {
        background: #7f1d1d;
        border-color: #7f1d1d;
        color: #ffffff;
      }

      .capture-btn:hover {
        background: var(--accent-color-hover);
        border-color: var(--accent-color-hover);
      }

      .capture-btn.is-stop:hover {
        background: #8f2424;
        border-color: #8f2424;
      }

      .capture-btn:disabled {
        background: #94a3b8;
        border-color: #94a3b8;
        box-shadow: none;
        color: #e2e8f0;
      }

      .smallest.button {
        margin: 0;
        background-color: #fff;
        padding: 6px 10px;
      }

      .flex-form {
        display: flex;
        gap: 6px;
        align-items: center;
        width: 100%;
        flex-wrap: wrap;
      }

      .flex-form > * {
        padding: 0;
      }

      .session-head {
        font-size: 0.8rem;
        color: #475569;
        font-weight: 700;
      }

      .underline {
        margin-top: 14px;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 8px;
      }

      .status th {
        padding-left: 10px;
        color: #0f172a;
      }

      .status {
        width: 100%;
        font-size: 0.8rem;
      }

      .status td,
      .status th {
        border-bottom: 1px solid #edf2f7;
        padding: 6px 0;
      }

      .status-sep {
        border-bottom: 1px solid #94a3b8;
        width: 100%;
        height: 10px;
      }

      .status-ready {
        color: #459558;
        font-style: italic;
      }

      .status-pending {
        color: #bb9f08;
        font-style: italic;
      }
      .error {
        font-size: 12px;
        color: #991b1b;
      }

      .error p {
        margin-bottom: 1em;
      }

      .error-msg {
        font-family: monospace;
        font-style: italic;
      }

      .checkbox {
        font-size: 0.76rem !important;
        color: #334155;
      }

      .input.is-small {
        border-radius: 8px;
        border-color: #cbd5e1;
      }

      form {
        width: 100%;
      }

      .credits {
        margin-top: 10px;
        text-align: center;
        font-size: 0.72rem;
        color: #64748b;
      }

      .upload-error-banner {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
      }

      .upload-error-title {
        font-size: 0.78rem;
        font-weight: 700;
        color: #991b1b;
      }

      .upload-error-msg {
        font-size: 0.75rem;
        color: #7f1d1d;
        line-height: 1.4;
      }

      .upload-error-dismiss {
        align-self: flex-end;
        margin-top: 2px;
        font-size: 0.72rem;
        font-weight: 600;
        color: #991b1b;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        text-decoration: underline;
      }

      .server-settings-wrap {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-top: 8px;
      }

      .server-settings-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #475569;
      }

      .server-settings-row {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .server-settings-input {
        flex: 1;
        font-size: 0.78rem;
        padding: 4px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        min-width: 0;
      }

      .server-settings-btn {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 4px 10px;
        border: 1px solid #94a3b8;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        white-space: nowrap;
      }

      .server-settings-btn:hover {
        background: #f1f5f9;
      }

      .gear-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 0.9rem;
        line-height: 1;
      }

      .gear-btn:hover {
        color: #475569;
        background: #f1f5f9;
      }
    `);
  }

  renderStatus() {
    // @ts-expect-error - TS2339 - Property 'uploadError' does not exist on type 'RecPopup'.
    if (this.uploadError) {
      return html`
        <div class="upload-error-banner">
          <span class="upload-error-title">⚠ Error al subir</span>
          <span class="upload-error-msg">${
            // @ts-expect-error - TS2339 - Property 'uploadErrorMessage' does not exist on type 'RecPopup'.
            this.uploadErrorMessage
          }</span>
          <button class="upload-error-dismiss" @click="${() => {
            // @ts-expect-error - TS2339 - Property 'uploadError' does not exist on type 'RecPopup'.
            this.uploadError = false;
            // @ts-expect-error - TS2339 - Property 'uploadErrorMessage' does not exist on type 'RecPopup'.
            this.uploadErrorMessage = "";
          }}">Cerrar</button>
        </div>
      `;
    }

    // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
    if (this.uploadActive) {
      // @ts-expect-error - TS2339 - Property 'uploadSourceTabId' does not exist on type 'RecPopup'. | TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
      const isOtherTab = this.uploadSourceTabId && this.uploadSourceTabId !== this.tabId;
      return html`
        <div class="upload-wrap">
          ${isOtherTab
            ? html`<span class="upload-text" style="color:#64748b;font-style:italic;">Subida en curso en otra pestaña…</span>`
            : html``}
          <span class="upload-text"
            >${
              // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
              this.uploadMessage || "Subiendo archivo al servidor..."
            }</span
          >
          <div class="upload-track">
            <div
              class="upload-fill"
              style="width: ${
                // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
                this.uploadProgress
              }%"
            ></div>
          </div>
          <span class="upload-percent"
            >${
              // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
              this.uploadProgress
            }%</span
          >
        </div>
      `;
    }

    // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
    if (this.recording) {
      return html`<b
          >${
            // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
            this.waitingForStop ? "Finalizando " : ""
          }
          archivado:&nbsp;</b
        >${
          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'. | TS2339 - Property 'status' does not exist on type 'RecPopup'.
          this.status?.numPending
            ? html`
                <span class="status-pending"
                  >${
                    // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                    this.status.numPending
                  }
                  URL
                  pendientes${
                    // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
                    this.waitingForStop
                      ? "."
                      : ", espera antes de cargar una página nueva."
                  }</span
                >
              `
            : html` <span class="status-ready">En espera, continúa navegando</span>`
        }`;
    }

    // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
    if (this.failureMsg) {
      return html`
        <div class="error">
          <p>
            Hubo un error al iniciar el archivado en esta página. Inténtalo de
            nuevo o prueba con otra página.
          </p>
          <p class="error-msg">
            Detalles del error:
            <i
              >${
                // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
                this.failureMsg
              }</i
            >
          </p>
          <p>
            Si el error persiste, revisa la página de
            <a
              href="https://archiveweb.page/guide/troubleshooting/errors"
              target="_blank"
              >errores comunes y soluciones</a
            >
            en la guía para ver problemas conocidos y posibles soluciones.
          </p>
        </div>
      `;
    }

    // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'.
    if (!this.canRecord) {
      // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'. | TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
      if (this.pageUrl?.startsWith(this.extRoot)) {
        return html`
          <p class="is-size-7">
            Esta página es parte de la extensión. Desde aquí puedes ver
            elementos ya archivados. Para iniciar una nueva sesión, pulsa
            "Iniciar archivado" e ingresa una URL nueva.
          </p>
        `;
      }

      return html`<i>No se puede archivar esta página.</i>`;
    }

    // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
    if (this.waitingForStart) {
      return html`<i>El archivado iniciará después de recargar la página...</i>`;
    }

    return html`<i>${this.notRecordingMessage}</i>`;
  }

  renderCollDropdown() {
    return html`
      <div class="coll-select">
        <div class="is-size-7">
          ${
            // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
            this.recording ? "Archivando ahora" : "Guardar"
          }
          en:&nbsp;
        </div>
        <div
          class="dropdown ${
            // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
            this.collDrop === "show" ? "is-active" : ""
          }"
        >
          <div class="dropdown-trigger">
            <button
              @click="${this.onShowDrop}"
              class="coll button is-small"
              aria-haspopup="true"
              aria-controls="dropdown-menu"
              ?disabled="${
                // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                this.recording
              }"
            >
              <span
                >${
                  // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
                  this.collTitle
                }</span
              >
              <span class="icon is-small">
                <wr-icon .src="${fasCaretDown}"></wr-icon>
              </span>
            </button>
          </div>
          ${
            // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
            !this.recording
              ? html` <div class="dropdown-menu" id="dropdown-menu" role="menu">
                  <div class="dropdown-content">
                    ${
                      // @ts-expect-error - TS2339 - Property 'allowCreate' does not exist on type 'RecPopup'.
                      this.allowCreate
                        ? html` <a
                              @click="${
                                // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
                                () => (this.collDrop = "create")
                              }"
                              class="dropdown-item"
                            >
                              <span class="icon is-small">
                                <wr-icon .src="${fasPlus}"></wr-icon> </span
                              >Nueva sesión de archivado
                            </a>
                            <hr class="dropdown-divider" />`
                        : ""
                    }
                    ${
                      // @ts-expect-error - TS2339 - Property 'collections' does not exist on type 'RecPopup'.
                      this.collections.map(
                        // @ts-expect-error - TS7006 - Parameter 'coll' implicitly has an 'any' type.
                        (coll) => html`
                          <a
                            @click=${this.onSelectColl}
                            data-title="${coll.title}"
                            data-id="${coll.id}"
                            class="dropdown-item"
                            >${coll.title}</a
                          >
                        `,
                      )
                    }
                  </div>
                </div>`
              : html``
          }
        </div>
      </div>
    `;
  }

  renderCollCreate() {
    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    if (this.collDrop !== "create") {
      return "";
    }

    return html`
      <div class="view-row is-marginless">
        <form @submit="${this.onNewColl}">
          <div class="flex-form">
            <label for="new-name" class="is-size-7 is-italic"
              >Nueva sesión de archivado:</label
            >
            <div class="control">
              <input
                class="input is-small"
                id="new-name"
                type="text"
                required
                placeholder="Escribe el nombre de la sesión"
              />
            </div>
            <button class="button is-small is-outlined" type="submit">
              <wr-icon .src=${fasCheck}></wr-icon>
            </button>
            <button
              @click="${() =>
                // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
                (this.collDrop = "")}"
              class="button is-small is-outlined"
              type="button"
            >
              <wr-icon .src=${fasX}></wr-icon>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  render() {
    // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'. | TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
    const isUnarchivable = !this.canRecord && !this.pageUrl?.startsWith(this.extRoot);

    return html`
      <div class="shell">
        <div class="brand-row">
          <div>
            <div class="brand-title">Hemeroteca</div>
            <div class="brand-subtitle">Extensión de Archivado Digital</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button
              class="gear-btn"
              title="Configurar URL del servidor"
              @click="${() => {
                // @ts-expect-error - TS2339 - Property 'showServerSettings' does not exist on type 'RecPopup'.
                this.showServerSettings = !this.showServerSettings;
              }}"
            >&#9881;</button>
            <div class="brand-logo-wrap" title="Fiscalia">
              <wr-icon class="brand-logo" size="38px" .src="${fiscaliaLogo}"></wr-icon>
            </div>
          </div>
        </div>

        ${
          // @ts-expect-error - TS2339 - Property 'showServerSettings' does not exist on type 'RecPopup'.
          this.showServerSettings
            ? html`
              <div class="server-settings-wrap">
                <span class="server-settings-label">URL del servidor</span>
                <div class="server-settings-row">
                  <input
                    class="server-settings-input"
                    id="server-url-input"
                    type="url"
                    placeholder="https://siai2/"
                    .value="${
                      // @ts-expect-error - TS2339 - Property 'serverUrl' does not exist on type 'RecPopup'.
                      this.serverUrl
                    }"
                  />
                  <button
                    class="server-settings-btn"
                    @click="${() => {
                      const input = this.renderRoot.querySelector("#server-url-input") as HTMLInputElement | null;
                      const val = input?.value?.trim() ?? "";
                      if (val && /^https?:\/\/.+/.test(val)) {
                        this.sendMessage({ type: "setApiBaseUrl", url: val });
                        // @ts-expect-error - TS2339 - Property 'showServerSettings' does not exist on type 'RecPopup'.
                        this.showServerSettings = false;
                      }
                    }}"
                  >Guardar</button>
                </div>
              </div>
            `
            : html``
        }

        <div class="container">
          <div class="status-row">
            <p class="rec-state">${this.renderStatus()}</p>
            <span class="pill ${
              isUnarchivable
                ? "is-unarchivable"
                // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
                : this.uploadActive
                  ? "is-uploading"
                // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                : this.recording
                  ? "is-recording"
                  : ""
            }">
              ${
                isUnarchivable
                  ? "No archivable"
                  // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
                  : this.uploadActive
                    ? "Subiendo"
                  // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                  : this.recording
                    ? "Grabando"
                    : "Listo"
              }
            </span>
          </div>

          <div class="view-row" style="justify-content: flex-end;">
          ${
            // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'. | TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
            this.canRecord && !this.uploadActive
              ? html`
                  <button
                    autofocus
                    ?disabled=${this.actionButtonDisabled}
                    @click="${
                      // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                      !this.recording ? this.onStart : this.onStop
                    }"
                    class="button action-button capture-btn ${
                      // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                      !this.recording ? "is-start" : "is-stop"
                    }"
                  >
                    ${
                      // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                      this.recording
                        ? html`<span class="icon"><wr-icon .src=${fasBox}></wr-icon></span>`
                        : html``
                    }
                    <span
                      >${
                        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.

                        !this.recording ? "Iniciar archivado" : "Detener archivado"
                      }</span
                    >
                  </button>
                `
              : ""
          }
          </div>

          ${
            // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'. | TS2339 - Property 'status' does not exist on type 'RecPopup'.
            this.status?.sizeTotal
              ? html`
                  <div class="view-row underline">
                    <div class="session-head">Archivado en esta pestaña</div>
                  </div>
                  <div class="view-row">
                    <table class="status">
                    <tr>
                      <td>Tamaño guardado:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          prettyBytes(this.status.sizeNew)
                        }
                      </th>
                    </tr>
                    <tr>
                      <td>Tamaño cargado:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          prettyBytes(this.status.sizeTotal)
                        }
                      </th>
                    </tr>
                    </table>
                  </div>
                `
              : html``
          }
        </div>
        <div class="credits">Basado en <a href="https://webrecorder.net/archivewebpage/" target="_blank" rel="noopener noreferrer">Archive webpage</a></div>
      </div>
    `;
  }

  get actionButtonDisabled() {
    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    if (this.collDrop === "create") {
      return true;
    }

    // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'. | TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'. | TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
    return !this.recording ? this.waitingForStart : this.waitingForStop;
  }

  onStart() {
    // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
    this.uploadActive = false;
    // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
    this.uploadProgress = 0;
    // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
    this.uploadMessage = "";
    // @ts-expect-error - TS2339 - Property 'uploadError' does not exist on type 'RecPopup'.
    this.uploadError = false;
    // @ts-expect-error - TS2339 - Property 'uploadErrorMessage' does not exist on type 'RecPopup'.
    this.uploadErrorMessage = "";

    this.sendMessage({
      type: "startRecording",
      // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
      collId: this.collId,
      // @ts-expect-error - TS2339 - Property 'pageUrl' does not exist on type 'RecPopup'.
      url: this.pageUrl,
      autorun: false,
    });
    // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
    this.waitingForStart = true;
    // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
    this.waitingForStop = false;
  }

  onStop() {
    // @ts-expect-error - TS2339 - Property 'uploadActive' does not exist on type 'RecPopup'.
    this.uploadActive = true;
    // @ts-expect-error - TS2339 - Property 'uploadProgress' does not exist on type 'RecPopup'.
    this.uploadProgress = 5;
    // @ts-expect-error - TS2339 - Property 'uploadMessage' does not exist on type 'RecPopup'.
    this.uploadMessage = "Deteniendo captura y preparando subida...";

    this.sendMessage({ type: "stopRecording" });
    // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
    this.waitingForStart = false;
    // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
    this.waitingForStop = true;
  }

  // @ts-expect-error - TS7006 - Parameter 'event' implicitly has an 'any' type.
  async onSelectColl(event) {
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
    this.collId = event.currentTarget.getAttribute("data-id");
    // @ts-expect-error - TS2339 - Property 'collTitle' does not exist on type 'RecPopup'.
    this.collTitle = event.currentTarget.getAttribute("data-title");
    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    this.collDrop = "";

    // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'. | TS2339 - Property 'collId' does not exist on type 'RecPopup'.
    await setLocalOption(`${this.tabId}-collId`, this.collId);
    // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
    await setLocalOption("defaultCollId", this.collId);
  }

  // @ts-expect-error - TS7006 - Parameter 'event' implicitly has an 'any' type.
  onShowDrop(event) {
    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    this.collDrop = "show";
    event.stopPropagation();
    event.preventDefault();
  }

  onNewColl() {
    // @ts-expect-error - TS2531 - Object is possibly 'null'. | TS2339 - Property 'value' does not exist on type 'Element'.
    const title = this.renderRoot.querySelector("#new-name").value;

    this.sendMessage({
      // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
      tabId: this.tabId,
      type: "newColl",
      title,
    });
    // @ts-expect-error - TS2339 - Property 'tabId' does not exist on type 'RecPopup'.
    removeLocalOption(`${this.tabId}-collId`);
    // @ts-expect-error - TS2339 - Property 'collDrop' does not exist on type 'RecPopup'.
    this.collDrop = "";
  }
}

// ===========================================================================
class WrIcon extends LitElement {
  constructor() {
    super();
    // @ts-expect-error - TS2339 - Property 'size' does not exist on type 'WrIcon'.
    this.size = "0.9em";
  }

  static get properties() {
    return {
      src: { type: Object },
      size: { type: String },
    };
  }

  render() {
    return html`
      <svg
        style="width: ${
          // @ts-expect-error - TS2339 - Property 'size' does not exist on type 'WrIcon'. | TS2339 - Property 'size' does not exist on type 'WrIcon'.
          this.size
        }; height: ${
          // @ts-expect-error - TS2339 - Property 'size' does not exist on type 'WrIcon'. | TS2339 - Property 'size' does not exist on type 'WrIcon'.
          this.size
        }"
      >
        <g>
          ${
            // @ts-expect-error - TS2339 - Property 'src' does not exist on type 'WrIcon'.
            unsafeSVG(this.src)
          }
        </g>
      </svg>
    `;
  }
}

customElements.define("wr-icon", WrIcon);
customElements.define("wr-popup-viewer", RecPopup);

export { RecPopup };
