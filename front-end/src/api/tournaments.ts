import { apiFetch,ApiResponse } from "./client";

export interface TournamentFilters {
  game?: string;
  type?: "free" | "paid" | "all";
  sort?: "trending" | "latest" | "prize_asc" | "prize_desc";
  search?: string;
}

export const ENDPOINTS = {
  list: "/tournaments",
  detail: (id: string) => `/tournaments/${id}`,
  create: "/tournaments",
  update: (id: string) => `/tournaments/${id}`,
  remove: (id: string) => `/tournaments/${id}`,
  join: (id: string) => `/tournaments/${id}/join`,
  participants: (id: string) => `/tournaments/${id}/participants`,
  comments: (id: string) => `/tournaments/${id}/comments`,
  postComment: (id: string) => `/tournaments/${id}/comments`,
};

export interface Tournament {
  _id: string;
  title: string;
  description?: string;
  game: string;
  type: "solo" | "duo" | "squad";
  format: "single_elim" | "double_elim" | "round_robin" | "swiss";
  startAt: string;
  endAt?: string;
  registrationStart: string;
  registrationEnd: string;
  maxPlayers: number;
  entryFee: number;
  prizePool?: {
    total?: number;
    distribution?: { place: number; amount: number }[];
  };
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
  if (filters.type === "free") params.set("entryFee", "0");
  const qs = params.toString();
  const res = await apiFetch<ApiResponse<TournamentListData>>(`${ENDPOINTS.list}${qs ? `?${qs}` : ""}`);
  let tournaments = res.data?.tournaments ?? [];

  if (filters.type === "free") tournaments = tournaments.filter((t) => Number(t.entryFee || 0) === 0);
  if (filters.type === "paid") tournaments = tournaments.filter((t) => Number(t.entryFee || 0) > 0);
  if (filters.sort === "prize_asc") {
    tournaments = [...tournaments].sort((a, b) => Number(a.prizePool?.total || 0) - Number(b.prizePool?.total || 0));
  }
  if (filters.sort === "prize_desc") {
    tournaments = [...tournaments].sort((a, b) => Number(b.prizePool?.total || 0) - Number(a.prizePool?.total || 0));
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

export async function deleteTournament(id: string) {
  return apiFetch(ENDPOINTS.remove(id), { method: "DELETE" });
}

export async function joinTournament(id: string) {
  // return apiFetch(ENDPOINTS.join(id), { method: "POST" });
  return { success: true };
}

export async function getParticipants(id: string) {
  // return apiFetch(ENDPOINTS.participants(id));
  return [];
}

export async function getComments(id: string) {
  // return apiFetch(ENDPOINTS.comments(id));
  return [];
}

export async function postComment(id: string, message: string) {
  // return apiFetch(ENDPOINTS.postComment(id), { method: "POST", body: JSON.stringify({ message }) });
  return { id: "comment-1", message };
}
