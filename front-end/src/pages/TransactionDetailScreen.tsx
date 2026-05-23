import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Receipt,
  RefreshCcw,
  Tag,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getTransactionDetail, type TransactionDetail } from "@/api/wallet";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { copyText } from "@/lib/clipboard";
import { WalletShell } from "@/components/wallet/WalletShell";

const statusConfig = {
  SUCCESS: {
    icon: CheckCircle2,
    color: "text-accent",
    bg: "bg-accent/10",
    label: "Success",
  },
  PENDING: {
    icon: Clock,
    color: "text-neon-blue",
    bg: "bg-neon-blue/10",
    label: "Pending",
  },
  FAILED: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Failed",
  },
  REVERSED: {
    icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
    label: "Reversed",
  },
};

const categoryLabels: Record<string, string> = {
  DEPOSIT: "Money Added",
  WITHDRAW: "Withdrawal",
  TOURNAMENT_ENTRY: "Tournament Entry",
  ORGANIZER_EARNING: "Creator Earning",
  WALLET_TRANSFER: "Wallet Transfer",
  REFUND: "Refund",
  WINNING: "Winning",
  BONUS: "Bonus",
};

const formatDate = (iso?: string) => {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatUser = (user: TransactionDetail["fromUser"]) => {
  if (!user) return "";
  if (typeof user === "string") return user;
  return user.username || user.phone_number || user._id;
};

const copyToClipboard = async (value: string, label: string) => {
  const copied = await copyText(value);
  if (copied) toast.success(`${label} copied`);
  else
    toast.error("Copy failed", {
      description: `Could not copy ${label.toLowerCase()}.`,
    });
};

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
  copyable?: boolean;
  mono?: boolean;
}

