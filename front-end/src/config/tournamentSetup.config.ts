export type GameKey = "freefire" | "bgmi" | "callofduty" | "valorant";
export type TeamType = "solo" | "duo" | "squad" | "team";
export type PrizeMode = "position" | "kill" | "both";
export type Platform = "mobile" | "pc" | "console" | "crossplay";
export type Perspective = "tpp" | "fpp" | "both" | "na";

export interface FormatOption {
  value: TeamType;
  label: string;
  short: string;
  teamSize: number;
  defaultTeams: number;
  minTeams: number;
  maxTeams: number;
  maxPlayers: number;
  lockedTeamSize?: boolean;
  helper: string;
}

export interface ModeOption {
  value: string;
  label: string;
  description: string;
  formats: FormatOption[];
  recommendedMaps: string[];
  scoringPreset: string;
  defaultPrizeMode: PrizeMode;
  defaultKillPrize?: string;
  rulePreset: string[];
}

export interface GameSetupConfig {
  label: string;
  short: string;
  platform: Platform;
  perspective: Perspective;
  defaultMode: string;
  accent: "primary" | "secondary" | "accent";
  modes: ModeOption[];
}

const commonRules = [
  "Players must use the registered in-game account and assigned slot/team.",
  "Room ID/password must not be shared with unregistered players.",
  "Cheats, scripts, modified clients, teaming abuse, and toxic behavior are disallowed.",
  "Players must join before room lock time. Late joins are handled by admin decision.",
  "Valid evidence is required for result disputes. Admin decision is final.",
];

const ffBrRules = [
  "Battle Royale supports Solo, Duo, and Squad custom rooms only.",
  "Use assigned slots. Wrong slot entry can lead to removal or disqualification.",
  "Kill and placement screenshots may be required for prize verification.",
];

const arenaRules = [
  "Both teams must be ready before match start. Starting side/map follows admin instructions.",
  "Disconnected players may reconnect only if the game allows it and admin approves.",
  "Round win/result screenshots must be submitted when requested.",
];

const brFormat = (value: TeamType, label: string, teamSize: number, maxPlayers: number): FormatOption => ({
  value,
  label,
  short: label,
  teamSize,
  defaultTeams: Math.floor(maxPlayers / teamSize),
  minTeams: 2,
  maxTeams: Math.floor(maxPlayers / teamSize),
  maxPlayers,
  lockedTeamSize: true,
  helper: `${label} battle royale lobby`,
});

const headToHeadFormat = (
  value: TeamType,
  label: string,
  teamSize: number,
  helper: string,
): FormatOption => ({
  value,
  label,
  short: label,
  teamSize,
  defaultTeams: 2,
  minTeams: 2,
  maxTeams: 2,
  maxPlayers: teamSize * 2,
  lockedTeamSize: true,
  helper,
});

