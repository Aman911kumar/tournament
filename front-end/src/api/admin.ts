import { apiFetch } from "./client";
import type { ApiResponse } from "./client";

export interface AdminApiResponse {
  statusCode: number;
  data: AdminDashboardData;
  message: string;
  success: boolean;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyRevenue {
  date: string;
  amount: number;
  count: number;
}

export interface CountBucket {
  _id: string | null;
  count: number;
}

export interface AmountBucket extends CountBucket {
  amount: number;
}

export interface AdminDashboardData {
  range: {
    days: number;
    start: string;
    end: string;
  };
  totals: {
    users: number;
    activeUsers: number;
    creators: number;
    bannedUsers: number;
    channels: number;
    channelMembers: number;
    tournaments: number;
    openTournaments: number;
    runningTournaments: number;
    completedTournaments: number;
    publicTournaments?: number;
    privateTournaments?: number;
    teams: number;
    registrations: number;
    verifiedGameAccounts: number;
    openTickets: number;
    successfulPayments: number;
    totalRevenue: number;
    walletCredits: number;
    walletDebits: number;
    netWalletFlow: number;
    platformFees: number;
    platformFeeTransactionCount: number;
    ledgerTransactions: number;
    pendingRazorpayPayments: number;
    failedRazorpayPayments: number;
    pendingCreatorRequests: number;
    adminAuditCount: number;
  };
  charts: {
    usersByDay: DailyCount[];
    tournamentsByDay: DailyCount[];
    revenueByDay: DailyRevenue[];
    tournamentsByStatus: CountBucket[];
    tournamentsByGame: CountBucket[];
    paymentsByStatus: CountBucket[];
    usersByRole: CountBucket[];
    platformFeesByCategory: AmountBucket[];
  };
  tournamentAnalytics?: {
    finance?: {
      receivedMoney?: number;
      platformFees?: number;
      prizePaid?: number;
      pendingPrizes?: number;
    };
  };
  tables: {
    topCreators: TopCreator[];
    recentTournaments: RecentTournament[];
    recentUsers: RecentUser[];
    recentTickets: RecentTicket[];
    creatorRequests: RecentUser[];
    recentAdminAuditLogs: AdminAuditLog[];
    recentFinanceTransactions: AdminFinanceTransaction[];
  };
}

export interface AdminWithdrawalRequest {
  _id: string;
  user?: {
    _id: string;
    username?: string;
    phone_number?: string;
    email?: string;
  };
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  status: "pending" | "success" | "failed" | "cancelled" | "refunded" | "initiated";
  meta?: {
    purpose?: string;
    method?: string;
    destination?: string;
    walletTransactionId?: string;
    walletTransactionRef?: string;
    requestedAt?: string;
    adminPaidAt?: string;
    adminUpdatedAt?: string;
    payoutReference?: string;
    payoutStatus?: string;
    failureReason?: string;
    refundTransactionId?: string;
    note?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type AdminWithdrawalUpdateStatus = "success" | "failed" | "cancelled";

export interface AdminCollectionSummary {
  key: string;
  label: string;
  count: number;
}

export interface AdminCollectionRecords {
  collection: string;
  label: string;
  page: number;
  limit: number;
  total: number;
  pages: number;
  records: Record<string, unknown>[];
}

export interface AdminUserTransactionRecord {
  _id: string;
  source: "wallet" | "payment" | "ledger";
  title?: string;
  transactionId?: string;
  category?: string;
  direction?: "CREDIT" | "DEBIT" | "INFO" | string;
  amount?: number;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  status?: string;
  referenceId?: string;
  provider?: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  debitAccount?: string;
  creditAccount?: string;
  fromUser?: {
    _id?: string;
    username?: string;
    email?: string;
    phone_number?: string;
  } | null;
  toUser?: {
    _id?: string;
    username?: string;
    email?: string;
    phone_number?: string;
  } | null;
  createdAt?: string;
}

export interface AdminUserTransactionHistory {
  user: Record<string, unknown>;
  wallet: {
    _id?: string;
    balance: number;
    lockedBalance: number;
    availableBalance: number;
    currency?: string;
    updatedAt?: string;
  };
  totals: {
    walletTransactions: number;
    payments: number;
    ledgerEntries: number;
    all: number;
  };
  page: number;
  limit: number;
  total: number;
  pages: number;
  records: AdminUserTransactionRecord[];
}

export interface AdminAuditLog {
  _id: string;
  actor?: {
    username?: string;
    phone_number?: string;
    email?: string;
  };
  targetUser?: {
    username?: string;
    phone_number?: string;
    email?: string;
  };
  action: string;
  entity: string;
  note?: string;
  createdAt?: string;
}

export interface AdminFinanceTransaction {
  _id: string;
  transactionId: string;
  debitAccount?: string;
  creditAccount?: string;
  category?: string;
  referenceId?: string;
  amount?: number;
  platformFee?: number;
  netAmount?: number;
  status?: string;
  fromUser?: {
    username?: string;
    phone_number?: string;
    email?: string;
  } | null;
  toUser?: {
    username?: string;
    phone_number?: string;
    email?: string;
  } | null;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface TopCreator {
  _id: string;
  name: string;
  handle: string;
  memberCount: number;
  tournamentCount: number;
  owner?: {
    _id: string;
    username: string;
  };
}

export interface RecentTournament {
  _id: string;
  title: string;
  game?: string;
  type?: string;
  status: string;
  visibility?: "public" | "private";
  entryFee?: number;
  prizePool?: number;
  prizeMode?: "position" | "kill" | "both";
  killPrizeAmount?: number;
  prizeDistribution?: { position: number; prizeAmount: number }[];
  maxPlayers?: number;
  startAt?: string;
  organizer?: {
    username?: string;
  };
  channel?: {
    name?: string;
    handle?: string;
  };
}

export interface RecentUser {
  _id: string;
  username: string;
  phone_number?: string;
  email?: string;
  role?: string[];
  creatorRequest?: {
    status?: "none" | "pending" | "approved" | "rejected" | "removed";
    requestedAt?: string;
    reviewedAt?: string;
    note?: string;
  };
  isActive?: boolean;
  createdAt?: string;
}

export interface RecentTicket {
  _id: string;
  title: string;
  type: string;
  status: string;
  createdAt?: string;
  user?: {
    username?: string;
    phone_number?: string;
  };
}

export async function getAdminDashboard(days = 30): Promise<AdminApiResponse> {
  return apiFetch(`/admin/dashboard?days=${days}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminWithdrawals(status: "pending" | "all" = "pending") {
  return apiFetch<ApiResponse<AdminWithdrawalRequest[]>>(`/admin/withdrawals?status=${status}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function updateWithdrawalStatus(
  id: string,
  payload: { status: AdminWithdrawalUpdateStatus; payoutReference?: string; note?: string; reason?: string },
) {
  return apiFetch<ApiResponse<AdminWithdrawalRequest>>(`/admin/withdrawals/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function markWithdrawalPaid(id: string, payload: { payoutReference?: string; note?: string }) {
  return updateWithdrawalStatus(id, { status: "success", ...payload });
}

export async function updateCreatorPermission(id: string, payload: { status: "approved" | "rejected" | "removed"; note?: string }) {
  return apiFetch<ApiResponse<{ user: Record<string, unknown> }>>(`/admin/users/${id}/creator`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function getAdminUserTransactionHistory(
  id: string,
  params: { page?: number; limit?: number } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  return apiFetch<ApiResponse<AdminUserTransactionHistory>>(`/admin/users/${id}/transactions?${searchParams.toString()}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminCollections() {
  return apiFetch<ApiResponse<AdminCollectionSummary[]>>("/admin/collections", {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminCollectionRecords(
  collection: string,
  params: { page?: number; limit?: number; search?: string; creatorRequestStatus?: string } = {},
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 25),
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.creatorRequestStatus) searchParams.set("creatorRequestStatus", params.creatorRequestStatus);

  return apiFetch<ApiResponse<AdminCollectionRecords>>(`/admin/collections/${collection}?${searchParams.toString()}`, {
    method: "GET",
    credentials: "include",
  });
}
