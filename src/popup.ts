import { LitElement, html, css, unsafeCSS } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import bulma from "bulma/bulma.sass";

import fasPlus from "@fortawesome/fontawesome-free/svgs/solid/plus.svg";
import fasBox from "@fortawesome/fontawesome-free/svgs/solid/square.svg";
import fasQ from "@fortawesome/fontawesome-free/svgs/solid/question.svg";
import fasCheck from "@fortawesome/fontawesome-free/svgs/solid/check.svg";
import fasX from "@fortawesome/fontawesome-free/svgs/solid/times.svg";
import fasCaretDown from "@fortawesome/fontawesome-free/svgs/solid/caret-down.svg";

import wrRec from "./assets/icons/recLogo.svg";

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

      replayUrl: { type: String },
      pageUrl: { type: String },
      pageTs: { type: Number },

      canRecord: { type: Boolean },
      failureMsg: { type: String },
    };
  }

  async firstUpdated() {
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
  }

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  sendMessage(message) {
    // @ts-expect-error - TS2339 - Property 'port' does not exist on type 'RecPopup'.
    this.port.postMessage(message);
  }

  // @ts-expect-error - TS7006 - Parameter 'message' implicitly has an 'any' type.
  async onMessage(message) {
    switch (message.type) {
      case "status":
        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
        this.recording = message.recording;
        // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
        if (this.waitingForStart && message.firstPageStarted) {
          // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
          this.waitingForStart = false;
        }
        // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
        if (this.waitingForStop && !message.recording && !message.stopping) {
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
          this.collTitle = "[No Title]";
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
      // @ts-expect-error - TS2339 - Property 'collId' does not exist on type 'RecPopup'.
      if (coll.id === this.collId) {
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
    return "Not Archiving this Tab";
  }

  static get styles() {
    return wrapCss(css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-size: initial !important;
        color: #0f172a;
        font-family: "Nunito Sans", "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .shell {
        background: #f3f4f6;
        padding: 14px;
        min-height: 100vh;
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

      .help-link {
        border: 1px solid #d9dde3;
        border-radius: 999px;
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #334155;
        background: #fff;
      }

      .help-link:hover {
        border-color: #9ca3af;
        background: #f8fafc;
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
        background: #0f172a;
        color: #fff;
        border-color: #0f172a;
      }

      .action-button:hover {
        background: #1e293b;
        color: #fff;
        border-color: #1e293b;
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
    `);
  }

  renderStatus() {
    // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
    if (this.recording) {
      return html`<b
          >${
            // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
            this.waitingForStop ? "Finishing " : ""
          }
          Archiving:&nbsp;</b
        >${
          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'. | TS2339 - Property 'status' does not exist on type 'RecPopup'.
          this.status?.numPending
            ? html`
                <span class="status-pending"
                  >${
                    // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                    this.status.numPending
                  }
                  URLs
                  pending${
                    // @ts-expect-error - TS2339 - Property 'waitingForStop' does not exist on type 'RecPopup'.
                    this.waitingForStop
                      ? "."
                      : ", please wait before loading a new page."
                  }</span
                >
              `
            : html` <span class="status-ready">Idle, Continue Browsing</span>`
        }`;
    }

    // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
    if (this.failureMsg) {
      return html`
        <div class="error">
          <p>
            Sorry, there was an error starting archiving on this page. Please
            try again or try a different page.
          </p>
          <p class="error-msg">
            Error Details:
            <i
              >${
                // @ts-expect-error - TS2339 - Property 'failureMsg' does not exist on type 'RecPopup'.
                this.failureMsg
              }</i
            >
          </p>
          <p>
            If the error persists, check the
            <a
              href="https://archiveweb.page/guide/troubleshooting/errors"
              target="_blank"
              >Common Errors and Issues</a
            >
            page in the guide for known issues and possible solutions.
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
            This page is part of the extension. You can view existing archived
            items from here. To start a new archiving session, click the
            <wr-icon .src="${wrRec}"></wr-icon> Start Archiving button and enter
            a new URL.
          </p>
        `;
      }

      return html`<i>Can't archive this page.</i>`;
    }

    // @ts-expect-error - TS2339 - Property 'waitingForStart' does not exist on type 'RecPopup'.
    if (this.waitingForStart) {
      return html`<i>Archiving will start after the page reloads...</i>`;
    }

    return html`<i>${this.notRecordingMessage}</i>`;
  }

  renderCollDropdown() {
    return html`
      <div class="coll-select">
        <div class="is-size-7">
          ${
            // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
            this.recording ? "Currently archiving" : "Save"
          }
          to:&nbsp;
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
                              >New Archiving Session
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
              >New Archiving Session:</label
            >
            <div class="control">
              <input
                class="input is-small"
                id="new-name"
                type="text"
                required
                placeholder="Enter Archiving Session Name"
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
    return html`
      <div class="shell">
        <div class="brand-row">
          <div>
            <div class="brand-title">Hemeroteca</div>
            <div class="brand-subtitle">Archivo digital</div>
          </div>
          <a
            target="_blank"
            href="https://archiveweb.page/guide/usage"
            class="help-link"
            title="Guia"
          >
            <wr-icon size="0.95em" .src="${fasQ}"></wr-icon>
          </a>
        </div>

        <div class="container">
          <div class="status-row">
            <p class="rec-state">${this.renderStatus()}</p>
            <span class="pill ${
              // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
              this.recording ? "is-recording" : ""
            }">
              ${
                // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                this.recording ? "Grabando" : "Listo"
              }
            </span>
          </div>

          <div class="view-row" style="justify-content: flex-end;">
          ${
            // @ts-expect-error - TS2339 - Property 'canRecord' does not exist on type 'RecPopup'.
            this.canRecord
              ? html`
                  <button
                    autofocus
                    ?disabled=${this.actionButtonDisabled}
                    @click="${
                      // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                      !this.recording ? this.onStart : this.onStop
                    }"
                    class="button action-button"
                  >
                    <span class="icon">
                      ${
                        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.
                        !this.recording
                          ? html` <wr-icon .src=${wrRec}></wr-icon>`
                          : html` <wr-icon .src=${fasBox}></wr-icon>`
                      }
                    </span>
                    <span
                      >${
                        // @ts-expect-error - TS2339 - Property 'recording' does not exist on type 'RecPopup'.

                        !this.recording ? "Start Archiving" : "Stop Archiving"
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
                    <div class="session-head">Archivado en esta pestana</div>
                  </div>
                  <div class="view-row">
                    <table class="status">
                    <tr>
                      <td>Size Stored:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          prettyBytes(this.status.sizeNew)
                        }
                      </th>
                    </tr>
                    <tr>
                      <td>Size Loaded:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          prettyBytes(this.status.sizeTotal)
                        }
                      </th>
                    </tr>
                    <tr>
                      <td>Pages:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          this.status.numPages
                        }
                      </th>
                    </tr>
                    <tr>
                      <td>URLs:</td>
                      <th>
                        ${
                          // @ts-expect-error - TS2339 - Property 'status' does not exist on type 'RecPopup'.
                          this.status.numUrls
                        }
                      </th>
                    </tr>
                    </table>
                  </div>
                `
              : html``
          }
        </div>
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
