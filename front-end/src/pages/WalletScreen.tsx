import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bell,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  Crown,
  History,
  IndianRupee,
  Lock,
  Medal,
  Receipt,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import {
  getBalance,
  getCreatorEarnings,
  getPlayerEarnings,
  getTransactions,
  WalletTransaction,
} from "@/api/wallet";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { getNotificationSocket } from "@/lib/notification-socket";
import type { NotificationItem } from "@/api/notifications";

interface WalletSummary {
  balance: number;
  creatorEarnings: number;
  playerEarnings: number;
  monthlyChange: number;
  playerMonthlyChange: number;
}

const statusStyles: Record<
  string,
  { text: string; bg: string; iconBg: string; icon: string; amount: string }
> = {
  success: {
    text: "text-accent",
    bg: "bg-accent/10 border-accent/20",
    iconBg: "bg-accent/10",
    icon: "text-accent",
    amount: "text-accent",
  },
  successful: {
    text: "text-accent",
    bg: "bg-accent/10 border-accent/20",
    iconBg: "bg-accent/10",
    icon: "text-accent",
    amount: "text-accent",
  },
  initiated: {
    text: "text-secondary",
    bg: "bg-secondary/10 border-secondary/20",
    iconBg: "bg-secondary/10",
    icon: "text-secondary",
    amount: "text-secondary",
  },
  pending: {
    text: "text-secondary",
    bg: "bg-secondary/10 border-secondary/20",
    iconBg: "bg-secondary/10",
    icon: "text-secondary",
    amount: "text-secondary",
  },
  failed: {
    text: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
    iconBg: "bg-destructive/10",
    icon: "text-destructive",
    amount: "text-destructive",
  },
  rejected: {
    text: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
    iconBg: "bg-destructive/10",
    icon: "text-destructive",
    amount: "text-destructive",
  },
  cancelled: {
    text: "text-muted-foreground",
    bg: "bg-muted/30 border-muted/40",
    iconBg: "bg-muted/40",
    icon: "text-muted-foreground",
    amount: "text-muted-foreground",
  },
  reversed: {
    text: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    iconBg: "bg-primary/10",
    icon: "text-primary",
    amount: "text-primary",
  },
};

const getStatusStyle = (status: string) =>
  statusStyles[status.toLowerCase()] ?? {
    text: "text-muted-foreground",
    bg: "bg-muted/30 border-muted/40",
    iconBg: "bg-muted/40",
    icon: "text-muted-foreground",
    amount: "text-muted-foreground",
  };

const formatTransactionStatus = (status: string) => {
  const normalized = status.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatMonthlyChange = (value: number) =>
  `${value > 0 ? "+" : ""}${value}% this month`;
const PAGE_SIZE = 12;

const getTransactionIcon = (transaction: WalletTransaction) => {
  const label = transaction.label.toLowerCase();
  if (transaction.kind === "PAYMENT") return CreditCard;
  if (label.includes("prize") || label.includes("winning")) return Trophy;
  if (label.includes("bonus")) return Sparkles;
  if (label.includes("creator")) return Crown;
  if (label.includes("withdraw")) return Banknote;
  if (label.includes("transfer")) return Send;
  if (label.includes("entry")) return Medal;
  return transaction.type === "CREDIT" ? ArrowDownLeft : ArrowUpRight;
};

const formatSignedAmount = (amount: number) =>
  `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${formatCurrency(Math.abs(amount))}`;

const WalletStat = ({
  icon: Icon,
  label,
  value,
  note,
  tone = "text-primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone?: string;
}) => (
  <div className="wallet-tile wallet-stat min-w-0 rounded-lg p-2 sm:rounded-xl sm:p-3">
    <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/10 bg-background/45 sm:h-8 sm:w-8 sm:rounded-lg ${tone}`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <p className="min-w-0 truncate text-[10px] font-heading text-muted-foreground sm:text-[11px]">
        {label}
      </p>
    </div>
    <p className="truncate font-heading text-sm font-black sm:text-lg">
      {value}
    </p>
    <p className="wallet-stat-note mt-0.5 truncate text-[10px] text-muted-foreground sm:mt-1">
      {note}
    </p>
  </div>
);

const TransactionRow = ({
  transaction,
  index,
  onClick,
}: {
  transaction: WalletTransaction;
  index: number;
  onClick: () => void;
}) => {
  const style = getStatusStyle(transaction.status);
  const Icon = getTransactionIcon(transaction);
  const credit = transaction.amount > 0 || transaction.type === "CREDIT";
  const amountLabel =
    transaction.kind === "PAYMENT"
      ? formatCurrency(Math.abs(transaction.amount))
      : formatSignedAmount(transaction.amount);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.025, 0.18),
        duration: 0.18,
        ease: "easeOut",
      }}
      onClick={onClick}
      className="arena-focus wallet-transaction group w-full rounded-lg p-2 text-left sm:rounded-xl sm:p-3"
    >
      <div className="wallet-transaction-grid grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[2.75rem_1fr_auto] sm:gap-3">
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg border sm:h-11 sm:w-11 sm:rounded-xl ${credit ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-primary/25 bg-primary/10 text-primary"}`}
        >
          <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-heading text-xs font-bold sm:text-sm">
            {transaction.label}
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:mt-1 sm:gap-1.5">
            <span className="truncate">{transaction.date}</span>
            <span
              className={`rounded-full border px-1.5 py-px font-heading sm:py-0.5 ${style.bg} ${style.text}`}
            >
              {formatTransactionStatus(transaction.status)}
            </span>
          </span>
        </span>
        <span className="wallet-transaction-amount text-right">
          <span
            className={`block whitespace-nowrap font-heading text-xs font-black sm:text-sm ${credit ? "text-emerald-200" : "text-foreground"}`}
          >
            {amountLabel}
          </span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground sm:mt-1">
            {transaction.kind === "PAYMENT" ? "Gateway" : "Wallet"}
          </span>
        </span>
      </div>
    </motion.button>
  );
};

const WalletScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "player" | "creator">(
    "all",
  );
  const [historyView, setHistoryView] = useState<"wallet" | "payments">(
    "wallet",
  );
  const [balance, setBalance] = useState(0);
  const [creatorEarnings, setCreatorEarnings] = useState(0);
  const [playerEarnings, setPlayerEarnings] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(0);
  const [playerMonthlyChange, setPlayerMonthlyChange] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const loadWallet = useCallback(async (nextPage = 1) => {
    const cachedSummary = readCache<WalletSummary>(CACHE_KEYS.walletSummary);
    const cachedTransactions = readCache<WalletTransaction[]>(
      CACHE_KEYS.walletTransactions,
    );

    try {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      if (nextPage === 1 && cachedSummary) {
        setBalance(cachedSummary.data.balance);
        setCreatorEarnings(cachedSummary.data.creatorEarnings);
        setPlayerEarnings(cachedSummary.data.playerEarnings ?? 0);
        setMonthlyChange(cachedSummary.data.monthlyChange ?? 0);
        setPlayerMonthlyChange(cachedSummary.data.playerMonthlyChange ?? 0);
        setCacheNotice(getSavedDataLabel(cachedSummary.savedAt));
      }
      if (nextPage === 1 && cachedTransactions) {
        setTransactions(cachedTransactions.data);
      }

      const [balanceRes, earningsRes, playerEarningsRes, transactionsRes] =
        await Promise.all([
          getBalance(),
          getCreatorEarnings(),
          getPlayerEarnings(),
          getTransactions("all", { page: nextPage, limit: PAGE_SIZE }),
        ]);
      setBalance(balanceRes.balance);
      setCreatorEarnings(earningsRes.total);
      setPlayerEarnings(playerEarningsRes.total);
      setMonthlyChange(earningsRes.monthlyChange);
      setPlayerMonthlyChange(playerEarningsRes.monthlyChange);
      setTransactions((previous) =>
        nextPage === 1
          ? transactionsRes.transactions
          : [...previous, ...transactionsRes.transactions],
      );
      setPage(transactionsRes.page);
      setHasMore(transactionsRes.hasMore);
      setCacheNotice(null);
      writeAuthenticatedCache(CACHE_KEYS.walletSummary, {
        balance: balanceRes.balance,
        creatorEarnings: earningsRes.total,
        playerEarnings: playerEarningsRes.total,
        monthlyChange: earningsRes.monthlyChange,
        playerMonthlyChange: playerEarningsRes.monthlyChange,
      });
      if (nextPage === 1) {
        writeAuthenticatedCache(
          CACHE_KEYS.walletTransactions,
          transactionsRes.transactions,
        );
      }
    } catch (loadError) {
      if (nextPage === 1 && (cachedSummary || cachedTransactions)) {
        if (cachedSummary) {
          setBalance(cachedSummary.data.balance);
          setCreatorEarnings(cachedSummary.data.creatorEarnings);
          setPlayerEarnings(cachedSummary.data.playerEarnings ?? 0);
          setMonthlyChange(cachedSummary.data.monthlyChange ?? 0);
          setPlayerMonthlyChange(cachedSummary.data.playerMonthlyChange ?? 0);
        }
        if (cachedTransactions) {
          setTransactions(cachedTransactions.data);
        }
        setError(null);
        setCacheNotice(
          getSavedDataNotice(
            cachedSummary?.savedAt ?? cachedTransactions?.savedAt,
            loadError,
          ),
        );
      } else {
        setError(getErrorMessage(loadError, "Failed to load wallet."));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadWallet(1);
  }, [loadWallet]);

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;

    let refreshTimer: number | undefined;
    const refreshWallet = (notification: NotificationItem) => {
      if (
        !["wallet", "payment", "tournament", "room"].includes(notification.type)
      )
        return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadWallet(1), 450);
    };

    socket.on("notification:new", refreshWallet);
    return () => {
      window.clearTimeout(refreshTimer);
      socket.off("notification:new", refreshWallet);
    };
  }, [loadWallet]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return transactions;
    if (activeTab === "creator")
      return transactions.filter((t) => t.label.includes("Creator"));
    return transactions.filter((t) => !t.label.includes("Creator"));
  }, [activeTab, transactions]);

  const walletTransactions = useMemo(
    () => filtered.filter((transaction) => transaction.kind !== "PAYMENT"),
    [filtered],
  );

  const paymentTransactions = useMemo(
    () =>
      activeTab === "creator"
        ? []
        : filtered.filter((transaction) => transaction.kind === "PAYMENT"),
    [activeTab, filtered],
  );

  const pendingCount = useMemo(
    () =>
      transactions.filter((transaction) =>
        ["initiated", "pending"].includes(transaction.status.toLowerCase()),
      ).length,
    [transactions],
  );

  const creditTotal = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions],
  );

  const debitTotal = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [transactions],
  );

  const rewardTotal = playerEarnings + Math.max(creatorEarnings, 0);

  useEffect(() => {
    if (activeTab === "creator" && historyView === "payments") {
      setHistoryView("wallet");
    }
  }, [activeTab, historyView]);

  return (
    <div className="arena-shell min-h-[100dvh] overflow-x-hidden pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pb-24">
      <style>{`
        .wallet-hero {
          background:
            radial-gradient(circle at 86% 8%, hsl(var(--accent) / 0.16), transparent 26%),
            radial-gradient(circle at 8% 0%, hsl(var(--primary) / 0.18), transparent 30%),
            linear-gradient(135deg, hsl(var(--card) / 0.94), hsl(var(--background) / 0.96));
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.045), 0 12px 28px rgb(0 0 0 / 0.18);
        }
        .wallet-tile,
        .wallet-action-card,
        .wallet-transaction,
        .wallet-panel {
          border: 1px solid hsl(var(--border) / 0.72);
          background: hsl(var(--card) / 0.74);
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.04);
        }
        .wallet-action-card {
          transition: transform 150ms ease, border-color 150ms ease, background-color 150ms ease;
        }
        .wallet-action-card:hover,
        .wallet-transaction:hover {
          border-color: hsl(var(--primary) / 0.5);
          background: hsl(var(--card) / 0.94);
        }
        .wallet-action-card:active,
        .wallet-transaction:active {
          transform: scale(0.99);
        }
        .live-dot {
          box-shadow: 0 0 0 0 hsl(var(--accent) / 0.35);
          animation: walletPulse 2.8s ease-out infinite;
        }
        @keyframes walletPulse {
          70% { box-shadow: 0 0 0 8px hsl(var(--accent) / 0); }
          100% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .live-dot { animation: none; }
        }
        @media (max-width: 420px) {
          .wallet-transaction-grid {
            grid-template-columns: 2rem minmax(0, 1fr);
          }
          .wallet-transaction-amount {
            grid-column: 2;
            text-align: left;
          }
        }
        @media (max-width: 480px) {
          .wallet-hero,
          .wallet-panel {
            border-radius: 1rem;
          }
          .wallet-stat-note,
          .wallet-action-desc {
            display: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:px-6">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary sm:h-10 sm:w-10 sm:rounded-xl">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-base font-black sm:text-lg">
              Wallet Arena
            </h1>
            <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
              Balance, rewards, payouts, and secure wallet activity
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadWallet(1)}
            disabled={loading || loadingMore}
            className="arena-focus grid h-8 w-8 place-items-center rounded-lg border border-glass-border bg-card/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 sm:h-10 sm:w-10 sm:rounded-xl"
            aria-label="Refresh wallet"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading || loadingMore ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-2.5 px-2.5 pt-2.5 sm:space-y-4 sm:px-5 sm:pt-4 lg:px-6">
        <section className="grid gap-2.5 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="wallet-hero relative overflow-hidden rounded-2xl border border-glass-border p-3 sm:p-6"
          >
            <div className="absolute right-4 top-4 hidden h-24 w-24 rounded-full border border-white/10 bg-white/5 sm:block" />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-5 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-heading text-[10px] font-bold text-emerald-200 sm:gap-2 sm:px-3 sm:text-[11px]">
                  <span className="live-dot h-2 w-2 rounded-full bg-emerald-300" />
                  Realtime wallet
                </span>
                <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-background/35 px-3 py-1 text-[11px] text-muted-foreground min-[430px]:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  Protected by account security
                </span>
              </div>

              <p className="flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
                <IndianRupee className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                Available Balance
              </p>
              {loading ? (
                <div className="mt-3 h-12 w-48 animate-pulse rounded-xl bg-muted" />
              ) : error ? (
                <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3">
                  <p className="flex items-center gap-2 text-sm font-heading text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Could not load balance
                  </p>
                  <button
                    type="button"
                    onClick={() => loadWallet(1)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              ) : (
                <motion.p
                  key={balance}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1.5 font-display text-[clamp(1.8rem,10vw,2.45rem)] font-black leading-tight neon-text-purple sm:mt-2 sm:text-5xl"
                >
                  {formatCurrency(balance)}
                </motion.p>
              )}
              {cacheNotice && (
                <p
                  className="mt-2 max-w-full truncate text-[11px] font-heading text-secondary"
                  title={cacheNotice}
                >
                  {cacheNotice}
                </p>
              )}

              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-6 sm:gap-2">
                <WalletStat
                  icon={Trophy}
                  label="Player Winnings"
                  value={formatCurrency(playerEarnings)}
                  note={formatMonthlyChange(playerMonthlyChange)}
                  tone="text-accent"
                />
                <WalletStat
                  icon={Crown}
                  label="Creator Payouts"
                  value={formatCurrency(creatorEarnings)}
                  note={formatMonthlyChange(monthlyChange)}
                  tone={
                    monthlyChange >= 0 ? "text-secondary" : "text-destructive"
                  }
                />
                <WalletStat
                  icon={Sparkles}
                  label="Reward Pool"
                  value={formatCurrency(rewardTotal)}
                  note="Winnings + creator income"
                  tone="text-emerald-200"
                />
              </div>
            </div>
          </motion.div>

          <section className="wallet-panel rounded-2xl p-2.5 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
              <div>
                <h2 className="font-heading text-sm font-black">
                  Quick Actions
                </h2>
                <p className="hidden text-[11px] text-muted-foreground min-[430px]:block">
                  Fast and secure wallet controls
                </p>
              </div>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:grid-cols-1">
              {[
                {
                  icon: Plus,
                  title: "Add Money",
                  desc: "Recharge via Razorpay",
                  route: "/wallet/add",
                  tone: "text-emerald-200",
                  bg: "bg-emerald-400/10 border-emerald-400/25",
                },
                {
                  icon: Send,
                  title: "Transfer",
                  desc: "Send to players securely",
                  route: "/wallet/transfer",
                  tone: "text-primary",
                  bg: "bg-primary/10 border-primary/25",
                },
                {
                  icon: ArrowUpRight,
                  title: "Withdraw",
                  desc: "UPI or bank payout",
                  route: "/wallet/withdraw",
                  tone: "text-cyan-200",
                  bg: "bg-cyan-400/10 border-cyan-400/25",
                },
                {
                  icon: Lock,
                  title: "Transfer PIN",
                  desc: "Manage payout safety",
                  route: "/wallet/transfer-pin",
                  tone: "text-accent",
                  bg: "bg-accent/10 border-accent/25",
                },
              ].map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => navigate(action.route)}
                  className="arena-focus wallet-action-card rounded-lg p-2 text-center sm:rounded-xl sm:p-3 lg:text-left"
                >
                  <span className="flex flex-col items-center gap-1.5 lg:flex-row lg:gap-3">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border sm:h-10 sm:w-10 sm:rounded-xl ${action.bg} ${action.tone}`}
                    >
                      <action.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-[10px] font-bold sm:text-sm">
                        {action.title}
                      </span>
                      <span className="wallet-action-desc block truncate text-[11px] text-muted-foreground">
                        {action.desc}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-4">
          <WalletStat
            icon={Coins}
            label="Credits Tracked"
            value={formatCurrency(creditTotal)}
            note="Recent wallet inflow"
            tone="text-emerald-200"
          />
          <WalletStat
            icon={Banknote}
            label="Debits Tracked"
            value={formatCurrency(debitTotal)}
            note="Entries, transfers, payouts"
            tone="text-primary"
          />
          <WalletStat
            icon={Clock3}
            label="Pending"
            value={`${pendingCount}`}
            note="Processing activities"
            tone="text-secondary"
          />
          <WalletStat
            icon={Bell}
            label="Updates"
            value={transactions.length ? "Live" : "Ready"}
            note="Refreshes on wallet alerts"
            tone="text-accent"
          />
        </section>

        <section className="wallet-panel rounded-2xl p-2.5 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-sm font-black sm:text-base">
                {historyView === "wallet" ? (
                  <History className="h-4 w-4 text-primary" />
                ) : (
                  <Receipt className="h-4 w-4 text-secondary" />
                )}
                {historyView === "wallet"
                  ? "Wallet Ledger"
                  : "Payment Activity"}
              </h2>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
                Clear status, amount direction, and source for every money
                movement.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {(["all", "player", "creator"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`arena-focus rounded-full px-2.5 py-1 font-heading text-[10px] font-bold capitalize transition-colors sm:px-3 sm:py-1.5 ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "border border-glass-border bg-card/60 text-muted-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <div className="grid grid-cols-2 rounded-full border border-glass-border bg-card/60 p-0.5 sm:p-1">
                <button
                  type="button"
                  onClick={() => setHistoryView("wallet")}
                  className={`rounded-full px-2.5 py-1 font-heading text-[10px] transition-colors sm:px-3 ${
                    historyView === "wallet"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryView("payments")}
                  disabled={activeTab === "creator"}
                  className={`rounded-full px-2.5 py-1 font-heading text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${
                    historyView === "payments"
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Payments
                </button>
              </div>
            </div>
          </div>

          {loading && transactions.length === 0 && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-muted/60"
                />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {historyView === "wallet" &&
              !loading &&
              walletTransactions.length === 0 && (
                <GlassCard className="py-6 text-center sm:py-8">
                  <Wallet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="font-heading text-sm">
                    No wallet transactions found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error
                      ? "Connect once to save wallet data for offline use."
                      : "Wallet credits and debits will appear here."}
                  </p>
                </GlassCard>
              )}

            {historyView === "wallet" &&
              walletTransactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  index={index}
                  onClick={() =>
                    navigate(`/wallet/transaction/${transaction.id}`)
                  }
                />
              ))}

            {historyView === "payments" &&
              !loading &&
              paymentTransactions.length === 0 && (
                <GlassCard className="py-6 text-center sm:py-8">
                  <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="font-heading text-sm">
                    No payment activity found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Razorpay checkout updates and payout processing will appear
                    here.
                  </p>
                </GlassCard>
              )}

            {historyView === "payments" &&
              paymentTransactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  index={index}
                  onClick={() => navigate(`/wallet/payment/${transaction.id}`)}
                />
              ))}
          </div>

          {!loading && !error && hasMore && (
            <div className="mt-4">
              <NeonButton
                full
                variant="blue"
                className="text-xs"
                onClick={() => loadWallet(page + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? "LOADING..." : "LOAD MORE ACTIVITY"}
              </NeonButton>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-accent/20 bg-accent/10 p-2.5 sm:mt-4 sm:p-3">
            <p className="flex items-center gap-2 font-heading text-xs font-bold text-accent">
              <CheckCircle2 className="h-4 w-4" />
              Secure wallet note
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Deposits, withdrawals, transfers, and prize payouts are verified
              by backend records. Keep transaction IDs for disputes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WalletScreen;
