"use client";

const TOKEN_KEY = "token";
const USER_KEY = "user";

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
 * Single source of truth for API base URL (inlined at Next static-export build).
 * Always set NEXT_PUBLIC_API_URL in .env.production before `npm run android:apk`.
 * Never rely on localhost inside an APK — that is the phone itself.
 */
export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  // Dev-only fallback (browser on same machine)
  return "http://localhost:3001";
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
