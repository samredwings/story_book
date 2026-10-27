"use client";

import { useEffect, useState } from "react";
import {
  DEBUG_MODE,
  recordDebugEvent,
  redactDebugText,
} from "../lib/debug-mode";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const safeMessage = redactDebugText(error.message || "Uncaught application error");
  const safeStack = error.stack ? redactDebugText(error.stack) : "";
  const details = DEBUG_MODE
    ? [safeMessage, safeStack].filter(Boolean).join("\n\n")
    : "The app encountered an unexpected error.";

  useEffect(() => {
    recordDebugEvent(
      "startup",
      error.message || "Uncaught application error",
      error.stack,
    );
  }, [error]);

  async function copyReport() {
    const report = JSON.stringify(
      {
        app: "Storybook Studio debug build",
        capturedAt: new Date().toISOString(),
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        digest: error.digest,
        message: safeMessage,
        stack: safeStack,
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Error report copied. Paste it into the chat.");
    } catch {
      setCopyStatus("Clipboard unavailable. Copy the error details below.");
    }
  }

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ width: "min(100%, 720px)" }}>
          <h1 style={{ color: "#fbbf24", fontSize: 24 }}>Storybook Studio error</h1>
          <p>The app hit an error while opening. Copy the details below and send them in this chat so I can trace the failing code.</p>
          <pre
            style={{
              maxHeight: "50vh",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              padding: 12,
              userSelect: "text",
            }}
          >
            {details}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
          {DEBUG_MODE && (
            <button
              type="button"
              onClick={copyReport}
              style={{ marginRight: 8, padding: "10px 14px", background: "#a16207", color: "white", border: 0, borderRadius: 6 }}
            >
              Copy error report
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ padding: "10px 14px", background: "#27272a", color: "white", border: "1px solid #52525b", borderRadius: 6 }}
          >
            Try again
          </button>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </main>
      </body>
    </html>
  );
}
