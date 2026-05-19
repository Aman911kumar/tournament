import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";

const ForgotPasswordExpiredScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="arena-shell min-h-screen px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => navigate("/login")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Back to login"
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>

        <div>
          <h1 className="font-display text-3xl font-bold tracking-wider neon-text-purple">Link Expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            That reset link is no longer valid. For your security, password reset links can only be used for a limited time and may be invalidated when you request a new code.
          </p>
        </div>

        <GlassCard neon className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10">
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
            RESTART RESET FLOW
          </NeonButton>
        </GlassCard>
      </div>
    </div>
  );
};

export default ForgotPasswordExpiredScreen;

