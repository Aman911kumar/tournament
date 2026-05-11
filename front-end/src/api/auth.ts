import { apiFetch ,ApiResponse} from "./client";

export interface LoginPayload { identifier: string; password: string }
export interface SignupPayload { email: string; password: string; username: string; phone_number: string; firstName?: string; lastName?: string }
export interface ClerkSyncPayload { email?: string; username?: string; phone_number?: string; firstName?: string; lastName?: string }
export interface GoogleLoginPayload {
  access_token?: string;
  credential?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export interface FacebookLoginPayload {
  accessToken: string;
  userID?: string;
  expiresIn?: number;
  signedRequest?: string;
}

export interface GoogleUserPayload {
  sub: string;          // unique Google user ID
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export interface User {
  _id: string;
  clerkId?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone_number?: string;
  socialProvider?: "google" | "facebook";
  passwordLoginEnabled?: boolean;
  dateOfBirth: string | null;
  gender: string | null;
  gamename: string;
  gameid: string;
  walletBalance: number;
  role: string[];
  lastLoginAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;

  stats: Stats;
  preferences: Preferences;
}

export type AuthResponse = ApiResponse<{
  user: User;
  accessToken: string;
  refreshToken?: string;
}>;

export interface Stats {
  matchesPlayed: number;
  tournamentsPlayed?: number;
  kills: number;
  amount_won: number;
}

export interface Preferences {
  notifications: boolean;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}

export interface ForgotPasswordResponse {
  resetToken?: string;
  expiresInMinutes?: number;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export const ENDPOINTS = {
  google: "/auth/google",
  facebook: "/auth/facebook",
  login: "/auth/login",
  logout: "/auth/logout",
  signup: "/auth/register",
  changePassword: "/auth/change-password",
  forgotPassword: "/auth/forgot-password",
  resetPassword: (token: string) => `/auth/reset-password/${encodeURIComponent(token)}`,
  clerkSync: "/auth/clerk/sync",
  socialLogin: (provider: "google" | "facebook") => `/auth/${provider}`,
};



export async function google(payload: GoogleLoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.google, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function facebook(payload: FacebookLoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.facebook, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.login, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function logout(): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.logout, {
    method: "GET",
    credentials: "include",
  });
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.signup, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function syncClerkUser(payload: ClerkSyncPayload = {}): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.clerkSync, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function changePassword(payload: ChangePasswordPayload):Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.changePassword, { method: "PATCH", body: JSON.stringify(payload) , credentials:"include" });
}

export async function forgotPassword(identifier: string): Promise<ApiResponse<ForgotPasswordResponse>> {
  const trimmedIdentifier = identifier.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
  const digitsOnly = trimmedIdentifier.replace(/\D/g, "");
  const isPhone = !isEmail && (digitsOnly.length === 10 || (digitsOnly.length === 12 && digitsOnly.startsWith("91")));
  const phoneNumber = isPhone
    ? digitsOnly.length === 12 && digitsOnly.startsWith("91")
      ? digitsOnly.slice(2)
      : digitsOnly
    : undefined;
  const email = isEmail ? trimmedIdentifier.toLowerCase() : undefined;

  return apiFetch(ENDPOINTS.forgotPassword, {
    method: "POST",
    body: JSON.stringify({
      identifier: trimmedIdentifier,
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      ...(email ? { email } : {}),
      ...(!isEmail && !isPhone ? { username: trimmedIdentifier } : {}),
    }),
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.resetPassword(payload.token), {
    method: "PUT",
    body: JSON.stringify({ newPassword: payload.newPassword }),
  });
}
