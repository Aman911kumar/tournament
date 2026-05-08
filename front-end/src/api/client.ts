// Central API client. Set VITE_API_BASE_URL in your env when you have a backend.
// All page-specific files import `apiFetch` from here.

import { clearAuthTokens, getAccessToken, getRefreshToken, hasAuthSession, setAuthTokens } from "@/lib/auth-storage";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const API_BASE_URL = String(configuredApiBaseUrl).replace(/\/$/, "");
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);

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
  "/auth/forgot-password",
  "/auth/reset-password",
];

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
    if (!refreshToken && !hasAuthSession()) return false;

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const method = options.method ?? "GET";

  const sendRequest = async () => {
    const timeout = withTimeoutSignal(options.signal);
    try {
      return await fetch(url, {
      credentials: "include",
      ...options,
      signal: timeout.signal,
      headers: buildHeaders(options, getAccessToken(), isFormData),
      });
    } finally {
      timeout.cleanup();
    }
  };

  let res: Response;

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
          return (await parseJsonResponse(res)) as T;
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

  return (await parseJsonResponse(res)) as T;
}
