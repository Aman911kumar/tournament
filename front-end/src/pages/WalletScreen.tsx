import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Crown,
  History,
  Plus,
  RefreshCcw,
  Send,
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

const statusColors: Record<string, string> = {
  success: "text-accent",
  successful: "text-accent",
  pending: "text-neon-blue",
  failed: "text-destructive",
  rejected: "text-destructive",
};

const formatMonthlyChange = (value: number) => `${value > 0 ? "+" : ""}${value}% this month`;

const WalletScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "player" | "creator">("all");
  const [balance, setBalance] = useState(0);
  const [creatorEarnings, setCreatorEarnings] = useState(0);
  const [playerEarnings, setPlayerEarnings] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(0);
  const [playerMonthlyChange, setPlayerMonthlyChange] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    const cachedSummary = readCache<WalletSummary>(CACHE_KEYS.walletSummary);
    const cachedTransactions = readCache<WalletTransaction[]>(CACHE_KEYS.walletTransactions);

    try {
      setLoading(true);
      setError(null);
      if (cachedSummary) {
        setBalance(cachedSummary.data.balance);
        setCreatorEarnings(cachedSummary.data.creatorEarnings);
        setPlayerEarnings(cachedSummary.data.playerEarnings ?? 0);
        setMonthlyChange(cachedSummary.data.monthlyChange ?? 0);
        setPlayerMonthlyChange(cachedSummary.data.playerMonthlyChange ?? 0);
        setCacheNotice(getSavedDataLabel(cachedSummary.savedAt));
      }
      if (cachedTransactions) {
        setTransactions(cachedTransactions.data);
      }

      const [balanceRes, earningsRes, playerEarningsRes, transactionsRes] = await Promise.all([
        getBalance(),
        getCreatorEarnings(),
        getPlayerEarnings(),
        getTransactions("all"),
      ]);
      setBalance(balanceRes.balance);
      setCreatorEarnings(earningsRes.total);
      setPlayerEarnings(playerEarningsRes.total);
      setMonthlyChange(earningsRes.monthlyChange);
      setPlayerMonthlyChange(playerEarningsRes.monthlyChange);
      setTransactions(transactionsRes);
      setCacheNotice(null);
      writeAuthenticatedCache(CACHE_KEYS.walletSummary, {
        balance: balanceRes.balance,
        creatorEarnings: earningsRes.total,
        playerEarnings: playerEarningsRes.total,
        monthlyChange: earningsRes.monthlyChange,
        playerMonthlyChange: playerEarningsRes.monthlyChange,
      });
      writeAuthenticatedCache(CACHE_KEYS.walletTransactions, transactionsRes);
    } catch (loadError) {
      if (cachedSummary || cachedTransactions) {
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
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return transactions;
    if (activeTab === "creator") return transactions.filter((t) => t.label.includes("Creator"));
    return transactions.filter((t) => !t.label.includes("Creator"));
  }, [activeTab, transactions]);

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
              <button type="button" onClick={loadWallet} className="mt-2 text-xs text-primary inline-flex items-center gap-1.5">
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Transactions
          </h2>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <GlassCard className="text-center py-8">
              <p className="text-sm font-heading">No transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error ? "Connect once to save wallet data for offline use." : "Try a different filter."}
              </p>
            </GlassCard>
          ) : (
            filtered.map((t, i) => (
              <GlassCard
                key={t.id}
                delay={i * 0.05}
                className="flex items-center justify-between cursor-pointer hover:neon-border transition-all"
                onClick={() => { console.log(t); navigate(`/wallet/transaction/${t.id}`) }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "CREDIT" ? "bg-accent/10" : "bg-destructive/10"
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
                  <p className={`text-[10px] font-heading capitalize ${statusColors[t.status]}`}>{t.status}</p>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default WalletScreen;
