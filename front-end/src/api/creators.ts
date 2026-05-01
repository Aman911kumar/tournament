// CreatorProfileScreen, CreatorDashboardScreen, SubscriptionsScreen
import { apiFetch } from "./client";

export const ENDPOINTS = {
  profile: (id: string) => `/api/creators/${id}`,
  tournaments: (id: string) => `/api/creators/${id}/tournaments`,
  reviews: (id: string) => `/api/creators/${id}/reviews`,
  follow: (id: string) => `/api/creators/${id}/follow`,
  unfollow: (id: string) => `/api/creators/${id}/unfollow`,
  dashboard: "/api/creators/me/dashboard",
  analytics: "/api/creators/me/analytics",
  subscriptions: "/api/creators/me/subscriptions",
  suggestions: "/api/creators/suggestions",
};

export async function getCreatorProfile(id: string) {
  // return apiFetch(ENDPOINTS.profile(id));
  return null;
}
export async function getCreatorTournaments(id: string) {
  // return apiFetch(ENDPOINTS.tournaments(id));
  return [];
}
export async function getCreatorReviews(id: string) {
  // return apiFetch(ENDPOINTS.reviews(id));
  return [];
}
export async function followCreator(id: string) {
  // return apiFetch(ENDPOINTS.follow(id), { method: "POST" });
  return { success: true };
}
export async function unfollowCreator(id: string) {
  // return apiFetch(ENDPOINTS.unfollow(id), { method: "POST" });
  return { success: true };
}
export async function getCreatorDashboard() {
  // return apiFetch(ENDPOINTS.dashboard);
  return null;
}
export async function getCreatorAnalytics() {
  // return apiFetch(ENDPOINTS.analytics);
  return null;
}
export async function getMySubscriptions() {
  // return apiFetch(ENDPOINTS.subscriptions);
  return [];
}
export async function getCreatorSuggestions() {
  // return apiFetch(ENDPOINTS.suggestions);
  return [];
}
