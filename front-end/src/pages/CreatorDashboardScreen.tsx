import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleX,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  Bell,
  Flag,
  KeyRound,
  LoaderCircle,
  Lock,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Trophy,
  UserX,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { cancelTournament, deleteTournament, getParticipants, getTournaments, notifyTournamentRoom, Tournament, TournamentRegistration, updateTournamentStatus, updateTournamentVisibility } from "@/api/tournaments";
import { banTournamentPlayer, createReport, getTournamentBans, TournamentBan, unbanTournamentPlayer } from "@/api/moderation";
import { User as ProfileUser } from "@/api/profile";
import { UserAvatar } from "@/components/identity";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatPrizeSummary, getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";
import { CACHE_KEYS, readCache, removeCache, removeCacheByPrefix, writeAuthenticatedCache } from "@/lib/offline-cache";

const statusFilters = ["all", "live", "upcoming", "completed", "cancelled", "draft"] as const;
type DashboardStatus = Exclude<(typeof statusFilters)[number], "all">;

const statusClass: Record<DashboardStatus, string> = {
  live: "bg-destructive/20 text-destructive",
  upcoming: "bg-secondary/20 text-secondary",
  completed: "bg-accent/20 text-accent",
  cancelled: "bg-destructive/15 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

const toDashboardStatus = (status: Tournament["status"]): DashboardStatus => {
  if (status === "running") return "live";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "draft";
  return "upcoming";
};

const CANCEL_TOURNAMENT_CONFIRM_TEXT = "cancel";

const formatDateTime = (value?: string) => {
  if (!value) return "No start date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No start date" : date.toLocaleString();
};

const getPrizePaidTotal = (tournament: Tournament) =>
  (tournament.results ?? []).reduce((sum, result) => sum + Number(result.prizeWon || 0), 0);

const getReceivedMoney = (tournament: Tournament) =>
  Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0);

const getPaidMoney = (tournament: Tournament) =>
  Number(tournament.paidMoney ?? getPrizePaidTotal(tournament));

const getNetEarnings = (tournament: Tournament) =>
  getReceivedMoney(tournament) - getPaidMoney(tournament);

const getCancellationRefundEstimate = (tournament: Tournament) =>
  Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0) + Number(tournament.platformFeeAmount || 0);

const getTournamentVisibility = (tournament: Tournament) =>
  tournament.visibility === "private" ? "private" : "public";

const getJoinedCount = (tournament: Tournament) =>
  Number(tournament.participantCount || tournament.registrationCount || tournament.joinedPlayers?.length || 0);

const actionButtonClass = {
  primary: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
  secondary: "border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/20",
  accent: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
  muted: "border-glass-border bg-muted/40 text-muted-foreground hover:bg-muted/70",
};
const tournamentActionButtonBase =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-heading font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type ModerationPlayer = {
  id: string;
  name: string;
  avatarUrl?: string;
  gameName?: string;
  gameId?: string;
  slotNumber?: number | null;
  status?: string;
};

type ModerationIntent = {
  type: "ban" | "unban" | "report";
  player: ModerationPlayer;
};

const getStatusActionToast = (status: Tournament["status"]) => {
  if (status === "open") return "Tournament published";
  if (status === "draft") return "Tournament moved to private";
  if (status === "completed") return "Tournament completed";
  if (status === "running") return "Tournament started";
  return "Tournament updated";
};

const getRegistrationPlayers = (registration: TournamentRegistration): ModerationPlayer[] => {
  const slotNumber = registration.slotNumber ?? null;
  const status = registration.status;
  if (registration.user?._id) {
    return [{
      id: registration.user._id,
      name: registration.user.username || "Player",
      avatarUrl: registration.user.avatar?.url,
      gameName: registration.user.gameAccount?.inGameName || registration.gameAccount?.inGameName,
      gameId: registration.user.gameAccount?.gameId || registration.gameAccount?.gameId,
      slotNumber,
      status,
    }];
  }

  return (registration.team || [])
    .filter((member) => Boolean(member._id))
    .map((member) => ({
      id: member._id!,
      name: member.username || "Player",
      avatarUrl: member.avatar?.url,
      gameName: member.gameAccount?.inGameName,
      gameId: member.gameAccount?.gameId,
      slotNumber,
      status,
    }));
};

