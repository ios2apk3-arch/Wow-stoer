/**
 * HTTP client for the WAW API.
 *
 * Owns exactly three concerns: attaching the access token, refreshing it once
 * when the server says it expired, and turning error responses into typed
 * errors the UI can branch on.
 */

const TOKEN_KEY = "waw.session.v1";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "buyer" | "supplier" | "admin";
  companyId: string | null;
  avatarColor: string;
}

export interface SessionCompany {
  id: string;
  nameAr: string;
  nameEn: string;
  logo: string;
  countryCode: string;
  city: string;
  phone: string;
  email: string;
  taxId: string;
  website: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected";
  memberSince: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  /** Attached after sign-in so `currentCompany()` can stay synchronous. */
  company?: SessionCompany | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
}

export const apiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL;
  return (configured && configured.trim()) || "http://localhost:8080";
};

/* ------------------------------------------------------------- session */

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

let session: Session | null = readStoredSession();

function readStoredSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session simply lives for this tab only.
  }
  listeners.forEach((l) => l(next));
}

export function subscribeSession(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* -------------------------------------------------------------- request */

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Set false for endpoints that must not trigger a token refresh. */
  retryOnExpiry?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path.replace(/^\//, ""), `${apiBaseUrl().replace(/\/$/, "")}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** A single in-flight refresh, shared by every request that hits a 401. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const current = session;
  if (!current?.refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(buildUrl("/api/v1/auth/refresh"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        setSession(null);
        return false;
      }
      const data = (await res.json()) as Session;
      setSession(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, retryOnExpiry = true, signal } = options;

  const send = async () => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (session?.accessToken) headers.authorization = `Bearer ${session.accessToken}`;
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError(0, "network_error", "Could not reach the server");
  }

  // One retry, and only when we actually hold a refresh token.
  if (res.status === 401 && retryOnExpiry && session?.refreshToken) {
    if (await refreshSession()) {
      try {
        res = await send();
      } catch {
        throw new ApiError(0, "network_error", "Could not reach the server");
      }
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? safeParse(text) : null;

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? res.statusText, err?.details);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
