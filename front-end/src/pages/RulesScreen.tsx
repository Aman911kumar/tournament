import { useNavigate } from "react-router-dom";
import { ArrowLeft, Ban, Flag, Gavel, Shield, Trophy, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";

const rules = [
  {
    icon: Shield,
    title: "Fair play",
    items: ["No cheats, scripts, macros, config abuse, spoofing, account sharing, or third-party tools.", "Players must use their own verified game account.", "Admin can request proof such as screenshots, video, or game ID."],
  },
  {
    icon: Trophy,
    title: "Tournament conduct",
    items: ["Join only if you can play at the scheduled time.", "Follow room instructions, slot number, team size, and game-specific rules.", "Late players may lose their slot depending on creator/admin decision."],
  },
  {
    icon: Wallet,
    title: "Payments and prizes",
    items: ["Entry fees are deducted from wallet at registration.", "Creators must distribute prizes after valid results are finalized.", "Prize disputes can delay payout until admin review is complete."],
  },
  {
    icon: Flag,
    title: "Reports and disputes",
    items: ["Submit reports only with honest details.", "False reports can lead to warnings or account restrictions.", "Admin decisions may use wallet records, result proof, room logs, and player evidence."],
  },
  {
    icon: Ban,
    title: "Penalties",
    items: ["Confirmed cheating can lead to disqualification, prize cancellation, wallet reversal, or account ban.", "Creator misconduct can lead to creator removal and payout review.", "Abuse, harassment, threats, or fake identity details are not allowed."],
  },
];

const RulesScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full glass flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-heading text-xl font-bold">Rules</h1>
          <p className="text-xs text-muted-foreground">Platform-wide tournament rules and fair play policy</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        <GlassCard neon>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Gavel className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold">Basic rule</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Play honestly, respect players and creators, keep proof for disputes, and follow each tournament's own rules.
              </p>
            </div>
          </div>
        </GlassCard>

        {rules.map((section) => (
          <GlassCard key={section.title}>
            <div className="mb-3 flex items-center gap-2">
              <section.icon className="h-4 w-4 text-secondary" />
              <h2 className="font-heading text-sm font-bold">{section.title}</h2>
            </div>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default RulesScreen;
