import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Crosshair,
  DollarSign,
  FileText,
  Gamepad2,
  Hash,
  IndianRupee,
  KeyRound,
  Lock,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { createTournament, getTournamentById, updateTournament } from "@/api/tournaments";
import { getErrorToast } from "@/lib/page-utils";

type GameKey = "freefire" | "bgmi" | "callofduty" | "valorant";
type TeamType = "solo" | "duo" | "squad" | "team";
type PrizeMode = "position" | "kill" | "both";

interface GamePreset {
  label: string;
  short: string;
  platform: "mobile" | "pc" | "console" | "crossplay";
  perspective: "tpp" | "fpp" | "both" | "na";
  defaultMode: string;
  defaultType: TeamType;
  defaultTeamSize: number;
  defaultTeams: number;
  modes: { value: string; label: string }[];
}

const GAME_PRESETS: Record<GameKey, GamePreset> = {
  freefire: {
    label: "Free Fire",
    short: "FF",
    platform: "mobile",
    perspective: "tpp",
    defaultMode: "battle_royale",
    defaultType: "squad",
    defaultTeamSize: 4,
    defaultTeams: 12,
    modes: [
      { value: "battle_royale", label: "Battle Royale" },
      { value: "clash_squad", label: "Clash Squad" },
      { value: "lone_wolf", label: "Lone Wolf" },
    ],
  },
  bgmi: {
    label: "BGMI",
    short: "BGMI",
    platform: "mobile",
    perspective: "tpp",
    defaultMode: "classic",
    defaultType: "squad",
    defaultTeamSize: 4,
    defaultTeams: 16,
    modes: [
      { value: "classic", label: "Classic" },
      { value: "tdm", label: "TDM" },
      { value: "arena", label: "Arena" },
    ],
  },
  callofduty: {
    label: "Call of Duty",
    short: "COD",
    platform: "mobile",
    perspective: "tpp",
    defaultMode: "battle_royale",
    defaultType: "squad",
    defaultTeamSize: 4,
    defaultTeams: 16,
    modes: [
      { value: "battle_royale", label: "Battle Royale" },
      { value: "multiplayer", label: "Multiplayer" },
      { value: "search_destroy", label: "Search & Destroy" },
    ],
  },
  valorant: {
    label: "Valorant",
    short: "VAL",
    platform: "pc",
    perspective: "na",
    defaultMode: "competitive",
    defaultType: "team",
    defaultTeamSize: 5,
    defaultTeams: 8,
    modes: [
      { value: "competitive", label: "Competitive" },
      { value: "custom", label: "Custom" },
    ],
  },
};

const typeOptions: { value: TeamType; label: string; teamSize: number }[] = [
  { value: "solo", label: "Solo", teamSize: 1 },
  { value: "duo", label: "Duo", teamSize: 2 },
  { value: "squad", label: "Squad", teamSize: 4 },
  { value: "team", label: "5v5 Team", teamSize: 5 },
];

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
  platform: GamePreset["platform"];
  perspective: GamePreset["perspective"];
  type: TeamType;
  teamSize: number;
  maxTeams: number;
  maxPlayers: number;
  entryFee: number;
  prizeMode: PrizeMode;
  killPrizeAmount: number;
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

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors";

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

const BASIC_RULES = [
  "Players must join the custom room at least 10 minutes before match start.",
  "Use only the registered in-game account and assigned slot.",
  "Teaming, hacking, emulator bypass, or abusive behavior leads to disqualification.",
  "Room ID and password must not be shared with unregistered players.",
  "Admin decision is final for result disputes and rule violations.",
].join("\n");

const makeEmptyForm = (game: GameKey = "freefire"): FormState => {
  const preset = GAME_PRESETS[game];
  return {
    game,
    title: "",
    description: "",
    gameMode: preset.defaultMode,
    type: preset.defaultType,
    teamSize: String(preset.defaultTeamSize),
    maxTeams: String(preset.defaultTeams),
    entryFee: "0",
    prizeMode: "position",
    killPrizeAmount: "",
    prizeDistribution: [{ position: "1", prizeAmount: "" }],
    registrationStart: nowLocal(),
    registrationEnd: "",
    startAt: "",
    mapName: "",
    rules: "",
    roomId: "",
    roomPass: "",
    roomJoinTime: "",
  };
};