const CreatorDashboardScreen = () => {
  const navigate = useNavigate();
  const { profile: currentProfile } = useCurrentProfile();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<ProfileUser | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [showTournamentFilters, setShowTournamentFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);
  const [pushingRoomId, setPushingRoomId] = useState<string | null>(null);
  const [roomDrafts, setRoomDrafts] = useState<Record<string, { roomId: string; roomPass: string }>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Tournament | null>(null);
  const [cancelUsernameInput, setCancelUsernameInput] = useState("");
  const [cancelPhraseInput, setCancelPhraseInput] = useState("");
  const [moderationTarget, setModerationTarget] = useState<Tournament | null>(null);
  const [moderationParticipants, setModerationParticipants] = useState<TournamentRegistration[]>([]);
  const [moderationBans, setModerationBans] = useState<TournamentBan[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationActionId, setModerationActionId] = useState<string | null>(null);
  const [moderationIntent, setModerationIntent] = useState<ModerationIntent | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationRemoveRegistration, setModerationRemoveRegistration] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile?._id) return undefined;
    let active = true;

    const loadTournaments = async () => {
      try {
        const user = currentProfile;
        const userId = user._id;
        if (active) setCreatorProfile(user);
        const cachedTournaments = readCache<Tournament[]>(CACHE_KEYS.creatorDashboard(userId));
        if (cachedTournaments && active) {
          setTournaments(cachedTournaments.data);
          setLoading(false);
        }
        const allTournaments = await getTournaments({ organizer: userId });
        if (!active) return;
        setTournaments(allTournaments);
        writeAuthenticatedCache(CACHE_KEYS.creatorDashboard(userId), allTournaments);
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Load tournaments", fallback: "Could not load creator tournaments." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTournaments();

    return () => {
      active = false;
    };
  }, [currentProfile]);

  useEffect(() => {
    setRoomDrafts((previous) => {
      const next = { ...previous };
      tournaments.forEach((tournament) => {
        if (!next[tournament._id]) {
          next[tournament._id] = {
            roomId: tournament.room_details?.roomId || "",
            roomPass: tournament.room_details?.roomPass || "",
          };
        }
      });
      return next;
    });
  }, [tournaments]);

  const stats = useMemo(() => {
    const totalReceived = tournaments.reduce((sum, tournament) => sum + getReceivedMoney(tournament), 0);
    const totalPaid = tournaments.reduce((sum, tournament) => sum + getPaidMoney(tournament), 0);
    const totalEarnings = totalReceived - totalPaid;
    const totalParticipants = tournaments.reduce((sum, tournament) => sum + Number(tournament.participantCount || tournament.registrationCount || 0), 0);

    return [
      { icon: Trophy, label: "Tournaments", value: String(tournaments.length), color: "text-primary" },
      { icon: DollarSign, label: "Received", value: formatCurrency(totalReceived), color: "text-accent" },
      { icon: CheckCircle2, label: "Paid", value: formatCurrency(totalPaid), color: "text-secondary" },
      { icon: TrendingUp, label: "Earnings", value: formatCurrency(totalEarnings), color: totalEarnings < 0 ? "text-destructive" : "text-accent" },
      { icon: Users, label: "Participants", value: totalParticipants.toLocaleString("en-IN"), color: "text-secondary" },
    ];
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tournaments.filter((tournament) => {
      const matchesStatus = status === "all" || toDashboardStatus(tournament.status) === status;
      const matchesSearch =
        !search ||
        tournament.title.toLowerCase().includes(search) ||
        tournament.game.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [query, status, tournaments]);

  const cancelRefundEstimate = cancelTarget ? getCancellationRefundEstimate(cancelTarget) : 0;
  const cancelPlatformFeeEstimate = cancelTarget ? Number(cancelTarget.platformFeeAmount || 0) : 0;
  const cancelConfirmReady = Boolean(cancelTarget && creatorProfile)
    && cancelUsernameInput.trim() === creatorProfile?.username
    && cancelPhraseInput.trim().toLowerCase() === CANCEL_TOURNAMENT_CONFIRM_TEXT;
  const moderationPlayers = useMemo(() => {
    const seen = new Set<string>();
    return moderationParticipants.flatMap(getRegistrationPlayers).filter((player) => {
      if (!player.id || seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
  }, [moderationParticipants]);
  const activeBanByPlayer = useMemo(() => {
    const rows = new Map<string, TournamentBan>();
    moderationBans
      .filter((ban) => ban.status === "active")
      .forEach((ban) => {
        const playerId = typeof ban.player === "string" ? ban.player : ban.player?._id;
        if (playerId) rows.set(playerId, ban);
      });
    return rows;
  }, [moderationBans]);

  const skeletonCards = (count: number, className = "h-20") =>
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`${className} animate-pulse rounded-lg bg-muted`} />
    ));

  const resetCancelDialog = () => {
    setCancelUsernameInput("");
    setCancelPhraseInput("");
  };

  const persistDashboardTournaments = (nextTournaments: Tournament[]) => {
    if (creatorProfile?._id) {
      writeAuthenticatedCache(CACHE_KEYS.creatorDashboard(creatorProfile._id), nextTournaments);
    }
    removeCache(CACHE_KEYS.home);
    removeCacheByPrefix("tournaments.page.");
  };

  const openCancelDialog = (tournament: Tournament) => {
    setCancelTarget(tournament);
    resetCancelDialog();
  };

  const openModerationDialog = async (tournament: Tournament) => {
    setModerationTarget(tournament);
    setModerationParticipants([]);
    setModerationBans([]);
    setModerationLoading(true);
    try {
      const [participants, bans] = await Promise.all([
        getParticipants(tournament._id),
        getTournamentBans(tournament._id).catch(() => ({ bans: [] })),
      ]);
      setModerationParticipants(participants);
      setModerationBans(bans.bans || []);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Load moderation roster", fallback: "Could not load players." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setModerationLoading(false);
    }
  };

  const updateRoomDraft = (tournamentId: string, field: "roomId" | "roomPass", value: string) => {
    setRoomDrafts((previous) => ({
      ...previous,
      [tournamentId]: {
        roomId: previous[tournamentId]?.roomId || "",
        roomPass: previous[tournamentId]?.roomPass || "",
        [field]: value,
      },
    }));
  };

  const handlePushRoomDetails = async (tournament: Tournament) => {
    const draft = roomDrafts[tournament._id] || { roomId: "", roomPass: "" };
    const roomId = draft.roomId.trim();
    const roomPass = draft.roomPass.trim();

    if (!roomId && !roomPass) {
      toast.error("Room details required", { description: "Add Room ID or password before sending notifications." });
      return;
    }

    try {
      setPushingRoomId(tournament._id);
      const result = await notifyTournamentRoom(tournament._id, {
        room_details: {
          roomId,
          roomPass,
          ...(tournament.room_details?.roomJoinTime ? { roomJoinTime: tournament.room_details.roomJoinTime } : {}),
        },
      });
      const updatedTournament = result?.tournament;
      if (updatedTournament) {
        const nextTournaments = tournaments.map((item) => (item._id === tournament._id ? updatedTournament : item));
        setTournaments(nextTournaments);
        persistDashboardTournaments(nextTournaments);
      }
      toast.success("Room details pushed", {
        description: `${result?.notifiedCount ?? 0} joined user${result?.notifiedCount === 1 ? "" : "s"} notified.`,
      });
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Push room details", fallback: "Could not send room details." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setPushingRoomId(null);
    }
  };

  const handleDelete = async (tournament: Tournament) => {
    if (Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0) > 0) {
      toast.error("Cannot delete tournament", { description: "This tournament already has paid registrations." });
      return;
    }

    const previous = tournaments;

    try {
      setDeletingId(tournament._id);
      const nextTournaments = tournaments.filter((item) => item._id !== tournament._id);
      setTournaments(nextTournaments);
      await deleteTournament(tournament._id);
      persistDashboardTournaments(nextTournaments);
      toast.success("Tournament deleted", { description: `${tournament.title} was removed.` });
    } catch (error) {
      setTournaments(previous);
      const errorToast = getErrorToast(error, { action: "Delete tournament", fallback: "Delete failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (tournament: Tournament, nextStatus: Tournament["status"]) => {
    const previous = tournaments;

    try {
      setUpdatingStatusId(tournament._id);
      setTournaments((current) => current.map((item) => (item._id === tournament._id ? { ...item, status: nextStatus } : item)));
      const updated = await updateTournamentStatus(tournament._id, nextStatus);
      if (updated) {
        const nextTournaments = tournaments.map((item) => (item._id === tournament._id ? updated : item));
        setTournaments(nextTournaments);
        persistDashboardTournaments(nextTournaments);
      }
      toast.success(getStatusActionToast(nextStatus), { description: tournament.title });
    } catch (error) {
      setTournaments(previous);
      const errorToast = getErrorToast(error, { action: "Update tournament", fallback: "Status update failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleVisibilityChange = async (tournament: Tournament, visibility: NonNullable<Tournament["visibility"]>) => {
    const joinedCount = getJoinedCount(tournament);
    if (visibility === "private" && joinedCount > 0) {
      toast.error("Cannot make private", { description: "Players have already joined this tournament." });
      return;
    }

    const previous = tournaments;

    try {
      setUpdatingVisibilityId(tournament._id);
      setTournaments((current) => current.map((item) => (item._id === tournament._id ? { ...item, visibility } : item)));
      const updated = await updateTournamentVisibility(tournament._id, visibility);
      if (updated) {
        const nextTournaments = tournaments.map((item) => (item._id === tournament._id ? updated : item));
        setTournaments(nextTournaments);
        persistDashboardTournaments(nextTournaments);
      }
      toast.success(visibility === "public" ? "Tournament published" : "Tournament moved to private", {
        description: tournament.title,
      });
    } catch (error) {
      setTournaments(previous);
      const errorToast = getErrorToast(error, { action: "Update visibility", fallback: "Visibility update failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  const handleCancelTournament = async () => {
    if (!cancelTarget || !creatorProfile) return;

    if (!cancelConfirmReady) {
      toast.error("Confirmation does not match.", {
        description: `Type your username and "${CANCEL_TOURNAMENT_CONFIRM_TEXT}" to cancel.`,
      });
      return;
    }

    const previous = tournaments;

    try {
      setCancellingId(cancelTarget._id);
      const result = await cancelTournament(cancelTarget._id, {
        username: cancelUsernameInput.trim(),
        confirmation: cancelPhraseInput.trim(),
      });
      const updatedTournament = result?.tournament ?? { ...cancelTarget, status: "cancelled" as const };
      const nextTournaments = tournaments.map((item) => (item._id === cancelTarget._id ? updatedTournament : item));
      setTournaments(nextTournaments);
      persistDashboardTournaments(nextTournaments);
      toast.success("Tournament cancelled", {
        description: `${result?.refundCount ?? 0} joined entries refunded. Creator paid ${formatCurrency(result?.refundTotal ?? 0)} including ${formatCurrency(result?.platformFeeCoveredByCreator ?? 0)} platform fee.`,
      });
      setCancelTarget(null);
      resetCancelDialog();
    } catch (error) {
      setTournaments(previous);
      const errorToast = getErrorToast(error, { action: "Cancel tournament", fallback: "Tournament cancellation failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setCancellingId(null);
    }
  };

  const openModerationIntent = (type: ModerationIntent["type"], player: ModerationPlayer) => {
    setModerationIntent({ type, player });
    setModerationReason("");
    setModerationRemoveRegistration(false);
  };

  const closeModerationIntent = () => {
    setModerationIntent(null);
    setModerationReason("");
    setModerationRemoveRegistration(false);
  };

  const submitModerationIntent = async () => {
    if (!moderationTarget || !moderationIntent) return;
    const { player, type } = moderationIntent;
    const reason = moderationReason.trim();

    if ((type === "ban" || type === "report") && reason.length < 12) {
      toast.error("Add more details", { description: "Please enter at least 12 characters so admins have enough context." });
      return;
    }

    try {
      setModerationActionId(player.id);
      if (type === "ban") {
      const res = await banTournamentPlayer(moderationTarget._id, {
        playerId: player.id,
        reason,
        note: reason,
          removeRegistration: moderationRemoveRegistration,
      });
      setModerationBans((current) => [res.data, ...current.filter((ban) => {
        const banPlayerId = typeof ban.player === "string" ? ban.player : ban.player?._id;
        return banPlayerId !== player.id || ban.status !== "active";
      })]);
      toast.success("Player banned", { description: `${player.name} cannot join this tournament now.` });
      }

      if (type === "unban") {
        await unbanTournamentPlayer(moderationTarget._id, player.id, reason);
        setModerationBans((current) => current.map((ban) => {
          const banPlayerId = typeof ban.player === "string" ? ban.player : ban.player?._id;
          return banPlayerId === player.id && ban.status === "active" ? { ...ban, status: "revoked" } : ban;
        }));
        toast.success("Player unbanned", { description: `${player.name} can join again.` });
      }

      if (type === "report") {
        await createReport({
          title: `Creator report: ${player.name}`,
          targetType: "player",
          category: "abusive_behavior",
          message: reason,
          tournament: moderationTarget._id,
          reportedUser: player.id,
          severity: "medium",
        });
        toast.success("Player reported", { description: "Admin moderation can now review it." });
      }

      closeModerationIntent();
    } catch (error) {
      const action = type === "ban" ? "Ban player" : type === "unban" ? "Unban player" : "Report player";
      const errorToast = getErrorToast(error, { action, fallback: `${action} failed.` });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setModerationActionId(null);
    }
  };

  const handleUnbanPlayer = async (player: ModerationPlayer) => {
    openModerationIntent("unban", player);
  };

  const handleReportPlayer = async (player: ModerationPlayer) => {
    openModerationIntent("report", player);
  };

  return (
    <div className="arena-shell min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-5 lg:px-6 pt-6 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold truncate">Creator Dashboard</h1>
            <p className="text-[10px] text-muted-foreground font-heading">Manage your tournaments</p>
          </div>
        </div>
        <NeonButton variant="green" className="text-[10px] py-1.5 px-3 shrink-0" onClick={() => navigate("/create-tournament")}>
          <Plus className="w-3 h-3 mr-1" /> Create
        </NeonButton>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-5 lg:px-6 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {loading ? skeletonCards(5, "h-[86px]") : stats.map((s, i) => (
            <GlassCard key={s.label} neon delay={i * 0.06}>
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <s.icon className={`w-4 h-4 shrink-0 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground font-heading truncate">{s.label}</span>
              </div>
              <p className="font-heading text-lg sm:text-xl font-bold truncate">{s.value}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-secondary" />
            Created Tournaments
          </h2>
          <span className="text-[10px] text-muted-foreground font-heading">{filteredTournaments.length} shown</span>
        </div>

        <div className="mb-3 flex min-w-0 items-center gap-2">
          <div className="glass flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search created tournaments..."
              className="min-w-0 flex-1 bg-transparent text-xs font-heading focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowTournamentFilters((value) => !value)}
            className={`arena-focus inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 font-heading text-[10px] font-bold transition-colors ${
              showTournamentFilters || status !== "all"
                ? "border-primary/45 text-primary neon-border"
                : "border-glass-border bg-card/80 text-muted-foreground"
            }`}
            aria-label="Toggle creator tournament filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden min-[360px]:inline">Filters</span>
          </button>
        </div>

        {showTournamentFilters && (
          <div className="glass mb-3 rounded-lg p-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {statusFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatus(filter)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-heading font-medium capitalize whitespace-nowrap transition-colors ${
                    status === filter ? "bg-primary text-primary-foreground neon-glow-purple" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            {status !== "all" && (
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-glass-border pt-2 text-[11px] text-muted-foreground">
                <span>Showing {status} tournaments.</span>
                <button
                  type="button"
                  onClick={() => setStatus("all")}
                  className="arena-focus shrink-0 rounded-sm font-heading font-bold text-primary"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {loading && skeletonCards(5)}
          {!loading && filteredTournaments.length === 0 && (
            <GlassCard className="text-center py-8">
              <Search className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No matching tournaments</p>
              <p className="text-xs text-muted-foreground mt-1">Try another search or status filter.</p>
            </GlassCard>
          )}

          {!loading && filteredTournaments.map((tournament, index) => {
            const hasPaidEntries = getCancellationRefundEstimate(tournament) > 0;
            const canCancelTournament = tournament.status !== "cancelled" && getPaidMoney(tournament) === 0;
            const isUpdatingTournament = updatingStatusId === tournament._id;
            const isUpdatingVisibility = updatingVisibilityId === tournament._id;
            const isPushingRoom = pushingRoomId === tournament._id;
            const visibility = getTournamentVisibility(tournament);
            const joinedCount = getJoinedCount(tournament);
            const canMakePrivate = joinedCount === 0;
            const canPushRoomDetails = visibility === "public" && tournament.status !== "completed" && tournament.status !== "cancelled";
            const roomDraft = roomDrafts[tournament._id] || {
              roomId: tournament.room_details?.roomId || "",
              roomPass: tournament.room_details?.roomPass || "",
            };
            return (
            <GlassCard key={tournament._id} delay={index * 0.04} className="relative overflow-hidden">
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-bold text-sm truncate">{tournament.title}</p>
                    <span className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full ${statusClass[toDashboardStatus(tournament.status)]}`}>
                      {toDashboardStatus(tournament.status)}
                    </span>
                    {visibility === "private" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-heading font-semibold text-muted-foreground">
                        <EyeOff className="h-3 w-3" />
                        Private
                      </span>
                    )}
                    {visibility === "public" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-heading font-semibold text-secondary">
                        <Eye className="h-3 w-3" />
                        Published
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {tournament.game} - {formatPrizeSummary(tournament)} prize
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
                    <span>{Number(tournament.registrationCount || 0)}/{tournament.maxPlayers} slots</span>
                    <span>{formatCurrency(tournament.entryFee)} entry</span>
                    <span>{formatCurrency(getReceivedMoney(tournament))} received</span>
                    {getPaidMoney(tournament) > 0 && <span>{formatCurrency(getPaidMoney(tournament))} paid</span>}
                    <span>{formatCurrency(getNetEarnings(tournament))} earnings</span>
                    <span>{formatDateTime(tournament.startAt)}</span>
                  </div>
                </div>

                {canPushRoomDetails && (
                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-glass-border/70 bg-background/35 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="min-w-0">
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-heading text-muted-foreground">
                        <KeyRound className="h-3 w-3" /> Room ID
                      </span>
                      <input
                        value={roomDraft.roomId}
                        onChange={(event) => updateRoomDraft(tournament._id, "roomId", event.target.value)}
                        placeholder="Custom room ID"
                        className="w-full rounded-md border border-glass-border bg-transparent px-3 py-2 text-xs font-heading outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-heading text-muted-foreground">
                        <Lock className="h-3 w-3" /> Password
                      </span>
                      <input
                        value={roomDraft.roomPass}
                        onChange={(event) => updateRoomDraft(tournament._id, "roomPass", event.target.value)}
                        placeholder="Room password"
                        className="w-full rounded-md border border-glass-border bg-transparent px-3 py-2 text-xs font-heading outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePushRoomDetails(tournament)}
                      disabled={isPushingRoom}
                      className="inline-flex h-10 items-center justify-center gap-1.5 self-end rounded-md border border-secondary/40 bg-secondary/10 px-3 text-[10px] font-heading font-semibold text-secondary transition-colors hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {isPushingRoom ? "Sending" : "Push"}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-glass-border/60 pt-3">
                  {visibility === "private" && tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleVisibilityChange(tournament, "public")}
                      disabled={isUpdatingVisibility}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.secondary}`}
                      title="Publish tournament"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Publish
                    </motion.button>
                  )}
                  {visibility === "public" && tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => canMakePrivate && handleVisibilityChange(tournament, "private")}
                      disabled={isUpdatingVisibility || !canMakePrivate}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.muted}`}
                      title={canMakePrivate ? "Move tournament to private" : "Cannot make private after players join"}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Private
                    </motion.button>
                  )}
                  {tournament.status === "completed" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => navigate(`/tournament/${tournament._id}/distribute-prizes`)}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.accent}`}
                      title={getPaidMoney(tournament) > 0 ? "View results" : "Prize distribution"}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Results
                    </motion.button>
                  )}
                  {tournament.status !== "running" && tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleStatusChange(tournament, "running")}
                      disabled={isUpdatingTournament}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.secondary}`}
                      title="Start tournament"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Start
                    </motion.button>
                  )}
                  {tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleStatusChange(tournament, "completed")}
                      disabled={isUpdatingTournament}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.accent}`}
                      title="Complete tournament"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete
                    </motion.button>
                  )}
                  {canCancelTournament && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => openCancelDialog(tournament)}
                      disabled={cancellingId === tournament._id}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.destructive}`}
                      title="Cancel tournament and refund joined players"
                    >
                      <CircleX className="w-3.5 h-3.5" />
                      Cancel
                    </motion.button>
                  )}
                  {joinedCount > 0 && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => openModerationDialog(tournament)}
                      className={`${tournamentActionButtonBase} ${actionButtonClass.secondary}`}
                      title="Moderate joined players"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Moderate
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/edit-tournament/${tournament._id}`)}
                    className={`${tournamentActionButtonBase} ${actionButtonClass.primary}`}
                    title="Edit tournament"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/tournament/${tournament._id}`)}
                    className={`${tournamentActionButtonBase} ${actionButtonClass.secondary}`}
                    title="Open tournament page"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => !hasPaidEntries && handleDelete(tournament)}
                    disabled={deletingId === tournament._id || hasPaidEntries}
                    className={`${tournamentActionButtonBase} ${actionButtonClass.destructive}`}
                    title={hasPaidEntries ? "Cannot delete after paid registrations" : "Delete tournament"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          )})}
        </div>
      </div>

      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            resetCancelDialog();
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg border-destructive/30 bg-card/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive">Cancel Tournament</DialogTitle>
            <DialogDescription>
              Joined entries will receive a full refund. The creator wallet pays the entry refunds plus the platform fee difference.
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-heading text-sm font-bold text-destructive">{cancelTarget.title}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg border border-glass-border bg-background/50 p-2">
                    <p className="text-muted-foreground">Refund estimate</p>
                    <p className="font-heading text-sm font-bold">{formatCurrency(cancelRefundEstimate)}</p>
                  </div>
                  <div className="rounded-lg border border-glass-border bg-background/50 p-2">
                    <p className="text-muted-foreground">Fee covered</p>
                    <p className="font-heading text-sm font-bold text-destructive">{formatCurrency(cancelPlatformFeeEstimate)}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Final refund is calculated by backend from saved registration payments.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-heading text-muted-foreground">
                  Type your username
                </label>
                <input
                  type="text"
                  value={cancelUsernameInput}
                  onChange={(event) => setCancelUsernameInput(event.target.value)}
                  placeholder={creatorProfile?.username || "username"}
                  className="w-full rounded-lg border border-glass-border bg-transparent px-3 py-2.5 text-sm font-heading focus:border-destructive focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-heading text-muted-foreground">
                  Type "{CANCEL_TOURNAMENT_CONFIRM_TEXT}"
                </label>
                <input
                  type="text"
                  value={cancelPhraseInput}
                  onChange={(event) => setCancelPhraseInput(event.target.value)}
                  placeholder={CANCEL_TOURNAMENT_CONFIRM_TEXT}
                  className="w-full rounded-lg border border-glass-border bg-transparent px-3 py-2.5 text-sm font-heading focus:border-destructive focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCancelTarget(null);
                    resetCancelDialog();
                  }}
                  disabled={cancellingId === cancelTarget._id}
                  className="rounded-lg border border-glass-border px-4 py-2 text-sm font-heading text-foreground disabled:opacity-60"
                >
                  Keep Tournament
                </button>
                <button
                  type="button"
                  onClick={handleCancelTournament}
                  disabled={!cancelConfirmReady || cancellingId === cancelTarget._id}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-heading text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancellingId === cancelTarget._id ? "Cancelling..." : "Cancel Tournament"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moderationTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setModerationTarget(null);
            setModerationParticipants([]);
            setModerationBans([]);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border-glass-border bg-card/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Player Moderation</DialogTitle>
            <DialogDescription>
              Ban, unban, or report players from your own tournament roster.
            </DialogDescription>
          </DialogHeader>

          {moderationTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                <p className="font-heading text-sm font-bold">{moderationTarget.title}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {moderationPlayers.length} player{moderationPlayers.length === 1 ? "" : "s"} loaded, {moderationBans.filter((ban) => ban.status === "active").length} active ban{moderationBans.filter((ban) => ban.status === "active").length === 1 ? "" : "s"}.
                </p>
              </div>

              {moderationLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-glass-border p-8 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading players
                </div>
              ) : moderationPlayers.length === 0 ? (
                <div className="rounded-lg border border-glass-border p-8 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="font-heading text-sm">No joined players yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Players will appear here after registration.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {moderationPlayers.map((player) => {
                    const ban = activeBanByPlayer.get(player.id);
                    const busy = moderationActionId === player.id;
                    return (
                      <div key={player.id} className="rounded-lg border border-glass-border bg-card/40 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar
                              user={{ _id: player.id, username: player.name, avatar: { url: player.avatarUrl } }}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-heading text-sm font-bold">{player.name}</p>
                                {ban && (
                                  <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-heading text-destructive">
                                    Banned
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {player.gameName || "Game name not set"} {player.gameId ? `- ${player.gameId}` : ""} {player.slotNumber ? `- Slot ${player.slotNumber}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ban ? (
                              <button
                                type="button"
                                onClick={() => handleUnbanPlayer(player)}
                                disabled={busy}
                                className={`${tournamentActionButtonBase} ${actionButtonClass.accent}`}
                              >
                                {busy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                                Unban
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openModerationIntent("ban", player)}
                                disabled={busy}
                                className={`${tournamentActionButtonBase} ${actionButtonClass.destructive}`}
                              >
                                {busy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                                Ban
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleReportPlayer(player)}
                              disabled={busy}
                              className={`${tournamentActionButtonBase} ${actionButtonClass.destructive}`}
                            >
                              <Flag className="h-3 w-3" />
                              Report
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moderationIntent)}
        onOpenChange={(open) => {
          if (!open) closeModerationIntent();
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg border-glass-border bg-card/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {moderationIntent?.type === "ban"
                ? "Ban Player"
                : moderationIntent?.type === "unban"
                  ? "Unban Player"
                  : "Report Player"}
            </DialogTitle>
            <DialogDescription>
              {moderationIntent?.player.name || "Player"} in {moderationTarget?.title || "this tournament"}
            </DialogDescription>
          </DialogHeader>

          {moderationIntent && (
            <div className="space-y-4">
              <div className="rounded-lg border border-glass-border bg-background/45 p-3">
                <p className="font-heading text-sm font-bold">{moderationIntent.player.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {moderationIntent.player.gameName || "Game name not set"}
                  {moderationIntent.player.gameId ? ` - ${moderationIntent.player.gameId}` : ""}
                  {moderationIntent.player.slotNumber ? ` - Slot ${moderationIntent.player.slotNumber}` : ""}
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-heading text-muted-foreground">
                  {moderationIntent.type === "unban" ? "Note (optional)" : "Reason"}
                </span>
                <textarea
                  value={moderationReason}
                  onChange={(event) => setModerationReason(event.target.value)}
                  rows={4}
                  placeholder={
                    moderationIntent.type === "ban"
                      ? "Explain why this player should be banned..."
                      : moderationIntent.type === "report"
                        ? "Explain what admins should review..."
                        : "Optional unban note..."
                  }
                  className="w-full resize-none rounded-lg border border-glass-border bg-background/55 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
              </label>

              {moderationIntent.type === "ban" && (
                <label className="flex items-start gap-3 rounded-lg border border-glass-border bg-background/45 p-3">
                  <input
                    type="checkbox"
                    checked={moderationRemoveRegistration}
                    onChange={(event) => setModerationRemoveRegistration(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-heading text-xs font-bold">Remove unpaid registration when allowed</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Paid players stay protected by the backend refund flow.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModerationIntent}
                  disabled={moderationActionId === moderationIntent.player.id}
                  className="rounded-lg border border-glass-border px-4 py-2 text-sm font-heading text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitModerationIntent}
                  disabled={moderationActionId === moderationIntent.player.id}
                  className={`rounded-lg px-4 py-2 text-sm font-heading font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    moderationIntent.type === "ban"
                      ? "bg-destructive text-destructive-foreground"
                      : moderationIntent.type === "unban"
                        ? "bg-accent text-accent-foreground"
                        : "bg-destructive text-destructive-foreground"
                  }`}
                >
                  {moderationActionId === moderationIntent.player.id ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CreatorDashboardScreen;
