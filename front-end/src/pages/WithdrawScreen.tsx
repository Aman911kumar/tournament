import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Lock, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import {
  deletePayoutMethod,
  getBalance,
  getPayoutMethods,
  PayoutMethod,
  savePayoutMethod,
  withdraw,
} from "@/api/wallet";
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
  const [selectedPayoutMethodId, setSelectedPayoutMethodId] = useState("");
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [showNewMethod, setShowNewMethod] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodForm, setMethodForm] = useState({
    label: "",
    upiId: "",
    accountHolderName: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
  });
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedWallet = readCache<{ balance: number; creatorEarnings: number; monthlyChange: number }>(
      CACHE_KEYS.walletSummary,
    );
    setBalance(cachedWallet?.data.balance ?? null);
  }, []);

  useEffect(() => {
    const loadPayoutMethods = async () => {
      try {
        const res = await getPayoutMethods();
        const methods = res.data ?? [];
        setPayoutMethods(methods);
        const preferred = methods.find((item) => item.isDefault) ?? methods[0];
        if (preferred) {
          setSelectedPayoutMethodId(preferred._id);
          setMethod(preferred.type);
          setDestination(preferred.display || "");
        } else {
          setShowNewMethod(true);
        }
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Load payout methods", fallback: "Could not load saved payout details." });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    };

    loadPayoutMethods();
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

    if (!selectedPayoutMethodId && !destination.trim()) {
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

      const res = await withdraw({
        amount: value,
        password,
        ...(selectedPayoutMethodId ? { payoutMethodId: selectedPayoutMethodId } : { method, destination: destination.trim() }),
      });
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

  const handleSavePayoutMethod = async () => {
    try {
      setSavingMethod(true);
      const res = await savePayoutMethod({
        type: method,
        label: methodForm.label.trim(),
        isDefault: payoutMethods.length === 0,
        ...(method === "upi"
          ? { upiId: methodForm.upiId.trim() }
          : {
              accountHolderName: methodForm.accountHolderName.trim(),
              accountNumber: methodForm.accountNumber.trim(),
              ifsc: methodForm.ifsc.trim(),
              bankName: methodForm.bankName.trim(),
            }),
      });
      const methodsRes = await getPayoutMethods();
      setPayoutMethods(methodsRes.data ?? []);
      setSelectedPayoutMethodId(res.data._id);
      setDestination(res.data.display || "");
      setShowNewMethod(false);
      setMethodForm({ label: "", upiId: "", accountHolderName: "", accountNumber: "", ifsc: "", bankName: "" });
      toast.success(res.message || "Payout method saved");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Save payout method", fallback: "Could not save payout details." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeletePayoutMethod = async (id: string) => {
    try {
      const res = await deletePayoutMethod(id);
      const methodsRes = await getPayoutMethods();
      const methods = methodsRes.data ?? [];
      setPayoutMethods(methods);
      const preferred = methods.find((item) => item.isDefault) ?? methods[0];
      setSelectedPayoutMethodId(preferred?._id || "");
      setDestination(preferred?.display || "");
      if (!preferred) setShowNewMethod(true);
      toast.success(res.message || "Payout method removed");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Remove payout method", fallback: "Could not remove payout details." });
      toast.error(errorToast.title, { description: errorToast.description });
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
                onClick={() => {
                  setMethod(m.id);
                  setSelectedPayoutMethodId("");
                  setDestination("");
                  setShowNewMethod(true);
                }}
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground font-heading">Saved Payout Details</p>
            <button
              type="button"
              onClick={() => {
                setShowNewMethod((value) => !value);
                setSelectedPayoutMethodId("");
                setDestination("");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-glass-border px-2 py-1 text-[10px] font-heading text-primary"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          {payoutMethods.length > 0 && (
            <div className="mb-4 space-y-2">
              {payoutMethods.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    setSelectedPayoutMethodId(item._id);
                    setMethod(item.type);
                    setDestination(item.display || "");
                    setShowNewMethod(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedPayoutMethodId === item._id ? "border-accent/40 bg-accent/10" : "border-glass-border bg-background/30"
                  }`}
                >
                  {item.type === "upi" ? <Smartphone className="h-4 w-4 text-accent" /> : <Building2 className="h-4 w-4 text-accent" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-heading font-semibold">{item.label || (item.type === "upi" ? "UPI" : "Bank account")}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{item.display}</span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeletePayoutMethod(item._id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeletePayoutMethod(item._id);
                      }
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {showNewMethod && (
            <div className="mb-4 space-y-3 rounded-lg border border-glass-border bg-background/30 p-3">
              <input
                value={methodForm.label}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Label, e.g. My UPI"
                disabled={loading || savingMethod}
                className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
              />
              {method === "upi" ? (
                <input
                  value={methodForm.upiId}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, upiId: e.target.value }))}
                  placeholder="name@upi"
                  disabled={loading || savingMethod}
                  className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                />
              ) : (
                <>
                  <input
                    value={methodForm.accountHolderName}
                    onChange={(e) => setMethodForm((prev) => ({ ...prev, accountHolderName: e.target.value }))}
                    placeholder="Account holder name"
                    disabled={loading || savingMethod}
                    className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                  />
                  <input
                    value={methodForm.accountNumber}
                    onChange={(e) => setMethodForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Account number"
                    disabled={loading || savingMethod}
                    className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={methodForm.ifsc}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                      placeholder="IFSC"
                      disabled={loading || savingMethod}
                      className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                    />
                    <input
                      value={methodForm.bankName}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, bankName: e.target.value }))}
                      placeholder="Bank name"
                      disabled={loading || savingMethod}
                      className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                    />
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={handleSavePayoutMethod}
                disabled={savingMethod || loading}
                className="w-full rounded-lg border border-accent/40 bg-accent/10 py-2 text-xs font-heading font-semibold text-accent disabled:opacity-60"
              >
                {savingMethod ? "Saving..." : "Save payout details"}
              </button>
            </div>
          )}

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
