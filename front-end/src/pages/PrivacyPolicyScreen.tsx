import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Eye, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import GlassCard from "@/components/GlassCard";

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
    <div className="arena-shell min-h-screen pb-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full glass flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-heading text-xl font-bold">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated May 7, 2026</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-5 space-y-4">
        <GlassCard neon>
          <h2 className="font-heading text-base font-bold">Privacy commitment</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            This platform uses only the information needed to operate tournaments, wallets, creator tools, support, reports, and account safety features.
            Sensitive fields are redacted from admin database views where possible.
          </p>
        </GlassCard>

        {policy.map((section) => (
          <GlassCard key={section.title}>
            <div className="mb-2 flex items-center gap-2">
              <section.icon className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-sm font-bold">{section.title}</h2>
            </div>
            <p className="text-xs text-muted-foreground">{section.body}</p>
          </GlassCard>
        ))}

        <GlassCard>
          <h2 className="font-heading text-sm font-bold">Important notes</h2>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>- Do not share OTPs, passwords, room credentials, or wallet details with other users.</li>
            <li>- Admins may review reports and wallet records to resolve disputes.</li>
            <li>- Room ID and password are restricted to joined users, organizers, and admins.</li>
            <li>- Legal requirements may require retaining payment, fraud, or dispute records.</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
};

export default PrivacyPolicyScreen;
