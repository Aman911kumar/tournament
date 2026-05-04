import { apiFetch, ApiResponse } from "./client";
import { Tournament } from "./tournaments";

export interface CreatorUser {
  _id: string;
  username: string;
  avatar?: { url?: string };
  role?: string[];
  stats?: { rating?: number };
}

export interface CreatorChannel {
  _id: string;
  owner: CreatorUser;
  name: string;
  handle: string;
  description?: string;
  avatar?: { url?: string };
  banner?: { url?: string };
  socialLinks?: {
    youtube?: string;
    instagram?: string;
    discord?: string;
    website?: string;
  };
  memberCount: number;
  isActive: boolean;
}

export interface CreatorProfileData {
  channel?: CreatorChannel | null;
  creator?: CreatorUser;
  tournaments: Tournament[];
  tournamentCount: number;
  totalPrize?: number;
}

export const ENDPOINTS = {
  list: "/channels",
  channelProfile: (id: string) => `/channels/${id}`,
  userProfile: (id: string) => `/channels/creator/${id}`,
  follow: (id: string) => `/channels/${id}/join`,
};

export async function getCreators() {
  const res = await apiFetch<ApiResponse<{ channels: (CreatorChannel & { tournamentCount?: number })[]; total: number }>>(ENDPOINTS.list);
  return res.data?.channels ?? [];
}

export async function getCreatorProfile(id: string) {
  try {
    const res = await apiFetch<ApiResponse<CreatorProfileData>>(ENDPOINTS.channelProfile(id));
    return res.data;
  } catch (error) {
    const res = await apiFetch<ApiResponse<CreatorProfileData>>(ENDPOINTS.userProfile(id));
    return res.data;
  }
}

export async function followCreator(channelId: string) {
  return apiFetch<ApiResponse>(ENDPOINTS.follow(channelId), { method: "POST" });
}

export async function unfollowCreator(channelId: string) {
  return apiFetch<ApiResponse>(ENDPOINTS.follow(channelId), { method: "DELETE" });
}
