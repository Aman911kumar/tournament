import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Lock, Smartphone, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { getBalance, withdraw } from "@/api/wallet";
import { CACHE_KEYS, readCache, writeAuthenticatedCache } from "@/lib/offline-cache";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";

const withdrawMethods = [
  { id: "upi", label: "UPI Transfer", desc: "Instant, no fees", icon: Smartphone },
  { id: "bank", label: "Bank Account", desc: "1-2 business days", icon: Building2 },
] as const;

const WithdrawScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof withdrawMethods)[number]["id"]>("upi");
  const [destination, setDestination] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedWallet = readCache<{ balance: number; creatorEarnings: number; monthlyChange: number }>(
      CACHE_KEYS.walletSummary,
    );
    setBalance(cachedWallet?.data.balance ?? null);
  }, []);

  const quickAmounts = useMemo(
    () => [500, 1000, 2000, balance].filter((value): value is number => typeof value === "number" && value > 0),
    [balance],
  );

  const handleWithdraw = async () => {
    const value = Number(amount);

    if (!value || value < 100) {
      toast.error("Invalid amount", { description: "Minimum withdrawal is Rs. 100" });
      return;
    }

    if (!destination.trim()) {
      toast.error("Destination required", { description: method === "upi" ? "Enter your UPI ID." : "Enter bank account details." });
      return;
    }

    if (!password) {
      toast.error("Password required", { description: "Enter your account password to confirm." });
      return;
    }

    try {
      setLoading(true);
      const beforeWithdraw = await getBalance();
      setBalance(beforeWithdraw.balance);

      if (value > beforeWithdraw.balance) {
        toast.error("Insufficient verified balance", {
          description: `Backend verified balance is ${formatCurrency(beforeWithdraw.balance)}.`,
        });
        return;
      }

      const res = await withdraw({ amount: value, method, destination: destination.trim(), password });
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
      toast.success("Withdrawal requested!", { description: `${formatCurrency(value)} reserved by backend and will be sent via ${method.toUpperCase()}` });
      setTimeout(() => navigate("/wallet"), 800);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Withdraw", fallback: "Withdrawal failed." });
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
          <ArrowUpRight className="w-5 h-5 text-secondary" />
          <h1 className="font-heading text-xl font-bold">Withdraw</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        <GlassCard neon>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-heading">Available Balance</span>
          </div>
          <p className="font-display text-2xl font-bold neon-text-purple">
            {balance === null ? "Balance unavailable" : formatCurrency(balance)}
          </p>
          {balance === null && (
            <p className="mt-1 text-[10px] text-muted-foreground">Open Wallet once online to save your balance.</p>
          )}
        </GlassCard>

        <GlassCard>
          <label className="text-xs text-muted-foreground font-heading mb-2 block">Withdraw Amount</label>
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

          <div className="grid grid-cols-4 gap-2 mt-4">
            {quickAmounts.map((amt) => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAmount(String(amt))}
                disabled={loading}
                className="glass rounded-lg py-2 text-[10px] font-heading font-semibold hover:neon-border transition-all disabled:opacity-60"
              >
                {amt === balance ? "Max" : formatCurrency(amt)}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-xs text-muted-foreground font-heading mb-3">Withdraw To</p>
          <div className="space-y-2">
            {withdrawMethods.map((m) => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMethod(m.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all disabled:opacity-60 ${
                  method === m.id ? "neon-border bg-secondary/10" : "glass"
                }`}
              >
                <m.icon className={`w-4 h-4 ${method === m.id ? "text-secondary" : "text-muted-foreground"}`} />
                <div className="text-left flex-1">
                  <p className="text-xs font-heading font-semibold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                </div>
                {method === m.id && <span className="w-2 h-2 rounded-full bg-secondary neon-glow-blue" />}
              </motion.button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <label className="text-xs text-muted-foreground font-heading mb-2 block">
            {method === "upi" ? "UPI ID" : "Bank Details"}
          </label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={method === "upi" ? "name@upi" : "Account number / IFSC"}
            disabled={loading}
            className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          />
          <label className="text-xs text-muted-foreground font-heading mt-4 mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm with your password"
            disabled={loading}
            className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          />
        </GlassCard>

        <NeonButton variant="blue" full onClick={handleWithdraw} disabled={loading}>
          {loading ? "Requesting..." : `Withdraw ${amount ? formatCurrency(Number(amount)) : "Rs. 0"}`}
        </NeonButton>
      </div>
    </div>
  );
};

export default WithdrawScreen;
