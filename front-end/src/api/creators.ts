import { apiFetch, ApiResponse } from "./client";
import { Tournament } from "./tournaments";

export interface CreatorUser {
  _id: string;
  username: string;
  avatar?: { url?: string };
  banner?: { url?: string };
  role?: string[];
  stats?: { rating?: number; ratingCount?: number };
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
  topScore?: number;
  ranking?: {
    completedTournaments?: number;
    activeTournaments?: number;
    totalPrize?: number;
    earnings?: number;
    rating?: number;
    ratingCount?: number;
  };
  virtual?: boolean;
}

export interface CreatorProfileData {
  channel?: CreatorChannel | null;
  creator?: CreatorUser;
  tournaments: Tournament[];
  tournamentCount: number;
  totalPrize?: number;
  viewer?: {
    isFollowing?: boolean;
    myRating?: number | null;
  };
}

export interface ChannelSetupPayload {
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
}

export const ENDPOINTS = {
  list: "/channels",
  create: "/channels",
  mine: "/channels/me",
  joined: "/channels/joined",
  channelProfile: (id: string) => `/channels/${id}`,
  update: (id: string) => `/channels/${id}`,
  userProfile: (id: string) => `/channels/creator/${id}`,
  follow: (id: string) => `/channels/${id}/join`,
  rateChannel: (id: string) => `/channels/${id}/rating`,
  rateUser: (id: string) => `/channels/creator/${id}/rating`,
};

export async function getCreators() {
  const res = await apiFetch<ApiResponse<{ channels: (CreatorChannel & { tournamentCount?: number })[]; total: number }>>(ENDPOINTS.list);
  return res.data?.channels ?? [];
}

export async function getJoinedChannels() {
  const res = await apiFetch<ApiResponse<{ channels: CreatorChannel[]; total: number }>>(ENDPOINTS.joined);
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

export async function getMyChannel() {
  const res = await apiFetch<ApiResponse<{ channel: CreatorChannel; tournamentCount: number }>>(ENDPOINTS.mine);
  return res.data;
}

export async function createChannel(payload: ChannelSetupPayload) {
  const res = await apiFetch<ApiResponse<CreatorChannel>>(ENDPOINTS.create, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateChannel(channelId: string, payload: ChannelSetupPayload) {
  const res = await apiFetch<ApiResponse<CreatorChannel>>(ENDPOINTS.update(channelId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function followCreator(channelId: string) {
  return apiFetch<ApiResponse>(ENDPOINTS.follow(channelId), { method: "POST" });
}

export async function unfollowCreator(channelId: string) {
  return apiFetch<ApiResponse>(ENDPOINTS.follow(channelId), { method: "DELETE" });
}

export async function rateCreator(id: string, rating: number, mode: "channel" | "user" = "channel") {
  const endpoint = mode === "channel" ? ENDPOINTS.rateChannel(id) : ENDPOINTS.rateUser(id);
  return apiFetch<ApiResponse<{ creator: CreatorUser }>>(endpoint, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}
