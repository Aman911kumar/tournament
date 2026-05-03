// ProfileScreen, EditProfileScreen
import { apiFetch,ApiResponse } from "./client";

export const ENDPOINTS = {
  me: "/user/profile",
  update: "/user/profile",
  stats: "/profile/stats",
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
}

export interface User {
  _id: string;
  username: string;
  email: string;
  phone_number: string;
  dateOfBirth: string | null;
  gender: string | null;
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

export async function getMyProfile():Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.me,{method:"GET",credentials: "include",});
  // return null;
}

export async function updateProfile(payload: ProfileUpdatePayload):Promise<ApiResponse> {
  return apiFetch(ENDPOINTS.update, { method: "PATCH", body: JSON.stringify(payload) , credentials:"include"});
  // return { success: true };
}

export async function getMyStats() {
  // return apiFetch(ENDPOINTS.stats);
  return null;
}
