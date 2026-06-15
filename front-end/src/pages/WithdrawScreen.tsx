import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Lock,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
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
import {
  CACHE_KEYS,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";
import {
  WalletShell,
} from "@/components/wallet/WalletShell";

const withdrawMethods = [
  {
    id: "upi",
    label: "UPI Transfer",
    desc: "Instant, no fees",
    icon: Smartphone,
  },
  {
    id: "bank",
    label: "Bank Account",
    desc: "1-2 business days",
    icon: Building2,
  },
] as const;

const WithdrawScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] =
    useState<(typeof withdrawMethods)[number]["id"]>("upi");
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
    const cachedWallet = readCache<{
      balance: number;
      creatorEarnings: number;
      monthlyChange: number;
    }>(CACHE_KEYS.walletSummary);
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
        const errorToast = getErrorToast(error, {
          action: "Load payout methods",
          fallback: "Could not load saved payout details.",
        });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    };

    loadPayoutMethods();
  }, []);

  const quickAmounts = useMemo(
    () =>
      [500, 1000, 2000, balance].filter(
        (value): value is number => typeof value === "number" && value > 0,
      ),
    [balance],
  );

  const handleWithdraw = async () => {
    const value = Number(amount);

    if (!value || value < 100) {
      toast.error("Invalid amount", {
        description: "Minimum withdrawal is Rs. 100",
      });
      return;
    }

    if (!selectedPayoutMethodId && !destination.trim()) {
      toast.error("Destination required", {
        description:
          method === "upi"
            ? "Enter your UPI ID."
            : "Enter bank account details.",
      });
      return;
    }

    if (!password) {
      toast.error("Password required", {
        description: "Enter your account password to confirm.",
      });
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
        ...(selectedPayoutMethodId
          ? { payoutMethodId: selectedPayoutMethodId }
          : { method, destination: destination.trim() }),
      });
      const balanceRes = await getBalance();
      const cachedWallet = readCache<{
        balance: number;
        creatorEarnings: number;
        monthlyChange: number;
      }>(CACHE_KEYS.walletSummary);
      const confirmedBalance = balanceRes.balance;
      if (cachedWallet && typeof confirmedBalance === "number") {
        writeAuthenticatedCache(
          CACHE_KEYS.walletSummary,
          {
            ...cachedWallet.data,
            balance: confirmedBalance,
          },
          res,
        );
      }
      setBalance(confirmedBalance);
      toast.success("Withdrawal requested!", {
        description: `${formatCurrency(value)} reserved by backend and will be sent via ${method.toUpperCase()}`,
      });
      setTimeout(() => navigate("/wallet"), 800);
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Withdraw",
        fallback: "Withdrawal failed.",
      });
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
      setMethodForm({
        label: "",
        upiId: "",
        accountHolderName: "",
        accountNumber: "",
        ifsc: "",
        bankName: "",
      });
      toast.success(res.message || "Payout method saved");
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Save payout method",
        fallback: "Could not save payout details.",
      });
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
      const errorToast = getErrorToast(error, {
        action: "Remove payout method",
        fallback: "Could not remove payout details.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  };

  return (
    <WalletShell
      title="Withdraw"
      subtitle="UPI and bank payouts with backend balance checks"
      icon={ArrowUpRight}
      maxWidth="max-w-4xl"
    >
      <section className="wallet-flow-hero rounded-2xl border border-glass-border p-3 sm:p-5">
        <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-end min-[430px]:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="font-heading text-xs text-muted-foreground">
              Available Balance
            </p>
            <p className="mt-1 truncate font-display text-[clamp(1.65rem,9vw,2.25rem)] font-black leading-tight neon-text-purple sm:text-4xl">
              {balance === null
                ? "Balance unavailable"
                : formatCurrency(balance)}
            </p>
            {balance === null && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Open Wallet once online to save your balance.
              </p>
            )}
          </div>
          <span className="w-full rounded-lg border border-secondary/25 bg-secondary/10 px-2.5 py-1.5 font-heading text-[11px] font-bold text-secondary min-[430px]:w-auto sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
            Min withdrawal {formatCurrency(100)}
          </span>
        </div>
      </section>

      <section className="wallet-flow-panel rounded-2xl p-2.5 sm:p-5">
        <label className="mb-2 block font-heading text-xs text-muted-foreground">
          Withdraw Amount
        </label>
        <div className="wallet-flow-input flex items-center gap-2 rounded-xl px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
          <span className="font-display text-xl font-bold text-foreground sm:text-2xl">
            Rs.
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent font-display text-[clamp(1.9rem,10vw,2.5rem)] font-bold leading-none outline-none placeholder:text-muted-foreground/40 disabled:opacity-60 sm:text-4xl"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-4 sm:grid-cols-4 sm:gap-2">
          {quickAmounts.map((amt) => (
            <motion.button
              key={amt}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setAmount(String(amt))}
              disabled={loading}
              className="wallet-flow-tile rounded-lg py-2 text-[10px] font-heading font-semibold transition-all hover:border-primary/50 disabled:opacity-60 sm:rounded-xl sm:py-2.5"
            >
              {amt === balance ? "Max" : formatCurrency(amt)}
            </motion.button>
          ))}
        </div>
      </section>

      <section className="wallet-flow-panel rounded-2xl p-2.5 sm:p-5">
        <p className="mb-3 font-heading text-xs text-muted-foreground">
          Withdraw To
        </p>
        <div className="grid gap-2 min-[430px]:grid-cols-2">
          {withdrawMethods.map((m) => (
            <motion.button
              key={m.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setMethod(m.id);
                setSelectedPayoutMethodId("");
                setDestination("");
                setShowNewMethod(true);
              }}
              disabled={loading}
              className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-all disabled:opacity-60 sm:gap-3 sm:rounded-xl sm:p-3 ${
                method === m.id
                  ? "border-secondary/50 bg-secondary/10"
                  : "wallet-flow-tile"
              }`}
            >
              <m.icon
                className={`h-4 w-4 ${method === m.id ? "text-secondary" : "text-muted-foreground"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-xs font-semibold">
                  {m.label}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {m.desc}
                </span>
              </span>
              {method === m.id && (
                <span className="h-2 w-2 rounded-full bg-secondary neon-glow-blue" />
              )}
            </motion.button>
          ))}
        </div>
      </section>

      <section className="wallet-flow-panel rounded-2xl p-2.5 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-heading text-xs text-muted-foreground">
            Saved Payout Details
          </p>
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
                className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-colors sm:gap-3 sm:rounded-xl sm:p-3 ${
                  selectedPayoutMethodId === item._id
                    ? "border-accent/40 bg-accent/10"
                    : "wallet-flow-tile"
                }`}
              >
                {item.type === "upi" ? (
                  <Smartphone className="h-4 w-4 text-accent" />
                ) : (
                  <Building2 className="h-4 w-4 text-accent" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-xs font-semibold">
                    {item.label ||
                      (item.type === "upi" ? "UPI" : "Bank account")}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {item.display}
                  </span>
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
          <div className="mb-3 space-y-2.5 rounded-xl border border-glass-border bg-background/30 p-2.5 sm:mb-4 sm:space-y-3 sm:p-3">
            <input
              value={methodForm.label}
              onChange={(e) =>
                setMethodForm((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="Label, e.g. My UPI"
              disabled={loading || savingMethod}
              className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
            />
            {method === "upi" ? (
              <input
                value={methodForm.upiId}
                onChange={(e) =>
                  setMethodForm((prev) => ({ ...prev, upiId: e.target.value }))
                }
                placeholder="name@upi"
                disabled={loading || savingMethod}
                className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
              />
            ) : (
              <>
                <input
                  value={methodForm.accountHolderName}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      accountHolderName: e.target.value,
                    }))
                  }
                  placeholder="Account holder name"
                  disabled={loading || savingMethod}
                  className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
                />
                <input
                  value={methodForm.accountNumber}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      accountNumber: e.target.value,
                    }))
                  }
                  placeholder="Account number"
                  disabled={loading || savingMethod}
                  className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
                />
                <div className="grid gap-2 min-[430px]:grid-cols-2">
                  <input
                    value={methodForm.ifsc}
                    onChange={(e) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        ifsc: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="IFSC"
                    disabled={loading || savingMethod}
                    className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
                  />
                  <input
                    value={methodForm.bankName}
                    onChange={(e) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        bankName: e.target.value,
                      }))
                    }
                    placeholder="Bank name"
                    disabled={loading || savingMethod}
                    className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
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

        <label className="mb-2 mt-4 flex items-center gap-1.5 font-heading text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Confirm with your password"
          disabled={loading}
          className="wallet-flow-input w-full rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 outline-none disabled:opacity-60"
        />
      </section>

      <NeonButton
        variant="blue"
        full
        onClick={handleWithdraw}
        disabled={loading}
      >
        {loading
          ? "Requesting..."
          : `Withdraw ${amount ? formatCurrency(Number(amount)) : "Rs. 0"}`}
      </NeonButton>
    </WalletShell>
  );
};

export default WithdrawScreen;
