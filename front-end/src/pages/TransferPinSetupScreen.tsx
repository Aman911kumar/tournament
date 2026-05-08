import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Lock, ShieldCheck } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { getTransferPinStatus, setupTransferPin } from "@/api/wallet";
import { getErrorToast } from "@/lib/page-utils";

const inputClass =
  "w-full rounded-lg border border-glass-border bg-background/50 px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary disabled:opacity-60";

const TransferPinSetupScreen = () => {
  const navigate = useNavigate();
  const [accountPassword, setAccountPassword] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hasTransferPin, setHasTransferPin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTransferPinStatus()
      .then((res) => setHasTransferPin(Boolean(res.data.hasTransferPin)))
      .catch(() => setHasTransferPin(false));
  }, []);

  const handleSave = async () => {
    if (!accountPassword.trim()) {
      toast.error("Account password required", { description: "Enter your login password to secure this change." });
      return;
    }

    if (!/^\d{6}$/.test(transferPin)) {
      toast.error("Invalid transfer PIN", { description: "Use exactly 6 digits." });
      return;
    }

    if (transferPin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    try {
      setLoading(true);
      const res = await setupTransferPin({ accountPassword, transferPin });
      toast.success(res.message || "Transfer PIN saved");
      navigate("/wallet/transfer");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Save transfer PIN", fallback: "Could not save transfer PIN." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-4 pt-6 sm:px-5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full border border-glass-border bg-background/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <div>
          <h1 className="font-heading text-xl font-bold">{hasTransferPin ? "Change Transfer PIN" : "Set Transfer PIN"}</h1>
          <p className="text-xs text-muted-foreground font-heading">Required before sending wallet balance</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 sm:px-5">
        <GlassCard neon className="space-y-4">
          <div className="rounded-xl border border-accent/25 bg-accent/10 p-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="font-heading text-sm font-bold">6 digit wallet safety PIN</p>
                <p className="mt-1 text-xs text-muted-foreground">Your account password is required to create or change this PIN.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Account Password
            </label>
            <input
              type="password"
              value={accountPassword}
              onChange={(event) => setAccountPassword(event.target.value)}
              placeholder="Enter login password"
              disabled={loading}
              className={inputClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Transfer PIN
              </label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={transferPin}
                onChange={(event) => setTransferPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digits"
                disabled={loading}
                className={`${inputClass} text-center font-display text-xl tracking-[0.35em]`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-heading text-muted-foreground">Confirm PIN</label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digits"
                disabled={loading}
                className={`${inputClass} text-center font-display text-xl tracking-[0.35em]`}
              />
            </div>
          </div>

          <NeonButton full variant="green" className="py-3" disabled={loading} onClick={handleSave}>
            {loading ? "SAVING..." : hasTransferPin ? "UPDATE TRANSFER PIN" : "SET TRANSFER PIN"}
          </NeonButton>
        </GlassCard>
      </div>
    </div>
  );
};

export default TransferPinSetupScreen;
