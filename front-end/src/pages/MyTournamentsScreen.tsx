import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Search, Trophy, Users } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getMyTournamentRegistrations, Tournament, TournamentRegistration } from "@/api/tournaments";
import { toast } from "@/components/ui/sonner";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getErrorToast } from "@/lib/page-utils";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const statusClass: Record<string, string> = {
  paid: "bg-accent/10 text-accent",
  confirmed: "bg-secondary/10 text-secondary",
  pending: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

const asTournament = (registration: TournamentRegistration) =>
  typeof registration.tournament === "string" ? null : registration.tournament;

const MyTournamentsScreen = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyTournamentRegistrations();
        if (active) setRegistrations(data);
      } catch (err) {
        setError(getErrorMessage(err, "Could not load your tournaments."));
        const errorToast = getErrorToast(err, { action: "Load my tournaments", fallback: "Could not load your tournaments." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return registrations.filter((registration) => {
      const tournament = asTournament(registration);
      if (!tournament) return false;
      return !search || tournament.title.toLowerCase().includes(search) || tournament.game.toLowerCase().includes(search);
    });
  }, [query, registrations]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h1 className="font-heading text-xl font-bold">My Tournaments</h1>
          <p className="text-[10px] text-muted-foreground font-heading">Registered and joined tournaments</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        <div className="glass rounded-lg flex items-center gap-2 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search joined tournaments..."
            className="min-w-0 flex-1 bg-transparent text-xs font-heading focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {loading && <GlassCard className="text-center py-8 text-xs text-muted-foreground font-heading">Loading your tournaments...</GlassCard>}

        {!loading && error && (
          <GlassCard className="text-center py-8">
            <p className="text-sm font-heading">Could not load tournaments</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </GlassCard>
        )}

        {!loading && !error && filtered.length === 0 && (
          <GlassCard className="text-center py-8">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No joined tournaments</p>
            <p className="text-xs text-muted-foreground mt-1">Register for a tournament and it will appear here.</p>
            <NeonButton variant="purple" className="mt-4 text-xs py-2" onClick={() => navigate("/tournaments")}>
              Browse Tournaments
            </NeonButton>
          </GlassCard>
        )}

        {!loading && !error && filtered.map((registration) => {
          const tournament = asTournament(registration) as Tournament;
          return (
            <GlassCard key={registration._id} neon className="cursor-pointer" onClick={() => navigate(`/tournament/${tournament._id}`)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-heading font-bold truncate">{tournament.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {gameLabels[tournament.game] ?? tournament.game} - Slot {registration.slotNumber ?? "-"}
                  </p>
                </div>
                <span className={`text-[10px] font-heading font-semibold px-2 py-1 rounded-full ${statusClass[registration.status] ?? "bg-muted text-muted-foreground"}`}>
                  {registration.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="glass rounded-lg p-2 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground">Starts</p>
                  <p className="text-[10px] font-heading font-bold truncate">{new Date(tournament.startAt).toLocaleDateString()}</p>
                </div>
                <div className="glass rounded-lg p-2 min-w-0">
                  <Users className="w-3.5 h-3.5 text-secondary mb-1" />
                  <p className="text-[10px] text-muted-foreground">Slots</p>
                  <p className="text-[10px] font-heading font-bold">{tournament.maxPlayers}</p>
                </div>
                <div className="glass rounded-lg p-2 min-w-0">
                  <Trophy className="w-3.5 h-3.5 text-accent mb-1" />
                  <p className="text-[10px] text-muted-foreground">Prize</p>
                  <p className="text-[10px] font-heading font-bold truncate">{formatPrizeSummary(tournament)}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

    </div>
  );
};

export default MyTournamentsScreen;
