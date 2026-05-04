import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { distributeTournamentPrizes, getParticipants, getTournamentById, Tournament, TournamentRegistration } from "@/api/tournaments";
import { toast } from "@/components/ui/sonner";
import { formatCurrency, getErrorMessage, getErrorToast } from "@/lib/page-utils";

type PrizeRow = { registrationId: string; place: string; amount: string };

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2 text-xs font-heading focus:outline-none focus:border-primary transition-colors";

const getParticipantName = (registration: TournamentRegistration) => {
  if (registration.user?.username) return registration.user.username;
  const names = registration.team?.map((member) => member.username).filter(Boolean) ?? [];
  return names.length ? names.join(", ") : registration.slotNumber ? `Slot ${registration.slotNumber}` : "Participant";
};

const getGameAccountLine = (registration: TournamentRegistration) => {
  const account = registration.user?.gameAccount ?? registration.gameAccount ?? registration.team?.[0]?.gameAccount;
  if (!account?.inGameName && !account?.gameId) return "No linked game account";
  return `${account.inGameName || "Linked account"}${account.gameId ? ` - ID ${account.gameId}` : ""}${account.verified ? " - Verified" : ""}`;
};

const PrizeDistributionScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentRegistration[]>([]);
  const [rows, setRows] = useState<PrizeRow[]>([]);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("1");
  const [selectedAmount, setSelectedAmount] = useState("");
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
        const [tournamentRes, participantRes] = await Promise.all([getTournamentById(id), getParticipants(id)]);
        if (!active) return;
        const activeParticipants = participantRes.filter((participant) => participant.status === "paid" || participant.status === "confirmed");
        setTournament(tournamentRes);
        setParticipants(activeParticipants);
        setSelectedRegistrationId(activeParticipants[0]?._id ?? "");
        setRows([]);
      } catch (err) {
        setError(getErrorMessage(err, "Could not load prize distribution."));
        const errorToast = getErrorToast(err, { action: "Load prize distribution", fallback: "Could not load prize distribution." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [id]);

  const prizePool = Number(tournament?.prizePool?.total || 0);
  const transferTotal = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

  const updateRow = (registrationId: string, field: "place" | "amount", value: string) => {
    setRows((current) => current.map((row) => (row.registrationId === registrationId ? { ...row, [field]: value } : row)));
  };

  const selectedParticipant = participants.find((participant) => participant._id === selectedRegistrationId);

  const addSelectedPayout = () => {
    if (!selectedRegistrationId) {
      toast.error("Select participant", { description: "Choose a registered participant first." });
      return;
    }
    if (Number(selectedAmount || 0) <= 0) {
      toast.error("Prize amount required", { description: "Enter prize money greater than zero." });
      return;
    }

    const nextRow = { registrationId: selectedRegistrationId, place: selectedPlace || "1", amount: selectedAmount };
    setRows((current) => current.some((row) => row.registrationId === selectedRegistrationId)
      ? current.map((row) => (row.registrationId === selectedRegistrationId ? nextRow : row))
      : [...current, nextRow]);
    setSelectedAmount("");
  };

  const removePayout = (registrationId: string) => {
    setRows((current) => current.filter((row) => row.registrationId !== registrationId));
  };

  const handleTransfer = async () => {
    if (!id) return;
    const payouts = rows
      .map((row) => ({ registrationId: row.registrationId, place: Number(row.place), amount: Number(row.amount || 0) }))
      .filter((row) => row.amount > 0);

    if (payouts.length === 0) {
      toast.error("No prize rows", { description: "Add prize money for at least one participant." });
      return;
    }
    if (prizePool > 0 && transferTotal > prizePool) {
      toast.error("Prize total too high", { description: "Prize payouts cannot be more than the prize pool." });
      return;
    }

    try {
      setSubmitting(true);
      await distributeTournamentPrizes(id, payouts);
      toast.success("Prize money transferred", { description: `${payouts.length} payout${payouts.length === 1 ? "" : "s"} completed.` });
      navigate("/creator-dashboard");
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Distribute prizes", fallback: "Prize transfer failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold truncate">Prize Distribution</h1>
          <p className="text-[10px] text-muted-foreground font-heading truncate">{tournament?.title ?? "Tournament payouts"}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <GlassCard neon>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-accent" />
              <p className="text-[10px] text-muted-foreground font-heading">Prize Pool</p>
            </div>
            <p className="font-heading text-lg font-bold text-accent">{formatCurrency(prizePool)}</p>
          </GlassCard>
          <GlassCard neon>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <p className="text-[10px] text-muted-foreground font-heading">Transfer Total</p>
            </div>
            <p className="font-heading text-lg font-bold text-primary">{formatCurrency(transferTotal)}</p>
          </GlassCard>
        </div>

        {loading && <GlassCard className="text-center py-8 text-xs text-muted-foreground font-heading">Loading participants...</GlassCard>}

        {!loading && error && (
          <GlassCard className="text-center py-8">
            <p className="text-sm font-heading">Could not load payouts</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </GlassCard>
        )}

        {!loading && !error && participants.length === 0 && (
          <GlassCard className="text-center py-8">
            <Users className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No registered participants</p>
            <p className="text-xs text-muted-foreground mt-1">Players must join before prize money can be distributed.</p>
          </GlassCard>
        )}

        {!loading && !error && participants.length > 0 && (
          <GlassCard neon>
            <label className="text-xs text-muted-foreground font-heading mb-1.5 block">Select Player</label>
            <select value={selectedRegistrationId} onChange={(event) => setSelectedRegistrationId(event.target.value)} className={`${inputClass} mb-3`}>
              {participants.map((participant) => (
                <option key={participant._id} value={participant._id} className="bg-background">
                  {getParticipantName(participant)} - Slot {participant.slotNumber ?? "-"}
                </option>
              ))}
            </select>
            {selectedParticipant && (
              <div className="glass rounded-lg p-3 mb-3">
                <p className="text-sm font-heading font-bold truncate">Username: {getParticipantName(selectedParticipant)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{getGameAccountLine(selectedParticipant)}</p>
              </div>
            )}
            <div className="grid grid-cols-[92px_1fr] gap-2 mb-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Position</p>
                <input type="number" min="1" value={selectedPlace} onChange={(event) => setSelectedPlace(event.target.value)} className={inputClass} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Prize Money</p>
                <input type="number" min="0" value={selectedAmount} onChange={(event) => setSelectedAmount(event.target.value)} placeholder="0" className={inputClass} />
              </div>
            </div>
            <NeonButton full variant="purple" className="text-xs py-2" onClick={addSelectedPayout}>
              ADD PAYOUT
            </NeonButton>
          </GlassCard>
        )}

        {!loading && !error && rows.map((row) => {
          const participant = participants.find((item) => item._id === row.registrationId);
          if (!participant) return null;
          return (
            <GlassCard key={participant._id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-heading font-bold truncate">{getParticipantName(participant)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">Slot {participant.slotNumber ?? "-"} - {getGameAccountLine(participant)}</p>
                </div>
                <span className="text-[10px] font-heading px-2 py-1 rounded-full bg-accent/10 text-accent">{participant.status}</span>
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Position</p>
                  <input type="number" min="1" value={row.place} onChange={(event) => updateRow(participant._id, "place", event.target.value)} className={inputClass} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Prize Money</p>
                  <input type="number" min="0" value={row.amount} onChange={(event) => updateRow(participant._id, "amount", event.target.value)} placeholder="0" className={inputClass} />
                </div>
              </div>
            </GlassCard>
          );
        })}

        <NeonButton full variant="green" className="text-sm py-3 mt-2" onClick={handleTransfer} disabled={loading || submitting || rows.length === 0}>
          {submitting ? "TRANSFERRING..." : "TRANSFER PRIZES"}
        </NeonButton>
      </div>
    </div>
  );
};

export default PrizeDistributionScreen;
