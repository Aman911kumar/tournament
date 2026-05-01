// Centralized auth token storage. Supports either a single `auth_token`
// or an `accessToken` + `refreshToken` pair returned by the backend.

const ACCESS_KEYS = ["accessToken", "access_token"];
const REFRESH_KEYS = ["refreshToken", "refresh_token"];

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of ACCESS_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of REFRESH_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function hasAuthSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

export function setAuthTokens(tokens: {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  if (typeof window === "undefined") return;
  const access = tokens.accessToken ?? tokens.token;
  if (access) {
    localStorage.setItem("accessToken", access);
  }
  if (tokens.refreshToken) {
    localStorage.setItem("refreshToken", tokens.refreshToken);
  }
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  [...ACCESS_KEYS, ...REFRESH_KEYS].forEach((k) => localStorage.removeItem(k));
}
