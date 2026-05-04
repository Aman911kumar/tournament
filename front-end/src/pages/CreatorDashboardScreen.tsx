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
  Eye,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import BottomNav from "@/components/BottomNav";
import { deleteTournament, getTournaments, Tournament, updateTournamentStatus } from "@/api/tournaments";
import { getMyProfile } from "@/api/profile";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";

const earningsData = [
  { month: "Jan", amount: "Rs. 18,000", height: 45 },
  { month: "Feb", amount: "Rs. 24,500", height: 62 },
  { month: "Mar", amount: "Rs. 31,200", height: 80 },
  { month: "Apr", amount: "Rs. 28,800", height: 72 },
];

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

const CreatorDashboardScreen = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadTournaments = async () => {
      try {
        const profileRes = await getMyProfile();
        const userId = profileRes.data.user._id;
        const allTournaments = await getTournaments({ organizer: userId });
        if (!active) return;
        setTournaments(allTournaments);
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Load tournaments", fallback: "Could not load creator tournaments." });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    };

    loadTournaments();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalEarnings = tournaments.reduce((sum, tournament) => sum + Number(tournament.organizerEarnings || 0), 0);
    const totalParticipants = 0;
    const totalViews = 0;

    return [
      { icon: Trophy, label: "Tournaments", value: String(tournaments.length), color: "text-primary" },
      { icon: DollarSign, label: "Earnings", value: formatCurrency(totalEarnings), color: "text-accent" },
      { icon: Users, label: "Participants", value: totalParticipants.toLocaleString("en-IN"), color: "text-secondary" },
      { icon: Eye, label: "Views", value: totalViews.toLocaleString("en-IN"), color: "text-neon-pink" },
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

  const recentTournaments = tournaments.slice(0, 4);

  const handleDelete = async (tournament: Tournament) => {
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
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
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
        <GlassCard neon>
          <div className="flex items-end gap-3 h-28">
            {earningsData.map((e, i) => (
              <motion.div
                key={e.month}
                initial={{ height: 0 }}
                animate={{ height: e.height }}
                transition={{ delay: i * 0.15, duration: 0.5, ease: "easeOut" }}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full rounded-t-md gradient-primary opacity-80" style={{ height: e.height }} />
                <p className="text-[9px] text-muted-foreground font-heading">{e.month}</p>
                <p className="text-[9px] text-accent font-heading font-bold">{e.amount}</p>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
        <h2 className="font-heading text-base font-bold flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          Recent Tournaments
        </h2>
        <div className="space-y-3">
          {recentTournaments.length === 0 && (
            <GlassCard className="text-center py-8">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No tournaments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first tournament to see stats here.</p>
            </GlassCard>
          )}

          {recentTournaments.map((tournament, i) => (
            <GlassCard key={tournament._id} neon delay={i * 0.06}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{tournament.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> 0
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {tournament.views}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-heading font-bold text-accent">{formatCurrency(Number(tournament.organizerEarnings || 0))}</p>
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
          {filteredTournaments.length === 0 && (
            <GlassCard className="text-center py-8">
              <Search className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No matching tournaments</p>
              <p className="text-xs text-muted-foreground mt-1">Try another search or status filter.</p>
            </GlassCard>
          )}

          {filteredTournaments.map((tournament, index) => (
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
                    {tournament.game} - {formatCurrency(Number(tournament.prizePool?.total || 0))} prize
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
                    <span>0/{tournament.maxPlayers} players</span>
                    <span>{formatCurrency(tournament.entryFee)} entry</span>
                    <span>{tournament.startAt || "No start date"}</span>
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  {tournament.status === "completed" && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => navigate(`/tournament/${tournament._id}/distribute-prizes`)}
                      className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition-colors"
                      title="Prize distribution"
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
                    onClick={() => handleDelete(tournament)}
                    disabled={deletingId === tournament._id}
                    className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    title="Delete tournament"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default CreatorDashboardScreen;
