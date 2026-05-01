export type TournamentType = "solo" | "duo" | "squad";
export type TournamentFormat = "single_elim" | "double_elim" | "round_robin" | "swiss";
export type TournamentStatus = "live" | "upcoming" | "completed" | "draft";

export interface PrizeDistributionItem {
  place: number;
  amount: number;
}

export interface CreatorTournament {
  id: string;
  game: string;
  title: string;
  description: string;
  type: TournamentType;
  format: TournamentFormat;
  entryFee: number;
  maxPlayers: number;
  registrationStart: string;
  registrationEnd: string;
  startAt: string;
  endAt?: string;
  rules: string;
  prizePool: {
    total: number;
    distribution: PrizeDistributionItem[];
  };
  room_details: {
    roomId: string;
    roomPass: string;
  };
  participants: number;
  views: number;
  earnings: number;
  status: TournamentStatus;
  updatedAt: string;
}

export type CreatorTournamentInput = Omit<
  CreatorTournament,
  "id" | "participants" | "views" | "earnings" | "status" | "updatedAt"
>;

const STORAGE_KEY = "battlearena.creatorTournaments";

export const seedCreatorTournaments: CreatorTournament[] = [
  {
    id: "creator-1",
    game: "Free Fire",
    title: "Pro League S4",
    description: "Competitive Free Fire solo tournament for ranked players.",
    type: "solo",
    format: "single_elim",
    entryFee: 50,
    maxPlayers: 100,
    registrationStart: "2026-04-10T10:00",
    registrationEnd: "2026-04-15T18:00",
    startAt: "2026-04-15T20:00",
    endAt: "2026-04-15T23:00",
    rules: "Solo only. No teaming. Admin decision is final.",
    prizePool: {
      total: 50000,
      distribution: [
        { place: 1, amount: 30000 },
        { place: 2, amount: 15000 },
        { place: 3, amount: 5000 },
      ],
    },
    room_details: { roomId: "FF-4501", roomPass: "proS4" },
    participants: 88,
    views: 1200,
    earnings: 4400,
    status: "live",
    updatedAt: "2026-04-14T12:00:00.000Z",
  },
  {
    id: "creator-2",
    game: "Free Fire",
    title: "Weekend Clash",
    description: "Fast weekend tournament with instant room details.",
    type: "squad",
    format: "round_robin",
    entryFee: 50,
    maxPlayers: 64,
    registrationStart: "2026-04-18T09:00",
    registrationEnd: "2026-04-20T16:00",
    startAt: "2026-04-20T19:00",
    endAt: "",
    rules: "Squad check-in is required 15 minutes before start.",
    prizePool: {
      total: 10000,
      distribution: [{ place: 1, amount: 10000 }],
    },
    room_details: { roomId: "", roomPass: "" },
    participants: 64,
    views: 890,
    earnings: 3200,
    status: "upcoming",
    updatedAt: "2026-04-13T12:00:00.000Z",
  },
  {
    id: "creator-3",
    game: "BGMI",
    title: "Duo Showdown",
    description: "BGMI duo event with verified player slots.",
    type: "duo",
    format: "double_elim",
    entryFee: 75,
    maxPlayers: 100,
    registrationStart: "2026-04-19T10:00",
    registrationEnd: "2026-04-22T16:00",
    startAt: "2026-04-22T20:00",
    endAt: "",
    rules: "Duo mode only. Players must use linked game accounts.",
    prizePool: {
      total: 20000,
      distribution: [
        { place: 1, amount: 12000 },
        { place: 2, amount: 8000 },
      ],
    },
    room_details: { roomId: "", roomPass: "" },
    participants: 100,
    views: 2100,
    earnings: 7500,
    status: "completed",
    updatedAt: "2026-04-12T12:00:00.000Z",
  },
];

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const readStoredTournaments = () => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CreatorTournament[]) : null;
  } catch {
    return null;
  }
};

export const getCreatorTournaments = () => readStoredTournaments() ?? seedCreatorTournaments;

export const setCreatorTournaments = (tournaments: CreatorTournament[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
};

export const getCreatorTournamentById = (id: string) =>
  getCreatorTournaments().find((tournament) => tournament.id === id) ?? null;

export const saveCreatorTournament = (input: CreatorTournamentInput, id?: string) => {
  const tournaments = getCreatorTournaments();
  const existing = id ? tournaments.find((tournament) => tournament.id === id) : null;
  const next: CreatorTournament = {
    ...input,
    id: existing?.id ?? id ?? `creator-${Date.now()}`,
    participants: existing?.participants ?? 0,
    views: existing?.views ?? 0,
    earnings: existing?.earnings ?? 0,
    status: existing?.status ?? "upcoming",
    updatedAt: new Date().toISOString(),
  };

  const updated = existing
    ? tournaments.map((tournament) => (tournament.id === existing.id ? next : tournament))
    : [next, ...tournaments];

  setCreatorTournaments(updated);
  return next;
};

export const deleteCreatorTournament = (id: string) => {
  const updated = getCreatorTournaments().filter((tournament) => tournament.id !== id);
  setCreatorTournaments(updated);
  return updated;
};
