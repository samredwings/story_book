/**
 * API Client for IMG-VDO Android App
 */
import { getApiBase, setApiBase } from "./auth";

function getApiBaseUrl(): string {
  return getApiBase();
}

export const API_BASE_URL = getApiBaseUrl();

export function setApiBaseUrl(url: string): void {
  setApiBase(url);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ user: unknown; token: string; consent: unknown }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),

  getLegal: () => apiFetch("/api/auth/legal"),

  getConsent: () => apiFetch("/api/auth/consent"),

  updateConsent: (data: {
    dateOfBirth?: string;
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
    acceptedAdultContent?: boolean;
  }) =>
    apiFetch("/api/auth/consent", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const healthApi = {
  check: () =>
    apiFetch<{ status: string; database: string; redis: string }>("/health"),
};

export const storiesApi = {
  list: () => apiFetch("/api/stories/"),
  get: (id: string) => apiFetch(`/api/stories/${id}`),
  create: (data: unknown) =>
    apiFetch("/api/stories/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const scenesApi = {
  list: (storyId: string) =>
    apiFetch(`/api/scenes/?storyId=${storyId}`),
  get: (id: string) => apiFetch(`/api/scenes/${id}`),
};

export const videosApi = {
  generate: (data: {
    sceneId: string;
    imageUrl: string;
    prompt: string;
    duration?: number;
    motionStrength?: number;
    provider?: string;
  }) =>
    apiFetch("/api/videos/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
