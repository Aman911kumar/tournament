import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Calendar, Users, Trophy, DollarSign, Shield, CheckCircle, Star, MessageCircle, RefreshCcw } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getTournamentById, Tournament } from "@/api/tournaments";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const TournamentDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showConfirm, setShowConfirm] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTournament = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setTournament(await getTournamentById(id));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load tournament."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();
  }, [id]);

  const creator = {
    id: tournament?.channel?._id ?? tournament?.organizer?._id ?? "",
    name: tournament?.channel?.name ?? tournament?.organizer?.username ?? "Creator",
    verified: Boolean(tournament?.channel || tournament?.organizer),
    rating: tournament?.organizer?.stats?.rating ?? 4.5,
  };

  const rules = tournament?.rules
    ? tournament.rules.split("\n").filter(Boolean)
    : ["Match starts at scheduled time.", "Disputes are resolved by admin decision."];
  const prize = Number(tournament?.prizePool?.total || 0);
  const entryFee = Number(tournament?.entryFee || 0);

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
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
              <span className="font-display text-xs font-bold text-primary-foreground">{creator.name[0]}</span>
            </div>
            <div className="text-left flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-heading font-bold">{creator.name}</span>
                {creator.verified && (
                  <Shield className="w-3 h-3 text-secondary fill-secondary" />
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
              { icon: Users, label: "Slots", value: String(tournament.maxPlayers) },
              { icon: DollarSign, label: "Entry Fee", value: entryFee === 0 ? "FREE" : formatCurrency(entryFee) },
              { icon: Trophy, label: "Prize Pool", value: formatCurrency(prize) },
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

        {/* Participants */}
        <GlassCard delay={0.15}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" />
              Participants
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">Participant registration will appear here after teams join.</p>
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
          variant={registered ? "green" : "purple"}
          onClick={() => !registered && setShowConfirm(true)}
        >
          {registered ? "REGISTERED" : `REGISTER NOW - ${entryFee === 0 ? "FREE" : formatCurrency(entryFee)}`}
        </NeonButton>
        </>
        )}
      </div>

      {/* Confirmation Popup */}
      <AnimatePresence>
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