const getGameKey = (value?: string): GameKey => {
  const key = String(value || "freefire").toLowerCase().replace(/\s+/g, "");
  if (key === "callofduty" || key === "cod") return "callofduty";
  if (key === "bgmi" || key === "valorant" || key === "freefire") return key;
  return "freefire";
};

const CreateTournamentScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<FormState>(() => makeEmptyForm());

  const preset = GAME_PRESETS[form.game];
  const teamSize = Number(form.teamSize || preset.defaultTeamSize);
  const maxTeams = Number(form.maxTeams || preset.defaultTeams);
  const totalSlots = Math.max(teamSize * maxTeams, 0);
  const resolvedPrizeDistribution = useMemo(() => {
    return form.prizeDistribution
      .map((row) => ({ position: Number(row.position), prizeAmount: Number(row.prizeAmount || 0) }))
      .filter((row) => Number.isFinite(row.position) && row.position > 0 && Number.isFinite(row.prizeAmount) && row.prizeAmount > 0);
  }, [form.prizeDistribution]);
  const configuredPrizeTotal = useMemo(
    () => resolvedPrizeDistribution.reduce((sum, row) => sum + row.prizeAmount, 0),
    [resolvedPrizeDistribution],
  );
  const usesPositionPrize = form.prizeMode === "position" || form.prizeMode === "both";
  const usesKillPrize = form.prizeMode === "kill" || form.prizeMode === "both";
  const killPrizeAmount = Number(form.killPrizeAmount || 0);

  useEffect(() => {
    if (!id) {
      setForm(makeEmptyForm());
      return;
    }

    let active = true;
    getTournamentById(id)
      .then((tournament) => {
        if (!active || !tournament) return;
        const game = getGameKey(tournament.game);
        const nextPreset = GAME_PRESETS[game];
        setForm({
          game,
          title: tournament.title,
          description: tournament.description ?? "",
          gameMode: tournament.gameMode ?? nextPreset.defaultMode,
          type: tournament.type,
          teamSize: String(tournament.teamSize || nextPreset.defaultTeamSize),
          maxTeams: String(tournament.maxTeams || Math.ceil((tournament.maxPlayers || nextPreset.defaultTeams) / (tournament.teamSize || nextPreset.defaultTeamSize))),
          entryFee: String(tournament.entryFee ?? 0),
          prizeMode: tournament.prizeMode ?? "position",
          killPrizeAmount: tournament.killPrizeAmount ? String(tournament.killPrizeAmount) : "",
          prizeDistribution:
            tournament.prizeDistribution?.length
              ? tournament.prizeDistribution.map((row) => ({ position: String(row.position), prizeAmount: String(row.prizeAmount) }))
              : [{ position: "1", prizeAmount: "" }],
          registrationStart: toDateTimeLocal(tournament.registrationStart) || nowLocal(),
          registrationEnd: toDateTimeLocal(tournament.registrationEnd),
          startAt: toDateTimeLocal(tournament.startAt),
          mapName: tournament.mapName ?? "",
          rules: tournament.rules ?? "",
          roomId: tournament.room_details?.roomId ?? "",
          roomPass: tournament.room_details?.roomPass ?? "",
          roomJoinTime: toDateTimeLocal(tournament.room_details?.roomJoinTime),
        });
      })
      .catch((error) => {
        const errorToast = getErrorToast(error, { action: "Load tournament", fallback: "Tournament not found." });
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
    const next = makeEmptyForm(game);
    setForm((previous) => ({
      ...previous,
      game,
      gameMode: next.gameMode,
      type: next.type,
      teamSize: next.teamSize,
      maxTeams: next.maxTeams,
    }));
  };

  const selectType = (type: TeamType) => {
    const selected = typeOptions.find((option) => option.value === type);
    setForm((previous) => ({
      ...previous,
      type,
      teamSize: String(selected?.teamSize ?? previous.teamSize),
    }));
  };

  const handlePublish = async () => {
    if (!form.title.trim() || !form.registrationEnd || !form.startAt || !form.maxTeams || !form.teamSize) {
      toast.error("Missing fields", { description: "Add title, registration close time, start time, teams, and team size." });
      return;
    }

    if (new Date(form.startAt) <= new Date(form.registrationEnd)) {
      toast.error("Invalid schedule", { description: "Start time must be after registration closes." });
      return;
    }
    if (new Date(form.registrationEnd) <= new Date(form.registrationStart)) {
      toast.error("Invalid schedule", { description: "Registration close time must be after registration open time." });
      return;
    }
    if (form.roomJoinTime && new Date(form.roomJoinTime) > new Date(form.startAt)) {
      toast.error("Invalid room join time", { description: "Room join time must be before match start time." });
      return;
    }
    if (usesPositionPrize && resolvedPrizeDistribution.length === 0) {
      toast.error("Invalid prize distribution", { description: "Add at least one prize position and amount." });
      return;
    }
    if (usesKillPrize && (!Number.isFinite(killPrizeAmount) || killPrizeAmount <= 0)) {
      toast.error("Invalid kill prize", { description: "Add a per-kill prize amount greater than zero." });
      return;
    }

    const payload: TournamentPayload = {
      game: form.game,
      title: form.title.trim(),
      description: form.description.trim(),
      gameMode: form.gameMode,
      mapName: form.mapName.trim(),
      platform: preset.platform,
      perspective: preset.perspective,
      type: form.type,
      teamSize,
      maxTeams,
      maxPlayers: totalSlots,
      entryFee: Number(form.entryFee || 0),
      prizeMode: form.prizeMode,
      killPrizeAmount: usesKillPrize ? killPrizeAmount : 0,
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
      if (isEditing && id) {
        await updateTournament(id, payload);
      } else {
        await createTournament(payload);
      }
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

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h1 className="font-heading text-xl font-bold">{isEditing ? "Edit Tournament" : "Create Tournament"}</h1>
          <p className="text-[10px] text-muted-foreground font-heading">Free Fire, BGMI, COD, and Valorant presets</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" /> Game
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(GAME_PRESETS) as GameKey[]).map((game) => (
              <button
                key={game}
                type="button"
                onClick={() => selectGame(game)}
                className={`rounded-lg px-3 py-3 text-left transition-all ${form.game === game ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span className="block text-sm font-heading font-bold">{GAME_PRESETS[game].label}</span>
                <span className="text-[10px] opacity-80">{GAME_PRESETS[game].platform.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Tournament Name
          </label>
          <input
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder={`${preset.label} Weekend Cup`}
            className={inputClass}
          />
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" /> Mode
          </label>
          <select value={form.gameMode} onChange={(event) => update("gameMode", event.target.value)} className={inputClass}>
            {preset.modes.map((mode) => (
              <option key={mode.value} value={mode.value} className="bg-background">
                {mode.label}
              </option>
            ))}
          </select>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Team Setup
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {typeOptions.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => selectType(type.value)}
                className={`px-3 py-2.5 rounded-lg text-xs font-heading font-medium transition-all ${form.type === type.value ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground hover:text-foreground"
                  }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Teams</p>
              <input type="number" min="1" value={form.maxTeams} onChange={(event) => update("maxTeams", event.target.value)} className={inputClass} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Team Size</p>
              <input type="number" min="1" max="5" value={form.teamSize} onChange={(event) => update("teamSize", event.target.value)} className={inputClass} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Slots</p>
              <div className="glass rounded-lg px-3 py-2.5 text-sm font-heading font-bold text-primary">{totalSlots}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> Entry Fee
          </label>
          <input type="number" min="0" value={form.entryFee} onChange={(event) => update("entryFee", event.target.value)} placeholder="0 for free" className={inputClass} />
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Position prize pool: {configuredPrizeTotal}
          </p>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> Prize Type
          </label>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 mb-3">
            {[
              { value: "position" as PrizeMode, label: "Position", icon: Trophy },
              { value: "kill" as PrizeMode, label: "Kill", icon: Crosshair },
              { value: "both" as PrizeMode, label: "Both", icon: Award },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("prizeMode", option.value)}
                className={`rounded-lg px-3 py-2.5 text-left transition-all ${form.prizeMode === option.value ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground hover:text-foreground"}`}
              >
                <span className="flex items-center gap-2 text-xs font-heading font-bold">
                  <option.icon className="h-3.5 w-3.5" /> {option.label}
                </span>
              </button>
            ))}
          </div>
          {usesKillPrize && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Per Kill Prize</p>
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
        </GlassCard>

        {usesPositionPrize && (
        <div>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" /> Prize Distribution
            </label>
            <div className="space-y-2">
              {form.prizeDistribution.map((row, index) => (
                <div key={index} className="flex max-[420px]:flex-col items-center max-[420px]:items-start gap-2">
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
                    placeholder="Position"
                    className={`${inputClass} max-w-[100px] flex-1`}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
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
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() =>
                      setForm((previous) => {
                        const next = previous.prizeDistribution.filter((_, i) => i !== index);
                        return { ...previous, prizeDistribution: next };
                      })
                    }
                    aria-label="Remove prize row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <NeonButton full variant="green" onClick={() => setForm((previous) => ({ ...previous, prizeDistribution: [...previous.prizeDistribution, { position: String(previous.prizeDistribution.length + 1), prizeAmount: "" }] }))}>
                Add Place
              </NeonButton>
            </div>
          </GlassCard>
        </div>
        )}

        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Registration Opens
            </label>
            <input type="datetime-local" value={form.registrationStart} onChange={(event) => update("registrationStart", event.target.value)} className={`${inputClass} text-foreground`} />
          </GlassCard>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Registration Closes
            </label>
            <input type="datetime-local" value={form.registrationEnd} onChange={(event) => update("registrationEnd", event.target.value)} className={`${inputClass} text-foreground`} />
          </GlassCard>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Match Starts
            </label>
            <input type="datetime-local" value={form.startAt} onChange={(event) => update("startAt", event.target.value)} className={`${inputClass} text-foreground`} />
          </GlassCard>
        </div>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Optional Details
          </label>
          <textarea
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Short description for players..."
            rows={2}
            className={`${inputClass} font-body resize-none mb-2`}
          />
          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1">Map</p>
              <input value={form.mapName} onChange={(event) => update("mapName", event.target.value)} placeholder="Optional" className={inputClass} />
            </div>
          </div>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-secondary" /> Room Details
          </label>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Room ID
              </p>
              <input value={form.roomId} onChange={(event) => update("roomId", event.target.value)} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Room Pass
              </p>
              <input value={form.roomPass} onChange={(event) => update("roomPass", event.target.value)} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Join Time
              </p>
              <input type="datetime-local" value={form.roomJoinTime} onChange={(event) => update("roomJoinTime", event.target.value)} className={`${inputClass} text-foreground`} />
            </div>
          </div>
        </GlassCard>

        <GlassCard neon>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground font-heading flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Rules
            </label>
            <button
              type="button"
              onClick={() => update("rules", form.rules.trim() ? `${form.rules.trim()}\n${BASIC_RULES}` : BASIC_RULES)}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-heading text-primary hover:bg-primary/20 transition-colors"
            >
              Basic Rules
            </button>
          </div>
          <textarea
            value={form.rules}
            onChange={(event) => update("rules", event.target.value)}
            placeholder="No teaming, be on time, admin decision is final..."
            rows={3}
            className={`${inputClass} font-body resize-none`}
          />
        </GlassCard>

        <NeonButton full variant="green" className="text-sm py-3 mt-2" onClick={handlePublish} disabled={publishing}>
          {publishing ? (isEditing ? "SAVING..." : "PUBLISHING...") : isEditing ? "SAVE TOURNAMENT" : "PUBLISH TOURNAMENT"}
        </NeonButton>
      </div>

      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-6 w-full max-w-sm text-center neon-border">
              <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-3" />
              <h3 className="font-heading text-lg font-bold mb-1">{isEditing ? "Tournament Updated!" : "Tournament Published!"}</h3>
              <p className="text-xs text-muted-foreground font-body mb-4">
                {isEditing ? `Your changes to "${form.title}" have been saved.` : `"${form.title}" is ready for players.`}
              </p>
              <NeonButton full variant="purple" onClick={() => navigate("/creator-dashboard")}>
                VIEW DASHBOARD
              </NeonButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateTournamentScreen;
