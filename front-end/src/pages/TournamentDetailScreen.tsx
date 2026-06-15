import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Copy,
  Flag,
  Gamepad2,
  Hash,
  KeyRound,
  Lock,
  MessageCircle,
  Radio,
  RefreshCcw,
  Share2,
  Shield,
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
import { startDmConversation } from "@/api/dm";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { CACHE_KEYS, readCache, writeAuthenticatedCache, writeCache } from "@/lib/offline-cache";
import {
  prefetchCreatorProfile,
  prefetchOnIntent,
  prefetchRoute,
} from "@/lib/route-prefetch";
import { createReport, ReportCategory } from "@/api/moderation";
import { toast } from "@/components/ui/sonner";
import { UserAvatar, UserIdentity } from "@/components/identity";
import { gameLabels, getDiscoveryGame, getGameImagePosition } from "@/config/discovery.config";

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

const getRegistrationUserId = (registration: TournamentRegistration) =>
  typeof registration.user === "string" ? registration.user : registration.user?._id || "";

type DetailTab = "overview" | "room" | "players" | "chat";

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
  const [startingDmId, setStartingDmId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportCategory>("cheating");
  const [reportDescription, setReportDescription] = useState("");
  const [reportProof, setReportProof] = useState("");
  const [reportTargetUser, setReportTargetUser] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [tabTouched, setTabTouched] = useState(false);

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

  useEffect(() => {
    if (registered && !tabTouched) setActiveTab("room");
  }, [registered, tabTouched]);

  const creator = {
    id: tournament?.channel?._id ?? tournament?.organizer?._id ?? "",
    userId: tournament?.organizer?._id ?? "",
    name: tournament?.channel?.name ?? tournament?.organizer?.username ?? "Creator",
    avatarUrl: tournament?.channel?.avatar?.url ?? tournament?.organizer?.avatar?.url ?? "",
    verified: Boolean(tournament?.channel || tournament?.organizer),
    rating: tournament?.organizer?.stats?.rating ?? 4.5,
  };
  const creatorProfilePath = creator.id ? `/creator/${creator.id}` : "";

  const openDirectMessage = async (targetUserId: string, metadata: Record<string, unknown> = {}) => {
    if (!targetUserId || startingDmId) return;
    setStartingDmId(targetUserId);
    try {
      const { conversation } = await startDmConversation({
        targetUserId,
        metadata: {
          source: "tournament-detail",
          tournamentId: tournament?._id,
          tournamentTitle: tournament?.title,
          ...metadata,
        },
      });
      navigate(`/messages/${conversation._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open direct message");
    } finally {
      setStartingDmId(null);
    }
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
  const heroGame = tournament ? getDiscoveryGame(tournament.game) : getDiscoveryGame("bgmi");
  const heroImage = heroGame.image;
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
  const slotSelectionPath = tournament
    ? `/tournament/${id}/slots?type=${tournament.type}&slots=${tournament.maxPlayers}&teamSize=${tournament.teamSize || ""}&fee=${entryFee}&game=${tournament.game}&title=${encodeURIComponent(tournament.title)}`
    : "";
  const roomIdValue = tournament?.room_details?.roomId || "";
  const roomPassValue = tournament?.room_details?.roomPass || "";
  const roomIdDisplay = roomIdValue || (registered || tournament?.room_details?.hasRoomId ? "Pending" : "Join to view");
  const roomPassDisplay = roomPassValue || (registered || tournament?.room_details?.hasRoomPass ? "Pending" : "Join to view");
  const chatPath = tournament ? `/tournament/${tournament._id}/chat` : "";
  const setTab = (tab: DetailTab) => {
    setTabTouched(true);
    setActiveTab(tab);
  };
  const tabs: Array<{ id: DetailTab; label: string; icon: typeof Trophy }> = [
    { id: "overview", label: "Overview", icon: Trophy },
    { id: "room", label: "Room", icon: KeyRound },
    { id: "players", label: "Players", icon: Users },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ];

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

  const registerTournament = () => {
    if (!tournament || registered || !registrationIsOpen) return;
    navigate(slotSelectionPath);
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
    <div className="arena-shell min-h-screen pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <style>{`
        .tournament-section {
          border: 1px solid hsl(var(--border) / 0.72);
          background: linear-gradient(135deg, hsl(var(--card) / 0.78), hsl(var(--background) / 0.92));
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.035);
          padding: 0.9rem !important;
        }
        .detail-tile {
          border: 0;
          border-top: 1px solid hsl(var(--border) / 0.62);
          background: transparent;
          border-radius: 0 !important;
          padding: 0.65rem 0 !important;
          transition: color 150ms ease, transform 150ms ease;
        }
        .detail-tile:first-child { border-top: 0; padding-top: 0 !important; }
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
        @media (max-width: 640px) {
          .tournament-section { padding: 0.75rem !important; }
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
            <div className="b4a-skeleton h-[280px] rounded-xl sm:h-[340px]" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <div className="rounded-xl border border-glass-border bg-card/60 p-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="space-y-2 border-t border-glass-border/60 py-3 first:border-t-0 sm:border-t-0">
                        <div className="b4a-skeleton h-4 w-8 rounded-sm" />
                        <div className="b4a-skeleton h-3 w-16 rounded-sm" />
                        <div className="b4a-skeleton h-4 w-24 rounded-sm" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-glass-border bg-card/60 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="b4a-skeleton h-9 w-9 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="b4a-skeleton h-4 w-40 max-w-full" />
                      <div className="b4a-skeleton h-3 w-64 max-w-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="b4a-skeleton h-12 rounded-md" />
                    <div className="b4a-skeleton h-12 rounded-md" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-glass-border bg-card/60 p-4">
                <div className="b4a-skeleton h-10 rounded-md" />
                <div className="mt-3 space-y-2">
                  <div className="b4a-skeleton h-9 rounded-md" />
                  <div className="b4a-skeleton h-9 rounded-md" />
                  <div className="b4a-skeleton h-9 rounded-md" />
                </div>
              </div>
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
              className="relative overflow-hidden rounded-lg border border-glass-border bg-card"
            >
              <div
                className="absolute inset-0 bg-cover opacity-55"
                style={{
                  backgroundImage: `url(${heroImage})`,
                  backgroundPosition: getGameImagePosition(tournament.game, "banner"),
                }}
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${heroAccent}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_8_18/0.18),rgb(5_8_18/0.92)_82%)]" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

              <div className="relative flex min-h-[178px] flex-col justify-between p-3.5 sm:min-h-[220px] sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-heading text-[11px] font-bold ${statusMeta.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${statusMeta.dot} ${tournament.status === "running" ? "status-pulse" : ""}`} />
                    {statusMeta.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-black/28 px-3 py-1 font-heading text-[11px] text-white">
                    <Gamepad2 className="h-3.5 w-3.5 text-cyan-200" />
                    {gameLabels[tournament.game] ?? tournament.game}
                  </span>
                </div>

                <div className="max-w-3xl pt-5 sm:pt-8">
                  <h2 className="font-heading text-[clamp(1.45rem,8vw,2.55rem)] font-black leading-tight text-white">
                    {tournament.title}
                  </h2>
                  <p className="mt-1 line-clamp-1 max-w-2xl text-xs leading-5 text-white/70 sm:mt-2 sm:text-sm">
                    {tournament.description || `${teamLabel} ${modeLabel} tournament hosted on Battle4Arena.`}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                    <button
                      type="button"
                      onClick={() => creator.id && navigate(`/creator/${creator.id}`)}
                      className="arena-focus inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-black/32 px-2.5 py-1.5 text-left"
                    >
                      <UserAvatar
                        user={{
                          _id: creator.id,
                          username: creator.name,
                          avatar: { url: creator.avatarUrl },
                          role: ["creator"],
                        }}
                        size="sm"
                      />
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

                <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {[
                    { icon: Timer, label: countdownLabel, value: countdownValue, tone: "text-primary" },
                    { icon: Users, label: "Slots", value: `${registeredSlots}/${tournament.maxPlayers}`, tone: "text-cyan-200" },
                    { icon: Wallet, label: "Entry Fee", value: entryFee === 0 ? "Free" : formatCurrency(entryFee), tone: "text-emerald-200" },
                    { icon: Trophy, label: "Prize", value: usesPositionPrize ? formatCurrency(prize) : "Kill based", tone: "text-accent" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-glass-border bg-black/34 p-2.5 sm:p-3">
                      <item.icon className={`mb-1.5 h-4 w-4 ${item.tone}`} />
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/48">{item.label}</p>
                      <p className="mt-0.5 truncate font-heading text-sm font-black text-white sm:text-base">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <aside className="order-first lg:sticky lg:top-24 lg:order-last">
                <section className="tournament-section rounded-lg p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-bold">Match Lobby</p>
                      <p className="text-[11px] text-muted-foreground">{registered ? "Joined and ready" : "Join to unlock room and chat"}</p>
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
                    {...prefetchOnIntent(() => prefetchRoute(slotSelectionPath))}
                  >
                    {registerButtonText}
                  </NeonButton>
                  <div className="mt-3 flex flex-col gap-2">
                    {registered && (
                      <button
                        type="button"
                        onClick={() => setTab("room")}
                        className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-secondary/30 bg-secondary/10 font-heading text-xs font-bold text-secondary"
                      >
                        <KeyRound className="h-4 w-4" />
                        View Room Details
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openChat}
                      disabled={!registered}
                      {...prefetchOnIntent(() => prefetchRoute(chatPath))}
                      className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 font-heading text-xs font-bold text-primary disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Open Chat & Voice
                    </button>
                    <button
                      type="button"
                      onClick={() => openDirectMessage(creator.userId, { creatorId: creator.userId, creatorName: creator.name })}
                      disabled={!creator.userId || startingDmId === creator.userId}
                      className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-secondary/25 bg-secondary/10 font-heading text-xs font-bold text-secondary disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message Organizer
                    </button>
                    <button
                      type="button"
                      onClick={() => creatorProfilePath && navigate(creatorProfilePath)}
                      disabled={!creatorProfilePath}
                      {...prefetchOnIntent(() => prefetchCreatorProfile(creator.id))}
                      className="arena-focus flex min-h-10 items-center justify-between gap-3 rounded-sm border border-glass-border bg-card/70 px-3 text-left disabled:opacity-50"
                    >
                      <UserIdentity
                        user={{
                          _id: creator.id,
                          username: creator.name,
                          avatar: { url: creator.avatarUrl },
                        }}
                        subtitle="Organizer"
                        avatarSize="sm"
                        className="min-w-0 flex-1"
                      />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                    <details className="group rounded-sm border border-glass-border bg-card/70">
                      <summary className="arena-focus flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 font-heading text-xs font-bold text-muted-foreground">
                        More actions
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="grid gap-1 border-t border-glass-border/70 p-1.5">
                        <button
                          type="button"
                          onClick={shareTournament}
                          className="arena-focus flex min-h-8 items-center gap-2 rounded-sm px-2 text-left font-heading text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab("overview")}
                          className="arena-focus flex min-h-8 items-center gap-2 rounded-sm px-2 text-left font-heading text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          View rules
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportOpen(true)}
                          className="arena-focus flex min-h-8 items-center gap-2 rounded-sm px-2 text-left font-heading text-[11px] text-destructive hover:bg-destructive/10"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          Report issue
                        </button>
                      </div>
                    </details>
                  </div>
                </section>
              </aside>

              <div className="space-y-3">
                {registered && (
                  <section className="rounded-lg border border-secondary/35 bg-secondary/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-bold text-secondary">Room Access</p>
                        <p className="truncate text-[11px] text-muted-foreground">{formatDateTime(tournament.room_details?.roomJoinTime)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab("room")}
                        className="arena-focus inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-secondary px-3 font-heading text-[11px] font-bold text-secondary-foreground"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => roomIdValue && copyValue("Room ID", roomIdValue)}
                        disabled={!roomIdValue}
                        className="arena-focus min-w-0 rounded-sm border border-secondary/25 bg-background/35 p-2 text-left disabled:opacity-60"
                      >
                        <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Room ID</span>
                        <span className="mt-0.5 block truncate font-heading text-sm font-black text-foreground">{roomIdDisplay}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => roomPassValue && copyValue("Password", roomPassValue)}
                        disabled={!roomPassValue}
                        className="arena-focus min-w-0 rounded-sm border border-secondary/25 bg-background/35 p-2 text-left disabled:opacity-60"
                      >
                        <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Password</span>
                        <span className="mt-0.5 block truncate font-heading text-sm font-black text-foreground">{roomPassDisplay}</span>
                      </button>
                    </div>
                  </section>
                )}

                <nav className="sticky top-[4.25rem] z-10 rounded-lg border border-glass-border bg-background/95 p-1">
                  <div className="grid grid-cols-4 gap-1">
                    {tabs.map((tab) => {
                      const active = activeTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTab(tab.id)}
                          className={`arena-focus inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm px-1 font-heading text-[10px] font-bold transition-colors min-[390px]:text-[11px] ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-card hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {activeTab === "overview" && (
                  <section className="tournament-section rounded-lg p-3.5 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-base font-bold">Overview</h3>
                        <p className="text-xs text-muted-foreground">Only the match prep essentials.</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 font-heading text-[10px] font-bold ${statusMeta.tone}`}>
                        {registered ? "Joined" : statusMeta.label}
                      </span>
                    </div>

                    <div className="divide-y divide-glass-border/70">
                      {[
                        { icon: Calendar, label: "Match starts", value: formatDateTime(tournament.startAt) },
                        { icon: Gamepad2, label: "Mode", value: modeLabel },
                        { icon: UserCheck, label: "Team size", value: teamLabel },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-primary/25 bg-primary/10 text-primary">
                            <item.icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                            <p className="mt-0.5 truncate font-heading text-sm font-bold">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-3 divide-x divide-glass-border/70 border-y border-glass-border/70 py-2 text-center">
                      <div className="px-2">
                        <p className="text-[10px] text-muted-foreground">Prize</p>
                        <p className="truncate font-heading text-sm font-black text-accent">{usesPositionPrize ? formatCurrency(prize) : "Kill"}</p>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] text-muted-foreground">Entry</p>
                        <p className="truncate font-heading text-sm font-black">{entryFee === 0 ? "Free" : formatCurrency(entryFee)}</p>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] text-muted-foreground">Slots</p>
                        <p className="truncate font-heading text-sm font-black text-primary">{slotsLeft} left</p>
                      </div>
                    </div>

                    <details className="mt-3 group rounded-sm border border-glass-border bg-background/35">
                      <summary className="arena-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 font-heading text-xs font-bold">
                        View Details
                        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="border-t border-glass-border/70 p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {[
                            { label: "Registration", value: registrationIsOpen ? "Open now" : now < registrationStartMs ? "Opening soon" : "Closed" },
                            { label: "Format", value: tournament.type.toUpperCase() },
                            { label: "Platform", value: tournament.platform || "mobile" },
                            { label: "Prize type", value: prizeMode === "both" ? "Position + Kill" : prizeMode },
                            { label: "Per kill", value: usesKillPrize ? formatCurrency(killPrizeAmount) : "Disabled" },
                            { label: "Players", value: `${participantCount} joined` },
                          ].map((item) => (
                            <div key={item.label} className="border-t border-glass-border/60 py-2 first:border-t-0 sm:first:border-t">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                              <p className="mt-0.5 truncate font-heading text-sm font-bold capitalize">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div id="tournament-rules" className="mt-3 scroll-mt-24 border-t border-glass-border/70 pt-3">
                          <p className="mb-2 font-heading text-xs font-bold text-primary">Rules</p>
                          <div className="space-y-2">
                            {rules.map((rule, i) => (
                              <details key={`${rule}-${i}`} className="group rounded-sm border border-glass-border/70 bg-card/55 p-2.5" open={i === 0}>
                                <summary className="cursor-pointer list-none font-heading text-xs font-bold">
                                  Rule {i + 1}
                                  <span className="float-right text-muted-foreground transition-transform group-open:rotate-45">+</span>
                                </summary>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{rule}</p>
                              </details>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>

                    {tournament.status === "completed" && resultRows.length > 0 && (
                      <details className="mt-3 group rounded-sm border border-accent/25 bg-accent/5">
                        <summary className="arena-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 font-heading text-xs font-bold text-accent">
                          Results published
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="space-y-2 border-t border-accent/15 p-3">
                          {resultRows.map((result, index) => (
                            <div key={`${tournament._id}-${result.position}-${index}`} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-t border-glass-border/60 py-2 first:border-t-0">
                              <span className="grid h-9 w-9 place-items-center rounded-sm border border-accent/35 bg-accent/10 font-heading text-xs font-black text-accent">
                                #{result.position || index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-heading text-sm font-bold">{getResultPlayerName(result.player)}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{Number(result.kills || 0)} kills</p>
                              </div>
                              <p className="whitespace-nowrap font-heading text-sm font-bold text-secondary">{formatCurrency(result.prizeWon)}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </section>
                )}

                {activeTab === "room" && (
                  <section className="tournament-section rounded-lg p-3.5 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-base font-bold">Room</h3>
                        <p className="text-xs text-muted-foreground">{registered ? "Copy and join fast." : "Join the tournament to unlock room access."}</p>
                      </div>
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 border-y border-glass-border/70 py-3">
                        <Calendar className="h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Join time</p>
                          <p className="truncate font-heading text-sm font-bold">{formatDateTime(tournament.room_details?.roomJoinTime)}</p>
                        </div>
                      </div>

                      {[
                        { label: "Room ID", value: roomIdValue, display: roomIdDisplay, icon: Hash },
                        { label: "Password", value: roomPassValue, display: roomPassDisplay, icon: KeyRound },
                      ].map((item) => (
                        <div key={item.label} className="rounded-sm border border-secondary/25 bg-secondary/10 p-3">
                          <div className="mb-2 flex items-center gap-2 text-secondary">
                            <item.icon className="h-4 w-4" />
                            <p className="font-heading text-[11px] font-bold uppercase tracking-[0.12em]">{item.label}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate font-display text-[clamp(1.2rem,7vw,2rem)] font-black text-foreground">
                              {item.display}
                            </p>
                            <button
                              type="button"
                              onClick={() => item.value && copyValue(item.label, item.value)}
                              disabled={!item.value}
                              className="arena-focus inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm bg-secondary px-3 font-heading text-xs font-bold text-secondary-foreground disabled:bg-muted disabled:text-muted-foreground"
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!hasRoomDetails && (
                      <p className="mt-3 rounded-sm border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                        Room credentials have not been published yet. Joined players will receive live room updates.
                      </p>
                    )}
                  </section>
                )}

                {activeTab === "players" && (
                  <section className="tournament-section rounded-lg p-3.5 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-base font-bold">Players</h3>
                        <p className="text-xs text-muted-foreground">{registeredSlots}/{tournament.maxPlayers} slots booked</p>
                      </div>
                      {participantsLoading && <RefreshCcw className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-300" style={{ width: `${slotFillPercent}%` }} />
                    </div>
                    {participantPreview.length > 0 ? (
                      <div className="divide-y divide-glass-border/70">
                        {participantPreview.map((registration) => {
                          const playerName = getPlayerName(registration);
                          const playerUserId = getRegistrationUserId(registration);
                          return (
                            <div key={registration._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                              <UserAvatar user={registration.user} name={playerName} size="md" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-heading text-sm font-bold">{playerName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {registration.gameAccount?.gameId || registration.gameAccounts?.[0]?.gameId || "Game ID pending"}
                                </p>
                              </div>
                              <span className="rounded-sm border border-secondary/30 bg-secondary/10 px-2 py-1 font-heading text-[10px] font-bold text-secondary">
                                #{registration.slotNumber || "-"}
                              </span>
                              {playerUserId && (
                                <button
                                  type="button"
                                  onClick={() => openDirectMessage(playerUserId, { source: "tournament-participants" })}
                                  disabled={startingDmId === playerUserId}
                                  className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                                  aria-label={`Message ${playerName}`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {participants.length > participantPreview.length && (
                          <p className="py-3 text-center font-heading text-xs font-bold text-muted-foreground">
                            +{participants.length - participantPreview.length} more joined
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-sm border border-dashed border-glass-border bg-background/30 p-5 text-center">
                        <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="font-heading text-sm font-bold">Waiting for players</p>
                        <p className="mt-1 text-xs text-muted-foreground">The player list will fill as slots are booked.</p>
                      </div>
                    )}
                  </section>
                )}

                {activeTab === "chat" && (
                  <section className="tournament-section rounded-lg p-3.5 sm:p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-primary/25 bg-primary/10 text-primary">
                        <MessageCircle className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-heading text-base font-bold">Chat & Voice</h3>
                        <p className="truncate text-xs text-muted-foreground">Coordinate room entry, reports, and match calls.</p>
                      </div>
                    </div>
                    <div className="rounded-sm border border-primary/20 bg-primary/10 p-3">
                      <p className="font-heading text-sm font-bold text-primary">{registered ? "Live communication unlocked" : "Join required"}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {registered
                          ? "Open the tournament chat to message joined players and use voice controls."
                          : "Chat and voice are available only after you join this tournament."}
                      </p>
                      <button
                        type="button"
                        onClick={openChat}
                        disabled={!registered}
                        {...prefetchOnIntent(() => prefetchRoute(chatPath))}
                        className="arena-focus mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 font-heading text-xs font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
                      >
                        <Radio className="h-4 w-4" />
                        Open Chat & Voice
                      </button>
                    </div>
                  </section>
                )}
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
                <NeonButton variant="danger" onClick={submitReport} disabled={submittingReport}>
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
