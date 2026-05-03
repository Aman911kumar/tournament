// Central API client. Set VITE_API_BASE_URL in your env when you have a backend.
// All page-specific files import `apiFetch` from here.

import { getAccessToken, clearAuthTokens } from "@/lib/auth-storage";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const token = getAccessToken();
  const method = options.method ?? "GET";

  let res: Response;

  try {
    res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      0,
      error instanceof Error ? error.message : "Could not reach the API server",
      false,
      [],
      { endpoint: path, method, source: "network" },
    );
  }

  const parseJson = async () => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  if (res.status === 401) {
    clearAuthTokens();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    const resJson = await parseJson() as {errors?:[];message?:string;success?:boolean;requestId?:string;path?:string;method?:string} | null;
    throw new ApiError(res.status,resJson?.message ?? "Unauthorized request",resJson?.success ?? false,resJson?.errors ?? [], {
      endpoint: resJson?.path ?? path,
      method: resJson?.method ?? method,
      source: "backend",
      requestId: resJson?.requestId ?? res.headers.get("x-request-id") ?? "",
    });
  }

  if (!res.ok) {
    const resJson = await parseJson() as {errors?:[];message?:string;success?:boolean;requestId?:string;path?:string;method?:string} | null;
    throw new ApiError(res.status,resJson?.message ?? `Request failed: ${res.status} ${res.statusText}`,resJson?.success ?? false,resJson?.errors ?? [], {
      endpoint: resJson?.path ?? path,
      method: resJson?.method ?? method,
      source: "backend",
      requestId: resJson?.requestId ?? res.headers.get("x-request-id") ?? "",
    });
    // throw new ApiError(res.status, `Request failed: ${res.status} ${res.statusText}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return (await parseJson()) as T;
}
