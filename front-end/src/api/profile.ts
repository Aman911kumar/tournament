// ProfileScreen, EditProfileScreen
import { apiFetch,ApiResponse } from "./client";

export const ENDPOINTS = {
  me: "/user/profile",
  update: "/user/profile",
  onboarding: "/user/profile/onboarding",
  avatar: "/user/profile/avatar",
  banner: "/user/profile/banner",
  stats: "/profile/stats",
  becomeCreator: "/user/creator",
  leaveCreator: "/user/creator",
  verifyEmail: "/user/profile/verify-email",
  confirmEmail: "/user/profile/confirm-email",
  verifyPhone: "/user/profile/verify-phone",
  confirmPhone: "/user/profile/confirm-phone",
};

export interface ProfileUpdatePayload {
  username?: string;
  email?: string;
  phone_number?: string;
  dateOfBirth?: string;
  gender?: string;
  password?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface ProfileImage {
  public_id?: string;
  mediaId?: string;
  provider?: string;
  url?: string;
  thumbUrl?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  phone_number?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  linkedProviders?: Array<{
    provider: "password" | "google" | "facebook" | "phone" | "email";
    providerId?: string;
    verified?: boolean;
  }>;
  socialProvider?: "google" | "facebook";
  passwordLoginEnabled?: boolean;
  avatar?: ProfileImage;
  banner?: ProfileImage;
  dateOfBirth: string | null;
  gender: string | null;
  onboarding?: { completedAt?: string | null; source?: string } | null;
  legalAgreements?: {
    acceptedAt?: string | null;
    termsAcceptedAt?: string | null;
    privacyAcceptedAt?: string | null;
    communityAcceptedAt?: string | null;
    version?: string;
  } | null;
  walletBalance: number;
  playerEarnings?: number;
  playerMonthlyChange?: number;
  role: string[];
  creatorRequest?: {
    status: "none" | "pending" | "approved" | "rejected" | "removed";
    requestedAt?: string | null;
    reviewedAt?: string | null;
    note?: string;
  };
  lastLoginAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;

  stats?: Stats;
  preferences: Preferences;
}

export interface CompleteOnboardingPayload {
  phone_number: string;
  username?: string;
  dateOfBirth: string;
  agreements: { terms: boolean; privacy: boolean; community: boolean };
  agreementsVersion?: string;
}

export interface Stats {
  matchesPlayed: number;
  tournamentsPlayed?: number;
  kills: number;
  amount_won: number;
}

export interface Preferences {
  notifications: boolean;
}

export async function getMyProfile(): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.me,{method:"GET",credentials: "include",});
  // return null;
}

export async function updateProfile(payload: ProfileUpdatePayload):Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.update, { method: "PATCH", body: JSON.stringify(payload) , credentials:"include"});
  // return { success: true };
}

const uploadProfileImage = (
  endpoint: string,
  file: File,
): Promise<ApiResponse<{ user: User }>> =>
  apiFetch(endpoint, {
    method: "POST",
    body: file,
    credentials: "include",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
  });

export const uploadAvatar = (file: File): Promise<ApiResponse<{ user: User }>> =>
  uploadProfileImage(ENDPOINTS.avatar, file);

export const removeAvatar = (): Promise<ApiResponse<{ user: User }>> =>
  apiFetch(ENDPOINTS.avatar, { method: "DELETE", credentials: "include" });

export const uploadBanner = (file: File): Promise<ApiResponse<{ user: User }>> =>
  uploadProfileImage(ENDPOINTS.banner, file);

export const removeBanner = (): Promise<ApiResponse<{ user: User }>> =>
  apiFetch(ENDPOINTS.banner, { method: "DELETE", credentials: "include" });

export async function completeOnboarding(
  payload: CompleteOnboardingPayload,
  options: RequestInit = {},
): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.onboarding, { method: "POST", body: JSON.stringify(payload), credentials: "include", ...options });
}

export async function verifyEmail(): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.verifyEmail, { method: "POST", credentials: "include" });
}

export async function confirmEmailVerification(token: string): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.confirmEmail, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verifyPhone(): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.verifyPhone, { method: "POST", credentials: "include" });
}

export async function confirmPhoneVerification(token: string): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.confirmPhone, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function becomeCreator(): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.becomeCreator, { method: "POST", credentials: "include" });
}

export async function leaveCreator(): Promise<ApiResponse<{ user: User }>> {
  return apiFetch(ENDPOINTS.leaveCreator, { method: "DELETE", credentials: "include" });
}

export async function getMyStats() {
  // return apiFetch(ENDPOINTS.stats);
  return null;
}
