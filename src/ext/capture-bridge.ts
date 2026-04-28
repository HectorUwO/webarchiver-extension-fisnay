/**
 * Content script: bridge between the extension service worker and the
 * hemeroteca register page. Transfers the captured WACZ file + metadata
 * from the BG via a chunked port protocol, then hands the assembled File
 * to the page through window.postMessage (structured clone supports File).
 *
 * Injected only on siaikevin.test/hemeroteca/register* pages.
 */

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per base64 chunk

function getCaptureIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("captureId");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function transferCapture(captureId: string) {
  // Connect to the service worker
  const port = chrome.runtime.connect({ name: `capture-transfer:${captureId}` });

  let metadata: { url: string; text: string; filename: string; thumbnailBase64: string | null } | null = null;
  const chunks: Uint8Array[] = [];
  let totalChunks = 0;
  let receivedChunks = 0;

  port.onMessage.addListener((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    if (type === "error") {
      window.postMessage({ type: "capture-error", error: msg.error || "Captura no encontrada." }, "*");
      port.disconnect();
      return;
    }

    if (type === "metadata") {
      metadata = {
        url: msg.url as string,
        text: msg.text as string,
        filename: msg.filename as string,
        thumbnailBase64: (msg.thumbnailBase64 as string) || null,
      };
      return;
    }

    if (type === "chunk") {
      const data = msg.data as string;
      totalChunks = msg.total as number;
      receivedChunks++;
      chunks.push(base64ToUint8Array(data));

      // Report progress to the page
      const progress = Math.round((receivedChunks / totalChunks) * 100);
      window.postMessage({ type: "capture-progress", progress }, "*");
      return;
    }

    if (type === "done") {
      // Assemble all chunks into a single File
      const blob = new Blob(chunks as BlobPart[], { type: "application/octet-stream" });
      const file = new File([blob], metadata?.filename || "capture.wacz", {
        type: "application/octet-stream",
      });

      window.postMessage(
        {
          type: "capture-ready",
          file,
          url: metadata?.url || "",
          text: metadata?.text || "",
          filename: metadata?.filename || "capture.wacz",
          thumbnailBase64: metadata?.thumbnailBase64 || null,
        },
        "*",
      );

      port.disconnect();
    }
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        { type: "capture-error", error: "Se perdió la conexión con la extensión." },
        "*",
      );
    }
  });

  // Request the capture data
  port.postMessage({ type: "get-capture", captureId });
}

// Run on page load
const captureId = getCaptureIdFromUrl();
if (captureId) {
  // Small delay to let React mount before sending the message
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => transferCapture(captureId), 300);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => transferCapture(captureId), 300);
    });
  }
}