export const TOURNAMENT_SETUP_CONFIG: Record<GameKey, GameSetupConfig> = {
  freefire: {
    label: "Free Fire",
    short: "FF",
    platform: "mobile",
    perspective: "tpp",
    defaultMode: "battle_royale",
    accent: "primary",
    modes: [
      {
        value: "battle_royale",
        label: "Battle Royale",
        description: "Classic Free Fire lobby for survival, placement, and kill scoring.",
        formats: [
          brFormat("solo", "Solo", 1, 48),
          brFormat("duo", "Duo", 2, 48),
          brFormat("squad", "Squad", 4, 48),
        ],
        recommendedMaps: ["Bermuda", "Kalahari", "Purgatory", "Alpine"],
        scoringPreset: "Placement points + kill points",
        defaultPrizeMode: "both",
        defaultKillPrize: "10",
        rulePreset: [...commonRules, ...ffBrRules],
      },
      {
        value: "clash_squad",
        label: "Clash Squad",
        description: "Free Fire 4v4 round-based team format.",
        formats: [headToHeadFormat("squad", "4v4 Squad", 4, "Fixed 4v4 Clash Squad")],
        recommendedMaps: ["Bermuda CS", "Kalahari CS", "Purgatory CS"],
        scoringPreset: "Round wins / best-of series",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Clash Squad is locked to 4v4. Duo/Solo entries are not valid."],
      },
      {
        value: "lone_wolf",
        label: "Lone Wolf",
        description: "Small-format Free Fire duel mode for 1v1 or 2v2.",
        formats: [
          headToHeadFormat("solo", "1v1", 1, "Fixed 1v1 Lone Wolf duel"),
          headToHeadFormat("duo", "2v2", 2, "Fixed 2v2 Lone Wolf duel"),
        ],
        recommendedMaps: ["Iron Cage", "Lone Wolf Arena"],
        scoringPreset: "Round wins / best-of series",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Lone Wolf supports only 1v1 or 2v2. Squad lobbies are not valid."],
      },
    ],
  },
  bgmi: {
    label: "BGMI",
    short: "BGMI",
    platform: "mobile",
    perspective: "tpp",
    defaultMode: "classic",
    accent: "accent",
    modes: [
      {
        value: "classic",
        label: "Classic",
        description: "PUBG/BGMI battle royale setup for Solo, Duo, or Squad rooms.",
        formats: [
          brFormat("solo", "Solo", 1, 100),
          brFormat("duo", "Duo", 2, 100),
          brFormat("squad", "Squad", 4, 100),
        ],
        recommendedMaps: ["Erangel", "Miramar", "Sanhok", "Vikendi"],
        scoringPreset: "Placement points + kill points",
        defaultPrizeMode: "both",
        defaultKillPrize: "10",
        rulePreset: [...commonRules, "Classic supports Solo, Duo, and Squad only.", "Emulator/rooted device rules must be declared before match start."],
      },
      {
        value: "tdm",
        label: "TDM",
        description: "BGMI 4v4 Team Deathmatch arena setup.",
        formats: [headToHeadFormat("squad", "4v4 Squad", 4, "Fixed 4v4 TDM")],
        recommendedMaps: ["Warehouse", "Hangar"],
        scoringPreset: "Match wins / kill limit",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "TDM is locked to 4v4."],
      },
      {
        value: "arena",
        label: "Arena",
        description: "Compact BGMI arena match for 4v4 competitive play.",
        formats: [headToHeadFormat("squad", "4v4 Squad", 4, "Fixed 4v4 Arena")],
        recommendedMaps: ["Warehouse", "Hangar", "Domination Town"],
        scoringPreset: "Round/match wins",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Arena formats are locked to 4v4."],
      },
    ],
  },
  callofduty: {
    label: "Call of Duty",
    short: "CODM",
    platform: "mobile",
    perspective: "both",
    defaultMode: "battle_royale",
    accent: "secondary",
    modes: [
      {
        value: "battle_royale",
        label: "Battle Royale",
        description: "COD Mobile BR setup for Solo, Duo, or Squad lobbies.",
        formats: [
          brFormat("solo", "Solo", 1, 100),
          brFormat("duo", "Duo", 2, 100),
          brFormat("squad", "Squad", 4, 100),
        ],
        recommendedMaps: ["Isolated", "Blackout"],
        scoringPreset: "Placement points + kill points",
        defaultPrizeMode: "both",
        defaultKillPrize: "10",
        rulePreset: [...commonRules, "BR supports Solo, Duo, and Squad only.", "Controllers/emulators must follow tournament policy."],
      },
      {
        value: "multiplayer",
        label: "Multiplayer",
        description: "CODM competitive multiplayer team format.",
        formats: [headToHeadFormat("team", "5v5 Team", 5, "Fixed 5v5 multiplayer")],
        recommendedMaps: ["Raid", "Standoff", "Summit", "Firing Range"],
        scoringPreset: "Hardpoint / Control / match wins",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Competitive multiplayer is locked to 5v5."],
      },
      {
        value: "search_destroy",
        label: "Search & Destroy",
        description: "CODM 5v5 Search & Destroy format with round wins.",
        formats: [headToHeadFormat("team", "5v5 Team", 5, "Fixed 5v5 Search & Destroy")],
        recommendedMaps: ["Raid", "Standoff", "Firing Range", "Tunisia"],
        scoringPreset: "Round wins / overtime policy",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Search & Destroy is locked to 5v5."],
      },
    ],
  },
  valorant: {
    label: "Valorant",
    short: "VAL",
    platform: "pc",
    perspective: "na",
    defaultMode: "competitive",
    accent: "primary",
    modes: [
      {
        value: "competitive",
        label: "Competitive",
        description: "Valorant custom lobby with tournament-style 5v5 setup.",
        formats: [headToHeadFormat("team", "5v5 Team", 5, "Fixed 5v5 competitive")],
        recommendedMaps: ["Ascent", "Bind", "Haven", "Split", "Lotus", "Sunset"],
        scoringPreset: "Match wins / round differential",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Valorant competitive tournaments are locked to 5v5.", "Use custom game tournament mode when available."],
      },
      {
        value: "custom",
        label: "Custom",
        description: "Valorant custom room setup for creator-managed 5v5 matches.",
        formats: [headToHeadFormat("team", "5v5 Team", 5, "Fixed 5v5 custom lobby")],
        recommendedMaps: ["Ascent", "Bind", "Haven", "Split", "Lotus", "Sunset"],
        scoringPreset: "Creator-defined match wins",
        defaultPrizeMode: "position",
        rulePreset: [...commonRules, ...arenaRules, "Valorant custom events remain locked to 5v5 for platform integrity."],
      },
    ],
  },
};

export const getGameConfig = (game: GameKey) => TOURNAMENT_SETUP_CONFIG[game];

export const getModeConfig = (game: GameKey, mode?: string) => {
  const config = getGameConfig(game);
  return config.modes.find((item) => item.value === mode) ?? config.modes[0];
};

export const getFormatConfig = (game: GameKey, mode: string | undefined, type?: TeamType) => {
  const modeConfig = getModeConfig(game, mode);
  return modeConfig.formats.find((item) => item.value === type) ?? modeConfig.formats[0];
};

export const getRulePresetText = (game: GameKey, mode: string | undefined, type?: TeamType) => {
  const modeConfig = getModeConfig(game, mode);
  const format = getFormatConfig(game, mode, type);

  return [
    `${getGameConfig(game).label} - ${modeConfig.label} (${format.label})`,
    "",
    ...modeConfig.rulePreset.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    `Recommended scoring: ${modeConfig.scoringPreset}.`,
  ].join("\n");
};

export const getGameKey = (value?: string): GameKey => {
  const key = String(value || "freefire").toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "callofduty" || key === "cod" || key === "codm") return "callofduty";
  if (key === "bgmi" || key === "pubg") return "bgmi";
  if (key === "valorant") return "valorant";
  return "freefire";
};
