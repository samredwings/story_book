"use client";

export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

const STORAGE_KEY = "storybook.debug_events";
const MAX_EVENTS = 100;

export type DebugEvent = {
  time: string;
  kind: string;
  message: string;
  details?: string;
};

function redact(value: string): string {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/((?:password|secret|token)["'\s:=]+)[^\s,"']+/gi, "$1[redacted]");
}

export function getDebugEvents(): DebugEvent[] {
  if (!DEBUG_MODE || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const events = raw ? (JSON.parse(raw) as DebugEvent[]) : [];
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export function recordDebugEvent(
  kind: string,
  message: string,
  details?: string,
): void {
  if (!DEBUG_MODE || typeof window === "undefined") return;
  const event: DebugEvent = {
    time: new Date().toISOString(),
    kind: redact(kind).slice(0, 40),
    message: redact(message).slice(0, 2000),
    details: details ? redact(details).slice(0, 6000) : undefined,
  };
  const events = [...getDebugEvents(), event].slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Keep the app usable if local storage is full or unavailable.
  }
  window.dispatchEvent(new Event("storybook-debug-events-changed"));
}

function safeRequestUrl(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export function installDebugCapture(): void {
  if (!DEBUG_MODE || typeof window === "undefined") return;
  const target = window as typeof window & { __storybookDebugCaptureInstalled?: boolean };
  if (target.__storybookDebugCaptureInstalled) return;
  target.__storybookDebugCaptureInstalled = true;

  window.addEventListener("error", (event) => {
    const error = event.error as Error | undefined;
    recordDebugEvent(
      "javascript",
      event.message || error?.message || "Uncaught browser error",
      error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordDebugEvent(
      "promise",
      reason instanceof Error ? reason.message : String(reason),
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const message = args
      .map((arg) => (arg instanceof Error ? arg.message : typeof arg === "string" ? arg : "[object]"))
      .join(" ");
    const error = args.find((arg): arg is Error => arg instanceof Error);
    recordDebugEvent("console", message || "console.error", error?.stack);
    originalConsoleError(...args);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) {
        recordDebugEvent("http", `${method} ${safeRequestUrl(url)} → ${response.status}`);
      }
      return response;
    } catch (error) {
      recordDebugEvent(
        "network",
        `${method} ${safeRequestUrl(url)} failed`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ) {
    const xhr = this as XMLHttpRequest & { __storybookMethod?: string; __storybookUrl?: string };
    xhr.__storybookMethod = method;
    xhr.__storybookUrl = safeRequestUrl(String(url));
    return originalOpen.call(this, method, url, async, username, password);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as XMLHttpRequest & { __storybookMethod?: string; __storybookUrl?: string };
    this.addEventListener("loadend", () => {
      if (this.status >= 400) {
        recordDebugEvent(
          "http",
          `${xhr.__storybookMethod || "GET"} ${xhr.__storybookUrl || "request"} → ${this.status}`,
        );
      } else if (this.status === 0) {
        recordDebugEvent(
          "network",
          `${xhr.__storybookMethod || "GET"} ${xhr.__storybookUrl || "request"} failed`,
        );
      }
    });
    return originalSend.call(this, body);
  };
}
