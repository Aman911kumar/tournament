import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crosshair,
  Eye,
  FileText,
  Gamepad2,
  Hash,
  IndianRupee,
  Info,
  KeyRound,
  Lock,
  Map,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import {
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/design-system";
import { toast } from "@/components/ui/sonner";
import { createTournament, getTournamentById, updateTournament } from "@/api/tournaments";
import { getErrorToast } from "@/lib/page-utils";
import { CACHE_KEYS, removeCache, removeCacheByPrefix, writeCache } from "@/lib/offline-cache";
import { cn } from "@/lib/utils";
import {
  GameKey,
  PrizeMode,
  TeamType,
  TOURNAMENT_SETUP_CONFIG,
  getFormatConfig,
  getGameConfig,
  getGameKey,
  getModeConfig,
  getRulePresetText,
} from "@/config/tournamentSetup.config";

interface FormState {
  game: GameKey;
  title: string;
  description: string;
  gameMode: string;
  type: TeamType;
  teamSize: string;
  maxTeams: string;
  entryFee: string;
  prizeMode: PrizeMode;
  killPrizeAmount: string;
  prizeDistribution: { position: string; prizeAmount: string }[];
  registrationStart: string;
  registrationEnd: string;
  startAt: string;
  mapName: string;
  rules: string;
  roomId: string;
  roomPass: string;
  roomJoinTime: string;
}

interface TournamentPayload {
  game: GameKey;
  title: string;
  description: string;
  gameMode: string;
  mapName: string;
  platform: ReturnType<typeof getGameConfig>["platform"];
  perspective: ReturnType<typeof getGameConfig>["perspective"];
  type: TeamType;
  teamSize: number;
  maxTeams: number;
  maxPlayers: number;
  entryFee: number;
  prizeMode: PrizeMode;
  killPrizeAmount: number;
  visibility: "public" | "private";
  registrationStart: string;
  registrationEnd: string;
  startAt: string;
  endAt?: string | null;
  rules: string;
  prizeDistribution: { position: number; prizeAmount: number }[];
  room_details: {
    roomId: string;
    roomPass: string;
    roomJoinTime?: string;
  };
}

type IssueType = "error" | "warning" | "info";

interface SetupIssue {
  type: IssueType;
  message: string;
}

const inputClass =
  "arena-focus w-full min-h-11 rounded-xl border border-glass-border bg-background/45 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/55";

const labelClass =
  "mb-1.5 flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

const toDateTimeLocal = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

const nowLocal = () => toDateTimeLocal(new Date().toISOString());

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const makeEmptyForm = (game: GameKey = "freefire"): FormState => {
  const gameConfig = getGameConfig(game);
  const mode = getModeConfig(game, gameConfig.defaultMode);
  const format = mode.formats[0];

  return {
    game,
    title: "",
    description: "",
    gameMode: mode.value,
    type: format.value,
    teamSize: String(format.teamSize),
    maxTeams: String(format.defaultTeams),
    entryFee: "0",
    prizeMode: mode.defaultPrizeMode,
    killPrizeAmount: mode.defaultKillPrize ?? "",
    prizeDistribution: [{ position: "1", prizeAmount: "" }],
    registrationStart: nowLocal(),
    registrationEnd: "",
    startAt: "",
    mapName: mode.recommendedMaps[0] ?? "",
    rules: getRulePresetText(game, mode.value, format.value),
    roomId: "",
    roomPass: "",
    roomJoinTime: "",
  };
};

const shouldReplaceRules = (previous: FormState) => {
  const previousPreset = getRulePresetText(previous.game, previous.gameMode, previous.type).trim();
  const current = previous.rules.trim();

  return !current || current === previousPreset;
};

const isValidDate = (value?: string) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const toNumber = (value: string | number | undefined, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const SectionTitle = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gamepad2;
  title: string;
  description?: string;
}) => (
  <div className="mb-3 flex items-start gap-2.5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <h2 className="font-heading text-sm font-black leading-tight sm:text-base">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  </div>
);

const CreateTournamentScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [published, setPublished] = useState(false);
  const [publishedTournamentId, setPublishedTournamentId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState<"public" | "private">("public");
  const [form, setForm] = useState<FormState>(() => makeEmptyForm());

  const gameConfig = getGameConfig(form.game);
  const modeConfig = getModeConfig(form.game, form.gameMode);
  const formatConfig = getFormatConfig(form.game, form.gameMode, form.type);
  const teamSize = toNumber(form.teamSize, formatConfig.teamSize);
  const maxTeams = toNumber(form.maxTeams, formatConfig.defaultTeams);
  const totalSlots = Math.max(teamSize * maxTeams, 0);
  const usesPositionPrize = form.prizeMode === "position" || form.prizeMode === "both";
  const usesKillPrize = form.prizeMode === "kill" || form.prizeMode === "both";
  const killPrizeAmount = toNumber(form.killPrizeAmount);

  const resolvedPrizeDistribution = useMemo(() => {
    return form.prizeDistribution
      .map((row) => ({
        position: toNumber(row.position),
        prizeAmount: toNumber(row.prizeAmount),
      }))
      .filter((row) => row.position > 0 && row.prizeAmount > 0);
  }, [form.prizeDistribution]);

  const configuredPrizeTotal = useMemo(
    () => resolvedPrizeDistribution.reduce((sum, row) => sum + row.prizeAmount, 0),
    [resolvedPrizeDistribution],
  );

  const issues = useMemo<SetupIssue[]>(() => {
    const next: SetupIssue[] = [];
    const selectedMode = getModeConfig(form.game, form.gameMode);
    const selectedFormat = selectedMode.formats.find((item) => item.value === form.type);
    const teamNumber = toNumber(form.teamSize);
    const teamCount = toNumber(form.maxTeams);
    const slots = teamNumber * teamCount;

    if (!form.title.trim()) {
      next.push({ type: "error", message: "Tournament name is required." });
    } else if (form.title.trim().length < 4) {
      next.push({ type: "warning", message: "A clearer tournament name helps players trust the event." });
    }

    if (!selectedFormat) {
      next.push({ type: "error", message: `${selectedMode.label} does not support this team format.` });
    } else {
      if (teamNumber !== selectedFormat.teamSize) {
        next.push({ type: "error", message: `${selectedMode.label} ${selectedFormat.label} requires team size ${selectedFormat.teamSize}.` });
      }
      if (teamCount < selectedFormat.minTeams || teamCount > selectedFormat.maxTeams) {
        next.push({ type: "error", message: `${selectedFormat.label} supports ${selectedFormat.minTeams}-${selectedFormat.maxTeams} teams.` });
      }
      if (slots > selectedFormat.maxPlayers) {
        next.push({ type: "error", message: `Total slots cannot exceed ${selectedFormat.maxPlayers} for this setup.` });
      }
    }

    if (!form.registrationEnd || !form.startAt) {
      next.push({ type: "error", message: "Registration close time and tournament start time are required." });
    } else if (isValidDate(form.registrationEnd) && isValidDate(form.startAt)) {
      if (new Date(form.startAt) <= new Date(form.registrationEnd)) {
        next.push({ type: "error", message: "Tournament start must be after registration closes." });
      }
      if (isValidDate(form.registrationStart) && new Date(form.registrationEnd) <= new Date(form.registrationStart)) {
        next.push({ type: "error", message: "Registration close must be after registration open." });
      }
    }

    if (form.roomJoinTime && form.startAt && new Date(form.roomJoinTime) > new Date(form.startAt)) {
      next.push({ type: "error", message: "Room join time must be before tournament start." });
    }

    if (usesPositionPrize && resolvedPrizeDistribution.length === 0) {
      next.push({ type: "error", message: "Add at least one placement prize or switch prize type." });
    }

    if (usesKillPrize && killPrizeAmount <= 0) {
      next.push({ type: "error", message: "Per-kill prize must be greater than zero." });
    }

    if (!form.mapName.trim()) {
      next.push({ type: "info", message: "Choose a recommended map to reduce player confusion." });
    }

    if (!form.description.trim()) {
      next.push({ type: "info", message: "A short description improves join confidence." });
    }

    return next;
  }, [
    form.description,
    form.game,
    form.gameMode,
    form.mapName,
    form.maxTeams,
    form.registrationEnd,
    form.registrationStart,
    form.roomJoinTime,
    form.startAt,
    form.teamSize,
    form.title,
    form.type,
    killPrizeAmount,
    resolvedPrizeDistribution.length,
    usesKillPrize,
    usesPositionPrize,
  ]);

  const errorCount = issues.filter((issue) => issue.type === "error").length;
  const warningCount = issues.filter((issue) => issue.type === "warning").length;
  const canPublish = !publishing && errorCount === 0;

  useEffect(() => {
    if (!id) {
      setForm(makeEmptyForm());
      setCurrentVisibility("public");
      return;
    }

    let active = true;
    getTournamentById(id)
      .then((tournament) => {
        if (!active || !tournament) return;
        const game = getGameKey(tournament.game);
        const mode = getModeConfig(game, tournament.gameMode);
        const format = getFormatConfig(game, mode.value, tournament.type);

        setCurrentVisibility(tournament.visibility === "private" ? "private" : "public");
        setForm({
          game,
          title: tournament.title,
          description: tournament.description ?? "",
          gameMode: mode.value,
          type: format.value,
          teamSize: String(tournament.teamSize || format.teamSize),
          maxTeams: String(tournament.maxTeams || Math.ceil((tournament.maxPlayers || format.defaultTeams * format.teamSize) / format.teamSize)),
          entryFee: String(tournament.entryFee ?? 0),
          prizeMode: tournament.prizeMode ?? mode.defaultPrizeMode,
          killPrizeAmount: tournament.killPrizeAmount ? String(tournament.killPrizeAmount) : mode.defaultKillPrize ?? "",
          prizeDistribution:
            tournament.prizeDistribution?.length
              ? tournament.prizeDistribution.map((row) => ({
                position: String(row.position),
                prizeAmount: String(row.prizeAmount),
              }))
              : [{ position: "1", prizeAmount: "" }],
          registrationStart: toDateTimeLocal(tournament.registrationStart) || nowLocal(),
          registrationEnd: toDateTimeLocal(tournament.registrationEnd),
          startAt: toDateTimeLocal(tournament.startAt),
          mapName: tournament.mapName || mode.recommendedMaps[0] || "",
          rules: tournament.rules || getRulePresetText(game, mode.value, format.value),
          roomId: tournament.room_details?.roomId ?? "",
          roomPass: tournament.room_details?.roomPass ?? "",
          roomJoinTime: toDateTimeLocal(tournament.room_details?.roomJoinTime),
        });
      })
      .catch((error) => {
        const errorToast = getErrorToast(error, {
          action: "Load tournament",
          fallback: "Tournament not found.",
        });
        toast.error(errorToast.title, { description: errorToast.description });
        navigate("/creator-dashboard");
      });

    return () => {
      active = false;
    };
  }, [id, navigate]);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const selectGame = (game: GameKey) => {
    const nextGame = getGameConfig(game);
    const nextMode = getModeConfig(game, nextGame.defaultMode);
    const nextFormat = nextMode.formats[0];

    setForm((previous) => ({
      ...previous,
      game,
      gameMode: nextMode.value,
      type: nextFormat.value,
      teamSize: String(nextFormat.teamSize),
      maxTeams: String(nextFormat.defaultTeams),
      mapName: nextMode.recommendedMaps[0] ?? "",
      prizeMode: nextMode.defaultPrizeMode,
      killPrizeAmount: nextMode.defaultKillPrize ?? "",
      rules: shouldReplaceRules(previous)
        ? getRulePresetText(game, nextMode.value, nextFormat.value)
        : previous.rules,
    }));
  };

  const selectMode = (modeValue: string) => {
    const nextMode = getModeConfig(form.game, modeValue);
    const nextFormat = nextMode.formats[0];

    setForm((previous) => ({
      ...previous,
      gameMode: nextMode.value,
      type: nextFormat.value,
      teamSize: String(nextFormat.teamSize),
      maxTeams: String(nextFormat.defaultTeams),
      mapName: nextMode.recommendedMaps[0] ?? previous.mapName,
      prizeMode: nextMode.defaultPrizeMode,
      killPrizeAmount: nextMode.defaultKillPrize ?? "",
      rules: shouldReplaceRules(previous)
        ? getRulePresetText(previous.game, nextMode.value, nextFormat.value)
        : previous.rules,
    }));
  };

  const selectFormat = (type: TeamType) => {
    const nextFormat = getFormatConfig(form.game, form.gameMode, type);

    setForm((previous) => ({
      ...previous,
      type: nextFormat.value,
      teamSize: String(nextFormat.teamSize),
      maxTeams: String(nextFormat.defaultTeams),
      rules: shouldReplaceRules(previous)
        ? getRulePresetText(previous.game, previous.gameMode, nextFormat.value)
        : previous.rules,
    }));
  };

  const updateMaxTeams = (value: string) => {
    const raw = toNumber(value, formatConfig.defaultTeams);
    const clamped = Math.min(Math.max(raw, formatConfig.minTeams), formatConfig.maxTeams);
    update("maxTeams", value === "" ? "" : String(clamped));
  };

  const applyRecommendedRules = () => {
    update("rules", getRulePresetText(form.game, form.gameMode, form.type));
  };

  const handlePublish = async () => {
    if (errorCount > 0) {
      toast.error("Fix tournament setup", {
        description: issues.find((issue) => issue.type === "error")?.message ?? "Some tournament details are invalid.",
      });
      return;
    }

    const payload: TournamentPayload = {
      game: form.game,
      title: form.title.trim(),
      description: form.description.trim(),
      gameMode: modeConfig.value,
      mapName: form.mapName.trim(),
      platform: gameConfig.platform,
      perspective: gameConfig.perspective,
      type: formatConfig.value,
      teamSize: formatConfig.teamSize,
      maxTeams,
      maxPlayers: totalSlots,
      entryFee: toNumber(form.entryFee),
      prizeMode: form.prizeMode,
      killPrizeAmount: usesKillPrize ? killPrizeAmount : 0,
      visibility: currentVisibility,
      registrationStart: toIsoDateTime(form.registrationStart || nowLocal()),
      registrationEnd: toIsoDateTime(form.registrationEnd),
      startAt: toIsoDateTime(form.startAt),
      endAt: null,
      rules: form.rules.trim(),
      prizeDistribution: usesPositionPrize ? resolvedPrizeDistribution : [],
      room_details: {
        roomId: form.roomId.trim(),
        roomPass: form.roomPass.trim(),
        ...(form.roomJoinTime ? { roomJoinTime: toIsoDateTime(form.roomJoinTime) } : {}),
      },
    };

    try {
      setPublishing(true);
      let savedTournamentId = id || null;
      if (isEditing && id) {
        const res = await updateTournament(id, payload);
        if (res.data?._id) {
          savedTournamentId = res.data._id;
          writeCache(CACHE_KEYS.tournamentDetail(res.data._id), res.data);
        }
      } else {
        const res = await createTournament(payload);
        if (res.data?._id) {
          savedTournamentId = res.data._id;
          writeCache(CACHE_KEYS.tournamentDetail(res.data._id), res.data);
        }
      }

      removeCache(CACHE_KEYS.home);
      removeCacheByPrefix("tournaments.page.");
      removeCacheByPrefix("creatorDashboard.");
      setPublishedTournamentId(savedTournamentId);
      setPublished(true);
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: isEditing ? "Update tournament" : "Publish tournament",
        fallback: isEditing ? "Update failed." : "Publish failed.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setPublishing(false);
    }
  };

  const firstError = issues.find((issue) => issue.type === "error");
  const setupHealthTone = errorCount > 0 ? "danger" : warningCount > 0 ? "primary" : "accent";

  return (
    <PageShell wide contentClassName="max-w-7xl space-y-3 pb-24 sm:space-y-4">
      <PageHeader
        title={isEditing ? "Edit Tournament" : "Create Tournament"}
        subtitle="Smart esports setup with valid game formats"
        onBack={() => navigate(-1)}
        action={
          <StatusPill tone={setupHealthTone}>
            {errorCount > 0 ? `${errorCount} fix` : warningCount > 0 ? `${warningCount} tip` : "Ready"}
          </StatusPill>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-3">
          <Surface neon className="p-3 sm:p-4">
            <SectionTitle
              icon={Gamepad2}
              title="Game Setup"
              description="Choose the game first. Modes and team formats will lock to valid esports structures."
            />

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {(Object.keys(TOURNAMENT_SETUP_CONFIG) as GameKey[]).map((game) => {
                const item = TOURNAMENT_SETUP_CONFIG[game];
                const active = form.game === game;
                return (
                  <button
                    key={game}
                    type="button"
                    onClick={() => selectGame(game)}
                    className={cn(
                      "arena-focus min-h-[74px] rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary/45 bg-primary text-primary-foreground"
                        : "border-glass-border bg-background/45 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                    )}
                  >
                    <span className="block font-heading text-sm font-black">{item.label}</span>
                    <span className="mt-1 block text-[10px] uppercase opacity-75">
                      {item.platform} / {item.short}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <label className={labelClass}>
                  <Swords className="h-3.5 w-3.5" />
                  Mode
                </label>
                <div className="grid gap-2">
                  {gameConfig.modes.map((mode) => {
                    const active = form.gameMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => selectMode(mode.value)}
                        className={cn(
                          "arena-focus rounded-xl border p-3 text-left transition-colors",
                          active
                            ? "border-secondary/50 bg-secondary/15 text-foreground"
                            : "border-glass-border bg-background/35 text-muted-foreground hover:border-secondary/35 hover:text-foreground",
                        )}
                      >
                        <span className="block font-heading text-sm font-bold">{mode.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed">{mode.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  <Users className="h-3.5 w-3.5" />
                  Team Format
                </label>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  {modeConfig.formats.map((format) => {
                    const active = form.type === format.value;
                    return (
                      <button
                        key={`${modeConfig.value}-${format.value}`}
                        type="button"
                        onClick={() => selectFormat(format.value)}
                        className={cn(
                          "arena-focus rounded-xl border p-3 text-left transition-colors",
                          active
                            ? "border-accent/50 bg-accent/15 text-foreground"
                            : "border-glass-border bg-background/35 text-muted-foreground hover:border-accent/35 hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-heading text-sm font-bold">{format.label}</span>
                          <span className="rounded-full bg-background/55 px-2 py-0.5 font-heading text-[10px]">
                            {format.teamSize} x {format.defaultTeams}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed">{format.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="p-3 sm:p-4">
            <SectionTitle
              icon={Trophy}
              title="Tournament Details"
              description="Clear titles, maps, and descriptions reduce disputes before the room opens."
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>
                  <Trophy className="h-3.5 w-3.5" />
                  Tournament Name
                </label>
                <input
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder={`${gameConfig.label} ${modeConfig.label} Cup`}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  <FileText className="h-3.5 w-3.5" />
                  Short Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Add room timing, match flow, eligibility, or prize notes..."
                  rows={3}
                  className={`${inputClass} resize-none font-body`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Map className="h-3.5 w-3.5" />
                  Map
                </label>
                <input
                  value={form.mapName}
                  onChange={(event) => update("mapName", event.target.value)}
                  placeholder="Select or type map"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Eye className="h-3.5 w-3.5" />
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["public", "private"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCurrentVisibility(value)}
                      className={cn(
                        "arena-focus min-h-11 rounded-xl border px-3 font-heading text-xs font-bold capitalize transition-colors",
                        currentVisibility === value
                          ? "border-primary/45 bg-primary text-primary-foreground"
                          : "border-glass-border bg-background/45 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {modeConfig.recommendedMaps.map((map) => (
                <button
                  key={map}
                  type="button"
                  onClick={() => update("mapName", map)}
                  className={cn(
                    "arena-focus shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    form.mapName === map
                      ? "border-secondary/45 bg-secondary/15 text-secondary"
                      : "border-glass-border bg-background/45 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {map}
                </button>
              ))}
            </div>
          </Surface>

          <div className="grid gap-3 xl:grid-cols-2">
            <Surface className="p-3 sm:p-4">
              <SectionTitle
                icon={Users}
                title="Slots & Entry"
                description="Team size is locked by the selected esports format."
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Teams</label>
                  <input
                    type="number"
                    min={formatConfig.minTeams}
                    max={formatConfig.maxTeams}
                    disabled={formatConfig.minTeams === formatConfig.maxTeams}
                    value={form.maxTeams}
                    onChange={(event) => updateMaxTeams(event.target.value)}
                    className={cn(inputClass, "disabled:cursor-not-allowed disabled:opacity-70")}
                  />
                </div>
                <div>
                  <label className={labelClass}>Team Size</label>
                  <input
                    type="number"
                    disabled
                    value={form.teamSize}
                    className={`${inputClass} cursor-not-allowed opacity-70`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Slots</label>
                  <div className="flex min-h-11 items-center rounded-xl border border-primary/25 bg-primary/10 px-3 font-heading text-sm font-black text-primary">
                    {totalSlots}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClass}>
                  <IndianRupee className="h-3.5 w-3.5" />
                  Entry Fee
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.entryFee}
                  onChange={(event) => update("entryFee", event.target.value)}
                  placeholder="0 for free"
                  className={inputClass}
                />
              </div>

              <p className="mt-3 rounded-xl border border-glass-border bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                Valid range: {formatConfig.minTeams}-{formatConfig.maxTeams} teams, max {formatConfig.maxPlayers} players.
              </p>
            </Surface>

            <Surface className="p-3 sm:p-4">
              <SectionTitle
                icon={Award}
                title="Prize & Scoring"
                description={modeConfig.scoringPreset}
              />

              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "position" as PrizeMode, label: "Rank", icon: Trophy },
                  { value: "kill" as PrizeMode, label: "Kill", icon: Crosshair },
                  { value: "both" as PrizeMode, label: "Both", icon: Award },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update("prizeMode", option.value)}
                      className={cn(
                        "arena-focus min-h-11 rounded-xl border px-2 text-xs font-bold transition-colors",
                        form.prizeMode === option.value
                          ? "border-primary/45 bg-primary text-primary-foreground"
                          : "border-glass-border bg-background/45 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {usesKillPrize && (
                <div className="mt-3">
                  <label className={labelClass}>Per Kill Prize</label>
                  <input
                    type="number"
                    min="0"
                    value={form.killPrizeAmount}
                    onChange={(event) => update("killPrizeAmount", event.target.value)}
                    placeholder="Amount per kill"
                    className={inputClass}
                  />
                </div>
              )}

              {usesPositionPrize && (
                <div className="mt-3 space-y-2">
                  <label className={labelClass}>Placement Prize</label>
                  {form.prizeDistribution.map((row, index) => (
                    <div key={index} className="grid grid-cols-[72px_minmax(0,1fr)_40px] gap-2">
                      <input
                        type="number"
                        min="1"
                        value={row.position || String(index + 1)}
                        onChange={(event) => {
                          const position = event.target.value;
                          setForm((previous) => {
                            const next = [...previous.prizeDistribution];
                            next[index] = { ...next[index], position };
                            return { ...previous, prizeDistribution: next };
                          });
                        }}
                        placeholder="#"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min="0"
                        value={row.prizeAmount}
                        onChange={(event) => {
                          const prizeAmount = event.target.value;
                          setForm((previous) => {
                            const next = [...previous.prizeDistribution];
                            next[index] = { ...next[index], prizeAmount };
                            return { ...previous, prizeDistribution: next };
                          });
                        }}
                        placeholder="Prize amount"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        className="arena-focus grid h-11 w-10 place-items-center rounded-xl border border-glass-border text-muted-foreground transition-colors hover:border-destructive/45 hover:text-destructive"
                        onClick={() =>
                          setForm((previous) => {
                            const next = previous.prizeDistribution.filter((_, i) => i !== index);
                            return {
                              ...previous,
                              prizeDistribution: next.length ? next : [{ position: "1", prizeAmount: "" }],
                            };
                          })
                        }
                        aria-label="Remove prize row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <NeonButton
                    full
                    variant="ghost"
                    className="min-h-10 text-xs"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        prizeDistribution: [
                          ...previous.prizeDistribution,
                          { position: String(previous.prizeDistribution.length + 1), prizeAmount: "" },
                        ],
                      }))
                    }
                  >
                    Add Place
                  </NeonButton>
                </div>
              )}
            </Surface>
          </div>

          <Surface className="p-3 sm:p-4">
            <SectionTitle
              icon={Calendar}
              title="Schedule & Room"
              description="Keep registration, start time, and room release in a clean sequence."
            />

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={labelClass}>
                  <Calendar className="h-3.5 w-3.5" />
                  Opens
                </label>
                <input
                  type="datetime-local"
                  value={form.registrationStart}
                  onChange={(event) => update("registrationStart", event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Calendar className="h-3.5 w-3.5" />
                  Closes
                </label>
                <input
                  type="datetime-local"
                  value={form.registrationEnd}
                  onChange={(event) => update("registrationEnd", event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Radio className="h-3.5 w-3.5" />
                  Starts
                </label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => update("startAt", event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <label className={labelClass}>
                  <Hash className="h-3.5 w-3.5" />
                  Room ID
                </label>
                <input
                  value={form.roomId}
                  onChange={(event) => update("roomId", event.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Lock className="h-3.5 w-3.5" />
                  Room Pass
                </label>
                <input
                  value={form.roomPass}
                  onChange={(event) => update("roomPass", event.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Join Time
                </label>
                <input
                  type="datetime-local"
                  value={form.roomJoinTime}
                  onChange={(event) => update("roomJoinTime", event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </Surface>

          <Surface className="p-3 sm:p-4">
            <SectionTitle
              icon={FileText}
              title="Rules Assistant"
              description="Recommended rules are generated from game, mode, and team format."
            />

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyRecommendedRules}
                className="arena-focus inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 font-heading text-xs font-bold text-primary transition-colors hover:bg-primary/15"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Apply recommended rules
              </button>
              <span className="inline-flex min-h-9 items-center rounded-full border border-glass-border bg-background/45 px-3 text-xs text-muted-foreground">
                {modeConfig.scoringPreset}
              </span>
            </div>

            <textarea
              value={form.rules}
              onChange={(event) => update("rules", event.target.value)}
              placeholder="Rules will appear here..."
              rows={9}
              className={`${inputClass} resize-y font-body leading-relaxed`}
            />
          </Surface>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <Surface neon className="overflow-hidden p-0">
            <div className="relative p-3 sm:p-4">
              <div className="absolute inset-x-0 top-0 h-1 gradient-neon" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-[10px] font-bold uppercase text-muted-foreground">
                    Live Preview
                  </p>
                  <h2 className="mt-1 truncate font-heading text-lg font-black">
                    {form.title.trim() || `${gameConfig.label} Tournament`}
                  </h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {modeConfig.label} - {formatConfig.label}
                  </p>
                </div>
                <StatusPill tone={currentVisibility === "public" ? "accent" : "muted"}>
                  {currentVisibility}
                </StatusPill>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-glass-border bg-background/45 p-2">
                  <Users className="h-4 w-4 text-secondary" />
                  <p className="mt-2 font-heading text-lg font-black">{totalSlots}</p>
                  <p className="text-[10px] text-muted-foreground">Total slots</p>
                </div>
                <div className="rounded-xl border border-glass-border bg-background/45 p-2">
                  <IndianRupee className="h-4 w-4 text-accent" />
                  <p className="mt-2 truncate font-heading text-lg font-black">
                    {toNumber(form.entryFee) > 0 ? formatCurrency(toNumber(form.entryFee)) : "Free"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Entry</p>
                </div>
                <div className="rounded-xl border border-glass-border bg-background/45 p-2">
                  <Map className="h-4 w-4 text-primary" />
                  <p className="mt-2 truncate font-heading text-sm font-black">
                    {form.mapName || "Map TBD"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Map</p>
                </div>
                <div className="rounded-xl border border-glass-border bg-background/45 p-2">
                  <Award className="h-4 w-4 text-accent" />
                  <p className="mt-2 truncate font-heading text-sm font-black">
                    {usesPositionPrize ? formatCurrency(configuredPrizeTotal) : `${formatCurrency(killPrizeAmount)}/kill`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Prize</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-glass-border bg-background/35 p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <p className="font-heading text-xs font-bold">Format guard</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {formatConfig.helper}. Team size and slot limits are locked to prevent invalid tournament setups.
                </p>
              </div>
            </div>
          </Surface>

          <Surface className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-heading text-sm font-black">Setup Intelligence</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {errorCount > 0 ? "Fix blockers before publishing." : "No blocking issues detected."}
                </p>
              </div>
              <StatusPill tone={setupHealthTone}>
                {errorCount > 0 ? "Blocked" : "Valid"}
              </StatusPill>
            </div>

            <div className="mt-3 space-y-2">
              {issues.length === 0 ? (
                <div className="rounded-xl border border-accent/25 bg-accent/10 p-3 text-xs text-accent">
                  All core setup rules look good.
                </div>
              ) : (
                issues.slice(0, 6).map((issue, index) => {
                  const Icon = issue.type === "error" ? AlertTriangle : issue.type === "warning" ? Clock3 : Info;
                  return (
                    <div
                      key={`${issue.type}-${index}`}
                      className={cn(
                        "flex gap-2 rounded-xl border p-2.5 text-xs",
                        issue.type === "error"
                          ? "border-destructive/25 bg-destructive/10 text-destructive"
                          : issue.type === "warning"
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-glass-border bg-background/35 text-muted-foreground",
                      )}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Surface>

          <Surface className="p-3 sm:p-4">
            <p className="font-heading text-sm font-black">Publish Checklist</p>
            <div className="mt-3 space-y-2 text-xs">
              {[
                ["Valid format", errorCount === 0],
                ["Prize configured", usesKillPrize ? killPrizeAmount > 0 : configuredPrizeTotal > 0],
                ["Schedule ready", Boolean(form.registrationEnd && form.startAt)],
                ["Rules attached", Boolean(form.rules.trim())],
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-heading font-bold", ok ? "text-accent" : "text-muted-foreground")}>
                    {ok ? "Ready" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </Surface>
        </aside>
      </div>

      <div className="arena-sticky-actions">
        <NeonButton
          full
          variant={canPublish ? "green" : "ghost"}
          className="min-h-12 text-sm"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? (isEditing ? "SAVING..." : "PUBLISHING...") : isEditing ? "SAVE TOURNAMENT" : "PUBLISH TOURNAMENT"}
          {!publishing && <ChevronRight className="h-4 w-4" />}
        </NeonButton>
        {firstError && (
          <p className="mt-2 px-1 text-center text-[11px] text-destructive sm:hidden">
            {firstError.message}
          </p>
        )}
      </div>

      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/88 p-6"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass w-full max-w-sm rounded-xl p-6 text-center neon-border"
            >
              <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-accent" />
              <h3 className="mb-1 font-heading text-lg font-bold">
                {isEditing ? "Tournament Updated!" : "Tournament Published!"}
              </h3>
              <p className="mb-4 text-xs text-muted-foreground">
                {isEditing
                  ? `Your changes to "${form.title}" have been saved.`
                  : `"${form.title}" is ready for players.`}
              </p>
              <NeonButton
                full
                variant="purple"
                onClick={() => navigate(publishedTournamentId ? `/tournament/${publishedTournamentId}` : "/creator-dashboard")}
              >
                VIEW TOURNAMENT
              </NeonButton>
              <button
                type="button"
                onClick={() => navigate("/creator-dashboard")}
                className="arena-focus mt-3 rounded-lg px-3 py-2 text-xs font-heading text-muted-foreground hover:text-primary"
              >
                Open creator dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
};

export default CreateTournamentScreen;
