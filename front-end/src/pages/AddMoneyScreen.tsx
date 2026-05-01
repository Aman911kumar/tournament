import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, CreditCard, Plus, Smartphone, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { addMoney, getBalance } from "@/api/wallet";
import { CACHE_KEYS, readCache, writeAuthenticatedCache } from "@/lib/offline-cache";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";

const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

const paymentMethods = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "bank", label: "Net Banking", icon: Building2 },
] as const;

const AddMoneyScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof paymentMethods)[number]["id"]>("upi");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedWallet = readCache<{ balance: number; creatorEarnings: number; monthlyChange: number }>(
      CACHE_KEYS.walletSummary,
    );
    setBalance(cachedWallet?.data.balance ?? null);
  }, []);

  const handleAdd = async () => {
    const value = Number(amount);

    if (!value || value < 10) {
      toast.error("Invalid amount", { description: "Minimum amount is Rs. 10" });
      return;
    }

    if (value > 100000) {
      toast.error("Amount too high", { description: "Maximum amount is Rs. 1,00,000" });
      return;
    }

    try {
      setLoading(true);
      const res = await addMoney({ amount: value, method });
      const balanceRes = await getBalance();
      const cachedWallet = readCache<{ balance: number; creatorEarnings: number; monthlyChange: number }>(
        CACHE_KEYS.walletSummary,
      );
      const confirmedBalance = balanceRes.balance;
      if (cachedWallet && typeof confirmedBalance === "number") {
        writeAuthenticatedCache(CACHE_KEYS.walletSummary, {
          ...cachedWallet.data,
          balance: confirmedBalance,
        }, res);
      }
      setBalance(confirmedBalance);
      toast.info("Payment verification pending", {
        description: `${formatCurrency(value)} requested via ${method.toUpperCase()}. Wallet balance will update only after backend payment verification.`,
      });
      setTimeout(() => navigate("/wallet"), 800);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Add money", fallback: "Failed to add money." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-accent" />
          <h1 className="font-heading text-xl font-bold">Add Money</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        <GlassCard neon>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-heading">Current Balance</span>
          </div>
          <p className="font-display text-2xl font-bold neon-text-purple">
            {balance === null ? "Balance unavailable" : formatCurrency(balance)}
          </p>
          {balance === null && (
            <p className="mt-1 text-[10px] text-muted-foreground">Open Wallet once online to save your balance.</p>
          )}
        </GlassCard>

        <GlassCard>
          <label className="text-xs text-muted-foreground font-heading mb-2 block">Enter Amount</label>
          <div className="flex items-center gap-2 border-b border-glass-border pb-2">
            <span className="font-display text-2xl font-bold text-foreground">Rs.</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              disabled={loading}
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold outline-none placeholder:text-muted-foreground/40 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {quickAmounts.map((amt) => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAmount(String(amt))}
                disabled={loading}
                className="glass rounded-lg py-2 text-xs font-heading font-semibold hover:neon-border transition-all disabled:opacity-60"
              >
                {formatCurrency(amt)}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-xs text-muted-foreground font-heading mb-3">Payment Method</p>
          <div className="space-y-2">
            {paymentMethods.map((m) => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMethod(m.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all disabled:opacity-60 ${
                  method === m.id ? "neon-border bg-primary/10" : "glass"
                }`}
              >
                <m.icon className={`w-4 h-4 ${method === m.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-heading font-semibold">{m.label}</span>
                {method === m.id && <span className="ml-auto w-2 h-2 rounded-full bg-primary neon-glow-purple" />}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        <NeonButton variant="green" full onClick={handleAdd} disabled={loading}>
          {loading ? "Adding..." : `Add ${amount ? formatCurrency(Number(amount)) : "Rs. 0"}`}
        </NeonButton>
      </div>
    </div>
  );
};

export default AddMoneyScreen;
