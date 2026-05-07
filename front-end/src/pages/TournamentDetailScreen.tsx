import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Award, Calendar, Crosshair, Users, Trophy, DollarSign, Shield, CheckCircle, Star, MessageCircle, RefreshCcw, KeyRound, Hash, Lock } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getMyTournamentRegistrations, getTournamentById, Tournament } from "@/api/tournaments";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";

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
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadTournament = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [tournamentRes, registrations] = await Promise.all([
        getTournamentById(id),
        getMyTournamentRegistrations().catch(() => []),
      ]);
      setTournament(tournamentRes);
      setRegistered(registrations.some((registration) => getRegistrationTournamentId(registration) === id));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load tournament."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const creator = {
    id: tournament?.channel?._id ?? tournament?.organizer?._id ?? "",
    name: tournament?.channel?.name ?? tournament?.organizer?.username ?? "Creator",
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
  const hasRoomDetails = Boolean(tournament?.room_details?.roomJoinTime || tournament?.room_details?.roomId || tournament?.room_details?.roomPass);
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
                  { icon: Users, label: "Slots", value: `${registeredSlots}/${tournament.maxPlayers}` },
                  { icon: DollarSign, label: "Entry Fee", value: entryFee === 0 ? "FREE" : formatCurrency(entryFee) },
                  { icon: Trophy, label: "Position Prize", value: usesPositionPrize ? formatCurrency(prize) : "No position prize" },
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
                  {tournament.room_details?.roomId && (
                    <div className="glass rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Room ID
                      </p>
                      <p className="font-heading font-bold truncate">{tournament.room_details.roomId}</p>
                    </div>
                  )}
                  {tournament.room_details?.roomPass && (
                    <div className="glass rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Room Pass
                      </p>
                      <p className="font-heading font-bold truncate">{tournament.room_details.roomPass}</p>
                    </div>
                  )}
                </div>
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
