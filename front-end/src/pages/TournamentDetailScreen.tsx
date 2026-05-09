import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Award, Calendar, Crosshair, Users, Trophy, DollarSign, Shield, CheckCircle, Star, MessageCircle, RefreshCcw, KeyRound, Hash, Lock, Flag, Copy } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getMyTournamentRegistrations, getTournamentById, Tournament, TournamentRegistration } from "@/api/tournaments";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import { createReport, ReportCategory } from "@/api/moderation";
import { toast } from "@/components/ui/sonner";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const getResultPlayerName = (player: NonNullable<Tournament["results"]>[number]["player"]) =>
  typeof player === "string" ? "Player" : player?.username || "Player";

const TournamentDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showConfirm, setShowConfirm] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [myRegistration, setMyRegistration] = useState<TournamentRegistration | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportCategory>("cheating");
  const [reportDescription, setReportDescription] = useState("");
  const [reportProof, setReportProof] = useState("");
  const [reportTargetUser, setReportTargetUser] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadTournament = useCallback(async () => {
    if (!id) return;
    const cachedTournament = readCache<Tournament>(CACHE_KEYS.tournamentDetail(id));
    const cachedRegistrations = readCache<Awaited<ReturnType<typeof getMyTournamentRegistrations>>>(CACHE_KEYS.myRegistrations);
    if (cachedTournament) {
      setTournament(cachedTournament.data);
      const cachedRegistration = cachedRegistrations?.data.find((registration) => getRegistrationTournamentId(registration) === id && registration.status !== "cancelled") ?? null;
      setMyRegistration(cachedRegistration);
      setRegistered(Boolean(cachedRegistration));
      setLoading(false);
    }

    try {
      setLoading(!cachedTournament);
      setError(null);
      const [tournamentRes, registrations] = await Promise.all([
        getTournamentById(id),
        getMyTournamentRegistrations().catch(() => []),
      ]);
      const activeRegistration = registrations.find((registration) => getRegistrationTournamentId(registration) === id && registration.status !== "cancelled") ?? null;
      setTournament(tournamentRes);
      setMyRegistration(activeRegistration);
      setRegistered(Boolean(activeRegistration));
      writeCache(CACHE_KEYS.tournamentDetail(id), tournamentRes);
      writeAuthenticatedCache(CACHE_KEYS.myRegistrations, registrations);
    } catch (err) {
      if (!cachedTournament) setError(getErrorMessage(err, "Failed to load tournament."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const creator = {
    id: tournament?.channel?._id ?? tournament?.organizer?._id ?? "",
    name: tournament?.channel?.name ?? tournament?.organizer?.username ?? "Creator",
    avatarUrl: tournament?.channel?.avatar?.url ?? tournament?.organizer?.avatar?.url ?? "",
    verified: Boolean(tournament?.channel || tournament?.organizer),
    rating: tournament?.organizer?.stats?.rating ?? 4.5,
  };

  const rules = tournament?.rules
    ? tournament.rules.split("\n").filter(Boolean)
    : ["Tournament starts at scheduled time.", "Disputes are resolved by admin decision."];
  const prize = Number(tournament?.prizePool || 0);
  const prizeMode = tournament?.prizeMode ?? "position";
  const killPrizeAmount = Number(tournament?.killPrizeAmount || 0);
  const usesPositionPrize = prizeMode === "position" || prizeMode === "both";
  const usesKillPrize = prizeMode === "kill" || prizeMode === "both";
  const entryFee = Number(tournament?.entryFee || 0);
  const registeredSlots = Number(tournament?.registrationCount || 0);
  const participantCount = Number(tournament?.participantCount || registeredSlots);
  const hasRoomDetails = Boolean(
    tournament?.room_details?.roomJoinTime ||
    tournament?.room_details?.roomId ||
    tournament?.room_details?.roomPass ||
    tournament?.room_details?.hasRoomId ||
    tournament?.room_details?.hasRoomPass
  );
  const resultRows = (tournament?.results ?? [])
    .filter((result) => Number(result.prizeWon || 0) > 0)
    .sort((a, b) => {
      if (prizeMode === "kill") return Number(b.kills || 0) - Number(a.kills || 0);
      return Number(a.position || 9999) - Number(b.position || 9999);
    });
  const resultPaidTotal = tournament?.paidMoney ?? resultRows.reduce((sum, result) => sum + Number(result.prizeWon || 0), 0);
  const registrationStartMs = tournament?.registrationStart ? new Date(tournament.registrationStart).getTime() : 0;
  const registrationEndMs = tournament?.registrationEnd ? new Date(tournament.registrationEnd).getTime() : 0;
  const registrationIsOpen =
    Boolean(tournament) &&
    tournament?.status === "open" &&
    Number.isFinite(registrationStartMs) &&
    Number.isFinite(registrationEndMs) &&
    now >= registrationStartMs &&
    now <= registrationEndMs;
  const registerButtonText = !tournament
    ? "REGISTER NOW"
    : registered
      ? "JOINED"
      : tournament.status === "completed"
      ? "TOURNAMENT COMPLETED"
      : tournament.status === "running"
        ? "TOURNAMENT LIVE"
        : now < registrationStartMs
          ? "REGISTRATION OPENS SOON"
          : now > registrationEndMs
            ? "REGISTRATION CLOSED"
            : `REGISTER NOW - ${entryFee === 0 ? "FREE" : formatCurrency(entryFee)}`;

  const reportablePlayers = (tournament?.results ?? [])
    .map((result) => result.player)
    .filter((player): player is { _id?: string; username?: string; avatar?: { url?: string } } => typeof player !== "string" && Boolean(player?._id));

  const copyValue = async (label: string, value?: string | null) => {
    const text = String(value || "").trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed", { description: `Could not copy ${label.toLowerCase()}.` });
    }
  };

  const submitReport = async () => {
    if (!tournament) return;
    if (reportDescription.trim().length < 12) {
      toast.error("Add more details", { description: "Explain what happened so admin can review it properly." });
      return;
    }

    try {
      setSubmittingReport(true);
      await createReport({
        title: `Tournament report: ${tournament.title}`,
        targetType: reportTargetUser ? "player" : "tournament",
        category: reportReason,
        message: reportDescription.trim(),
        tournament: tournament._id,
        reportedUser: reportTargetUser || undefined,
        evidence: { matchProof: reportProof.trim() },
        severity: ["cheating", "fraud_scam", "payout_not_distributed", "wrong_payout"].includes(reportReason) ? "high" : "medium",
      });
      toast.success("Report submitted", { description: "Admin will review the report and update the status." });
      setReportOpen(false);
      setReportDescription("");
      setReportProof("");
      setReportTargetUser("");
    } catch (reportError) {
      toast.error(getErrorMessage(reportError, "Could not submit report."));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl flex items-center gap-3 px-4 sm:px-5 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-full flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="font-heading text-lg font-bold">Tournament Details</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        {loading && (
          <GlassCard neon>
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-14 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded bg-muted" />
                <div className="h-20 rounded bg-muted" />
              </div>
            </div>
          </GlassCard>
        )}

        {!loading && error && (
          <GlassCard className="text-center py-10">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load tournament</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button onClick={loadTournament} className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-heading">
              <RefreshCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && tournament && (
          <>
            <GlassCard neon>
              <h2 className="font-heading text-xl font-bold mb-1">{tournament.title}</h2>
              <p className="text-xs text-muted-foreground mb-2">{gameLabels[tournament.game] ?? tournament.game}</p>

              {/* Creator Info */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => creator.id && navigate(`/creator/${creator.id}`)}
                className="w-full glass rounded-lg p-2.5 flex items-center gap-3 mb-4"
              >
                {creator.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.name}
                    className="h-9 w-9 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
                    <span className="font-display text-xs font-bold text-primary-foreground">{creator.name[0]}</span>
                  </div>
                )}
                <div className="text-left flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-heading font-bold">{creator.name}</span>
                    {creator.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-heading font-semibold text-accent">
                        <Shield className="h-3 w-3 fill-accent" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                    <span className="text-[10px] text-muted-foreground">{creator.rating} rating</span>
                  </div>
                </div>
                <span className="text-[10px] text-primary font-heading">View Profile</span>
              </motion.button>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Calendar, label: "Date & Time", value: "Apr 15, 2026, 8 PM" },
                  { icon: Users, label: "Slots", value: `${registeredSlots}/${tournament.maxPlayers}` },
                  { icon: DollarSign, label: "Entry Fee", value: entryFee === 0 ? "FREE" : formatCurrency(entryFee) },
                  { icon: Trophy, label: "Position Prize", value: usesPositionPrize ? formatCurrency(prize) : "No position prize" },
                  ...(myRegistration?.slotNumber ? [{ icon: Hash, label: "Your Slot", value: `#${myRegistration.slotNumber}` }] : []),
                ].map((item) => (
                  <div key={item.label} className="glass rounded-lg p-3">
                    <item.icon className="w-4 h-4 text-primary mb-1" />
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-heading font-bold">
                      {item.label === "Date & Time" ? new Date(tournament.startAt).toLocaleString() : item.value}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard delay={0.08}>
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-sm">Prize Settings</h3>
              </div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                <div className="glass rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Prize Type</p>
                  <p className="font-heading font-bold capitalize">{prizeMode === "both" ? "Position + Kill" : prizeMode}</p>
                </div>
                {usesKillPrize && (
                  <div className="glass rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Crosshair className="w-3 h-3" /> Per Kill
                    </p>
                    <p className="font-heading font-bold text-accent">{formatCurrency(killPrizeAmount)}</p>
                  </div>
                )}
              </div>
              {usesPositionPrize && Boolean(tournament.prizeDistribution?.length) && (
                <div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                  {tournament.prizeDistribution.map((row) => (
                    <div key={row.position} className="rounded-lg border border-glass-border/70 bg-background/35 p-3">
                      <p className="text-[10px] text-muted-foreground">Position #{row.position}</p>
                      <p className="font-heading font-bold text-primary">{formatCurrency(row.prizeAmount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {hasRoomDetails && (
              <GlassCard delay={0.085}>
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="w-4 h-4 text-secondary" />
                  <h3 className="font-heading font-bold text-sm">Custom Room</h3>
                </div>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 text-xs">
                  {tournament.room_details?.roomJoinTime && (
                    <div className="glass rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Join Time
                      </p>
                      <p className="font-heading font-bold">{new Date(tournament.room_details.roomJoinTime).toLocaleString()}</p>
                    </div>
                  )}
                  {(tournament.room_details?.roomId || tournament.room_details?.hasRoomId) && (
                    <div className="glass rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Room ID
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 font-heading font-bold truncate">
                          {tournament.room_details.roomId || (registered ? "Not shared yet" : "Join to view")}
                        </p>
                        {tournament.room_details.roomId && (
                          <button
                            type="button"
                            onClick={() => copyValue("Room ID", tournament.room_details?.roomId)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition hover:bg-primary/20 active:scale-95"
                            aria-label="Copy Room ID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {(tournament.room_details?.roomPass || tournament.room_details?.hasRoomPass) && (
                    <div className="glass rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Room Pass
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 font-heading font-bold truncate">
                          {tournament.room_details.roomPass || (registered ? "Not shared yet" : "Join to view")}
                        </p>
                        {tournament.room_details.roomPass && (
                          <button
                            type="button"
                            onClick={() => copyValue("Room Pass", tournament.room_details?.roomPass)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition hover:bg-primary/20 active:scale-95"
                            aria-label="Copy Room Pass"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!registered && !tournament.room_details?.roomId && !tournament.room_details?.roomPass && (
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Room ID and password are only visible to joined users.
                  </p>
                )}
              </GlassCard>
            )}

            {tournament.status === "completed" && (
              <GlassCard delay={0.09}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-accent" />
                    <h3 className="font-heading font-bold text-sm">Tournament Result</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatCurrency(resultPaidTotal)} paid</span>
                </div>
                {resultRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Result not published yet.</p>
                ) : (
                  <div className="space-y-2">
                    {resultRows.map((result, index) => (
                      <div key={`${tournament._id}-${result.position}-${index}`} className="rounded-lg border border-glass-border/70 bg-background/35 p-3">
                        <div className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-accent/15 border border-accent/40 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] leading-none text-muted-foreground">{prizeMode === "kill" ? "Rank" : "Pos"}</span>
                            <span className="text-sm leading-tight font-heading font-bold text-accent">#{result.position || index + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-heading font-bold">{getResultPlayerName(result.player)}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {result.gameName || "Game name not set"} - ID {result.gameId || "Not set"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-heading text-accent">
                                <Crosshair className="w-3 h-3" /> {Number(result.kills || 0)} kill{Number(result.kills || 0) === 1 ? "" : "s"}
                              </span>
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-heading text-primary">
                                {Number(result.points || 0)} pts
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-heading font-bold text-secondary whitespace-nowrap">{formatCurrency(result.prizeWon)}</p>
                            {usesKillPrize && Number(result.killPrizeWon || 0) > 0 && (
                              <p className="text-[10px] text-muted-foreground whitespace-nowrap">{formatCurrency(result.killPrizeWon)} kills</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Rules */}
            <GlassCard delay={0.1}>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm">Rules & Regulations</h3>
              </div>
              <ul className="space-y-2">
                {rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground font-body">
                    <span className="text-primary mt-0.5">-</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard delay={0.12}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-secondary" />
                <h3 className="font-heading font-bold text-sm">Registration Window</h3>
              </div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 text-xs">
                <div className="glass rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Opens</p>
                  <p className="font-heading font-bold">{new Date(tournament.registrationStart).toLocaleString()}</p>
                </div>
                <div className="glass rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Closes</p>
                  <p className="font-heading font-bold">{new Date(tournament.registrationEnd).toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>

            {/* Participants */}
            <GlassCard delay={0.15}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-secondary" />
                  Participants
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {registeredSlots > 0
                  ? `${registeredSlots} slot${registeredSlots === 1 ? "" : "s"} booked with ${participantCount} participant${participantCount === 1 ? "" : "s"}.`
                  : "No participants have joined yet."}
              </p>
            </GlassCard>

            <GlassCard delay={0.18}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                    <Flag className="w-4 h-4 text-destructive" />
                    Report Match Issue
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Report cheating, fake results, room problems, or missing prize distribution.
                  </p>
                </div>
                <NeonButton variant="blue" className="shrink-0 text-[10px] py-1.5 px-3" onClick={() => setReportOpen(true)}>
                  Report
                </NeonButton>
              </div>
            </GlassCard>

            {/* Comments Link */}
            <GlassCard delay={0.2} onClick={() => navigate(`/tournament/${tournament._id}/comments`)} className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <span className="font-heading font-bold text-sm">Comments & Chat</span>
                </div>
                <span className="text-[10px] text-primary font-heading">5 messages</span>
              </div>
            </GlassCard>

            <NeonButton
              full
              variant={registered ? "green" : registrationIsOpen ? "purple" : "blue"}
              disabled={!registrationIsOpen || registered}
              onClick={() =>
                !registered &&
                registrationIsOpen &&
                navigate(
                  `/tournament/${id}/slots?type=${tournament.type}&slots=${tournament.maxPlayers}&teamSize=${tournament.teamSize || ""}&fee=${entryFee}&game=${tournament.game}&title=${encodeURIComponent(tournament.title)}`
                )
              }
            >
              {registerButtonText}
            </NeonButton>
          </>
        )}
      </div>

      {/* Confirmation Popup */}
      <AnimatePresence>
        {reportOpen && tournament && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-glass-border p-5"
            >
              <h3 className="font-heading text-lg font-bold">Report issue</h3>
              <p className="mt-1 text-xs text-muted-foreground">Reports go to admin review with your evidence.</p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[10px] font-heading text-muted-foreground">Reason</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value as ReportCategory)}
                    className="mt-1 w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading"
                  >
                    <option value="cheating">Player cheating</option>
                    <option value="fake_results">Fake or wrong result</option>
                    <option value="payout_not_distributed">Creator did not distribute prize</option>
                    <option value="wrong_payout">Wrong payout amount</option>
                    <option value="room_details_issue">Room ID/password issue</option>
                    <option value="abusive_behavior">Abusive behavior</option>
                    <option value="spam">Spam</option>
                    <option value="fraud_scam">Fraud / scam</option>
                    <option value="inappropriate_content">Inappropriate content</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                {reportablePlayers.length > 0 && (
                  <label className="block">
                    <span className="text-[10px] font-heading text-muted-foreground">Reported player optional</span>
                    <select
                      value={reportTargetUser}
                      onChange={(event) => setReportTargetUser(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading"
                    >
                      <option value="">Not specific</option>
                      {reportablePlayers.map((player) => (
                        <option key={player._id} value={player._id}>{player.username || "Player"}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="text-[10px] font-heading text-muted-foreground">What happened?</span>
                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    rows={4}
                    placeholder="Mention player name/game ID, round time, suspicious action, or payout issue..."
                    className="mt-1 w-full resize-none rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-heading text-muted-foreground">Evidence link or proof text</span>
                  <input
                    value={reportProof}
                    onChange={(event) => setReportProof(event.target.value)}
                    placeholder="Screenshot/video URL, match timestamp, transaction note..."
                    className="mt-1 w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-xs font-heading outline-none"
                  />
                </label>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <NeonButton variant="blue" onClick={() => setReportOpen(false)} disabled={submittingReport}>Cancel</NeonButton>
                <NeonButton variant="purple" onClick={submitReport} disabled={submittingReport}>
                  {submittingReport ? "Submitting..." : "Submit"}
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm neon-border text-center"
            >
              <CheckCircle className="w-12 h-12 text-accent mx-auto mb-3" />
              <h3 className="font-heading text-lg font-bold mb-1">Confirm Registration</h3>
              <p className="text-xs text-muted-foreground mb-4 font-body">
                {entryFee === 0 ? "This tournament is free to join." : `${formatCurrency(entryFee)} will be deducted from your wallet for ${tournament?.title}.`}
              </p>
              <div className="flex gap-3">
                <NeonButton
                  full
                  variant="blue"
                  onClick={() => setShowConfirm(false)}
                  className="bg-muted text-foreground neon-glow-blue"
                >
                  Cancel
                </NeonButton>
                <NeonButton
                  full
                  variant="green"
                  onClick={() => {
                    setRegistered(true);
                    setShowConfirm(false);
                  }}
                >
                  Confirm
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TournamentDetailScreen;
