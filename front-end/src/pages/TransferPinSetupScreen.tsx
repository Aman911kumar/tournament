import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Lock } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { getTransferPinStatus, setupTransferPin } from "@/api/wallet";
import { getErrorToast } from "@/lib/page-utils";
import {
  WalletSecurityNote,
  WalletShell,
} from "@/components/wallet/WalletShell";

const inputClass =
  "wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60";

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
      toast.error("Account password required", {
        description: "Enter your login password to secure this change.",
      });
      return;
    }

    if (!/^\d{6}$/.test(transferPin)) {
      toast.error("Invalid transfer PIN", {
        description: "Use exactly 6 digits.",
      });
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
      const errorToast = getErrorToast(error, {
        action: "Save transfer PIN",
        fallback: "Could not save transfer PIN.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletShell
      title={hasTransferPin ? "Change Transfer PIN" : "Set Transfer PIN"}
      subtitle="Required before sending wallet balance"
      icon={KeyRound}
      maxWidth="max-w-xl"
    >
      <section className="wallet-flow-hero space-y-4 rounded-2xl border border-glass-border p-3 sm:p-5">
        <WalletSecurityNote>
          Your 6 digit wallet PIN protects transfers and payout actions. Your
          account password is required to create or change it.
        </WalletSecurityNote>

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

        <div className="grid gap-3 min-[430px]:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Transfer PIN
            </label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={transferPin}
              onChange={(event) =>
                setTransferPin(
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              placeholder="6 digits"
              disabled={loading}
              className={`${inputClass} text-center font-display text-lg tracking-[0.28em] sm:text-xl sm:tracking-[0.35em]`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-heading text-muted-foreground">
              Confirm PIN
            </label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6 digits"
              disabled={loading}
              className={`${inputClass} text-center font-display text-lg tracking-[0.28em] sm:text-xl sm:tracking-[0.35em]`}
            />
          </div>
        </div>

        <NeonButton
          full
          variant="green"
          className="py-3"
          disabled={loading}
          onClick={handleSave}
        >
          {loading
            ? "SAVING..."
            : hasTransferPin
              ? "UPDATE TRANSFER PIN"
              : "SET TRANSFER PIN"}
        </NeonButton>
      </section>
    </WalletShell>
  );
};

export default TransferPinSetupScreen;
