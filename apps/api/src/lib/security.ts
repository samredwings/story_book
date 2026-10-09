import { URL } from "node:url";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import {
  looksLikePromptInjection,
  sanitizeForLog,
} from "./prompt-guards";

export { looksLikePromptInjection, sanitizeForLog };

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 0) return true;
  if (parts[0] >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  return false;
}

export async function isSafeUrl(input: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.username || url.password) return false;
  if (url.hostname === "localhost" || url.hostname === "0.0.0.0") return false;

  let ips: Array<{ address: string }>;
  try {
    ips = (await dns.lookup(url.hostname, { all: true })) as Array<{
      address: string;
    }>;
  } catch {
    return false;
  }
  if (ips.length === 0) return false;

  for (const { address } of ips) {
    if (isIP(address) === 4 && isPrivateIPv4(address)) return false;
    if (isIP(address) === 6 && isPrivateIPv6(address)) return false;
  }

  return true;
}

/**
 * Fetch a remote URL with SSRF protections.
 * Redirects are followed manually so each hop is re-validated
 * (avoid redirect-to-private-IP after the initial DNS check).
 */
export async function fetchSafe(
  input: string,
  opts: {
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
  } = {},
): Promise<Buffer> {
  const {
    timeoutMs = 10_000,
    maxBytes = 25 * 1024 * 1024,
    maxRedirects = 5,
  } = opts;

  let current = input;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!(await isSafeUrl(current))) {
        throw new Error("URL is not safe to fetch");
      }

      const res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`Redirect without Location (${res.status})`);
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentLength = res.headers.get("content-length");
      if (contentLength && Number(contentLength) > maxBytes) {
        throw new Error("Response too large");
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new Error("Response too large");
      return buf;
    }

    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
