import { useNavigate } from "react-router-dom";
import {
  Database,
  Eye,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/design-system";

const policy = [
  {
    icon: Database,
    title: "Information we collect",
    body: "Account details, login details, game account IDs, tournament registrations, wallet transactions, payment status, reports, support tickets, ratings, and device/network metadata needed for security.",
  },
  {
    icon: Eye,
    title: "How we use information",
    body: "We use data to run tournaments, verify joins, process wallet activity, show room details to eligible users, detect abuse, review reports, improve rankings, and provide support.",
  },
  {
    icon: LockKeyhole,
    title: "Payment privacy",
    body: "Payment method collection is handled by Razorpay checkout. The frontend must never store Razorpay key secrets. We store payment order/status data needed for wallet reconciliation.",
  },
  {
    icon: ShieldCheck,
    title: "Safety and fair play",
    body: "Reports, evidence, game IDs, and transaction records may be reviewed by admins to investigate cheating, fake results, payout disputes, or platform abuse.",
  },
  {
    icon: UserCheck,
    title: "User choices",
    body: "Users can edit profile details, manage game accounts, request creator access, open support tickets, and contact admin through reports for disputes or corrections.",
  },
];

const PrivacyPolicyScreen = () => {
  const navigate = useNavigate();

  return (
    <PageShell contentClassName="max-w-4xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title="Privacy Policy"
        subtitle="Last updated May 7, 2026"
        icon={ShieldCheck}
        onBack={() => navigate(-1)}
      />

      <Surface neon className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_16%_0%,hsl(var(--secondary)/0.24),transparent_30%),linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card)))] p-4 sm:p-5">
          <StatusPill tone="secondary">Privacy commitment</StatusPill>
          <h2 className="mt-3 font-heading text-lg font-black">
            Your tournament data stays purposeful
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This platform uses only the information needed to operate
            tournaments, wallets, creator tools, support, reports, and account
            safety features. Sensitive fields are redacted from admin database
            views where possible.
          </p>
        </div>
      </Surface>

      <div className="grid gap-3 md:grid-cols-2">
        {policy.map((section) => (
          <Surface key={section.title}>
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <section.icon className="h-4 w-4" />
              </span>
              <h2 className="font-heading text-sm font-bold">{section.title}</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </Surface>
        ))}
      </div>

      <Surface>
        <h2 className="font-heading text-sm font-bold">Important notes</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>- Do not share OTPs, passwords, room credentials, or wallet details with other users.</li>
          <li>- Admins may review reports and wallet records to resolve disputes.</li>
          <li>- Room ID and password are restricted to joined users, organizers, and admins.</li>
          <li>- Legal requirements may require retaining payment, fraud, or dispute records.</li>
        </ul>
      </Surface>
    </PageShell>
  );
};

export default PrivacyPolicyScreen;
