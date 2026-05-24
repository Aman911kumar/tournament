import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  CreditCard,
  Flag,
  HelpCircle,
  Shield,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/design-system";

const sections = [
  {
    icon: Trophy,
    title: "Joining tournaments",
    body: "Choose a tournament, check entry fee, rules, prize type, registration window, and slots. After joining, room details become visible only when the creator shares them.",
  },
  {
    icon: Wallet,
    title: "Wallet and payments",
    body: "Add money through Razorpay, track payment activity, and see wallet credits/debits separately. Failed or cancelled payment attempts remain visible for clarity.",
  },
  {
    icon: UserPlus,
    title: "Becoming a creator",
    body: "Creator access requires admin approval. Once approved, a creator channel is created automatically and you can create tournaments from the creator dashboard.",
  },
  {
    icon: Flag,
    title: "Reports and disputes",
    body: "Use tournament reports for cheating, fake results, room issues, or missing payouts. Use creator reports for payout disputes or creator misconduct.",
  },
];

const faqs = [
  [
    "Why can I not see room ID?",
    "Room ID and password are hidden until you join the tournament or the creator/admin has permission to view them.",
  ],
  [
    "When should I report a player?",
    "Report only when you have a real reason such as cheating, abusive behavior, fake result, or suspicious gameplay. Add evidence whenever possible.",
  ],
  [
    "What if creator does not pay prize?",
    "Open a payout dispute from the tournament or creator profile. Admin can review results, wallet records, and evidence.",
  ],
  [
    "How are top creators calculated?",
    "The platform considers followers, ratings, active/completed tournaments, prize activity, and trust signals.",
  ],
];

const HelpCenterScreen = () => {
  const navigate = useNavigate();

  return (
    <PageShell contentClassName="max-w-4xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Help Center"
        subtitle="Payments, tournaments, reports, and creator help"
        icon={HelpCircle}
        onBack={() => navigate(-1)}
      />

      <Surface neon className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_12%_0%,hsl(var(--primary)/0.28),transparent_30%),linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card)))] p-4 sm:p-5">
          <StatusPill tone="primary">Support ready</StatusPill>
          <h2 className="mt-3 font-heading text-lg font-black">
            Need help fast?
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Keep screenshots, video links, transaction IDs, game ID, and
            tournament name ready before opening a report.
          </p>
        </div>
      </Surface>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Surface key={section.title} interactive>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <section.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-bold">
                  {section.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              </div>
            </div>
          </Surface>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <Surface className="space-y-2">
          <h2 className="font-heading text-base font-bold">Quick Actions</h2>
          {[
            { icon: CreditCard, label: "Wallet", route: "/wallet" },
            { icon: Trophy, label: "My Tournaments", route: "/my-tournaments" },
            { icon: Shield, label: "Legal & Policies", route: "/legal/terms" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.route)}
              className="arena-focus flex w-full items-center justify-between rounded-xl border border-glass-border bg-background/35 px-3 py-2.5 text-left transition-colors hover:border-secondary/40"
            >
              <span className="flex min-w-0 items-center gap-2 font-heading text-sm">
                <item.icon className="h-4 w-4 shrink-0 text-secondary" />
                <span className="truncate">{item.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </Surface>

        <Surface>
          <h2 className="mb-3 font-heading text-base font-bold">FAQ</h2>
          <div className="space-y-2">
            {faqs.map(([question, answer]) => (
              <div
                key={question}
                className="rounded-xl border border-glass-border bg-background/35 p-3"
              >
                <p className="font-heading text-xs font-bold">{question}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {answer}
                </p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </PageShell>
  );
};

export default HelpCenterScreen;
