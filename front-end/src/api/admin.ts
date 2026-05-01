import { apiFetch } from "./client";

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
    teams: number;
    matches: number;
    finishedMatches: number;
    registrations: number;
    verifiedGameAccounts: number;
    openTickets: number;
    successfulPayments: number;
    totalRevenue: number;
    walletCredits: number;
    walletDebits: number;
    netWalletFlow: number;
  };
  charts: {
    usersByDay: DailyCount[];
    tournamentsByDay: DailyCount[];
    revenueByDay: DailyRevenue[];
    tournamentsByStatus: CountBucket[];
    tournamentsByGame: CountBucket[];
    paymentsByStatus: CountBucket[];
    usersByRole: CountBucket[];
  };
  tables: {
    topCreators: TopCreator[];
    recentTournaments: RecentTournament[];
    recentUsers: RecentUser[];
    recentTickets: RecentTicket[];
  };
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
  entryFee?: number;
  prizePool?: {
    total?: number;
  };
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
