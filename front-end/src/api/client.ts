// Central API client. Set VITE_API_BASE_URL in your env when you have a backend.
// All page-specific files import `apiFetch` from here.

import appConfig from "@/config/project.config";
import { clearAuthTokens, getAccessToken, getRefreshToken, hasAuthSession, setAuthTokens } from "@/lib/auth-storage";

const DEFAULT_API_BASE_URL = "/api/v1";
const FAST_PRODUCTION_API_FALLBACK = appConfig.api.fastProductionBaseUrl;
const REALTIME_PRODUCTION_API_FALLBACK = appConfig.api.realtimeProductionBaseUrl;

const isPrivateOrLocalHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, "");

const resolveApiBaseUrl = (configuredValue: unknown, productionFallback: string) => {
  const configured = String(configuredValue || DEFAULT_API_BASE_URL).trim();

  if (typeof window === "undefined" || !configured.startsWith("http")) {
    return normalizeBaseUrl(configured);
  }

  try {
    const apiUrl = new URL(configured);
    const appIsPublic = !isPrivateOrLocalHost(window.location.hostname);
    const apiIsPrivate = isPrivateOrLocalHost(apiUrl.hostname);

    if (appIsPublic && apiIsPrivate) {
      return normalizeBaseUrl(String(productionFallback));
    }
  } catch {
    return DEFAULT_API_BASE_URL;
  }

  return normalizeBaseUrl(configured);
};

export type ApiTarget = "fast" | "realtime";

export const FAST_API_BASE_URL = resolveApiBaseUrl(
  appConfig.api.fastBaseUrl,
  FAST_PRODUCTION_API_FALLBACK,
);

const configuredRealtimeApi = appConfig.api.realtimeBaseUrl;

export const REALTIME_API_BASE_URL = resolveApiBaseUrl(
  configuredRealtimeApi,
  REALTIME_PRODUCTION_API_FALLBACK,
);

export const API_BASE_URL = FAST_API_BASE_URL;
const API_TIMEOUT_MS = appConfig.api.timeoutMs;
const API_SLOW_REQUEST_MS = appConfig.api.slowRequestMs;
const API_PERF_LOGS = appConfig.api.performanceLogs;
const REALTIME_WAKEUP_COOLDOWN_MS = appConfig.api.realtimeWakeupCooldownMs;
const inFlightGetRequests = new Map<string, Promise<unknown>>();
let lastRealtimeWarmupAt = 0;
let realtimeWarmupPromise: Promise<boolean> | null = null;

export type ApiFetchOptions = RequestInit & {
  apiTarget?: ApiTarget;
  skipRealtimeWarmup?: boolean;
};

export type ApiErrorDetail = Record<string, unknown>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown[];
}

export class ApiError extends Error {
  status: number;
  success: boolean;
  errors: ApiErrorDetail[];
  endpoint: string;
  method: string;
  source: "backend" | "network" | "client";
  requestId: string;

