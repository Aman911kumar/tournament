import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Gamepad2,
  Trophy,
  DollarSign,
  Calendar,
  Users,
  FileText,
  ImagePlus,
  CheckCircle2,
  Layers,
  Swords,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  Award,
  Hash,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { createTournament, updateTournament } from "@/api/tournaments";
import { getErrorToast } from "@/lib/page-utils";
import {
  CreatorTournamentInput,
  getCreatorTournamentById,
  saveCreatorTournament,
} from "@/lib/creator-tournaments";

const gameOptions = ["Free Fire", "BGMI", "Call of Duty", "Valorant"];
const typeOptions: { value: "solo" | "duo" | "squad"; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Duo" },
  { value: "squad", label: "Squad" },
];
const formatOptions: { value: "single_elim" | "double_elim" | "round_robin" | "swiss"; label: string }[] = [
  { value: "single_elim", label: "Single Elim" },
  { value: "double_elim", label: "Double Elim" },
  { value: "round_robin", label: "Round Robin" },
  { value: "swiss", label: "Swiss" },
];

interface PrizeDistribution {
  place: string;
  amount: string;
}

interface FormState {
  game: string;
  title: string;
  description: string;
  type: "solo" | "duo" | "squad" | "";
  format: "single_elim" | "double_elim" | "round_robin" | "swiss" | "";
  entryFee: string;
  prizePool: string;
  registrationStart: string;
  registrationEnd: string;
  startAt: string;
  endAt: string;
  maxPlayers: string;
  rules: string;
  roomId: string;
  roomPass: string;
}

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors";

const EMPTY_FORM: FormState = {
  game: "",
  title: "",
  description: "",
  type: "",
  format: "",
  entryFee: "",
  prizePool: "",
  registrationStart: "",
  registrationEnd: "",
  startAt: "",
  endAt: "",
  maxPlayers: "",
  rules: "",
  roomId: "",
  roomPass: "",
};

const CreateTournamentScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [distribution, setDistribution] = useState<PrizeDistribution[]>([
    { place: "1", amount: "" },
  ]);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY_FORM);
      setDistribution([{ place: "1", amount: "" }]);
      return;
    }

    const tournament = getCreatorTournamentById(id);

    if (!tournament) {
      toast.error("Tournament not found", { description: "The tournament may have been deleted." });
      navigate("/creator-dashboard");
      return;
    }

    setForm({
      game: tournament.game,
      title: tournament.title,
      description: tournament.description,
      type: tournament.type,
      format: tournament.format,
      entryFee: String(tournament.entryFee || ""),
      prizePool: String(tournament.prizePool.total || ""),
      registrationStart: tournament.registrationStart,
      registrationEnd: tournament.registrationEnd,
      startAt: tournament.startAt,
      endAt: tournament.endAt ?? "",
      maxPlayers: String(tournament.maxPlayers || ""),
      rules: tournament.rules,
      roomId: tournament.room_details.roomId,
      roomPass: tournament.room_details.roomPass,
    });
    setDistribution(
      tournament.prizePool.distribution.length > 0
        ? tournament.prizePool.distribution.map((item) => ({
            place: String(item.place),
            amount: String(item.amount),
          }))
        : [{ place: "1", amount: "" }],
    );
  }, [id, navigate]);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [field]: value }));

  const updateDist = (idx: number, field: keyof PrizeDistribution, value: string) =>
    setDistribution((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));

  const addDist = () =>
    setDistribution((prev) => [...prev, { place: String(prev.length + 1), amount: "" }]);

  const removeDist = (idx: number) =>
    setDistribution((prev) => prev.filter((_, i) => i !== idx));

  const handlePublish = async () => {
    if (
      !form.game ||
      !form.title ||
      !form.type ||
      !form.format ||
      !form.prizePool ||
      !form.maxPlayers ||
      !form.registrationStart ||
      !form.registrationEnd ||
      !form.startAt
    ) {
      toast.error("Missing fields", { description: "Please fill in all required fields." });
      return;
    }

    const payload: CreatorTournamentInput = {
      game: form.game,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type as CreatorTournamentInput["type"],
      format: form.format as CreatorTournamentInput["format"],
      entryFee: Number(form.entryFee || 0),
      maxPlayers: Number(form.maxPlayers),
      registrationStart: form.registrationStart,
      registrationEnd: form.registrationEnd,
      startAt: form.startAt,
      endAt: form.endAt || undefined,
      rules: form.rules.trim(),
      prizePool: {
        total: Number(form.prizePool || 0),
        distribution: distribution
          .filter((d) => d.place && d.amount)
          .map((d) => ({ place: Number(d.place), amount: Number(d.amount) })),
      },
      room_details: {
        roomId: form.roomId.trim(),
        roomPass: form.roomPass.trim(),
      },
    };

    try {
      setPublishing(true);
      if (isEditing && id) {
        await updateTournament(id, payload);
      } else {
        await createTournament(payload);
      }
      saveCreatorTournament(payload, id);
      setPublished(true);
    } catch (err) {
      const errorToast = getErrorToast(err, {
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
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">
          {isEditing ? "Edit Tournament" : "Create Tournament"}
        </h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        {/* Game Selection */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" /> Select Game *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {gameOptions.map((g) => (
              <motion.button
                key={g}
                whileTap={{ scale: 0.95 }}
                onClick={() => update("game", g)}
                className={`px-3 py-2.5 rounded-lg text-xs font-heading font-medium transition-all ${form.game === g
                    ? "bg-primary text-primary-foreground neon-glow-purple"
                    : "glass text-muted-foreground hover:text-foreground"
                  }`}
              >
                {g}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        {/* Title */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Tournament Title *
          </label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Pro League Season 5"
            className={inputClass}
          />
        </GlassCard>

        {/* Description */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Short overview of your tournament..."
            rows={3}
            className={`${inputClass} font-body resize-none`}
          />
        </GlassCard>

        {/* Type */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Team Type *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((t) => (
              <motion.button
                key={t.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => update("type", t.value)}
                className={`px-3 py-2.5 rounded-lg text-xs font-heading font-medium transition-all ${form.type === t.value
                    ? "bg-primary text-primary-foreground neon-glow-purple"
                    : "glass text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t.label}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        {/* Format */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Tournament Format *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {formatOptions.map((f) => (
              <motion.button
                key={f.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => update("format", f.value)}
                className={`px-3 py-2.5 rounded-lg text-xs font-heading font-medium transition-all flex items-center justify-center gap-1.5 ${form.format === f.value
                    ? "bg-primary text-primary-foreground neon-glow-purple"
                    : "glass text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Swords className="w-3 h-3" />
                {f.label}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        {/* Entry Fee + Prize */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Entry Fee
            </label>
            <input
              type="number"
              value={form.entryFee}
              onChange={(e) => update("entryFee", e.target.value)}
              placeholder="0 (Free)"
              className={inputClass}
            />
          </GlassCard>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-accent" /> Prize Pool *
            </label>
            <input
              type="number"
              value={form.prizePool}
              onChange={(e) => update("prizePool", e.target.value)}
              placeholder="10000"
              className={inputClass}
            />
          </GlassCard>
        </div>

        {/* Prize Distribution */}
        <GlassCard neon>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground font-heading flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-accent" /> Prize Distribution
            </label>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addDist}
              className="text-xs font-heading text-primary flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </motion.button>
          </div>
          <div className="space-y-2">
            {distribution.map((d, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                <input
                  type="number"
                  value={d.place}
                  onChange={(e) => updateDist(i, "place", e.target.value)}
                  placeholder="Place"
                  className={inputClass}
                />
                <input
                  type="number"
                  value={d.amount}
                  onChange={(e) => updateDist(i, "amount", e.target.value)}
                  placeholder="Amount"
                  className={inputClass}
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeDist(i)}
                  className="p-2 text-destructive hover:text-destructive/80"
                  disabled={distribution.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Registration Window */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Registration Start *
            </label>
            <input
              type="datetime-local"
              value={form.registrationStart}
              onChange={(e) => update("registrationStart", e.target.value)}
              className={`${inputClass} text-foreground`}
            />
          </GlassCard>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Registration End *
            </label>
            <input
              type="datetime-local"
              value={form.registrationEnd}
              onChange={(e) => update("registrationEnd", e.target.value)}
              className={`${inputClass} text-foreground`}
            />
          </GlassCard>
        </div>

        {/* Tournament Schedule */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Start At *
            </label>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => update("startAt", e.target.value)}
              className={`${inputClass} text-foreground`}
            />
          </GlassCard>
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> End At
            </label>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => update("endAt", e.target.value)}
              className={`${inputClass} text-foreground`}
            />
          </GlassCard>
        </div>

        {/* Max Players */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Max Players *
          </label>
          <input
            type="number"
            value={form.maxPlayers}
            onChange={(e) => update("maxPlayers", e.target.value)}
            placeholder="e.g. 100"
            className={inputClass}
          />
        </GlassCard>

        {/* Room Details */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-2 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-secondary" /> Room Details
          </label>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Room ID
              </p>
              <input
                value={form.roomId}
                onChange={(e) => update("roomId", e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Room Pass
              </p>
              <input
                value={form.roomPass}
                onChange={(e) => update("roomPass", e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2">
            Share with players when the match goes live.
          </p>
        </GlassCard>

        {/* Rules */}
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Rules
          </label>
          <textarea
            value={form.rules}
            onChange={(e) => update("rules", e.target.value)}
            placeholder="Enter tournament rules, format, and any special instructions..."
            rows={4}
            className={`${inputClass} font-body resize-none`}
          />
        </GlassCard>

        {/* Banner Upload */}
        <GlassCard neon className="flex flex-col items-center justify-center py-8">
          <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground font-heading">Upload Tournament Banner</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG up to 5MB</p>
        </GlassCard>

        {/* Publish */}
        <NeonButton full variant="green" className="text-sm py-3 mt-2" onClick={handlePublish} disabled={publishing}>
          {publishing ? (isEditing ? "SAVING..." : "PUBLISHING...") : isEditing ? "SAVE TOURNAMENT" : "PUBLISH TOURNAMENT"}
        </NeonButton>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center neon-border"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-3" />
              </motion.div>
              <h3 className="font-heading text-lg font-bold mb-1">
                {isEditing ? "Tournament Updated!" : "Tournament Published!"}
              </h3>
              <p className="text-xs text-muted-foreground font-body mb-4">
                {isEditing
                  ? `Your changes to "${form.title}" have been saved.`
                  : `Your tournament "${form.title}" is now live. Players can register now!`}
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