const DetailRow = ({
  icon: Icon,
  label,
  value,
  copyable,
  mono,
}: DetailRowProps) => {
  if (value === undefined || value === null || value === "") return null;
  const textValue = String(value);

  return (
    <div className="flex flex-col gap-1.5 border-b border-glass-border py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-heading">{label}</span>
      </div>
      <div className="flex w-full items-center gap-2 sm:max-w-[60%] sm:justify-end">
        <span
          className={`break-all text-left font-heading text-xs text-foreground sm:text-right ${mono ? "font-mono" : ""}`}
        >
          {textValue}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={() => copyToClipboard(textValue, label)}
            className="shrink-0 text-muted-foreground hover:text-primary"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

const TransactionDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransaction = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getTransactionDetail(id);
      setTx(res.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load transaction."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  const details = useMemo(() => {
    if (!tx) return null;
    const isCredit = tx.type === "CREDIT";
    const category = categoryLabels[tx.category] ?? tx.category;
    const status =
      statusConfig[tx.status as keyof typeof statusConfig] ??
      statusConfig.PENDING;
    const from = formatUser(tx.fromUser);
    const to = formatUser(tx.toUser);

    return {
      isCredit,
      category,
      status,
      StatusIcon: status.icon,
      from,
      to,
      signedAmount: `${isCredit ? "+" : "-"}${formatCurrency(Math.abs(tx.amount))}`,
    };
  }, [tx]);

  return (
    <WalletShell
      title="Transaction Details"
      subtitle="Verified wallet ledger record"
      icon={Receipt}
      maxWidth="max-w-3xl"
    >
      {loading && (
        <section className="wallet-flow-hero rounded-2xl border border-glass-border p-3 sm:p-5">
          <div className="animate-pulse space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted mx-auto" />
            <div className="h-8 w-40 bg-muted rounded mx-auto" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="wallet-flow-panel rounded-2xl px-3 py-8 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="text-sm font-heading">Could not load transaction</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
          <button
            onClick={loadTransaction}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-heading"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </section>
      )}

      {!loading && !error && tx && details && (
        <>
          <section className="wallet-flow-hero relative overflow-hidden rounded-2xl border border-glass-border p-4 text-center sm:p-5">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                details.isCredit ? "bg-accent/10" : "bg-destructive/10"
              }`}
            >
              {details.isCredit ? (
                <ArrowDownLeft className="w-7 h-7 text-accent" />
              ) : (
                <ArrowUpRight className="w-7 h-7 text-destructive" />
              )}
            </motion.div>
            <p className="text-xs text-muted-foreground font-heading mb-1">
              {details.category}
            </p>
            <p
              className={`font-display text-[clamp(2rem,10vw,2.5rem)] font-bold leading-tight ${details.isCredit ? "text-accent" : "text-foreground"}`}
            >
              {details.signedAmount}
            </p>
            {tx.description && (
              <p className="text-xs text-muted-foreground mt-2">
                {tx.description}
              </p>
            )}
            <div
              className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full ${details.status.bg}`}
            >
              <details.StatusIcon
                className={`w-3.5 h-3.5 ${details.status.color}`}
              />
              <span
                className={`text-[10px] font-heading font-semibold ${details.status.color}`}
              >
                {details.status.label}
              </span>
            </div>
          </section>

          {(details.from ||
            details.to ||
            tx.platformFee ||
            tx.netAmount ||
            tx.grossAmount) && (
            <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-secondary" />
                <h2 className="text-xs font-heading font-bold">
                  Money Movement
                </h2>
              </div>
              <DetailRow icon={Users} label="From" value={details.from} />
              <DetailRow icon={Users} label="To" value={details.to} />
              <DetailRow
                icon={Tag}
                label="Gross Amount"
                value={
                  tx.grossAmount ? formatCurrency(tx.grossAmount) : undefined
                }
              />
              <DetailRow
                icon={Tag}
                label="Platform Fee"
                value={
                  tx.platformFee ? formatCurrency(tx.platformFee) : undefined
                }
              />
              <DetailRow
                icon={Tag}
                label="Receiver Gets"
                value={tx.netAmount ? formatCurrency(tx.netAmount) : undefined}
              />
            </section>
          )}

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-heading font-bold">
                Balance Snapshot
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-lg p-3 min-w-0">
                <p className="text-[10px] text-muted-foreground font-heading mb-1">
                  Before
                </p>
                <p className="font-heading text-base font-bold text-foreground truncate">
                  {formatCurrency(tx.balanceBefore)}
                </p>
              </div>
              <div className="glass rounded-lg p-3 neon-border min-w-0">
                <p className="text-[10px] text-muted-foreground font-heading mb-1">
                  After
                </p>
                <p className="font-heading text-base font-bold neon-text-purple truncate">
                  {formatCurrency(tx.balanceAfter)}
                </p>
              </div>
            </div>
          </section>

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <h2 className="text-xs font-heading font-bold mb-1">
              Transaction Info
            </h2>
            <DetailRow
              icon={Hash}
              label="Transaction ID"
              value={tx.transactionId}
              copyable
              mono
            />
            <DetailRow icon={Tag} label="Type" value={tx.type} />
            <DetailRow icon={Tag} label="Category" value={details.category} />
            <DetailRow icon={Wallet} label="Currency" value={tx.currency} />
            <DetailRow
              icon={Calendar}
              label="Created"
              value={formatDate(tx.createdAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Updated"
              value={formatDate(tx.updatedAt)}
            />
          </section>

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <h2 className="text-xs font-heading font-bold mb-1">Reference</h2>
            <DetailRow
              icon={Hash}
              label="Wallet ID"
              value={tx.walletId}
              copyable
              mono
            />
            <DetailRow
              icon={Hash}
              label="Reference ID"
              value={tx.referenceId}
              copyable
              mono
            />
            <DetailRow
              icon={Hash}
              label="Idempotency Key"
              value={tx.idempotencyKey}
              copyable
              mono
            />
            <DetailRow
              icon={Hash}
              label="Internal ID"
              value={tx._id}
              copyable
              mono
            />
          </section>
        </>
      )}
    </WalletShell>
  );
};

export default TransactionDetailScreen;
