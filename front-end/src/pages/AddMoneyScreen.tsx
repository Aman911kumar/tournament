import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, IndianRupee, Loader2 } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import {
  createAddMoneyOrder,
  getBalance,
  updateAddMoneyStatus,
  verifyAddMoney,
} from "@/api/wallet";
import {
  CACHE_KEYS,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";
import {
  WalletSecurityNote,
  WalletShell,
} from "@/components/wallet/WalletShell";

const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existingScript) {
      if (window.Razorpay) {
        resolve();
        return;
      }

      if (existingScript.dataset.failed === "true") {
        reject(new Error("Unable to load Razorpay checkout"));
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay checkout")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.dataset.failed = "true";
      reject(new Error("Unable to load Razorpay checkout"));
    };
    document.body.appendChild(script);
  });

const normalizeAmountInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", decimal = ""] = cleaned.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "").slice(0, 6);
  const normalizedDecimal = decimal.slice(0, 2);

  if (cleaned.includes(".")) {
    return `${normalizedWhole || "0"}.${normalizedDecimal}`;
  }

  return normalizedWhole;
};

const AddMoneyScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentStage, setPaymentStage] = useState<
    "idle" | "order" | "checkout" | "verify"
  >("idle");

  const value = Number(amount);
  const isValidAmount =
    Number.isFinite(value) && value >= 10 && value <= 100000;
  const buttonLabel = loading
    ? paymentStage === "verify"
      ? "Verifying payment..."
      : paymentStage === "checkout"
        ? "Complete payment..."
        : "Creating order..."
    : isValidAmount
      ? `Pay ${formatCurrency(value)}`
      : "Enter amount";

  useEffect(() => {
    let active = true;
    const cachedWallet = readCache<{
      balance: number;
      creatorEarnings: number;
      monthlyChange: number;
    }>(CACHE_KEYS.walletSummary);
    setBalance(cachedWallet?.data.balance ?? null);

    getBalance()
      .then((res) => {
        if (!active) return;
        setBalance(res.balance);
      })
      .catch(() => {
        // Cached balance is already shown when available.
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAdd = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const value = Number(amount);

    if (!value || value < 10) {
      toast.error("Invalid amount", {
        description: "Minimum amount is Rs. 10",
      });
      return;
    }

    if (value > 100000) {
      toast.error("Amount too high", {
        description: "Maximum amount is Rs. 1,00,000",
      });
      return;
    }

    try {
      if (!window.navigator.onLine) {
        toast.error("You are offline", {
          description: "Connect to the internet to make a payment.",
        });
        return;
      }

      setLoading(true);
      setPaymentStage("order");
      await loadRazorpayCheckout();
      const orderRes = await createAddMoneyOrder({
        amount: value,
        method: "razorpay",
      });
      const order = orderRes.data;

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable");
      }

      setPaymentStage("checkout");
      let paymentCompleted = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Battle4Arena",
        description: `Add ${formatCurrency(value)} to wallet`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            paymentCompleted = true;
            setPaymentStage("verify");
            const verifyRes = await verifyAddMoney(response);
            const balanceRes = await getBalance();
            const cachedWallet = readCache<{
              balance: number;
              creatorEarnings: number;
              monthlyChange: number;
            }>(CACHE_KEYS.walletSummary);
            const confirmedBalance =
              verifyRes.data?.balance ?? balanceRes.balance;
            if (cachedWallet && typeof confirmedBalance === "number") {
              writeAuthenticatedCache(
                CACHE_KEYS.walletSummary,
                {
                  ...cachedWallet.data,
                  balance: confirmedBalance,
                },
                verifyRes,
              );
            }
            setBalance(confirmedBalance);
            toast.success("Money added", {
              description: `${formatCurrency(value)} has been credited to your wallet.`,
            });
            setTimeout(() => navigate("/wallet"), 800);
          } catch (error) {
            const errorToast = getErrorToast(error, {
              action: "Verify payment",
              fallback:
                "Payment completed, but wallet credit verification failed.",
            });
            toast.error(errorToast.title, {
              description: errorToast.description,
            });
          } finally {
            setLoading(false);
            setPaymentStage("idle");
          }
        },
        notes: {
          gateway: "razorpay",
        },
        theme: {
          color: "#8b5cf6",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setPaymentStage("idle");
            if (!paymentCompleted) {
              updateAddMoneyStatus({
                orderId: order.orderId,
                status: "cancelled",
                reason: "checkout_closed",
              }).catch(() => undefined);
              toast.info("Payment cancelled", {
                description:
                  "No money was deducted. The cancelled payment will appear in your wallet history.",
              });
            }
          },
        },
      });

      checkout.on("payment.failed", (response) => {
        paymentCompleted = true;
        setLoading(false);
        setPaymentStage("idle");
        updateAddMoneyStatus({
          orderId: order.orderId,
          status: "failed",
          reason:
            response.error?.reason ?? response.error?.code ?? "payment_failed",
          response,
        }).catch(() => undefined);
        toast.error("Payment failed", {
          description:
            response.error?.description ??
            "Razorpay could not complete the payment.",
        });
      });

      checkout.open();
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Add money",
        fallback: "Failed to add money.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
      setLoading(false);
      setPaymentStage("idle");
    }
  };

  return (
    <WalletShell
      title="Add Money"
      subtitle="Secure wallet recharge through Razorpay"
      icon={CreditCard}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleAdd} className="space-y-2.5 sm:space-y-4">
        <section className="wallet-flow-hero overflow-hidden rounded-2xl border border-glass-border p-3 sm:p-5">
          <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                <span className="font-heading text-xs text-muted-foreground">
                  Current Balance
                </span>
              </div>
              <p className="truncate font-display text-[clamp(1.65rem,9vw,2.25rem)] font-black leading-tight neon-text-purple sm:text-4xl">
                {balance === null ? "Unavailable" : formatCurrency(balance)}
              </p>
              {balance === null && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Open Wallet once online to save your balance.
                </p>
              )}
            </div>
            <div className="w-full rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-left min-[430px]:w-auto min-[430px]:text-right sm:rounded-xl sm:px-3 sm:py-2">
              <p className="font-heading text-[10px] uppercase text-muted-foreground">
                Gateway
              </p>
              <p className="font-heading text-sm font-bold text-accent">
                Razorpay
              </p>
            </div>
          </div>
        </section>

        <section className="wallet-flow-panel rounded-2xl p-2.5 sm:p-5">
          <div className="mb-2.5 flex flex-col gap-1 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between min-[430px]:gap-3 sm:mb-3">
            <label
              htmlFor="add-money-amount"
              className="block font-heading text-xs text-muted-foreground"
            >
              Recharge Amount
            </label>
            <span
              className={`font-heading text-[10px] ${amount && !isValidAmount ? "text-destructive" : "text-muted-foreground"}`}
            >
              Min {formatCurrency(10)} | Max {formatCurrency(100000)}
            </span>
          </div>

          <div
            className={`wallet-flow-input flex items-center gap-2 rounded-xl px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3 ${
              amount && !isValidAmount ? "!border-destructive/70" : ""
            }`}
          >
            <IndianRupee className="h-5 w-5 shrink-0 text-accent sm:h-6 sm:w-6" />
            <input
              id="add-money-amount"
              type="number"
              inputMode="decimal"
              min="10"
              max="100000"
              step="1"
              value={amount}
              onChange={(e) => setAmount(normalizeAmountInput(e.target.value))}
              placeholder="0"
              disabled={loading}
              className="min-w-0 flex-1 bg-transparent font-display text-[clamp(1.9rem,10vw,2.5rem)] font-bold leading-none outline-none placeholder:text-muted-foreground/40 disabled:opacity-60 sm:text-4xl"
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:grid-cols-6 sm:gap-2">
            {quickAmounts.map((amt) => (
              <motion.button
                key={amt}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setAmount(String(amt))}
                disabled={loading}
                className={`rounded-lg border py-2 text-[10px] font-heading font-semibold transition-all disabled:opacity-60 sm:rounded-xl sm:py-2.5 sm:text-xs ${
                  value === amt
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "wallet-flow-tile hover:border-primary/50"
                }`}
              >
                {formatCurrency(amt)}
              </motion.button>
            ))}
          </div>
        </section>

        <section className="wallet-flow-panel space-y-2.5 rounded-2xl p-2.5 sm:space-y-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-heading text-muted-foreground">
              Backend verified payment
            </span>
            <span className="font-heading font-semibold text-foreground">
              {isValidAmount ? formatCurrency(value) : formatCurrency(0)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-heading text-muted-foreground">
              Payment gateway
            </span>
            <span className="inline-flex items-center gap-1.5 font-heading font-semibold">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              Razorpay Checkout
            </span>
          </div>
        </section>

        <WalletSecurityNote>
          Your wallet is credited only after Razorpay verification succeeds on
          the backend. Cancelled or failed payments stay visible for tracking.
        </WalletSecurityNote>

        <NeonButton
          variant="green"
          full
          type="submit"
          disabled={loading || !isValidAmount}
          className="flex min-h-[44px] items-center justify-center gap-2 sm:min-h-[50px]"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {buttonLabel}
        </NeonButton>
      </form>
    </WalletShell>
  );
};

export default AddMoneyScreen;
