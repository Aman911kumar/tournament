import gameFreefire from "@/assets/game-freefire.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameCod from "@/assets/game-cod.jpg";
import gameValorant from "@/assets/game-valorant.jpg";

export type DiscoveryGameKey = "freefire" | "bgmi" | "callofduty" | "valorant";

export interface DiscoveryGame {
  key: DiscoveryGameKey;
  label: string;
  short: string;
  image: string;
  imagePosition: string;
  bannerPosition: string;
  accent: "primary" | "secondary" | "accent";
  modes: string[];
  tagline: string;
}

export const DISCOVERY_GAMES: DiscoveryGame[] = [
  {
    key: "freefire",
    label: "Free Fire",
    short: "FF",
    image: gameFreefire,
    imagePosition: "50% 36%",
    bannerPosition: "50% 34%",
    accent: "primary",
    modes: ["Battle Royale", "Clash Squad", "Lone Wolf"],
    tagline: "Fast mobile rooms and squad battles",
  },
  {
    key: "bgmi",
    label: "BGMI",
    short: "BGMI",
    image: gameBgmi,
    imagePosition: "50% 34%",
    bannerPosition: "50% 32%",
    accent: "accent",
    modes: ["Classic", "TDM", "Arena"],
    tagline: "Survival, squad play, and ranked lobbies",
  },
  {
    key: "callofduty",
    label: "Call of Duty",
    short: "CODM",
    image: gameCod,
    imagePosition: "50% 36%",
    bannerPosition: "50% 34%",
    accent: "secondary",
    modes: ["Battle Royale", "Multiplayer", "S&D"],
    tagline: "BR and 5v5 tactical formats",
  },
  {
    key: "valorant",
    label: "Valorant",
    short: "VAL",
    image: gameValorant,
    imagePosition: "50% 36%",
    bannerPosition: "50% 34%",
    accent: "primary",
    modes: ["Competitive", "Custom"],
    tagline: "PC tactical 5v5 tournaments",
  },
];

export const gameLabels: Record<string, string> = DISCOVERY_GAMES.reduce(
  (acc, game) => ({ ...acc, [game.key]: game.label }),
  {} as Record<string, string>,
);

export const gameQueryLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  valorant: "Valorant",
  callofduty: "COD",
  cod: "COD",
};

export const getDiscoveryGame = (game?: string) =>
  DISCOVERY_GAMES.find((item) => item.key === game) ?? DISCOVERY_GAMES[0];

export const getGameImagePosition = (game?: string, variant: "card" | "banner" = "card") => {
  const discoveryGame = getDiscoveryGame(game);
  return variant === "banner" ? discoveryGame.bannerPosition : discoveryGame.imagePosition;
};

export const normalizeGameFilter = (value: string) =>
  value === "COD" ? "Call of Duty" : value;

export const formatCompactNumber = (value?: number | string) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  if (number >= 100000) return `${(number / 100000).toFixed(number >= 1000000 ? 1 : 0)}L`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
  return number.toLocaleString("en-IN");
};

export const formatDateShort = (value?: string) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
