import { apiFetch ,ApiResponse} from "./client";

export interface LoginPayload { phone_number: string; password: string }
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
  phone_number: string;
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

export interface Stats {
  matchesPlayed: number;
  kills: number;
  amount_won: number;
}

export interface Preferences {
  notifications: boolean;
}

export interface ChangePasswordPayload {
  currentPassword: string;
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
  socialLogin: (provider: "google" | "facebook") => `/auth/${provider}`,
};



export async function google(payload: GoogleLoginPayload): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.google, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function facebook(payload: FacebookLoginPayload): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.facebook, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}
export async function login(payload: LoginPayload): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.login, {
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

export async function signup(payload: SignupPayload): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.signup, {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

export async function changePassword(payload: ChangePasswordPayload):Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.changePassword, { method: "PATCH", body: JSON.stringify(payload) , credentials:"include" });
}

export async function forgotPassword(email: string): Promise<void> {
  // return apiFetch(ENDPOINTS.forgotPassword, { method: "POST", body: JSON.stringify({ email }) });
}
