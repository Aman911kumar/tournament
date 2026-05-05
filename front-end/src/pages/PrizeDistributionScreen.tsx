import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Gamepad2,
  Trophy,
  Users,
  Wallet,
  Crown,
  Medal,
  Award,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import {
  distributeTournamentPrizes,
  getParticipants,
  getTournamentById,
  Tournament,
  TournamentRegistration,
} from "@/api/tournaments";
import { toast } from "sonner";
import { formatCurrency, getErrorMessage, getErrorToast } from "@/lib/page-utils";
import { cn } from "@/lib/utils";

type PrizeRow = { registrationId: string; place: string; amount: string; resultPlayerName?: string };

const inputClass =
  "w-full bg-background/40 border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all";

const placeMeta = (place: number) => {
  if (place === 1) return { icon: Crown, label: "1st Place", color: "from-yellow-400 to-amber-500", text: "text-yellow-400" };
  if (place === 2) return { icon: Medal, label: "2nd Place", color: "from-slate-300 to-slate-400", text: "text-slate-300" };
  if (place === 3) return { icon: Award, label: "3rd Place", color: "from-orange-400 to-amber-700", text: "text-orange-400" };
  return { icon: Trophy, label: `#${place}`, color: "from-primary to-secondary", text: "text-primary" };
};

const getParticipantName = (registration: TournamentRegistration) => {
  if (registration.user?.username) return registration.user.username;
  const names = registration.team?.map((member) => member.username).filter(Boolean) ?? [];
  return names.length
    ? names.join(", ")
    : registration.slotNumber
      ? `Slot ${registration.slotNumber}`
      : "Participant";
};

const getParticipantGameAccount = (registration: TournamentRegistration) =>
  registration.user?.gameAccount
  ?? registration.gameAccount
  ?? registration.team?.find((member) => member.gameAccount)?.gameAccount
  ?? registration.gameAccounts?.[0]
  ?? null;

const getGameAccountLine = (registration: TournamentRegistration) => {
  const account = getParticipantGameAccount(registration);
  if (!account?.inGameName && !account?.gameId) return "No linked game account";
  return `${account.inGameName || "In-game name not set"}${account.gameId ? ` - ID ${account.gameId}` : ""}${account.verified ? " - Verified" : ""}`;
};

const getGameName = (registration: TournamentRegistration) =>
  getParticipantGameAccount(registration)?.inGameName || "Not set";

const getGameId = (registration: TournamentRegistration) =>
  getParticipantGameAccount(registration)?.gameId || "Not set";

const getParticipantOptionLabel = (registration: TournamentRegistration) => {
  const account = getParticipantGameAccount(registration);
  const gameLabel = account?.inGameName || account?.gameId
    ? `${account.inGameName || "IGN not set"}${account.gameId ? ` / ${account.gameId}` : ""}`
    : "No game account";

  return `${getParticipantName(registration)} - Slot ${registration.slotNumber ?? "-"} - ${gameLabel}`;
};

const getRegistrationPlayerId = (registration: TournamentRegistration) =>
  registration.user?._id ?? registration.team?.[0]?._id ?? "";

const getResultPlayerId = (player: Tournament["results"][number]["player"]) =>
  typeof player === "string" ? player : player?._id ?? "";

const getResultPlayerName = (player: Tournament["results"][number]["player"]) =>
  typeof player === "string" ? "" : player?.username ?? "";

const buildPrizeRows = (
  tournament: Tournament,
  activeParticipants: TournamentRegistration[],
): PrizeRow[] => {
  const rowsByPosition = new Map<number, PrizeRow>();

  (tournament.prizeDistribution ?? []).forEach((prize) => {
    const position = Number(prize.position);
    if (!Number.isInteger(position) || position < 1 || rowsByPosition.has(position)) return;

    const result = tournament.results?.find((item) => Number(item.position) === position);
    const resultPlayerId = result ? getResultPlayerId(result.player) : "";
    const selectedParticipant = result
      ? activeParticipants.find((participant) => getRegistrationPlayerId(participant) === resultPlayerId)
      : undefined;

    rowsByPosition.set(position, {
      registrationId: selectedParticipant?._id ?? "",
      place: String(position),
      amount: String(prize.prizeAmount),
      resultPlayerName: result ? selectedParticipant ? getParticipantName(selectedParticipant) : getResultPlayerName(result.player) : undefined,
    });
  });

  return Array.from(rowsByPosition.values()).sort((a, b) => Number(a.place) - Number(b.place));
};

const PrizeDistributionScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentRegistration[]>([]);
  const [rows, setRows] = useState<PrizeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [tournamentRes, participantRes] = await Promise.all([
          getTournamentById(id),
          getParticipants(id),
        ]);
        if (!active) return;
        const activeParticipants = participantRes.filter(
          (p) => p.status === "paid" || p.status === "confirmed",
        );
        setTournament(tournamentRes);
        setParticipants(activeParticipants);
        setRows(buildPrizeRows(tournamentRes, activeParticipants));
      } catch (err) {
        setError(getErrorMessage(err, "Could not load prize distribution."));
        const t = getErrorToast(err, { action: "Load prize distribution", fallback: "Could not load prize distribution." });
        toast.error(t.title, { description: t.description });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const prizePool = Number(tournament?.prizePool || 0);
  const prizesPaid = Boolean(tournament?.results?.length);
  const transferTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );
  const paidTotal = useMemo(
    () => (tournament?.results ?? []).reduce((sum, result) => sum + Number(result.prizeWon || 0), 0),
    [tournament?.results],
  );
  const displayTotal = prizesPaid ? paidTotal : transferTotal;
  const remaining = prizePool - transferTotal;
  const overBudget = prizePool > 0 && transferTotal > prizePool;
  const usedPct = prizePool > 0 ? Math.min(100, (transferTotal / prizePool) * 100) : 0;
  const selectedRegistrationIds = useMemo(
    () => new Set(rows.map((row) => row.registrationId).filter(Boolean)),
    [rows],
  );

  const clearWinner = (position: string) => {
    if (prizesPaid) return;
    setRows((current) => current.map((row) => (row.place === position ? { ...row, registrationId: "" } : row)));
  };

  const handleTransfer = async () => {
    if (!id) return;
    if (prizesPaid) {
      toast.info("Prizes already paid", { description: "Tournament results are saved and prize money has already been transferred." });
      return;
    }
    const payouts = rows
      .map((r) => ({ registrationId: r.registrationId, position: Number(r.place) }))
      .filter((r) => r.registrationId && r.position > 0);

    if (payouts.length === 0) {
      toast.error("No winners selected", { description: "Select a joined player for at least one prize position." });
      return;
    }
    const duplicateWinner = payouts.find((payout, index) => payouts.findIndex((item) => item.registrationId === payout.registrationId) !== index);
    if (duplicateWinner) {
      toast.error("Duplicate winner", { description: "One player cannot be assigned to multiple positions." });
      return;
    }
    const duplicatePosition = payouts.find((payout, index) => payouts.findIndex((item) => item.position === payout.position) !== index);
    if (duplicatePosition) {
      toast.error("Duplicate position", { description: "Each prize position can only be assigned once." });
      return;
    }
    if (overBudget) {
      toast.error("Prize total too high", { description: "Prize payouts cannot be more than the prize pool." });
      return;
    }

    try {
      setSubmitting(true);
      const result = await distributeTournamentPrizes(id, payouts);
      toast.success("Prize money transferred", {
        description: `${formatCurrency(result?.payoutTotal || transferTotal)} paid to ${payouts.length} winner${payouts.length === 1 ? "" : "s"}.`,
      });
      if (result?.tournament) {
        setTournament(result.tournament);
        setRows(buildPrizeRows(result.tournament, participants));
      }
    } catch (err) {
      const t = getErrorToast(err, { action: "Distribute prizes", fallback: "Prize transfer failed." });
      toast.error(t.title, { description: t.description });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-40 sm:pb-32">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-20 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6 pb-4 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 h-10 w-10 grid place-items-center rounded-full glass hover:bg-primary/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-heading flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Payout Center
          </p>
          <h1 className="font-display text-xl font-bold neon-text-purple truncate">{prizesPaid ? "Tournament Results" : "Prize Distribution"}</h1>
          <p className="text-xs text-muted-foreground truncate">{tournament?.title ?? "Tournament payouts"}</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <GlassCard neon className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
              <Trophy className="h-3 w-3 text-primary" /> Pool
            </div>
            <p className="font-display text-base sm:text-lg font-bold neon-text-purple mt-1 truncate">{formatCurrency(prizePool)}</p>
          </GlassCard>
          <GlassCard delay={0.05} className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
              <Wallet className="h-3 w-3 text-secondary" /> {prizesPaid ? "Paid" : "Transfer"}
            </div>
            <p className="font-display text-base sm:text-lg font-bold text-secondary mt-1 truncate">{formatCurrency(displayTotal)}</p>
          </GlassCard>
          <GlassCard delay={0.1} className="p-3 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
              <Users className="h-3 w-3 text-accent" /> Players
            </div>
            <p className="font-display text-lg font-bold text-accent mt-1">{participants.length}</p>
          </GlassCard>
        </div>

        {/* Pool Progress */}
        {prizePool > 0 && (
          <GlassCard delay={0.15} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">Pool Used</span>
              <span className={cn("text-xs font-heading font-bold", overBudget ? "text-destructive" : "text-accent")}>
                {usedPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usedPct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  overBudget
                    ? "bg-gradient-to-r from-destructive to-destructive/60"
                    : "bg-gradient-to-r from-primary via-secondary to-accent",
                )}
              />
            </div>
            <p
              className={cn(
                "mt-2 text-xs font-heading",
                overBudget ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {overBudget
                ? `Over budget by ${formatCurrency(Math.abs(remaining))}`
                : `${formatCurrency(remaining)} remaining`}
            </p>
          </GlassCard>
        )}

        {/* States */}
        {loading && (
          <GlassCard className="p-8 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
            />
            <p className="mt-3 text-sm text-muted-foreground font-heading">Loading participants...</p>
          </GlassCard>
        )}

        {!loading && error && (
          <GlassCard className="p-6 text-center border border-destructive/40">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <h3 className="mt-2 font-heading font-bold">Could not load payouts</h3>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </GlassCard>
        )}

        {!loading && !error && !prizesPaid && participants.length === 0 && (
          <GlassCard className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 font-heading font-bold">No registered participants</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Players must join before prize money can be distributed.
            </p>
          </GlassCard>
        )}

        {/* Payout rows */}
        {!loading && !error && rows.length === 0 && (
          <GlassCard className="p-8 text-center">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 font-heading font-bold">No prize positions</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add prize positions and amounts while creating or editing the tournament.
            </p>
          </GlassCard>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading font-bold tracking-wide flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> {prizesPaid ? "Result List" : "Payout List"}
              </h2>
              <span className="text-xs text-muted-foreground font-heading">
                {rows.length} entr{rows.length === 1 ? "y" : "ies"}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {rows.map((row, idx) => {
                const participant = participants.find((item) => item._id === row.registrationId);
                const meta = placeMeta(Number(row.place || 1));
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={row.place}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <GlassCard className="p-3 sm:p-4 relative overflow-hidden">
                      <div
                        className={cn(
                          "absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl opacity-30 bg-gradient-to-br",
                          meta.color,
                        )}
                      />
                      <div className="relative">
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 sm:h-10 sm:w-10 shrink-0 grid place-items-center rounded-xl bg-gradient-to-br",
                              meta.color,
                            )}
                          >
                            <Icon className="h-5 w-5 text-background" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-heading font-bold truncate">
                                {participant ? getParticipantName(participant) : row.resultPlayerName || "Select player"}
                              </h3>
                              <span
                                className={cn(
                                  "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-heading",
                                  meta.text,
                                  "bg-foreground/5",
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {participant
                                ? `Slot ${participant.slotNumber ?? "-"} - ${getGameAccountLine(participant)}`
                                : row.resultPlayerName
                                  ? "Prize paid"
                                : "Choose one joined player for this position"}
                            </p>
                            {participant && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="min-w-0 rounded-lg border border-glass-border/70 bg-background/35 px-2.5 py-2">
                                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-heading">In-game name</p>
                                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-heading text-foreground truncate">
                                    <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="truncate">{getGameName(participant)}</span>
                                  </p>
                                </div>
                                <div className="min-w-0 rounded-lg border border-glass-border/70 bg-background/35 px-2.5 py-2">
                                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-heading">Game ID</p>
                                  <p className="mt-0.5 text-xs font-heading text-foreground truncate">{getGameId(participant)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          {!prizesPaid && (
                            <button
                              onClick={() => clearWinner(row.place)}
                              className="shrink-0 h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Clear winner"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
                              Position
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={row.place}
                              disabled
                              className={cn(inputClass, "mt-1 opacity-80")}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
                              Prize
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.amount}
                              disabled
                              className={cn(inputClass, "mt-1 font-bold text-accent opacity-80")}
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
                            Winner
                          </label>
                          {prizesPaid ? (
                            <div className={cn(inputClass, "mt-1 min-h-[46px] opacity-80")}>
                              <p className="truncate">{participant ? getParticipantName(participant) : row.resultPlayerName || "Winner saved"}</p>
                              {participant && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{getGameAccountLine(participant)}</p>}
                            </div>
                          ) : (
                            <select
                              value={row.registrationId}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((item) =>
                                    item.place === row.place ? { ...item, registrationId: event.target.value } : item,
                                  ),
                                )
                              }
                              className={cn(inputClass, "mt-1")}
                            >
                              <option value="" className="bg-card">Select joined player</option>
                              {participants.map((item) => {
                                const isPickedInAnotherPosition = selectedRegistrationIds.has(item._id) && item._id !== row.registrationId;
                                return (
                                  <option
                                    key={item._id}
                                    value={item._id}
                                    disabled={isPickedInAnotherPosition}
                                    className="bg-card disabled:text-muted-foreground"
                                  >
                                  {getParticipantOptionLabel(item)}
                                  {isPickedInAnotherPosition ? " (already selected)" : ""}
                                </option>
                                );
                              })}
                            </select>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Sticky transfer bar */}
      {!loading && !error && (participants.length > 0 || prizesPaid) && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-[72px] left-0 right-0 z-30 px-3 sm:px-4 pb-3 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent"
        >
          <div className="max-w-md mx-auto glass rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 neon-border">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
                {prizesPaid ? "Total Paid" : "Total Transfer"}
              </p>
              <p className={cn("font-display text-lg font-bold truncate", overBudget ? "text-destructive" : "neon-text-green")}>
                {formatCurrency(displayTotal)}
              </p>
            </div>
            <NeonButton
              onClick={handleTransfer}
              variant="purple"
              disabled={submitting || rows.length === 0 || overBudget || prizesPaid}
              className="w-full sm:w-auto shrink-0"
            >
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {prizesPaid ? "PAID" : submitting ? "TRANSFERRING..." : "TRANSFER"}
              </span>
            </NeonButton>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PrizeDistributionScreen;
