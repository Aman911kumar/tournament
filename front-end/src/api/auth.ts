import { apiFetch ,ApiResponse} from "./client";

export interface LoginPayload { identifier: string; password: string }
export interface SignupPayload { email: string; password: string; username: string; phone_number: string }
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
  username: string;
  email: string;
  phone_number?: string;
  socialProvider?: "google" | "facebook";
  passwordLoginEnabled?: boolean;
  onboarding?: { completedAt?: string | null; source?: string } | null;
  legalAgreements?: {
    acceptedAt?: string | null;
    termsAcceptedAt?: string | null;
    privacyAcceptedAt?: string | null;
    communityAcceptedAt?: string | null;
    version?: string;
  } | null;
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
  delivery?: "email" | string;
  requestId?: string;
  otpExpiresInSeconds?: number;
  otpExpiresAt?: string;
  resendAvailableInSeconds?: number;
  resendAvailableAt?: string;
  linkExpiresAt?: string;
  resetToken?: string; // dev-only
  otpCode?: string;    // dev-only
  debug?: unknown;
}

export interface ResetPasswordPayload {
  token: string;
  otp: string;
  newPassword: string;
}

export interface ForgotPasswordVerifyOtpPayload {
  requestId: string;
  otp: string;
}

export interface ForgotPasswordGrantResponse {
  resetGrant: string;
  expiresAt?: string;
}

export interface ForgotPasswordCompletePayload {
  resetGrant: string;
  newPassword: string;
}

export const ENDPOINTS = {
  google: "/auth/google",
  facebook: "/auth/facebook",
  oauthStart: (provider: "google" | "facebook") => `/auth/oauth/${provider}/start`,
  oauthComplete: "/auth/oauth/complete",
  login: "/auth/login",
  logout: "/auth/logout",
  signup: "/auth/register",
  changePassword: "/auth/change-password",
  forgotPassword: "/auth/forgot-password",
  forgotPasswordVerifyOtp: "/auth/forgot-password/verify-otp",
  forgotPasswordResend: "/auth/forgot-password/resend",
  forgotPasswordPrepare: "/auth/forgot-password/prepare",
  forgotPasswordComplete: "/auth/forgot-password/complete",
  resetPassword: (token: string) => `/auth/reset-password/${encodeURIComponent(token)}`,
  socialLogin: (provider: "google" | "facebook") => `/auth/${provider}`,
};

export interface OAuthCompletePayload {
  code: string;
}

export async function oauthComplete(payload: OAuthCompletePayload, options: RequestInit = {}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.oauthComplete, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    ...options,
  });
}



export async function google(payload: GoogleLoginPayload, options: RequestInit = {}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.google, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    ...options,
  });
}

export async function facebook(payload: FacebookLoginPayload, options: RequestInit = {}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.facebook, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    ...options,
  });
}
export async function login(payload: LoginPayload, options: RequestInit = {}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.login, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    ...options,
  });
}

export async function logout(): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.logout, {
    method: "GET",
    credentials: "include",
  });
}

export async function signup(payload: SignupPayload, options: RequestInit = {}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(ENDPOINTS.signup, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
    ...options,
  });
}

export async function changePassword(payload: ChangePasswordPayload):Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.changePassword, { method: "PATCH", body: JSON.stringify(payload) , credentials:"include" });
}

export async function forgotPassword(identifier: string, options: RequestInit = {}): Promise<ApiResponse<ForgotPasswordResponse>> {
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
    ...options,
  });
}

export async function resetPassword(payload: ResetPasswordPayload, options: RequestInit = {}): Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.resetPassword(payload.token), {
    method: "PUT",
    body: JSON.stringify({ newPassword: payload.newPassword, otp: payload.otp }),
    ...options,
  });
}

export async function verifyForgotPasswordOtp(
  payload: ForgotPasswordVerifyOtpPayload,
  options: RequestInit = {},
): Promise<ApiResponse<ForgotPasswordGrantResponse>> {
  return apiFetch(ENDPOINTS.forgotPasswordVerifyOtp, {
    method: "POST",
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function resendForgotPasswordOtp(
  requestId: string,
  options: RequestInit = {},
): Promise<ApiResponse<ForgotPasswordResponse>> {
  return apiFetch(ENDPOINTS.forgotPasswordResend, {
    method: "POST",
    body: JSON.stringify({ requestId }),
    ...options,
  });
}

export async function prepareForgotPasswordResetFromLink(
  token: string,
  options: RequestInit = {},
): Promise<ApiResponse<ForgotPasswordGrantResponse>> {
  return apiFetch(ENDPOINTS.forgotPasswordPrepare, {
    method: "POST",
    body: JSON.stringify({ token }),
    ...options,
  });
}

export async function completeForgotPasswordReset(
  payload: ForgotPasswordCompletePayload,
  options: RequestInit = {},
): Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.forgotPasswordComplete, {
    method: "PUT",
    body: JSON.stringify(payload),
    ...options,
  });
}
