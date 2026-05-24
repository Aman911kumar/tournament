import { useNavigate } from "react-router-dom";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import { PageShell, StatusPill, Surface } from "@/components/design-system";

const ForgotPasswordExpiredScreen = () => {
  const navigate = useNavigate();

  return (
    <PageShell bottomNavPadding={false} contentClassName="flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 py-8">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="arena-icon-button"
          aria-label="Back to login"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div>
          <StatusPill tone="danger">Secure reset</StatusPill>
          <h1 className="mt-3 font-display text-3xl font-black tracking-wide neon-text-purple">Link Expired</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            That reset link is no longer valid. For your security, password reset links can only be used for a limited time and may be invalidated when you request a new code.
          </p>
        </div>

        <Surface neon className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
              <TriangleAlert className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold">Start a new reset</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Go back to the reset screen and request a fresh code.
              </p>
            </div>
          </div>

          <NeonButton full onClick={() => navigate("/forgot-password", { replace: true })}>
            Restart reset flow
          </NeonButton>
        </Surface>
    </PageShell>
  );
};

export default ForgotPasswordExpiredScreen;
