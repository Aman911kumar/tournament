import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Hash,
  Receipt,
  RefreshCcw,
  Tag,
  XCircle,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getPaymentDetail, type PaymentDetail } from "@/api/wallet";
import { formatCurrency, getErrorMessage } from "@/lib/page-utils";
import { copyText } from "@/lib/clipboard";
import { WalletShell } from "@/components/wallet/WalletShell";

const statusConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-accent",
    bg: "bg-accent/10",
    label: "Success",
  },
  initiated: {
    icon: Clock,
    color: "text-secondary",
    bg: "bg-secondary/10",
    label: "Initiated",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Failed",
  },
  cancelled: {
    icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
    label: "Cancelled",
  },
  refunded: {
    icon: RefreshCcw,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Refunded",
  },
  pending: {
    icon: Clock,
    color: "text-secondary",
    bg: "bg-secondary/10",
    label: "Pending",
  },
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
        <span className="font-heading text-xs">{label}</span>
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
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

const stringifyResponse = (value: unknown) => {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const PaymentDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getPaymentDetail(id);
      setPayment(res.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load payment."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  const details = useMemo(() => {
    if (!payment) return null;
    const status = statusConfig[payment.status] ?? statusConfig.initiated;
    const isWithdrawal = payment.meta?.purpose === "withdrawal";
    const gatewayStatus = payment.meta?.razorpayOrder?.status;
    const responseText = stringifyResponse(payment.meta?.razorpayResponse);

    return {
      status,
      StatusIcon: status.icon,
      gatewayStatus,
      responseText,
      isWithdrawal,
    };
  }, [payment]);

  return (
    <WalletShell
      title="Payment Details"
      subtitle="Gateway status and wallet settlement trail"
      icon={Receipt}
      maxWidth="max-w-3xl"
    >
      {loading && (
        <section className="wallet-flow-hero rounded-2xl border border-glass-border p-3 sm:p-5">
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted" />
            <div className="mx-auto h-8 w-40 rounded bg-muted" />
            <div className="h-28 rounded bg-muted" />
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="wallet-flow-panel rounded-2xl px-3 py-8 text-center">
          <AlertCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
          <p className="font-heading text-sm">Could not load payment</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <button
            onClick={loadPayment}
            className="mt-4 inline-flex items-center gap-1.5 font-heading text-xs text-primary"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </button>
        </section>
      )}

      {!loading && !error && payment && details && (
        <>
          <section className="wallet-flow-hero relative overflow-hidden rounded-2xl border border-glass-border p-4 text-center sm:p-5">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-secondary/10 blur-xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${details.status.bg}`}
            >
              <details.StatusIcon
                className={`h-7 w-7 ${details.status.color}`}
              />
            </motion.div>
            <p className="mb-1 font-heading text-xs text-muted-foreground">
              {details.isWithdrawal
                ? "Withdrawal Payout"
                : `${payment.provider} Payment`}
            </p>
            <p className="font-display text-[clamp(2rem,10vw,2.5rem)] font-bold leading-tight text-foreground">
              {formatCurrency(payment.amount)}
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${details.status.bg}`}
            >
              <details.StatusIcon
                className={`h-3.5 w-3.5 ${details.status.color}`}
              />
              <span
                className={`font-heading text-[10px] font-semibold ${details.status.color}`}
              >
                {details.status.label}
              </span>
            </div>
          </section>

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-secondary" />
              <h2 className="font-heading text-xs font-bold">Gateway Info</h2>
            </div>
            <DetailRow icon={Tag} label="Provider" value={payment.provider} />
            <DetailRow
              icon={Tag}
              label="Purpose"
              value={payment.meta?.purpose}
            />
            <DetailRow icon={Tag} label="Method" value={payment.meta?.method} />
            <DetailRow
              icon={Tag}
              label="Destination"
              value={payment.meta?.destination}
              copyable
            />
            <DetailRow
              icon={Hash}
              label="Order ID"
              value={payment.providerOrderId}
              copyable
              mono
            />
            <DetailRow
              icon={Hash}
              label="Payment ID"
              value={payment.providerPaymentId}
              copyable
              mono
            />
            <DetailRow
              icon={Tag}
              label="Gateway Status"
              value={details.gatewayStatus}
            />
            <DetailRow icon={Tag} label="Reason" value={payment.meta?.reason} />
            <DetailRow
              icon={Hash}
              label="Payout Reference"
              value={payment.meta?.payoutReference}
              copyable
              mono
            />
            <DetailRow
              icon={Hash}
              label="Receipt"
              value={payment.meta?.razorpayOrder?.receipt}
              copyable
              mono
            />
          </section>

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-xs font-bold">Timeline</h2>
            </div>
            <DetailRow
              icon={Calendar}
              label="Created"
              value={formatDate(payment.createdAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Updated"
              value={formatDate(payment.updatedAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Requested"
              value={formatDate(payment.meta?.requestedAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Admin Paid"
              value={formatDate(payment.meta?.adminPaidAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Verified"
              value={formatDate(payment.meta?.verifiedAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Failed At"
              value={formatDate(payment.meta?.verificationFailedAt)}
            />
            <DetailRow
              icon={Calendar}
              label="Client Update"
              value={formatDate(payment.meta?.clientStatusUpdatedAt)}
            />
          </section>

          <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
            <h2 className="mb-1 font-heading text-xs font-bold">Reference</h2>
            <DetailRow
              icon={Hash}
              label="Internal ID"
              value={payment._id}
              copyable
              mono
            />
            <DetailRow icon={Tag} label="Currency" value={payment.currency} />
          </section>

          {details.responseText && (
            <section className="wallet-flow-panel rounded-2xl p-3 sm:p-5">
              <h2 className="mb-3 font-heading text-xs font-bold">
                Gateway Response
              </h2>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-[10px] text-muted-foreground">
                {details.responseText}
              </pre>
            </section>
          )}
        </>
      )}
    </WalletShell>
  );
};

export default PaymentDetailScreen;
