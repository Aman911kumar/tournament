import { apiFetch, ApiResponse } from "./client";

export type SupportTicketType = "report" | "dispute" | "general";
export type SupportReason =
  | "cheating"
  | "abusive_behavior"
  | "fake_result"
  | "payout_not_distributed"
  | "wrong_payout"
  | "room_details_issue"
  | "payment_issue"
  | "other";

export interface CreateSupportTicketPayload {
  title: string;
  description: string;
  type?: SupportTicketType;
  reason?: SupportReason;
  tournament?: string;
  targetUser?: string;
  evidence?: {
    screenshots?: string[];
    videoUrl?: string;
    matchProof?: string;
  };
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface SupportTicket {
  _id: string;
  title: string;
  description: string;
  type: SupportTicketType;
  reason: SupportReason;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  adminResponse?: string | null;
  createdAt: string;
}

export async function createSupportTicket(payload: CreateSupportTicketPayload) {
  return apiFetch<ApiResponse<SupportTicket>>("/support", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}
