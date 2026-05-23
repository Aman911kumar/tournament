import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Calendar,
  Clock3,
  Copy,
  Crosshair,
  Eye,
  Flag,
  Gamepad2,
  Hash,
  KeyRound,
  Lock,
  Medal,
  MessageCircle,
  Radio,
  RefreshCcw,
  Share2,
  Shield,
  Sparkles,
  Star,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import {
  getMyTournamentRegistrations,
  getParticipants,
  getTournamentById,
  Tournament,
  TournamentRegistration,
} from "@/api/tournaments";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import { createReport, ReportCategory } from "@/api/moderation";
import { toast } from "@/components/ui/sonner";
import gameFreefire from "@/assets/game-freefire.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameValorant from "@/assets/game-valorant.jpg";
import gameCod from "@/assets/game-cod.jpg";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const gameArtwork: Record<Tournament["game"], string> = {
  freefire: gameFreefire,
  bgmi: gameBgmi,
  callofduty: gameCod,
  valorant: gameValorant,
};

const gameAccent: Record<Tournament["game"], string> = {
  freefire: "from-orange-500/28 via-primary/18 to-cyan-500/12",
  bgmi: "from-emerald-500/26 via-cyan-500/16 to-primary/14",
  callofduty: "from-yellow-500/24 via-emerald-500/14 to-cyan-500/12",
  valorant: "from-red-500/24 via-primary/18 to-cyan-500/12",
};

const getRegistrationTournamentId = (registration: Awaited<ReturnType<typeof getMyTournamentRegistrations>>[number]) =>
  typeof registration.tournament === "string" ? registration.tournament : registration.tournament?._id;

const getResultPlayerName = (player: NonNullable<Tournament["results"]>[number]["player"]) =>
  typeof player === "string" ? "Player" : player?.username || "Player";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not scheduled";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Not scheduled";
  }
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "TBA";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "TBA";
  }
};

