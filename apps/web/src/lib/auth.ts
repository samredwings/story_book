"use client";

const TOKEN_KEY = "token";
const USER_KEY = "user";
const API_BASE_KEY = "storybook.api_base_url";

export type ConsentStatus = {
  complete: boolean;
  missing: string[];
  age?: number | null;
  minAge?: number;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * Single source of truth for the API base URL. Debug builds can set it on-device;
 * regular builds use the build-time environment variable. Never default to
 * localhost inside an APK — that is the phone itself.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(API_BASE_KEY)?.trim();
    if (saved) return saved.replace(/\/$/, "");
  }
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "";
}

export function setApiBase(url: string): void {
  if (typeof window === "undefined") return;
  const normalized = url.trim().replace(/\/$/, "");
  if (normalized) window.localStorage.setItem(API_BASE_KEY, normalized);
  else window.localStorage.removeItem(API_BASE_KEY);
  window.dispatchEvent(new Event("storybook-api-base-changed"));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user?: AuthUser | null): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
