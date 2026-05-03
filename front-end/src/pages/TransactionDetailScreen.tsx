import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Hash,
  Wallet,
  Calendar,
  Tag,
  Receipt,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { toast } from "sonner";
import { getTransactionDetail, type TransactionDetail } from "@/api/wallet";

const FALLBACK: TransactionDetail = {
  _id: "69f5e7aa39df330ea506269e",
  transactionId: "aa5640e3-1787-4c3d-a175-0f8008caaac8",
  idempotencyKey: "WITHDRAW_69f5e09dccf4574b3ce7fab8_1777723305942",
  user: "69f5e09dccf4574b3ce7fab8",
  walletId: "69f5e09dccf4574b3ce7fabd",
  amount: 500,
  balanceBefore: 600,
  balanceAfter: 100,
  currency: "INR",
  category: "WITHDRAW",
  type: "DEBIT",
  status: "SUCCESS",
  createdAt: "2026-05-02T12:01:46.753Z",
  updatedAt: "2026-05-02T12:01:46.753Z",
};

const statusConfig = {
  SUCCESS: { icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10", label: "Success" },
  PENDING: { icon: Clock, color: "text-neon-blue", bg: "bg-neon-blue/10", label: "Pending" },
  FAILED: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const copyToClipboard = (value: string, label: string) => {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
};

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}

const DetailRow = ({ icon: Icon, label, value, copyable, mono }: DetailRowProps) => (
  <div className="flex items-start justify-between gap-3 py-3 border-b border-glass-border last:border-b-0">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-heading">{label}</span>
    </div>
    <div className="flex items-center gap-2 max-w-[60%]">
      <span className={`text-xs font-heading text-foreground text-right break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      {copyable && (
        <button onClick={() => copyToClipboard(value, label)} className="shrink-0 text-muted-foreground hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

const TransactionDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<TransactionDetail>(FALLBACK);

  useEffect(() => {
    if (!id) return;
    getTransactionDetail(id)
      .then((res) => res?.data && setTx(res.data))
      .catch(() => {});
  }, [id]);

  const isCredit = tx.type === "CREDIT";
  const status = statusConfig[tx.status] ?? statusConfig.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h1 className="font-heading text-xl font-bold">Transaction Details</h1>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Hero Amount Card */}
        <GlassCard neon className="text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${isCredit ? "bg-accent/10" : "bg-destructive/10"}`}
          >
            {isCredit ? (
              <ArrowDownLeft className="w-7 h-7 text-accent" />
            ) : (
              <ArrowUpRight className="w-7 h-7 text-destructive" />
            )}
          </motion.div>
          <p className="text-xs text-muted-foreground font-heading mb-1 capitalize">{tx.category.toLowerCase()}</p>
          <p className={`font-display text-3xl font-bold ${isCredit ? "text-accent" : "text-foreground"}`}>
            {isCredit ? "+" : "-"}₹{tx.amount.toLocaleString()}
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full ${status.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
            <span className={`text-[10px] font-heading font-semibold ${status.color}`}>{status.label}</span>
          </div>
        </GlassCard>

        {/* Balance Snapshot */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-heading font-bold">Balance Snapshot</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground font-heading mb-1">Before</p>
              <p className="font-heading text-base font-bold text-foreground">₹{tx.balanceBefore.toLocaleString()}</p>
            </div>
            <div className="glass rounded-lg p-3 neon-border">
              <p className="text-[10px] text-muted-foreground font-heading mb-1">After</p>
              <p className="font-heading text-base font-bold neon-text-purple">₹{tx.balanceAfter.toLocaleString()}</p>
            </div>
          </div>
        </GlassCard>

        {/* Transaction Info */}
        <GlassCard>
          <h2 className="text-xs font-heading font-bold mb-1">Transaction Info</h2>
          <DetailRow icon={Hash} label="Transaction ID" value={tx.transactionId} copyable mono />
          <DetailRow icon={Tag} label="Type" value={tx.type} />
          <DetailRow icon={Tag} label="Category" value={tx.category} />
          <DetailRow icon={Wallet} label="Currency" value={tx.currency} />
          <DetailRow icon={Calendar} label="Created" value={formatDate(tx.createdAt)} />
          <DetailRow icon={Calendar} label="Updated" value={formatDate(tx.updatedAt)} />
        </GlassCard>

        {/* Reference IDs */}
        <GlassCard>
          <h2 className="text-xs font-heading font-bold mb-1">Reference</h2>
          <DetailRow icon={Hash} label="Wallet ID" value={tx.walletId} copyable mono />
          <DetailRow icon={Hash} label="Idempotency Key" value={tx.idempotencyKey} copyable mono />
          <DetailRow icon={Hash} label="Internal ID" value={tx._id} copyable mono />
        </GlassCard>
      </div>
    </div>
  );
};

export default TransactionDetailScreen;
