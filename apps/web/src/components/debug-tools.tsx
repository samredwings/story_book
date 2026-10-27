"use client";

import { useEffect, useState } from "react";
import { getApiBase, setApiBase } from "../lib/auth";
import {
  DEBUG_MODE,
  getDebugEvents,
  installDebugCapture,
  recordDebugEvent,
  type DebugEvent,
} from "../lib/debug-mode";

function safeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "Not configured";
  }
}

export function DebugTools() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [apiUrl, setApiUrl] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!DEBUG_MODE) return;
    try {
      installDebugCapture();
      setEvents(getDebugEvents());
      setApiUrl(getApiBase());
    } catch (error) {
      recordDebugEvent(
        "debug-tools",
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
      );
    }
    const refresh = () => setEvents(getDebugEvents());
    const refreshApiUrl = () => setApiUrl(getApiBase());
    window.addEventListener("storybook-debug-events-changed", refresh);
    window.addEventListener("storybook-api-base-changed", refreshApiUrl);
    return () => {
      window.removeEventListener("storybook-debug-events-changed", refresh);
      window.removeEventListener("storybook-api-base-changed", refreshApiUrl);
    };
  }, []);

  if (!DEBUG_MODE) return null;

  async function saveApiUrl() {
    let normalized: URL;
    try {
      normalized = new URL(apiUrl.trim());
    } catch {
      setStatus("Enter the full API address, including https:// or http://.");
      return;
    }
    if (!['http:', 'https:'].includes(normalized.protocol)) {
      setStatus("The API address must use http:// or https://.");
      return;
    }
    if (normalized.username || normalized.password) {
      setStatus("Do not include credentials in the API address.");
      return;
    }
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
    if (normalized.pathname.toLowerCase().endsWith("/api")) {
      normalized.pathname = normalized.pathname.slice(0, -4);
    }
    normalized.search = "";
    normalized.hash = "";
    setApiBase(normalized.toString().replace(/\/$/, ""));
    setStatus("API address saved. Reloading to retry the current screen…");
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function checkApi() {
    const base = getApiBase();
    if (!base) {
      setStatus("Set an API address first.");
      return;
    }
    setBusy(true);
    setStatus("Checking API…");
    try {
      const response = await fetch(`${base}/health`);
      const body = await response.text();
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
      recordDebugEvent("health", "API health check succeeded", body.slice(0, 1000));
      setStatus("API is reachable.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordDebugEvent("health", "API health check failed", message);
      setStatus(`API check failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyReport() {
    const report = JSON.stringify(
      {
        app: "Storybook Studio debug build",
        capturedAt: new Date().toISOString(),
        route: window.location.pathname,
        apiBase: safeBaseUrl(getApiBase()),
        userAgent: navigator.userAgent,
        events: getDebugEvents(),
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Debug report copied. Paste it into the chat.");
    } catch {
      setStatus("Clipboard unavailable. Please copy the event list below.");
    }
  }

  function clearReport() {
    window.localStorage.removeItem("storybook.debug_events");
    setEvents([]);
    setStatus("Debug log cleared.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[10000] rounded-full border border-amber-300 bg-zinc-950 px-4 py-2 text-sm font-semibold text-amber-200 shadow-xl"
        aria-label="Open debug tools"
      >
        Debug · {events.length}
      </button>
      {open && (
        <section className="fixed inset-x-3 bottom-16 z-[10000] max-h-[78vh] overflow-auto rounded-xl border border-amber-300/60 bg-zinc-950 p-4 text-zinc-100 shadow-2xl sm:left-auto sm:right-4 sm:w-[min(92vw,34rem)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-200">Debug tools</h2>
              <p className="text-xs text-zinc-400">Sign-in is skipped in this build. Server API calls still require a valid session.</p>
              <p className="text-xs text-zinc-500">Errors stay on this device until you copy the report.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-zinc-700 px-3 py-1 text-sm">Close</button>
          </div>

          <label className="mt-4 block text-sm font-medium" htmlFor="debug-api-url">API server address (without /api)</label>
          <input
            id="debug-api-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://your-api.example.com"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={saveApiUrl} className="rounded bg-violet-700 px-3 py-2 text-sm">Save address</button>
            <button type="button" onClick={checkApi} disabled={busy} className="rounded border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50">{busy ? "Checking…" : "Check API"}</button>
            <button type="button" onClick={copyReport} className="rounded border border-amber-300/60 px-3 py-2 text-sm text-amber-200">Copy debug report</button>
            <button type="button" onClick={clearReport} className="rounded border border-zinc-700 px-3 py-2 text-sm">Clear log</button>
            <a href="/login" className="rounded border border-zinc-700 px-3 py-2 text-sm">Open sign-in</a>
          </div>
          {status && <p className="mt-2 break-words text-sm text-zinc-300" role="status">{status}</p>}

          <div className="mt-4 flex items-center justify-between">
            <h3 className="font-medium">Captured errors ({events.length})</h3>
            <span className="max-w-[55%] truncate text-xs text-zinc-500">API: {safeBaseUrl(getApiBase())}</span>
          </div>
          <ol className="mt-2 space-y-2">
            {events.length === 0 && <li className="rounded bg-zinc-900 p-3 text-sm text-zinc-400">No errors captured yet. Try the screen or action that failed.</li>}
            {[...events].reverse().map((event, index) => (
              <li key={`${event.time}-${index}`} className="rounded bg-zinc-900 p-3 text-xs">
                <div className="flex justify-between gap-2 text-zinc-400"><span>{event.kind}</span><time>{new Date(event.time).toLocaleTimeString()}</time></div>
                <p className="mt-1 break-words text-zinc-100">{event.message}</p>
                {event.details && <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-zinc-500">{event.details}</pre>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
