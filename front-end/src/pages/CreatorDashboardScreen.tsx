import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit,
  PieChart,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { deleteTournament, getTournaments, Tournament, updateTournamentStatus } from "@/api/tournaments";
import { getMyProfile } from "@/api/profile";
import { formatCurrency, formatPrizeSummary, getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";
import { CACHE_KEYS, readCache, writeAuthenticatedCache } from "@/lib/offline-cache";

const statusFilters = ["all", "live", "upcoming", "completed", "draft"] as const;
type DashboardStatus = Exclude<(typeof statusFilters)[number], "all">;

const statusClass: Record<DashboardStatus, string> = {
  live: "bg-destructive/20 text-destructive",
  upcoming: "bg-secondary/20 text-secondary",
  completed: "bg-accent/20 text-accent",
  draft: "bg-muted text-muted-foreground",
};

const toDashboardStatus = (status: Tournament["status"]): DashboardStatus => {
  if (status === "running") return "live";
  if (status === "completed" || status === "cancelled") return "completed";
  if (status === "draft") return "draft";
  return "upcoming";
};

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

const CreatorDashboardScreen = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTournaments = async () => {
      try {
        const profileRes = await getMyProfile();
        const userId = profileRes.data.user._id;
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
  }, []);

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

  const earningsData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 4 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 3 + index, 1));
    const amounts = months.map((month) =>
      tournaments.reduce((sum, tournament) => {
        const date = new Date(tournament.startAt);
        if (Number.isNaN(date.getTime())) return sum;
        return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
          ? sum + getNetEarnings(tournament)
          : sum;
      }, 0),
    );
    const maxAmount = Math.max(...amounts.map((amount) => Math.abs(amount)), 1);

    return months.map((month, index) => ({
      month: month.toLocaleString("en-IN", { month: "short" }),
      amount: formatCurrency(amounts[index]),
      height: amounts[index] === 0 ? 4 : Math.max(16, Math.round((Math.abs(amounts[index]) / maxAmount) * 72)),
      negative: amounts[index] < 0,
    }));
  }, [tournaments]);

  const statusBreakdown = useMemo(() => {
    const rows = statusFilters.filter((item) => item !== "all").map((item) => {
      const count = tournaments.filter((tournament) => toDashboardStatus(tournament.status) === item).length;
      const percent = tournaments.length ? Math.round((count / tournaments.length) * 100) : 0;
      return { label: item, count, percent };
    });
    return rows;
  }, [tournaments]);

  const financeSummary = useMemo(() => {
    const gross = tournaments.reduce((sum, tournament) => sum + Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0), 0);
    const platformFees = tournaments.reduce((sum, tournament) => sum + Number(tournament.platformFeeAmount || 0), 0);
    const prizePaid = tournaments.reduce((sum, tournament) => sum + getPaidMoney(tournament), 0);
    const pendingPrize = tournaments
      .filter((tournament) => tournament.status === "completed" && getReceivedMoney(tournament) > 0 && getPaidMoney(tournament) === 0)
      .reduce((sum, tournament) => sum + Number(tournament.prizePool || tournament.killPrizeAmount || 0), 0);

    return {
      gross,
      platformFees,
      prizePaid,
      pendingPrize,
      net: gross - prizePaid,
      payoutRate: gross > 0 ? Math.min(100, Math.round((prizePaid / gross) * 100)) : 0,
    };
  }, [tournaments]);

  const gameBreakdown = useMemo(() => {
    const counts = tournaments.reduce<Record<string, number>>((record, tournament) => {
      record[tournament.game] = (record[tournament.game] || 0) + 1;
      return record;
    }, {});
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([game, count]) => ({ game, count, width: Math.max(8, Math.round((count / max) * 100)) }));
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

  const recentTournaments = tournaments.slice(0, 4);

  const skeletonCards = (count: number, className = "h-20") =>
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`${className} animate-pulse rounded-lg bg-muted`} />
    ));

  const handleDelete = async (tournament: Tournament) => {
    if (Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0) > 0) {
      toast.error("Cannot delete tournament", { description: "This tournament already has paid registrations." });
      return;
    }

    const previous = tournaments;

    try {
      setDeletingId(tournament._id);
      setTournaments((current) => current.filter((item) => item._id !== tournament._id));
      await deleteTournament(tournament._id);
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
        setTournaments((current) => current.map((item) => (item._id === tournament._id ? updated : item)));
      }
      toast.success(nextStatus === "completed" ? "Tournament completed" : "Tournament started", { description: tournament.title });
    } catch (error) {
      setTournaments(previous);
      const errorToast = getErrorToast(error, { action: "Update tournament", fallback: "Status update failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center justify-between gap-3">
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

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
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

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
        <h2 className="font-heading text-base font-bold flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" />
          Monthly Earnings
        </h2>
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : <GlassCard neon className="p-4">
          <div className="grid grid-cols-4 gap-3">
            {earningsData.map((e, i) => (
              <div key={e.month} className="min-w-0">
                <div className="h-24 rounded-lg border border-glass-border/70 bg-background/35 px-2 py-2 flex items-end overflow-hidden">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${e.height}%` }}
                    transition={{ delay: i * 0.12, duration: 0.45, ease: "easeOut" }}
                    className={`w-full rounded-md ${e.negative ? "bg-destructive" : "gradient-primary"}`}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground font-heading truncate">{e.month}</p>
                <p className={`text-center text-[10px] font-heading font-bold truncate ${e.negative ? "text-destructive" : "text-accent"}`}>
                  {e.amount}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>}
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5 grid gap-4 sm:grid-cols-2">
        {loading ? (
          <>
            <div className="h-44 animate-pulse rounded-xl bg-muted" />
            <div className="h-44 animate-pulse rounded-xl bg-muted" />
          </>
        ) : (
          <>
            <GlassCard neon>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-bold flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" />
                    Tournament Mix
                  </h2>
                  <p className="text-[10px] text-muted-foreground">Status distribution</p>
                </div>
                <span className="text-xs font-heading text-primary">{tournaments.length} total</span>
              </div>
              <div className="space-y-3">
                {statusBreakdown.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-heading capitalize">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span>{row.count} - {row.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full gradient-primary" style={{ width: `${Math.max(row.percent, row.count ? 8 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard neon>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-secondary" />
                    Payout Health
                  </h2>
                  <p className="text-[10px] text-muted-foreground">Prize distribution progress</p>
                </div>
                <span className="text-xs font-heading text-secondary">{financeSummary.payoutRate}% paid</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-secondary" style={{ width: `${financeSummary.payoutRate}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Received</p>
                  <p className="font-heading font-bold text-accent">{formatCurrency(financeSummary.gross)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Prize paid</p>
                  <p className="font-heading font-bold text-secondary">{formatCurrency(financeSummary.prizePaid)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Platform fees</p>
                  <p className="font-heading font-bold text-primary">{formatCurrency(financeSummary.platformFees)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Pending prizes</p>
                  <p className="font-heading font-bold text-destructive">{formatCurrency(financeSummary.pendingPrize)}</p>
                </div>
              </div>
            </GlassCard>
          </>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
        {loading ? (
          <div className="h-36 animate-pulse rounded-xl bg-muted" />
        ) : (
          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-sm font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                Game Performance
              </h2>
              <span className="text-[10px] text-muted-foreground">By created tournaments</span>
            </div>
            {gameBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">Create tournaments to see game analytics.</p>
            ) : (
              <div className="space-y-3">
                {gameBreakdown.map((row) => (
                  <div key={row.game}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-heading">
                      <span className="capitalize text-muted-foreground">{row.game}</span>
                      <span>{row.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${row.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
        <h2 className="font-heading text-base font-bold flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          Recent Tournaments
        </h2>
        <div className="space-y-3">
          {loading && skeletonCards(3)}
          {!loading && recentTournaments.length === 0 && (
            <GlassCard className="text-center py-8">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No tournaments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first tournament to see stats here.</p>
            </GlassCard>
          )}

          {!loading && recentTournaments.map((tournament, i) => (
            <GlassCard key={tournament._id} neon delay={i * 0.06}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{tournament.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {Number(tournament.participantCount || tournament.registrationCount || 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> {formatCurrency(getReceivedMoney(tournament))} received
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-heading font-bold ${getNetEarnings(tournament) < 0 ? "text-destructive" : "text-accent"}`}>
                    {formatCurrency(getNetEarnings(tournament))} net
                  </p>
                  <p className="text-[10px] text-muted-foreground font-heading">{formatCurrency(getPaidMoney(tournament))} paid</p>
                  <span className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full ${statusClass[toDashboardStatus(tournament.status)]}`}>
                    {toDashboardStatus(tournament.status)}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-secondary" />
            Created Tournaments
          </h2>
          <span className="text-[10px] text-muted-foreground font-heading">{filteredTournaments.length} shown</span>
        </div>

        <div className="glass rounded-lg flex items-center gap-2 px-3 py-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search created tournaments..."
            className="min-w-0 flex-1 bg-transparent text-xs font-heading focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-heading font-medium capitalize whitespace-nowrap transition-colors ${
                status === filter ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

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
            const hasPaidEntries = Number(tournament.receivedMoney ?? tournament.organizerEarnings ?? 0) > 0;
            return (
            <GlassCard key={tournament._id} delay={index * 0.04} className="relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-bold text-sm truncate">{tournament.title}</p>
                    <span className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full ${statusClass[toDashboardStatus(tournament.status)]}`}>
                      {toDashboardStatus(tournament.status)}
                    </span>
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

                <div className="flex gap-1.5 shrink-0">
                  {tournament.status === "completed" && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => navigate(`/tournament/${tournament._id}/distribute-prizes`)}
                      className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition-colors"
                      title={getPaidMoney(tournament) > 0 ? "View results" : "Prize distribution"}
                    >
                      <Trophy className="w-3.5 h-3.5 text-accent" />
                    </motion.button>
                  )}
                  {tournament.status !== "running" && tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStatusChange(tournament, "running")}
                      disabled={updatingStatusId === tournament._id}
                      className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center hover:bg-secondary/20 transition-colors disabled:opacity-50"
                      title="Start tournament"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-secondary" />
                    </motion.button>
                  )}
                  {tournament.status !== "completed" && tournament.status !== "cancelled" && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStatusChange(tournament, "completed")}
                      disabled={updatingStatusId === tournament._id}
                      className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition-colors disabled:opacity-50"
                      title="Complete tournament"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(`/edit-tournament/${tournament._id}`)}
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    title="Edit tournament"
                  >
                    <Edit className="w-3.5 h-3.5 text-primary" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => !hasPaidEntries && handleDelete(tournament)}
                    disabled={deletingId === tournament._id || hasPaidEntries}
                    className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    title={hasPaidEntries ? "Cannot delete after paid registrations" : "Delete tournament"}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          )})}
        </div>
      </div>

    </div>
  );
};

export default CreatorDashboardScreen;
