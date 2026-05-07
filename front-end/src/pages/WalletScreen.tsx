import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Crown,
  History,
  Plus,
  RefreshCcw,
  Send,
  Timer,
  Trophy,
  TrendingUp,
  Wallet,
  TrendingDown,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { getBalance, getCreatorEarnings, getPlayerEarnings, getTransactions, WalletTransaction } from "@/api/wallet";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";

interface WalletSummary {
  balance: number;
  creatorEarnings: number;
  playerEarnings: number;
  monthlyChange: number;
  playerMonthlyChange: number;
}

const statusStyles: Record<string, { text: string; bg: string; iconBg: string; icon: string; amount: string }> = {
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

const getStatusStyle = (status: string) => statusStyles[status.toLowerCase()] ?? {
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

const formatMonthlyChange = (value: number) => `${value > 0 ? "+" : ""}${value}% this month`;
const PAGE_SIZE = 12;

const WalletScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "player" | "creator">("all");
  const [historyView, setHistoryView] = useState<"wallet" | "payments">("wallet");
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
    const cachedTransactions = readCache<WalletTransaction[]>(CACHE_KEYS.walletTransactions);

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

      const [balanceRes, earningsRes, playerEarningsRes, transactionsRes] = await Promise.all([
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
      setTransactions((previous) => nextPage === 1 ? transactionsRes.transactions : [...previous, ...transactionsRes.transactions]);
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
        writeAuthenticatedCache(CACHE_KEYS.walletTransactions, transactionsRes.transactions);
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
        setCacheNotice(getSavedDataNotice(cachedSummary?.savedAt ?? cachedTransactions?.savedAt, loadError));
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

  const filtered = useMemo(() => {
    if (activeTab === "all") return transactions;
    if (activeTab === "creator") return transactions.filter((t) => t.label.includes("Creator"));
    return transactions.filter((t) => !t.label.includes("Creator"));
  }, [activeTab, transactions]);

  const walletTransactions = useMemo(
    () => filtered.filter((transaction) => transaction.kind !== "PAYMENT"),
    [filtered],
  );

  const paymentTransactions = useMemo(
    () => (activeTab === "creator" ? [] : filtered.filter((transaction) => transaction.kind === "PAYMENT")),
    [activeTab, filtered],
  );

  useEffect(() => {
    if (activeTab === "creator" && historyView === "payments") {
      setHistoryView("wallet");
    }
  }, [activeTab, historyView]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4">
        <h1 className="font-heading text-xl font-bold">Wallet</h1>
        <p className="text-xs text-muted-foreground font-heading">Manage your funds</p>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-4">
        <GlassCard neon className="relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground font-heading">Available Balance</span>
          </div>
          {cacheNotice && (
            <p className="mb-2 max-w-full truncate text-[10px] font-heading text-secondary" title={cacheNotice}>
              {cacheNotice}
            </p>
          )}
          {loading ? (
            <div className="h-9 w-36 rounded bg-muted animate-pulse mb-4" />
          ) : error ? (
            <div className="mb-4">
              <p className="text-sm font-heading text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Could not load balance
              </p>
              <button type="button" onClick={() => loadWallet(1)} className="mt-2 text-xs text-primary inline-flex items-center gap-1.5">
                <RefreshCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="font-display text-3xl font-bold neon-text-purple mb-4"
            >
              {formatCurrency(balance)}
            </motion.p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <NeonButton variant="green" className="text-xs py-2 flex items-center justify-center gap-1.5" onClick={() => navigate("/wallet/add")}>
              <Plus className="w-3.5 h-3.5" /> Add Money
            </NeonButton>
            <NeonButton variant="purple" className="text-xs py-2 flex items-center justify-center gap-1.5" onClick={() => navigate("/wallet/transfer")}>
              <Send className="w-3.5 h-3.5" /> Transfer
            </NeonButton>
            <NeonButton variant="blue" className="text-xs py-2 flex items-center justify-center gap-1.5" onClick={() => navigate("/wallet/withdraw")}>
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </NeonButton>
          </div>
        </GlassCard>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-4 grid gap-3 sm:grid-cols-2">
        <GlassCard className="neon-border">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground font-heading">Player Earnings</span>
              </div>
              {loading ? (
                <div className="h-6 w-28 rounded bg-muted animate-pulse" />
              ) : (
                <p className="font-heading text-lg font-bold text-accent truncate">{formatCurrency(playerEarnings)}</p>
              )}
              <p className="text-[10px] text-accent flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {formatMonthlyChange(playerMonthlyChange)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="neon-border">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-secondary" />
                <span className="text-xs text-muted-foreground font-heading">Creator Earnings</span>
              </div>
              {loading ? (
                <div className="h-6 w-28 rounded bg-muted animate-pulse" />
              ) : (
                creatorEarnings > 0 ? <p className="font-heading text-lg font-bold text-secondary truncate">{formatCurrency(creatorEarnings)}</p> :
                    <p className="text-red-600 font-heading text-lg font-bold text-muted-foreground truncate">{ formatCurrency(creatorEarnings)}</p>
              )}
              <p className="text-[10px] text-accent flex items-center gap-1">
                {
                  monthlyChange >= 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3" /> {formatMonthlyChange(monthlyChange)}
                    </>
                  ) : (
                    <div className="text-destructive flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> {formatMonthlyChange(monthlyChange)}
                    </div>
                  )
                }
              </p>
            </div>
            <NeonButton variant="blue" className="text-[10px] py-1.5 px-3 shrink-0" onClick={() => navigate("/creator-dashboard")}>
              Dashboard
            </NeonButton>
          </div>
        </GlassCard>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-3 flex gap-2">
        {(["all", "player", "creator"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-heading font-medium capitalize transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground neon-glow-purple" : "glass text-muted-foreground"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            {historyView === "wallet" ? (
              <History className="w-4 h-4 text-primary" />
            ) : (
              <CreditCard className="w-4 h-4 text-secondary" />
            )}
            {historyView === "wallet" ? "Wallet Transactions" : "Payment Activity"}
          </h2>
          <div className="grid grid-cols-2 rounded-lg border border-glass-border bg-card/60 p-1">
            <button
              type="button"
              onClick={() => setHistoryView("wallet")}
              className={`rounded-md px-3 py-1.5 font-heading text-[10px] transition-colors ${
                historyView === "wallet" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={() => setHistoryView("payments")}
              disabled={activeTab === "creator"}
              className={`rounded-md px-3 py-1.5 font-heading text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                historyView === "payments" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Payments
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {historyView === "wallet" && walletTransactions.length === 0 && (
            <GlassCard className="text-center py-8">
              <p className="text-sm font-heading">No wallet transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error ? "Connect once to save wallet data for offline use." : "Wallet credits and debits will appear here."}
              </p>
            </GlassCard>
          )}

          {historyView === "wallet" && walletTransactions.length > 0 && (
            walletTransactions.map((t, i) => {
              const style = getStatusStyle(t.status);
              return (
                <GlassCard
                  key={t.id}
                  delay={i * 0.05}
                  className="flex items-center justify-between cursor-pointer hover:neon-border transition-all"
                  onClick={() => navigate(`/wallet/transaction/${t.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        t.type === "CREDIT" ? "bg-accent/10" : "bg-destructive/10"
                      }`}
                    >
                      {t.type === "CREDIT" ? (
                        <ArrowDownLeft className="w-4 h-4 text-accent" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-heading font-semibold truncate">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-heading font-bold ${t.type === "CREDIT" ? "text-accent" : "text-foreground"}`}>
                      {t.amount > 0 ? "+" : ""}
                      {formatCurrency(t.amount)}
                    </p>
                    <p className={`text-[10px] font-heading ${style.text}`}>{formatTransactionStatus(t.status)}</p>
                  </div>
                </GlassCard>
              );
            })
          )}

          {historyView === "payments" && paymentTransactions.length === 0 && (
            <GlassCard className="text-center py-8">
              <p className="text-sm font-heading">No payment activity found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Razorpay checkout updates will appear here.
              </p>
            </GlassCard>
          )}

          {historyView === "payments" && paymentTransactions.length > 0 && (
            paymentTransactions.map((t, i) => {
              const style = getStatusStyle(t.status);
              const isWaiting = ["initiated", "pending"].includes(t.status.toLowerCase());
              return (
                <GlassCard
                  key={t.id}
                  delay={i * 0.05}
                  className={`flex cursor-pointer items-center justify-between border transition-all hover:neon-border ${style.bg}`}
                  onClick={() => navigate(`/wallet/payment/${t.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.iconBg}`}>
                      {isWaiting ? (
                        <Timer className={`w-4 h-4 ${style.icon}`} />
                      ) : (
                        <CreditCard className={`w-4 h-4 ${style.icon}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-heading font-semibold truncate">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-heading font-bold ${style.amount}`}>
                      {formatCurrency(t.amount)}
                    </p>
                    <p className={`text-[10px] font-heading ${style.text}`}>{formatTransactionStatus(t.status)}</p>
                  </div>
                </GlassCard>
              );
            })
          )}

          {!loading && !error && hasMore && (
            <NeonButton full variant="blue" className="text-xs py-2" onClick={() => loadWallet(page + 1)} disabled={loadingMore}>
              {loadingMore ? "LOADING..." : "LOAD MORE"}
            </NeonButton>
          )}
        </div>
      </div>

    </div>
  );
};

export default WalletScreen;
