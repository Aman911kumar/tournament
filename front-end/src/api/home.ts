// Index.tsx (Home Feed) — feed, trending, recommended creators, live
import { apiFetch } from "./client";

export const ENDPOINTS = {
  feed: "/api/home/feed",
  trending: "/api/home/trending",
  recommendedCreators: "/api/home/recommended-creators",
  liveTournaments: "/api/home/live",
};

export async function getHomeFeed() {
  // return apiFetch(ENDPOINTS.feed);
  return [];
}
export async function getTrending() {
  // return apiFetch(ENDPOINTS.trending);
  return [];
}
export async function getRecommendedCreators() {
  // return apiFetch(ENDPOINTS.recommendedCreators);
  return [];
}
export async function getLiveTournaments() {
  // return apiFetch(ENDPOINTS.liveTournaments);
  return [];
}
