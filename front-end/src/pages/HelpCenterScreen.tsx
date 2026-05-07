import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, CreditCard, Flag, HelpCircle, Shield, Trophy, UserPlus, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";

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
  ["Why can I not see room ID?", "Room ID and password are hidden until you join the tournament or the creator/admin has permission to view them."],
  ["When should I report a player?", "Report only when you have a real reason such as cheating, abusive behavior, fake result, or suspicious gameplay. Add evidence whenever possible."],
  ["What if creator does not pay prize?", "Open a payout dispute from the tournament or creator profile. Admin can review results, wallet records, and evidence."],
  ["How are top creators calculated?", "The platform considers followers, ratings, active/completed tournaments, prize activity, and trust signals."],
];

const HelpCenterScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full glass flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-heading text-xl font-bold">Help Center</h1>
          <p className="text-xs text-muted-foreground">Payments, tournaments, reports, and creator help</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        <GlassCard neon>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold">Need help fast?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep screenshots, video links, transaction IDs, game ID, and tournament name ready before opening a report.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <GlassCard key={section.title}>
              <section.icon className="mb-2 h-4 w-4 text-primary" />
              <h3 className="font-heading text-sm font-bold">{section.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{section.body}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard>
          <h2 className="font-heading text-base font-bold mb-3">Quick Actions</h2>
          {[
            { icon: CreditCard, label: "Wallet", route: "/wallet" },
            { icon: Trophy, label: "My Tournaments", route: "/my-tournaments" },
            { icon: Shield, label: "Rules and Regulations", route: "/rules" },
          ].map((item) => (
            <button key={item.label} onClick={() => navigate(item.route)} className="flex w-full items-center justify-between border-t border-glass-border py-3 text-left first:border-t-0">
              <span className="flex items-center gap-2 text-sm font-heading">
                <item.icon className="h-4 w-4 text-secondary" />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </GlassCard>

        <GlassCard>
          <h2 className="font-heading text-base font-bold mb-3">FAQ</h2>
          <div className="space-y-3">
            {faqs.map(([question, answer]) => (
              <div key={question} className="rounded-lg border border-glass-border bg-background/35 p-3">
                <p className="font-heading text-xs font-bold">{question}</p>
                <p className="mt-1 text-xs text-muted-foreground">{answer}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default HelpCenterScreen;