  constructor(
    status: number,
    message: string,
    success: boolean = false,
    errors: ApiErrorDetail[] = [],
    meta: { endpoint?: string; method?: string; source?: "backend" | "network" | "client"; requestId?: string } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.success = success;
    this.errors = errors;
    this.endpoint = meta.endpoint ?? "";
    this.method = meta.method ?? "GET";
    this.source = meta.source ?? (status > 0 ? "backend" : "network");
    this.requestId = meta.requestId ?? "";

    // Fix prototype chain (important for instanceof)
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

type BackendErrorBody = {
  errors?: [];
  message?: string;
  success?: boolean;
  requestId?: string;
  path?: string;
  method?: string;
} | null;

const REFRESH_ENDPOINT = "/auth/refresh-token";
const publicAuthPaths = [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/facebook",
  "/auth/oauth",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const realtimePathPatterns = [
  /^\/chat(?:\/|$)/,
  /^\/dm(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/moderation(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/tournaments\/[^/]+\/(?:notify-room|distribute-prizes)(?:\/|$)/,
];

const normalizeApiPath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const inferApiTarget = (path: string): ApiTarget => {
  if (path.startsWith("http")) return "fast";
  const normalized = normalizeApiPath(path).split("?")[0];
  return realtimePathPatterns.some((pattern) => pattern.test(normalized)) ? "realtime" : "fast";
};

export const getApiBaseUrlForPath = (path: string, target?: ApiTarget) => {
  if (path.startsWith("http")) return "";
  return (target || inferApiTarget(path)) === "realtime" ? REALTIME_API_BASE_URL : FAST_API_BASE_URL;
};

export const getRealtimeServerUrl = () => REALTIME_API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

export const warmRealtimeBackend = (reason = "app"): Promise<boolean> => {
  if (typeof window === "undefined" || REALTIME_API_BASE_URL === FAST_API_BASE_URL) {
    return Promise.resolve(false);
  }

  const now = Date.now();
  if (realtimeWarmupPromise) return realtimeWarmupPromise;
  if (now - lastRealtimeWarmupAt < REALTIME_WAKEUP_COOLDOWN_MS) return Promise.resolve(false);

  lastRealtimeWarmupAt = now;
  realtimeWarmupPromise = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const url = `${REALTIME_API_BASE_URL}/health/warmup?reason=${encodeURIComponent(reason)}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
        headers: { "x-b4a-warmup": reason },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
      realtimeWarmupPromise = null;
    }
  })();

  return realtimeWarmupPromise;
};

export const scheduleRealtimeWarmup = (reason = "app") => {
  if (typeof window === "undefined") return;
  const run = () => {
    void warmRealtimeBackend(reason);
  };
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 750);
  }
};

let refreshPromise: Promise<boolean> | null = null;

const isPublicAuthRequest = (path: string) =>
  publicAuthPaths.some((authPath) => path.startsWith(authPath));

const shouldRefreshForPath = (path: string) =>
  !path.startsWith(REFRESH_ENDPOINT) && !path.startsWith("/auth/renew-token") && !isPublicAuthRequest(path);

const buildHeaders = (options: RequestInit, token: string | null, isFormData: boolean) => ({
  ...(isFormData ? {} : { "Content-Type": "application/json" }),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(options.headers ?? {}),
});

const withTimeoutSignal = (signal?: AbortSignal | null) => {
  if (!API_TIMEOUT_MS || API_TIMEOUT_MS <= 0 || typeof AbortController === "undefined") {
    return { signal, cleanup: () => undefined };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    },
  };
};

const parseJsonResponse = async (res: Response): Promise<BackendErrorBody | unknown> => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const redirectToLogin = () => {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  window.location.href = "/login";
};

const refreshAuthSession = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();

    try {
      const res = await fetch(`${API_BASE_URL}${REFRESH_ENDPOINT}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });

      if (!res.ok) return false;

      const json = await parseJsonResponse(res) as ApiResponse<{
        accessToken?: string;
        refreshToken?: string;
      }> | null;

      const accessToken = json?.data?.accessToken;
      const nextRefreshToken = json?.data?.refreshToken;
      if (!accessToken) return false;

      setAuthTokens({ accessToken, refreshToken: nextRefreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const throwApiError = async (res: Response, path: string, method: string, fallbackMessage: string) => {
  const resJson = await parseJsonResponse(res) as BackendErrorBody;
  throw new ApiError(res.status, resJson?.message ?? fallbackMessage, resJson?.success ?? false, resJson?.errors ?? [], {
    endpoint: resJson?.path ?? path,
    method: resJson?.method ?? method,
    source: "backend",
    requestId: resJson?.requestId ?? res.headers.get("x-request-id") ?? "",
  });
};

const getDedupeKey = (url: string, method: string, options: RequestInit) => {
  if (method.toUpperCase() !== "GET") return "";
  if (options.body || options.signal) return "";
  return `${method.toUpperCase()} ${url} ${getAccessToken() || "guest"}`;
};

const reportApiTiming = (path: string, method: string, durationMs: number, status?: number, deduped = false) => {
  if (!API_PERF_LOGS && durationMs < API_SLOW_REQUEST_MS) return;
  const level = durationMs >= API_SLOW_REQUEST_MS ? "warn" : "debug";
  const message = `[api] ${method.toUpperCase()} ${path} ${Math.round(durationMs)}ms${deduped ? " deduped" : ""}`;
  console[level](message, { status, source: "apiFetch" });
};

async function apiFetchInternal<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { apiTarget, skipRealtimeWarmup, ...requestOptions } = options;
  const target = apiTarget || inferApiTarget(path);
  const url = path.startsWith("http") ? path : `${getApiBaseUrlForPath(path, target)}${path}`;

  if (target === "realtime" && !skipRealtimeWarmup) {
    void warmRealtimeBackend(`api:${normalizeApiPath(path).split("?")[0]}`);
  }

  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const method = requestOptions.method ?? "GET";

  const sendRequest = async () => {
    const timeout = withTimeoutSignal(requestOptions.signal);
    try {
      return await fetch(url, {
        credentials: "include",
        ...requestOptions,
        signal: timeout.signal,
        headers: buildHeaders(requestOptions, getAccessToken(), isFormData),
      });
    } finally {
      timeout.cleanup();
    }
  };

  let res: Response;
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    res = await sendRequest();
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError(
      0,
      isAbort ? "Request timed out. Please check your connection and try again." : error instanceof Error ? error.message : "Could not reach the API server",
      false,
      [],
      { endpoint: path, method, source: "network" },
    );
  }

  if (res.status === 401) {
    if (shouldRefreshForPath(path)) {
      const refreshed = await refreshAuthSession();
      if (refreshed) {
        try {
          res = await sendRequest();
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          throw new ApiError(
            0,
            isAbort ? "Request timed out. Please check your connection and try again." : error instanceof Error ? error.message : "Could not reach the API server",
            false,
            [],
            { endpoint: path, method, source: "network" },
          );
        }

        if (res.status !== 401) {
          if (!res.ok) {
            await throwApiError(res, path, method, `Request failed: ${res.status} ${res.statusText}`);
          }
          if (res.status === 204) return undefined as T;
          const parsed = (await parseJsonResponse(res)) as T;
          reportApiTiming(path, method, (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt, res.status);
          return parsed;
        }
      }

      if (hasAuthSession()) {
        clearAuthTokens();
        redirectToLogin();
      }
    }

    await throwApiError(res, path, method, "Unauthorized request");
  }

  if (!res.ok) {
    await throwApiError(res, path, method, `Request failed: ${res.status} ${res.statusText}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const parsed = (await parseJsonResponse(res)) as T;
  reportApiTiming(path, method, (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt, res.status);
  return parsed;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const target = options.apiTarget || inferApiTarget(path);
  const url = path.startsWith("http") ? path : `${getApiBaseUrlForPath(path, target)}${path}`;
  const method = options.method ?? "GET";
  const dedupeKey = getDedupeKey(url, method, options);

  if (!dedupeKey) return apiFetchInternal<T>(path, options);

  const existing = inFlightGetRequests.get(dedupeKey);
  if (existing) {
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const result = await existing as T;
    reportApiTiming(path, method, (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt, undefined, true);
    return result;
  }

  const request = apiFetchInternal<T>(path, options).finally(() => {
    inFlightGetRequests.delete(dedupeKey);
  });
  inFlightGetRequests.set(dedupeKey, request);
  return request;
}

export const fastApiFetch = <T>(path: string, options: ApiFetchOptions = {}) =>
  apiFetch<T>(path, { ...options, apiTarget: "fast" });

export const realtimeApiFetch = <T>(path: string, options: ApiFetchOptions = {}) =>
  apiFetch<T>(path, { ...options, apiTarget: "realtime" });
