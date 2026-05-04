import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AtSign, BadgeIndianRupee, FileText, Send } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { transferMoney } from "@/api/wallet";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors";

const TransferMoneyScreen = () => {
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountValue = Number(amount || 0);
  const fee = useMemo(() => Math.round(amountValue * 2) / 100, [amountValue]);
  const receiverGets = Math.max(amountValue - fee, 0);
  const canSubmit = recipient.trim() !== "" && amountValue > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Missing details", { description: "Enter a recipient and amount greater than 0." });
      return;
    }

    try {
      setSubmitting(true);
      await transferMoney({
        recipient: recipient.trim(),
        amount: amountValue,
        note: note.trim() || undefined,
      });
      toast.success("Money transferred", {
        description: `${formatCurrency(receiverGets)} sent after ${formatCurrency(fee)} platform fee.`,
      });
      navigate("/wallet");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Transfer money", fallback: "Transfer failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h1 className="font-heading text-xl font-bold">Transfer Money</h1>
          <p className="text-xs text-muted-foreground font-heading">Send balance to any user or creator</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <AtSign className="w-3.5 h-3.5" /> Recipient
          </label>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Username, phone, email, or user ID"
            className={inputClass}
          />
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <BadgeIndianRupee className="w-3.5 h-3.5" /> Amount
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100"
            className={inputClass}
          />
        </GlassCard>

        <GlassCard>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="glass rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-muted-foreground font-heading">Amount</p>
              <p className="text-sm font-heading font-bold truncate">{formatCurrency(amountValue || 0)}</p>
            </div>
            <div className="glass rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-muted-foreground font-heading">Fee 2%</p>
              <p className="text-sm font-heading font-bold text-destructive truncate">{formatCurrency(fee || 0)}</p>
            </div>
            <div className="glass rounded-lg p-3 min-w-0 neon-border">
              <p className="text-[10px] text-muted-foreground font-heading">Receiver Gets</p>
              <p className="text-sm font-heading font-bold text-accent truncate">{formatCurrency(receiverGets || 0)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard neon>
          <label className="text-xs text-muted-foreground font-heading mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Note
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional"
            rows={3}
            className={`${inputClass} resize-none font-body`}
          />
        </GlassCard>

        <NeonButton full variant="green" className="text-sm py-3 mt-2" onClick={handleSubmit} disabled={!canSubmit}>
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "SENDING..." : "SEND MONEY"}
        </NeonButton>
      </div>
    </div>
  );
};

export default TransferMoneyScreen;
