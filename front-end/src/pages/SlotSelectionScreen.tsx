import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, CheckCircle, Lock, User as UserIcon } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getParticipants, joinTournament } from "@/api/tournaments";
import { listGameAccounts } from "@/api/gameAccounts";
import { getBalance } from "@/api/wallet";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type TournamentType = "solo" | "duo" | "squad" | "team";

const TEAM_SIZE: Record<TournamentType, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
  team: 5,
};

const hasRealPhoneNumber = (value?: string) => {
  const phoneNumber = String(value || "").trim();
  return Boolean(phoneNumber) && !/^(google|facebook):/i.test(phoneNumber);
};

interface SlotInfo {
  index: number;
  taken: boolean;
  player?: string;
  gameName?: string;
  gameId?: string;
  verified?: boolean;
}

const SlotSelectionScreen = () => {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const { id } = useParams();
  const [params] = useSearchParams();

  const type = (params.get("type") as TournamentType) || "squad";
  const totalSlots = Number(params.get("slots") || 16);
  const teamSizeParam = Number(params.get("teamSize") || 0);
  const teamSize = teamSizeParam > 0 ? teamSizeParam : TEAM_SIZE[type];
  const entryFee = Number(params.get("fee") || 0);
  const game = params.get("game") || "";
  const title = params.get("title") || "Tournament";

  const [takenSlots, setTakenSlots] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [optimisticSlotIndex, setOptimisticSlotIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadParticipants = async () => {
      if (!id) return;
      try {
        setLoadingSlots(true);
        const registrations = await getParticipants(id);
        if (!active) return;
        setTakenSlots(
          registrations
            .filter((registration) => registration.slotNumber)
            .map((registration) => ({
              index: Number(registration.slotNumber) - 1,
              taken: true,
              player: registration.user?.username ?? registration.team?.[0]?.username ?? "Player",
              gameName: registration.user?.gameAccount?.inGameName ?? registration.gameAccount?.inGameName ?? registration.team?.[0]?.gameAccount?.inGameName,
              gameId: registration.user?.gameAccount?.gameId ?? registration.gameAccount?.gameId ?? registration.team?.[0]?.gameAccount?.gameId,
              verified: Boolean(registration.user?.gameAccount?.verified ?? registration.gameAccount?.verified ?? registration.team?.[0]?.gameAccount?.verified),
            })),
        );
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Load slots", fallback: "Could not load slots." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoadingSlots(false);
      }
    };

    loadParticipants();

    return () => {
      active = false;
    };
  }, [id]);

  const slots: SlotInfo[] = useMemo(() => {
    const taken = new Map(takenSlots.map((slot) => [slot.index, slot.player]));
    return Array.from({ length: totalSlots }, (_, i) => ({
      index: i,
      taken: taken.has(i) || optimisticSlotIndex === i,
      player: optimisticSlotIndex === i ? "You" : taken.get(i),
      gameName: takenSlots.find((slot) => slot.index === i)?.gameName,
      gameId: takenSlots.find((slot) => slot.index === i)?.gameId,
      verified: optimisticSlotIndex === i || takenSlots.find((slot) => slot.index === i)?.verified,
    }));
  }, [optimisticSlotIndex, takenSlots, totalSlots]);

  const teams = useMemo(() => {
    const groups: SlotInfo[][] = [];
    for (let i = 0; i < slots.length; i += teamSize) {
      groups.push(slots.slice(i, i + teamSize));
    }
    return groups;
  }, [slots, teamSize]);

  const toggleSlot = (slot: SlotInfo) => {
    if (slot.taken) return;
    setSelected((prev) => (prev.includes(slot.index) ? [] : [slot.index]));
  };

  const canConfirm = selected.length === 1 && !confirming;
  const requiredGame = game === "callofduty" ? "cod" : game;

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      if (!profile) {
        toast.error("Profile still loading", {
          description: "Wait a moment and try joining again.",
        });
        return;
      }
      if (!profile?.emailVerified || !profile?.phoneVerified) {
        toast.error("Verification required", {
          description: "Verify both email and phone before joining tournaments.",
        });
        navigate("/edit-profile");
        return;
      }

      if (!hasRealPhoneNumber(profile.phone_number)) {
        toast.error("Phone number required", {
          description: "Add your phone number before joining any tournament.",
        });
        navigate("/edit-profile");
        return;
      }

      if (requiredGame) {
        const accountsRes = await listGameAccounts();
        const hasRequiredAccount = (accountsRes.data ?? []).some((account) => account.game === requiredGame);
        if (!hasRequiredAccount) {
          toast.error("Game account required", { description: `Link your ${linkedAccountLabel} account before joining this tournament.` });
          navigate("/game-accounts");
          return;
        }
      }

      if (entryFee > 0) {
        const balance = await getBalance();
        if (balance.balance < entryFee) {
          toast.error("Low wallet balance", { description: `Add at least Rs. ${entryFee - balance.balance} to book this slot.` });
          navigate("/wallet/add");
          return;
        }
      }

      const slotNumber = selected[0] + 1;
      setOptimisticSlotIndex(selected[0]);
      toast.info("Reserving slot", { description: `Slot ${slotNumber} is being confirmed.` });

      if (id) await joinTournament(id, { slotNumber });
      toast.success("Slot booked!", { description: `Slot: ${slotNumber}` });
      navigate(`/tournament/${id}/chat`);
    } catch (err) {
      setOptimisticSlotIndex(null);
      const errorToast = getErrorToast(err, { action: "Book slot", fallback: "Slot booking failed." });
      toast.error(errorToast.title, { description: errorToast.description });
      const message = getErrorMessage(err, "").toLowerCase();
      if (message.includes("insufficient wallet") || message.includes("low wallet")) navigate("/wallet/add");
      if (message.includes("game account") || message.includes("not linked")) navigate("/game-accounts");
    } finally {
      setConfirming(false);
    }
  };

  const teamLabel = teamSize === 1 ? "Solo" : teamSize === 2 ? "Duo" : teamSize === 4 ? "Squad" : `${teamSize}-Member Team`;
  const linkedAccountLabel = game === "freefire" ? "Free Fire" : game ? game : "Game";

  return (
    <div className="arena-shell min-h-screen pb-32">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-full flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-lg font-bold">Select Your Slot</h1>
          <p className="text-[10px] text-muted-foreground truncate">{title}</p>
        </div>
      </div>

      <div className="px-5 mb-4">
        <GlassCard neon>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground">Format</p>
                <p className="text-sm font-heading font-bold">{teamLabel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Pick 1 slot</p>
              <p className="text-sm font-heading font-bold text-primary">
                {loadingSlots ? "Loading..." : `${selected.length}/1 selected`}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="px-5 space-y-3">
        {teams.map((team, teamIdx) => {
          const teamTaken = team.every((slot) => slot.taken);
          return (
            <motion.div
              key={teamIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: teamIdx * 0.03 }}
            >
              <GlassCard>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading text-sm font-bold">Team {teamIdx + 1}</h3>
                  {teamTaken && (
                    <span className="text-[10px] font-heading text-destructive flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Full
                    </span>
                  )}
                </div>
                <div className={`grid gap-2 ${teamSize === 1 ? "grid-cols-1" : teamSize === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {team.map((slot) => {
                    const isSelected = selected.includes(slot.index);
                    return (
                      <motion.button
                        key={slot.index}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleSlot(slot)}
                        disabled={slot.taken || confirming}
                        className={`relative rounded-lg p-3 border transition-all text-left ${
                          slot.taken
                            ? "bg-muted/30 border-border/30 cursor-not-allowed opacity-60"
                            : isSelected
                              ? "border-primary bg-primary/10 neon-glow-purple"
                              : "border-border/50 glass hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isSelected ? "gradient-primary" : "bg-muted/50"}`}>
                            {slot.taken ? (
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            ) : isSelected ? (
                              <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                            ) : (
                              <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground">Slot {slot.index + 1}</p>
                            <p className="text-xs font-heading font-bold truncate">
                              {slot.taken ? slot.player : isSelected ? "You" : "Open"}
                            </p>
                            {slot.taken && (slot.gameName || slot.gameId) && (
                              <p className="mt-0.5 text-[9px] text-muted-foreground truncate">
                                {linkedAccountLabel}: {slot.gameName || "Linked"}{slot.gameId ? ` - ID ${slot.gameId}` : ""}{slot.verified ? " - Verified" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <div className="arena-fixed-actions">
        <div className="arena-fixed-actions-inner">
          <NeonButton full variant={canConfirm ? "green" : "purple"} onClick={() => canConfirm && handleConfirm()} disabled={!canConfirm}>
            {optimisticSlotIndex !== null
              ? "Confirming reserved slot..."
              : confirming
                ? "Booking..."
                : canConfirm
                  ? `Confirm Slot - ${entryFee === 0 ? "FREE" : `Rs. ${entryFee}`}`
                  : "Pick a slot to continue"}
          </NeonButton>
        </div>
      </div>

      <AnimatePresence />
    </div>
  );
};

export default SlotSelectionScreen;
