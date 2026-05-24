import { useNavigate } from "react-router-dom";
import { Ban, Flag, Gavel, Shield, Trophy, Wallet } from "lucide-react";
import {
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/design-system";

const rules = [
  {
    icon: Shield,
    title: "Fair play",
    items: [
      "No cheats, scripts, macros, config abuse, spoofing, account sharing, or third-party tools.",
      "Players must use their own verified game account.",
      "Admin can request proof such as screenshots, video, or game ID.",
    ],
  },
  {
    icon: Trophy,
    title: "Tournament conduct",
    items: [
      "Join only if you can play at the scheduled time.",
      "Follow room instructions, slot number, team size, and game-specific rules.",
      "Late players may lose their slot depending on creator/admin decision.",
    ],
  },
  {
    icon: Wallet,
    title: "Payments and prizes",
    items: [
      "Entry fees are deducted from wallet at registration.",
      "Creators must distribute prizes after valid results are finalized.",
      "Prize disputes can delay payout until admin review is complete.",
    ],
  },
  {
    icon: Flag,
    title: "Reports and disputes",
    items: [
      "Submit reports only with honest details.",
      "False reports can lead to warnings or account restrictions.",
      "Admin decisions may use wallet records, result proof, room logs, and player evidence.",
    ],
  },
  {
    icon: Ban,
    title: "Penalties",
    items: [
      "Confirmed cheating can lead to disqualification, prize cancellation, wallet reversal, or account ban.",
      "Creator misconduct can lead to creator removal and payout review.",
      "Abuse, harassment, threats, or fake identity details are not allowed.",
    ],
  },
];

const RulesScreen = () => {
  const navigate = useNavigate();

  return (
    <PageShell contentClassName="max-w-4xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Rules"
        subtitle="Platform-wide tournament rules and fair play policy"
        icon={Gavel}
        onBack={() => navigate(-1)}
      />

      <Surface neon className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_16%_0%,hsl(var(--accent)/0.25),transparent_30%),linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card)))] p-4 sm:p-5">
          <StatusPill tone="accent">Fair competition</StatusPill>
          <h2 className="mt-3 font-heading text-lg font-black">Basic rule</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Play honestly, respect players and creators, keep proof for disputes,
            and follow each tournament's own rules.
          </p>
        </div>
      </Surface>

      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((section) => (
          <Surface key={section.title}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-secondary/25 bg-secondary/10 text-secondary">
                <section.icon className="h-4 w-4" />
              </span>
              <h2 className="font-heading text-sm font-bold">{section.title}</h2>
            </div>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Surface>
        ))}
      </div>
    </PageShell>
  );
};

export default RulesScreen;
