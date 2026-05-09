import { apiFetch, ApiResponse } from "./client";

export type ReportCategory =
  | "creator"
  | "player"
  | "tournament"
  | "cheating"
  | "abusive_behavior"
  | "fake_results"
  | "spam"
  | "fraud_scam"
  | "inappropriate_content"
  | "payout_not_distributed"
  | "wrong_payout"
  | "room_details_issue"
  | "payment_issue"
  | "other";

export type ReportTargetType = "creator" | "player" | "tournament" | "team" | "match" | "system";
export type ReportSeverity = "low" | "medium" | "high" | "critical";
export type ReportStatus = "open" | "under_review" | "actioned" | "resolved" | "rejected" | "closed" | "reviewed";

export interface ModerationUser {
  _id?: string;
  username?: string;
  email?: string;
  phone_number?: string;
  avatar?: { url?: string };
  role?: string[];
  accountStatus?: string;
}

export interface ModerationTournament {
  _id?: string;
  title?: string;
  game?: string;
  status?: string;
}

export interface ModerationReport {
  _id: string;
  title: string;
  message?: string;
  content?: string;
  targetType: ReportTargetType;
  category: ReportCategory;
  reason?: ReportCategory;
  severity: ReportSeverity;
  status: ReportStatus;
  reporter?: ModerationUser;
  createdBy?: ModerationUser;
  reportedUser?: ModerationUser | null;
  reportedCreator?: ModerationUser | null;
  tournament?: ModerationTournament | null;
  evidence?: {
    screenshots?: string[];
    videoUrl?: string;
    matchProof?: string;
  };
  reviewedBy?: ModerationUser | null;
  reviewedAt?: string | null;
  adminResponse?: string | null;
  resolution?: string;
  createdAt: string;
}

export interface TournamentBan {
  _id: string;
  tournament?: ModerationTournament | string;
  creator?: ModerationUser | string;
  player?: ModerationUser | string;
  reason: string;
  note?: string;
  status: "active" | "revoked" | "expired";
  expiresAt?: string | null;
  bannedAt?: string;
  createdAt?: string;
}

export interface ModerationAction {
  _id: string;
  actor?: ModerationUser;
  actorRole: "player" | "creator" | "moderator" | "admin" | "system";
  action: string;
  targetUser?: ModerationUser | null;
  tournament?: ModerationTournament | null;
  report?: Pick<ModerationReport, "_id" | "title" | "category" | "status" | "severity"> | null;
  note?: string;
  createdAt: string;
}

export interface ReportListResponse {
  reports: ModerationReport[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BanListResponse {
  bans: TournamentBan[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ActionListResponse {
  actions: ModerationAction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateReportPayload {
  title?: string;
  targetType: ReportTargetType;
  category: ReportCategory;
  message: string;
  tournament?: string;
  reportedUser?: string;
  reportedCreator?: string;
  evidence?: {
    screenshots?: string[] | string;
    videoUrl?: string;
    matchProof?: string;
  };
  severity?: ReportSeverity;
  source?: string;
}

export async function createReport(payload: CreateReportPayload) {
  return apiFetch<ApiResponse<ModerationReport>>("/moderation/reports", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function getModerationReports(params: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  targetType?: string;
  severity?: string;
  search?: string;
} = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  const res = await apiFetch<ApiResponse<ReportListResponse>>(`/moderation/reports${qs.toString() ? `?${qs}` : ""}`);
  return res.data ?? { reports: [], total: 0, page: 1, limit: 20, pages: 1 };
}

export async function reviewModerationReport(
  reportId: string,
  payload: { status?: ReportStatus; action?: string; note?: string; targetUser?: string; durationHours?: number; expiresAt?: string },
) {
  return apiFetch<ApiResponse<ModerationReport>>(`/moderation/reports/${reportId}/review`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function getTournamentBans(tournamentId: string, status = "active") {
  const res = await apiFetch<ApiResponse<BanListResponse>>(`/moderation/tournaments/${tournamentId}/bans?status=${encodeURIComponent(status)}`);
  return res.data ?? { bans: [], total: 0, page: 1, limit: 50, pages: 1 };
}

export async function banTournamentPlayer(
  tournamentId: string,
  payload: { playerId: string; reason: string; note?: string; expiresAt?: string; removeRegistration?: boolean; reportId?: string },
) {
  return apiFetch<ApiResponse<TournamentBan>>(`/moderation/tournaments/${tournamentId}/bans`, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function unbanTournamentPlayer(tournamentId: string, playerId: string, note = "") {
  return apiFetch<ApiResponse<TournamentBan>>(`/moderation/tournaments/${tournamentId}/bans/${playerId}`, {
    method: "DELETE",
    credentials: "include",
    body: JSON.stringify({ note }),
  });
}

export async function getModerationActions(params: { page?: number; limit?: number; user?: string; tournament?: string; action?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  const res = await apiFetch<ApiResponse<ActionListResponse>>(`/moderation/actions${qs.toString() ? `?${qs}` : ""}`);
  return res.data ?? { actions: [], total: 0, page: 1, limit: 30, pages: 1 };
}
