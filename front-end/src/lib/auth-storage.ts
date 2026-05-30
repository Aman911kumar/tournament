// Centralized auth token storage. Supports either a single `auth_token`
// or an `accessToken` + `refreshToken` pair returned by the backend.

const ACCESS_KEYS = ["accessToken", "access_token"];
const REFRESH_KEYS = ["refreshToken", "refresh_token"];
const AUTH_MARKER_KEY = "b4a_auth_session";

const getSessionValue = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const getLegacyLocalValue = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of ACCESS_KEYS) {
    const v = getSessionValue(k) || getLegacyLocalValue(k);
    if (v) return v;
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  // Refresh tokens are primarily carried by HttpOnly cookies. Legacy localStorage
  // values are read only long enough to keep existing sessions working.
  for (const k of REFRESH_KEYS) {
    const v = getLegacyLocalValue(k);
    if (v) return v;
  }
  return null;
}

export function hasAuthSession(): boolean {
  if (getAccessToken() || getRefreshToken()) return true;
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTH_MARKER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAuthTokens(tokens: {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  if (typeof window === "undefined") return;
  const access = tokens.accessToken ?? tokens.token;
  if (access) {
    try {
      sessionStorage.setItem("accessToken", access);
    } catch {
      // ignore storage failures; HttpOnly cookies still carry the session.
    }
  }
  [...ACCESS_KEYS, ...REFRESH_KEYS].forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
  try {
    localStorage.setItem(AUTH_MARKER_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  [...ACCESS_KEYS, ...REFRESH_KEYS].forEach((k) => {
    try {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
      localStorage.removeItem(AUTH_MARKER_KEY);
    } catch {
      // ignore
    }
  });
}
