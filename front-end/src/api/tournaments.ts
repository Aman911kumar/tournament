import { apiFetch,ApiResponse } from "./client";

export interface TournamentFilters {
  game?: string;
  type?: "free" | "paid" | "all";
  sort?: "trending" | "latest" | "prize_asc" | "prize_desc";
  search?: string;
  organizer?: string;
}

export const ENDPOINTS = {
  list: "/tournaments",
  detail: (id: string) => `/tournaments/${id}`,
  create: "/tournaments",
  update: (id: string) => `/tournaments/${id}`,
  remove: (id: string) => `/tournaments/${id}`,
  join: (id: string) => `/tournaments/${id}/join`,
  participants: (id: string) => `/tournaments/${id}/participants`,
  distributePrizes: (id: string) => `/tournaments/${id}/distribute-prizes`,
  myRegistrations: "/tournaments/me/registrations",
  comments: (id: string) => `/tournaments/${id}/comments`,
  postComment: (id: string) => `/tournaments/${id}/comments`,
};

export interface Tournament {
  _id: string;
  title: string;
  description?: string;
  game: "freefire" | "bgmi" | "callofduty" | "valorant";
  gameMode?: string;
  mapName?: string;
  platform?: "mobile" | "pc" | "console" | "crossplay";
  perspective?: "tpp" | "fpp" | "both" | "na";
  type: "solo" | "duo" | "squad" | "team";
  startAt: string;
  endAt?: string;
  registrationStart: string;
  registrationEnd: string;
  maxPlayers: number;
  maxTeams?: number;
  teamSize?: number;
  entryFee: number;
  platformFeePercent?: number;
  platformFeeAmount?: number;
  organizerEarnings?: number;
  receivedMoney?: number;
  paidMoney?: number;
  registrationCount?: number;
  participantCount?: number;
  views?: number;
  joinedPlayers?: string[];
  prizePool?: number;
  prizeMode?: "position" | "kill" | "both";
  killPrizeAmount?: number;
  prizeDistribution?: { position: number; prizeAmount: number }[];
  results?: { position: number; player: string | { _id?: string; username?: string; avatar?: { url?: string } }; prizeWon: number }[];
  rules?: string;
  status: "draft" | "open" | "running" | "completed" | "cancelled";
  room_details?: {
    roomId?: string;
    roomPass?: string;
  };
  organizer?: {
    _id?: string;
    username?: string;
    avatar?: { url?: string };
    stats?: { rating?: number };
  };
  channel?: {
    _id?: string;
    name?: string;
    handle?: string;
    avatar?: { url?: string };
  };
}

export interface TournamentRegistration {
  _id: string;
  tournament: string | Tournament;
  user?: { _id?: string; username?: string; avatar?: { url?: string }; gameAccount?: GameAccountSummary | null };
  team?: { _id?: string; username?: string; avatar?: { url?: string }; gameAccount?: GameAccountSummary | null }[];
  gameAccount?: GameAccountSummary | null;
  status: "pending" | "paid" | "confirmed" | "rejected" | "cancelled";
  slotNumber?: number | null;
  paidAmount: number;
  platformFee?: number;
  organizerAmount?: number;
  gameAccounts?: GameAccountSummary[];
}

export interface GameAccountSummary {
  _id?: string;
  game?: string;
  inGameName?: string;
  gameId?: string;
  level?: string;
  verified?: boolean;
}

export interface PrizePayoutInput {
  registrationId: string;
  position: number;
}

interface TournamentListData {
  tournaments: Tournament[];
  total: number;
}

const toBackendGame = (game?: string) => {
  if (!game || game === "All") return undefined;
  return game.toLowerCase().replace(/\s+/g, "");
};

export async function getTournaments(filters: TournamentFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  const game = toBackendGame(filters.game);
  if (game) params.set("game", game);
  if (filters.organizer) params.set("organizer", filters.organizer);
  if (filters.type === "free") params.set("entryFee", "0");
  const qs = params.toString();
  const res = await apiFetch<ApiResponse<TournamentListData>>(`${ENDPOINTS.list}${qs ? `?${qs}` : ""}`);
  let tournaments = res.data?.tournaments ?? [];

  if (filters.type === "free") tournaments = tournaments.filter((t) => Number(t.entryFee || 0) === 0);
  if (filters.type === "paid") tournaments = tournaments.filter((t) => Number(t.entryFee || 0) > 0);
  if (filters.sort === "prize_asc") {
    tournaments = [...tournaments].sort((a, b) => Number(a.prizePool || 0) - Number(b.prizePool || 0));
  }
  if (filters.sort === "prize_desc") {
    tournaments = [...tournaments].sort((a, b) => Number(b.prizePool || 0) - Number(a.prizePool || 0));
  }
  if (filters.sort === "latest") {
    tournaments = [...tournaments].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  return tournaments;
}

export async function getTournamentById(id: string) {
  const res = await apiFetch<ApiResponse<Tournament>>(ENDPOINTS.detail(id));
  return res.data;
}

export async function createTournament(payload: Record<string, unknown>) {
  return apiFetch<ApiResponse<Tournament>>(ENDPOINTS.create, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateTournament(id: string, payload: Record<string, unknown>) {
  return apiFetch<ApiResponse<Tournament>>(ENDPOINTS.update(id), { method: "PUT", body: JSON.stringify(payload) });
}

export async function updateTournamentStatus(id: string, status: Tournament["status"]) {
  const res = await updateTournament(id, { status });
  return res.data;
}

export async function deleteTournament(id: string) {
  return apiFetch(ENDPOINTS.remove(id), { method: "DELETE" });
}

export async function joinTournament(id: string, payload: { slotNumber?: number; teamName?: string; players?: string[] } = {}) {
  return apiFetch<ApiResponse<TournamentRegistration>>(ENDPOINTS.join(id), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getParticipants(id: string) {
  const res = await apiFetch<ApiResponse<TournamentRegistration[]>>(ENDPOINTS.participants(id));
  return res.data ?? [];
}

export async function getMyTournamentRegistrations() {
  const res = await apiFetch<ApiResponse<TournamentRegistration[]>>(ENDPOINTS.myRegistrations);
  return res.data ?? [];
}

export async function distributeTournamentPrizes(id: string, payouts: PrizePayoutInput[]) {
  const res = await apiFetch<ApiResponse<{ tournament: Tournament; payoutTotal: number; transactions: unknown[]; organizerTransaction?: unknown }>>(ENDPOINTS.distributePrizes(id), {
    method: "POST",
    body: JSON.stringify({ results: payouts }),
  });
  return res.data;
}

export async function getComments(id: string) {
  // return apiFetch(ENDPOINTS.comments(id));
  return [];
}

export async function postComment(id: string, message: string) {
  // return apiFetch(ENDPOINTS.postComment(id), { method: "POST", body: JSON.stringify({ message }) });
  return { id: "comment-1", message };
}