const formatCountdown = (targetMs: number, now: number) => {
  if (!Number.isFinite(targetMs) || targetMs <= 0) return "Schedule pending";
  const diff = targetMs - now;
  if (diff <= 0) return "Started";
  const minutes = Math.ceil(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getStatusMeta = (status?: Tournament["status"]) => {
  switch (status) {
    case "running":
      return { label: "Live", tone: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-300" };
    case "completed":
      return { label: "Completed", tone: "border-cyan-400/35 bg-cyan-400/10 text-cyan-200", dot: "bg-cyan-300" };
    case "cancelled":
      return { label: "Cancelled", tone: "border-red-400/35 bg-red-400/10 text-red-200", dot: "bg-red-300" };
    case "draft":
      return { label: "Draft", tone: "border-muted/60 bg-muted/30 text-muted-foreground", dot: "bg-muted-foreground" };
    default:
      return { label: "Open", tone: "border-primary/35 bg-primary/10 text-primary", dot: "bg-primary" };
  }
};

const getPlayerName = (registration: TournamentRegistration) =>
  registration.user?.username || registration.gameAccount?.inGameName || registration.gameAccounts?.[0]?.inGameName || "Player";

const getPlayerAvatar = (registration: TournamentRegistration) => registration.user?.avatar?.url || "";

const TournamentDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [registered, setRegistered] = useState(false);
  const [myRegistration, setMyRegistration] = useState<TournamentRegistration | null>(null);
  const [participants, setParticipants] = useState<TournamentRegistration[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
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
    const cachedParticipants = readCache<TournamentRegistration[]>(`tournamentParticipants.${id}`);
    if (cachedTournament) {
      setTournament(cachedTournament.data);
      const cachedRegistration = cachedRegistrations?.data.find((registration) => getRegistrationTournamentId(registration) === id && registration.status !== "cancelled") ?? null;
      setMyRegistration(cachedRegistration);
      setRegistered(Boolean(cachedRegistration));
      setParticipants(cachedParticipants?.data ?? []);
      setLoading(false);
    }

    try {
      setLoading(!cachedTournament);
      setParticipantsLoading(!cachedParticipants);
      setError(null);
      const [tournamentRes, registrations, participantRows] = await Promise.all([
        getTournamentById(id),
        getMyTournamentRegistrations().catch(() => []),
        getParticipants(id).catch(() => cachedParticipants?.data ?? []),
      ]);
      const activeRegistration = registrations.find((registration) => getRegistrationTournamentId(registration) === id && registration.status !== "cancelled") ?? null;
      setTournament(tournamentRes);
      setMyRegistration(activeRegistration);
      setRegistered(Boolean(activeRegistration));
      setParticipants(participantRows);
      writeCache(CACHE_KEYS.tournamentDetail(id), tournamentRes);
      writeCache(`tournamentParticipants.${id}`, participantRows);
      writeAuthenticatedCache(CACHE_KEYS.myRegistrations, registrations);
    } catch (err) {
      if (!cachedTournament) setError(getErrorMessage(err, "Failed to load tournament."));
    } finally {
      setLoading(false);
      setParticipantsLoading(false);
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
  const startMs = tournament?.startAt ? new Date(tournament.startAt).getTime() : 0;
  const endMs = tournament?.endAt ? new Date(tournament.endAt).getTime() : 0;
  const slotsLeft = Math.max(Number(tournament?.maxPlayers || 0) - registeredSlots, 0);
  const slotFillPercent = tournament?.maxPlayers ? Math.min(100, Math.round((registeredSlots / tournament.maxPlayers) * 100)) : 0;
  const statusMeta = getStatusMeta(tournament?.status);
  const countdownTarget =
    now < registrationStartMs
      ? registrationStartMs
      : now < registrationEndMs
        ? registrationEndMs
        : now < startMs
          ? startMs
          : endMs || startMs;
  const countdownLabel =
    now < registrationStartMs
      ? "Registration opens"
      : now < registrationEndMs
        ? "Registration closes"
        : now < startMs
          ? "Match starts"
          : tournament?.status === "running"
            ? "Match window"
            : "Event status";
  const countdownValue = formatCountdown(countdownTarget, now);
  const teamLabel = tournament?.teamSize ? `${tournament.teamSize} per team` : tournament?.type || "Solo";
  const modeLabel = [tournament?.gameMode, tournament?.mapName, tournament?.perspective?.toUpperCase()]
    .filter(Boolean)
    .join(" / ") || "Classic match";
  const heroImage = tournament ? gameArtwork[tournament.game] : gameBgmi;
  const heroAccent = tournament ? gameAccent[tournament.game] : "from-primary/24 via-cyan-500/12 to-emerald-500/10";
  const participantPreview = participants.slice(0, 8);
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

  const shareTournament = async () => {
    if (!tournament) return;
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: tournament.title,
          text: `Join ${tournament.title} on Battle4Arena`,
          url: shareUrl,
        });
        return;
      }
      await copyValue("Tournament link", shareUrl);
    } catch {
      await copyValue("Tournament link", shareUrl);
    }
  };

  const openChat = () => {
    if (tournament) navigate(`/tournament/${tournament._id}/chat`);
  };

  const scrollToRules = () => {
    document.getElementById("tournament-rules")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const registerTournament = () => {
    if (!tournament || registered || !registrationIsOpen) return;
    navigate(
      `/tournament/${id}/slots?type=${tournament.type}&slots=${tournament.maxPlayers}&teamSize=${tournament.teamSize || ""}&fee=${entryFee}&game=${tournament.game}&title=${encodeURIComponent(tournament.title)}`
    );
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
    <div className="arena-shell min-h-screen pb-8">
      <style>{`
        .tournament-section {
          border: 1px solid hsl(var(--border) / 0.72);
          background:
            linear-gradient(135deg, hsl(var(--card) / 0.88), hsl(var(--background) / 0.96)),
            radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.08), transparent 34%);
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.045), 0 12px 28px rgb(0 0 0 / 0.18);
        }
        .detail-tile {
          border: 1px solid hsl(var(--border) / 0.68);
          background: hsl(var(--background) / 0.46);
          transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
        }
        .detail-tile:active { transform: scale(0.99); }
        .status-pulse {
          box-shadow: 0 0 0 0 hsl(var(--accent) / 0.36);
          animation: statusPulse 2.8s ease-out infinite;
        }
        @keyframes statusPulse {
          70% { box-shadow: 0 0 0 8px hsl(var(--accent) / 0); }
          100% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .status-pulse { animation: none; }
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">
          <button
            onClick={() => navigate(-1)}
            className="arena-focus grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-glass-border bg-card/70"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-base font-bold sm:text-lg">Tournament Details</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {tournament ? `${gameLabels[tournament.game] ?? tournament.game} competition hub` : "Battle4Arena event hub"}
            </p>
          </div>
          {tournament && (
            <button
              type="button"
              onClick={shareTournament}
              className="arena-focus grid h-10 w-10 place-items-center rounded-lg border border-glass-border bg-card/70 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Share tournament"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4 sm:px-5">
        {loading && (
          <div className="space-y-4">
            <div className="h-[360px] animate-pulse rounded-xl border border-glass-border bg-card/70" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <div className="h-48 animate-pulse rounded-xl border border-glass-border bg-card/60" />
                <div className="h-56 animate-pulse rounded-xl border border-glass-border bg-card/60" />
              </div>
              <div className="h-72 animate-pulse rounded-xl border border-glass-border bg-card/60" />
            </div>
          </div>
        )}

        {!loading && error && (
          <GlassCard className="py-10 text-center">
            <AlertCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <p className="font-heading text-sm">Could not load tournament</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <button onClick={loadTournament} className="mt-4 inline-flex items-center gap-1.5 text-xs font-heading text-primary">
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && tournament && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="relative min-h-[360px] overflow-hidden rounded-xl border border-glass-border bg-card"
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-55"
                style={{ backgroundImage: `url(${heroImage})` }}
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${heroAccent}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_8_18/0.24),rgb(5_8_18/0.92)_78%)]" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

              <div className="relative flex min-h-[360px] flex-col justify-between p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-heading text-[11px] font-bold ${statusMeta.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${statusMeta.dot} ${tournament.status === "running" ? "status-pulse" : ""}`} />
                    {statusMeta.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/28 px-3 py-1 font-heading text-[11px] text-white">
                    <Gamepad2 className="h-3.5 w-3.5 text-cyan-200" />
                    {gameLabels[tournament.game] ?? tournament.game}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/28 px-3 py-1 font-heading text-[11px] text-white">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    {Number(tournament.views || 0).toLocaleString("en-IN")} views
                  </span>
                </div>

                <div className="max-w-3xl pt-12">
                  <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 font-heading text-[11px] font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Premium Battle Room
                  </p>
                  <h2 className="font-heading text-3xl font-black leading-tight text-white sm:text-5xl">
                    {tournament.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                    {tournament.description || `${teamLabel} ${modeLabel} tournament hosted on Battle4Arena.`}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => creator.id && navigate(`/creator/${creator.id}`)}
                      className="arena-focus inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-black/32 px-2.5 py-2 text-left"
                    >
                      {creator.avatarUrl ? (
                        <img src={creator.avatarUrl} alt={creator.name} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {creator.name[0]}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-heading font-bold text-white">{creator.name}</span>
                        <span className="flex items-center gap-1 text-[10px] text-white/60">
                          <Star className="h-3 w-3 fill-accent text-accent" />
                          {creator.rating} creator rating
                        </span>
                      </span>
                      {creator.verified && <Shield className="h-4 w-4 shrink-0 fill-accent text-accent" />}
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: Trophy, label: "Prize Pool", value: usesPositionPrize ? formatCurrency(prize) : "Kill based", tone: "text-accent" },
                    { icon: Users, label: "Slots Left", value: `${slotsLeft}/${tournament.maxPlayers}`, tone: "text-cyan-200" },
                    { icon: Timer, label: countdownLabel, value: countdownValue, tone: "text-primary" },
                    { icon: Wallet, label: "Entry Fee", value: entryFee === 0 ? "Free" : formatCurrency(entryFee), tone: "text-emerald-200" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/12 bg-black/34 p-3">
                      <item.icon className={`mb-2 h-4 w-4 ${item.tone}`} />
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/48">{item.label}</p>
                      <p className="mt-1 truncate font-heading text-lg font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <aside className="order-first space-y-4 lg:sticky lg:top-24 lg:order-last">
                <section className="tournament-section rounded-xl p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-bold">Ready check</p>
                      <p className="text-[11px] text-muted-foreground">{registered ? "You are in this lobby" : "Secure your slot before it fills"}</p>
                    </div>
                    {myRegistration?.slotNumber && (
                      <span className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 font-heading text-xs font-bold text-accent">
                        Slot #{myRegistration.slotNumber}
                      </span>
                    )}
                  </div>
                  <NeonButton
                    full
                    variant={registered ? "green" : registrationIsOpen ? "purple" : "blue"}
                    disabled={!registrationIsOpen || registered}
                    onClick={registerTournament}
                  >
                    {registerButtonText}
                  </NeonButton>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={openChat}
                      className="arena-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 font-heading text-xs font-bold text-primary"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={openChat}
                      className="arena-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 font-heading text-xs font-bold text-emerald-200"
                    >
                      <Radio className="h-4 w-4" />
                      Voice
                    </button>
                    <button
                      type="button"
                      onClick={shareTournament}
                      className="arena-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-glass-border bg-card/70 font-heading text-xs font-bold text-muted-foreground"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={scrollToRules}
                      className="arena-focus inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-glass-border bg-card/70 font-heading text-xs font-bold text-muted-foreground"
                    >
                      <Shield className="h-4 w-4" />
                      Rules
                    </button>
                  </div>
                </section>

                <section className="tournament-section rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <h3 className="font-heading text-sm font-bold">Communication Hub</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="detail-tile rounded-lg p-3">
                      <p className="flex items-center gap-2 font-heading font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-300" />
                        Live chat and squad voice
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {registered ? "Room chat is unlocked for joined players." : "Join first to access private room comms."}
                      </p>
                    </div>
                    <div className="detail-tile rounded-lg p-3">
                      <p className="font-heading font-bold">Realtime alerts</p>
                      <p className="mt-1 text-muted-foreground">Room updates, announcements, and match notices appear in the live room.</p>
                    </div>
                  </div>
                </section>

                <section className="tournament-section rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {creator.avatarUrl ? (
                      <img src={creator.avatarUrl} alt={creator.name} className="h-11 w-11 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                        {creator.name[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-bold">{creator.name}</p>
                      <p className="text-[11px] text-muted-foreground">Organizer</p>
                    </div>
                    {creator.verified && <Shield className="h-4 w-4 fill-accent text-accent" />}
                  </div>
                </section>
              </aside>

              <div className="space-y-4">
                <section className="tournament-section rounded-xl p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-bold">Match Overview</h3>
                      <p className="text-xs text-muted-foreground">Schedule, format, slot health, and room readiness.</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 font-heading text-[10px] font-bold ${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { icon: Calendar, label: "Starts", value: formatShortDate(tournament.startAt) },
                      { icon: Clock3, label: "Registration", value: registrationIsOpen ? "Open now" : now < registrationStartMs ? "Opening soon" : "Closed" },
                      { icon: Gamepad2, label: "Mode", value: modeLabel },
                      { icon: UserCheck, label: "Team Setup", value: teamLabel },
                      { icon: Hash, label: "Format", value: tournament.type.toUpperCase() },
                      { icon: Shield, label: "Platform", value: tournament.platform || "mobile" },
                      { icon: Users, label: "Players", value: `${participantCount} joined` },
                      { icon: Award, label: "Prize Type", value: prizeMode === "both" ? "Position + Kill" : prizeMode },
                    ].map((item) => (
                      <div key={item.label} className="detail-tile rounded-lg p-3">
                        <item.icon className="mb-2 h-4 w-4 text-primary" />
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                        <p className="mt-1 truncate font-heading text-sm font-bold capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg border border-glass-border/70 bg-background/35 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-heading font-bold">Slot capacity</span>
                      <span className="text-muted-foreground">{registeredSlots}/{tournament.maxPlayers} booked</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-300" style={{ width: `${slotFillPercent}%` }} />
                    </div>
                  </div>
                </section>

                <section className="tournament-section rounded-xl p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-accent" />
                    <div>
                      <h3 className="font-heading text-base font-bold">Prize Pool</h3>
                      <p className="text-xs text-muted-foreground">Transparent payout setup for this event.</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="detail-tile rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Position Prize</p>
                      <p className="mt-1 font-heading text-lg font-black text-primary">{usesPositionPrize ? formatCurrency(prize) : "Disabled"}</p>
                    </div>
                    <div className="detail-tile rounded-lg p-3">
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Crosshair className="h-3 w-3" /> Per Kill
                      </p>
                      <p className="mt-1 font-heading text-lg font-black text-accent">{usesKillPrize ? formatCurrency(killPrizeAmount) : "Disabled"}</p>
                    </div>
                    <div className="detail-tile rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Entry</p>
                      <p className="mt-1 font-heading text-lg font-black text-emerald-200">{entryFee === 0 ? "Free" : formatCurrency(entryFee)}</p>
                    </div>
                  </div>
                  {usesPositionPrize && Boolean(tournament.prizeDistribution?.length) && (
                    <div className="mt-3 grid gap-2 min-[520px]:grid-cols-3">
                      {tournament.prizeDistribution.slice(0, 6).map((row) => (
                        <div key={row.position} className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                          <p className="text-[10px] text-muted-foreground">Position #{row.position}</p>
                          <p className="font-heading font-bold text-accent">{formatCurrency(row.prizeAmount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="tournament-section rounded-xl p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-secondary" />
                      <div>
                        <h3 className="font-heading text-base font-bold">Room Credentials</h3>
                        <p className="text-xs text-muted-foreground">Visible only when your access allows it.</p>
                      </div>
                    </div>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="detail-tile rounded-lg p-3">
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-3 w-3" /> Join Time
                      </p>
                      <p className="mt-1 font-heading text-sm font-bold">{formatDateTime(tournament.room_details?.roomJoinTime)}</p>
                    </div>
                    <div className="detail-tile rounded-lg p-3">
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Hash className="h-3 w-3" /> Room ID
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-heading text-sm font-bold">
                          {tournament.room_details?.roomId || (registered || tournament.room_details?.hasRoomId ? "Not shared yet" : "Join to view")}
                        </p>
                        {tournament.room_details?.roomId && (
                          <button
                            type="button"
                            onClick={() => copyValue("Room ID", tournament.room_details?.roomId)}
                            className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
                            aria-label="Copy Room ID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="detail-tile rounded-lg p-3">
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> Password
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-heading text-sm font-bold">
                          {tournament.room_details?.roomPass || (registered || tournament.room_details?.hasRoomPass ? "Not shared yet" : "Join to view")}
                        </p>
                        {tournament.room_details?.roomPass && (
                          <button
                            type="button"
                            onClick={() => copyValue("Room Pass", tournament.room_details?.roomPass)}
                            className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
                            aria-label="Copy Room Pass"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!hasRoomDetails && (
                    <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      Room credentials have not been published yet. Joined players will receive live room updates.
                    </p>
                  )}
                </section>

                <section className="tournament-section rounded-xl p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-secondary" />
                      <div>
                        <h3 className="font-heading text-base font-bold">Participants</h3>
                        <p className="text-xs text-muted-foreground">
                          {registeredSlots > 0
                            ? `${registeredSlots} slot${registeredSlots === 1 ? "" : "s"} booked with ${participantCount} participant${participantCount === 1 ? "" : "s"}.`
                            : "No participants have joined yet."}
                        </p>
                      </div>
                    </div>
                    {participantsLoading && <RefreshCcw className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  {participantPreview.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {participantPreview.map((registration) => {
                        const avatar = getPlayerAvatar(registration);
                        return (
                          <div key={registration._id} className="detail-tile rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              {avatar ? (
                                <img src={avatar} alt={getPlayerName(registration)} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="grid h-10 w-10 place-items-center rounded-full bg-muted font-heading text-xs font-bold">
                                  {getPlayerName(registration).slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-heading text-sm font-bold">{getPlayerName(registration)}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {registration.gameAccount?.gameId || registration.gameAccounts?.[0]?.gameId || "Game ID pending"}
                                </p>
                              </div>
                              <span className="rounded-lg border border-secondary/30 bg-secondary/10 px-2 py-1 font-heading text-[10px] font-bold text-secondary">
                                #{registration.slotNumber || "-"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {participants.length > participantPreview.length && (
                        <div className="detail-tile rounded-lg p-3 text-center font-heading text-sm font-bold text-muted-foreground">
                          +{participants.length - participantPreview.length} more joined
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-glass-border bg-background/30 p-5 text-center">
                      <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="font-heading text-sm font-bold">Waiting for players</p>
                      <p className="mt-1 text-xs text-muted-foreground">The participant board will fill as players join.</p>
                    </div>
                  )}
                </section>

                {tournament.status === "completed" && (
                  <section className="tournament-section rounded-xl p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Medal className="h-5 w-5 text-accent" />
                        <h3 className="font-heading text-base font-bold">Tournament Result</h3>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{formatCurrency(resultPaidTotal)} paid</span>
                    </div>
                    {resultRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Result not published yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {resultRows.map((result, index) => (
                          <div key={`${tournament._id}-${result.position}-${index}`} className="detail-tile rounded-lg p-3">
                            <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2">
                              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-accent/40 bg-accent/15">
                                <span className="text-[9px] leading-none text-muted-foreground">{prizeMode === "kill" ? "Rank" : "Pos"}</span>
                                <span className="font-heading text-sm font-bold leading-tight text-accent">#{result.position || index + 1}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-heading text-sm font-bold">{getResultPlayerName(result.player)}</p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {result.gameName || "Game name not set"} - ID {result.gameId || "Not set"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="whitespace-nowrap font-heading font-bold text-secondary">{formatCurrency(result.prizeWon)}</p>
                                <p className="whitespace-nowrap text-[10px] text-muted-foreground">{Number(result.kills || 0)} kills</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section id="tournament-rules" className="tournament-section scroll-mt-24 rounded-xl p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-heading text-base font-bold">Rules & Regulations</h3>
                      <p className="text-xs text-muted-foreground">Match conduct and dispute standards.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {rules.map((rule, i) => (
                      <details key={`${rule}-${i}`} className="group rounded-lg border border-glass-border/70 bg-background/35 p-3" open={i === 0}>
                        <summary className="cursor-pointer list-none font-heading text-sm font-bold">
                          Rule {i + 1}
                          <span className="float-right text-muted-foreground transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{rule}</p>
                      </details>
                    ))}
                  </div>
                </section>

                <section className="tournament-section rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                        <Flag className="h-5 w-5 text-destructive" />
                        Report Match Issue
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Report cheating, fake results, room problems, abusive behavior, or missing prize distribution.
                      </p>
                    </div>
                    <NeonButton variant="blue" className="shrink-0 text-xs" onClick={() => setReportOpen(true)}>
                      Report
                    </NeonButton>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Confirmation Popup */}
      <AnimatePresence>
        {reportOpen && tournament && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/88 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass max-h-[88vh] w-full max-w-md overflow-y-auto rounded-lg border border-glass-border p-5"
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

      </AnimatePresence>
    </div>
  );
};

export default TournamentDetailScreen;
