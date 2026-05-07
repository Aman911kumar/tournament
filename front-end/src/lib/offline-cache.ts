import { ApiError } from "@/api/client";
import { getAccessToken } from "@/lib/auth-storage";

interface CachedValue<T> {
  data: T;
  savedAt: string;
  expiresAt: string;
  verified: true;
}

const PREFIX = "battlearena.cache.";
const AUTHENTICATED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const CACHE_KEYS = {
  profile: "profile.me",
  gameAccounts: "gameAccounts.list",
  walletSummary: "wallet.summary",
  walletTransactions: "wallet.transactions",
  creators: "creators.list",
  home: "home.feed",
  myRegistrations: "tournaments.myRegistrations",
  notifications: "notifications.list",
  creatorDashboard: (userId: string) => `creatorDashboard.${userId}`,
  creatorProfile: (id: string) => `creatorProfile.${id}`,
  tournamentDetail: (id: string) => `tournamentDetail.${id}`,
  tournamentPage: (key: string) => `tournaments.page.${key}`,
} as const;

export const stableCacheKey = (value: unknown) => {
  try {
    return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  } catch {
    return String(value);
  }
};

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export const readCache = <T,>(key: string): CachedValue<T> | null => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue<T>;
    if (!parsed || !("data" in parsed)) return null;

    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      removeCache(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const writeCache = <T,>(key: string, data: T) => {
  if (!canUseStorage()) return;

  const value: CachedValue<T> = {
    data,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + AUTHENTICATED_CACHE_TTL_MS).toISOString(),
    verified: true,
  };

  window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
};

export const writeAuthenticatedCache = <T,>(
  key: string,
  data: T,
  response?: { success?: boolean; statusCode?: number },
) => {
  const hasAuthToken = Boolean(getAccessToken());
  const isSuccessfulResponse =
    !response || response.success === true || (typeof response.statusCode === "number" && response.statusCode < 400);

  if (!hasAuthToken || !isSuccessfulResponse) {
    return false;
  }

  writeCache(key, data);
  return true;
};

export const removeCache = (key: string) => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(`${PREFIX}${key}`);
};

export const getSavedDataLabel = (savedAt?: string | null) => {
  if (!savedAt) return "Showing saved data";

  try {
    return `Showing saved data from ${new Date(savedAt).toLocaleString()}`;
  } catch {
    return "Showing saved data";
  }
};

export const getConnectionIssueLabel = (error?: unknown) => {
  if (isOffline()) {
    return "Network connection error: your device is offline.";
  }

  if (error instanceof ApiError && (error.source === "network" || error.status === 0)) {
    return "Backend is offline or unreachable.";
  }

  if (error instanceof ApiError && error.status >= 500) {
    return `Backend server error (${error.status}).`;
  }

  if (error instanceof ApiError && error.status === 401) {
    return "Session expired or unauthorized.";
  }

  if (error instanceof ApiError && error.status === 403) {
    return "Backend denied access.";
  }

  if (error instanceof ApiError && error.status >= 400) {
    return `Backend rejected request (${error.status}).`;
  }

  return "Could not refresh from backend.";
};

export const getSavedDataNotice = (savedAt?: string | null, error?: unknown) =>
  `${getConnectionIssueLabel(error)} ${getSavedDataLabel(savedAt)}`;
