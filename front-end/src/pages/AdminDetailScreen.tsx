import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleDollarSign,
  Crown,
  Database,
  ListChecks,
  RefreshCcw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getAdminCollectionRecords,
  getAdminUserTransactionHistory,
  updateCreatorPermission,
  type AdminCollectionRecords,
  type AdminUserTransactionHistory,
  type AdminUserTransactionRecord,
} from "@/api/admin";
import { formatCurrency, formatPrizeSummary, getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";

const formatNumber = (value: number | undefined) => Number(value || 0).toLocaleString("en-IN");

const cleanLabel = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDateTime = (value?: string) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getNestedValue = (record: Record<string, unknown>, path: string) =>
  path.split(".").reduce<unknown>((current, key) => asRecord(current)?.[key], record);

const isRedactedAdminValue = (value: unknown) => value === "[REDACTED]";

const isEmptyAdminValue = (value: unknown) => {
  if (value === undefined || value === null || value === "" || isRedactedAdminValue(value)) return true;
  if (Array.isArray(value)) return value.every(isEmptyAdminValue);
  if (value instanceof Date) return false;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0 || entries.every(([, child]) => isEmptyAdminValue(child));
  }
  return false;
};

const hiddenDetailFields = new Set(["__v"]);

const shouldShowDetailField = ([key, value]: [string, unknown]) =>
  !hiddenDetailFields.has(key) && !isEmptyAdminValue(value);

const summarizeAdminValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (isRedactedAdminValue(value)) return "Hidden";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())) return formatDateTime(value);
    return value;
  }
  if (Array.isArray(value)) return value.length ? `${value.length} items` : "No items";
  if (typeof value === "object") return getRecordTitle(value as Record<string, unknown>);
  return String(value);
};

const getRecordTitle = (record: Record<string, unknown>) => {
  const value = record.username
    || record.title
    || record.name
    || record.email
    || record.phone_number
    || record.transactionId
    || record.url
    || record.status
    || record._id;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return summarizeAdminValue(value);
  }

  const summary = Object.entries(record)
    .filter(shouldShowDetailField)
    .slice(0, 4)
    .map(([key, child]) => `${cleanLabel(key)}: ${summarizeAdminValue(child)}`);

  return summary.length ? summary.join(", ") : "Not set";
};

const statusClass = (value?: string) => {
  const status = String(value || "").toLowerCase();
  if (["success", "completed", "active", "finished", "verified"].includes(status)) return "border-accent/30 bg-accent/10 text-accent";
  if (["pending", "open", "running", "in_progress", "initiated"].includes(status)) return "border-secondary/30 bg-secondary/10 text-secondary";
  if (["failed", "rejected", "removed", "banned", "cancelled"].includes(status)) return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-muted bg-muted/40 text-muted-foreground";
};

const StatusBadge = ({ value }: { value?: string }) => (
  <span className={`inline-flex rounded-full border px-2 py-1 font-heading text-[10px] ${statusClass(value)}`}>
    {cleanLabel(value)}
  </span>
);

type FieldType = "date" | "money" | "status" | "user" | "count" | "prize";
type RecordColumn = { label: string; path: string; type?: FieldType };

const formatFieldValue = (value: unknown, type?: FieldType) => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (type === "money" && typeof value === "number") return formatCurrency(value);
  if (type === "date" && typeof value === "string") return formatDateTime(value);
  if (type === "count" && typeof value === "number") return formatNumber(value);
  if (type === "status") return cleanLabel(String(value));
  if (type === "user") {
    const user = asRecord(value);
    if (user) return String(user.username || user.email || user.phone_number || user._id || "User");
  }
  if (Array.isArray(value)) return value.length ? value.map(summarizeAdminValue).join(", ") : "No items";
  if (typeof value === "object") return getRecordTitle(value as Record<string, unknown>);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const getObjectId = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const text = value.toString();
    if (/^[a-f\d]{24}$/i.test(text)) return text;
  }
  const record = asRecord(value);
  const oid = record?.$oid;
  if (typeof oid === "string") return oid;
  const id = record?._id;
  return typeof id === "string" ? id : "";
};

const getUserLabel = (value: unknown) => {
  const user = asRecord(value);
  if (typeof value === "string") return value;
  if (!user) return "-";
  return String(user.username || user.email || user.phone_number || user._id || "-");
};

const getPaidToDetails = (row: Record<string, unknown>) => {
  const paidTo = asRecord(row.paidTo);
  const player = asRecord(row.player);
  const userId = String(paidTo?.userId || row.userId || getObjectId(row.player) || "-");

  return {
    name: String(paidTo?.username || player?.username || player?.phone_number || player?.email || userId),
    userId,
    gameName: String(paidTo?.gameName || row.gameName || "-"),
    gameId: String(paidTo?.gameId || row.gameId || "-"),
  };
};

const getTournamentPaidTotal = (record: Record<string, unknown>) => {
  const results = Array.isArray(record.results) ? record.results : [];
  return results.reduce((sum, result) => {
    const row = asRecord(result);
    return sum + Number(row?.prizeWon || 0);
  }, 0);
};

const importantFieldOrder = [
  "_id",
  "username",
  "email",
  "phone_number",
  "role",
  "title",
  "name",
  "status",
  "type",
  "game",
  "visibility",
  "amount",
  "balance",
  "entryFee",
  "prizePool",
  "provider",
  "providerOrderId",
  "providerPaymentId",
  "createdAt",
  "updatedAt",
];

const defaultColumns: RecordColumn[] = [
  { label: "Record", path: "_id" },
  { label: "Status", path: "status", type: "status" },
  { label: "Created", path: "createdAt", type: "date" },
  { label: "Updated", path: "updatedAt", type: "date" },
];

const collectionColumns: Record<string, RecordColumn[]> = {
  users: [
    { label: "Username", path: "username" },
    { label: "Email", path: "email" },
    { label: "Phone", path: "phone_number" },
    { label: "Role", path: "role" },
    { label: "Creator Request", path: "creatorRequest.status", type: "status" },
    { label: "Active", path: "isActive" },
    { label: "Joined", path: "createdAt", type: "date" },
  ],
  channels: [
    { label: "Name", path: "name" },
    { label: "Handle", path: "handle" },
    { label: "Owner", path: "owner", type: "user" },
    { label: "Members", path: "memberCount", type: "count" },
    { label: "Active", path: "isActive" },
  ],
  payments: [
    { label: "Provider", path: "provider" },
    { label: "Purpose", path: "meta.purpose", type: "status" },
    { label: "Amount", path: "amount", type: "money" },
    { label: "Status", path: "status", type: "status" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  wallets: [
    { label: "User", path: "user", type: "user" },
    { label: "Balance", path: "balance", type: "money" },
    { label: "Locked", path: "lockedBalance", type: "money" },
    { label: "Updated", path: "updatedAt", type: "date" },
  ],
  walletTransactions: [
    { label: "Type", path: "type", type: "status" },
    { label: "Category", path: "category", type: "status" },
    { label: "Amount", path: "amount", type: "money" },
    { label: "Status", path: "status", type: "status" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  tournaments: [
    { label: "Title", path: "title" },
    { label: "Game", path: "game", type: "status" },
    { label: "Status", path: "status", type: "status" },
    { label: "Entry", path: "entryFee", type: "money" },
    { label: "Prize", path: "prizePool", type: "prize" },
    { label: "Start", path: "startAt", type: "date" },
  ],
  gameAccounts: [
    { label: "User", path: "user", type: "user" },
    { label: "Game", path: "game", type: "status" },
    { label: "Game ID", path: "gameId" },
    { label: "Verified", path: "verified" },
    { label: "Updated", path: "updatedAt", type: "date" },
  ],
  registrations: [
    { label: "User", path: "user", type: "user" },
    { label: "Tournament", path: "tournament" },
    { label: "Status", path: "status", type: "status" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  teams: [
    { label: "Name", path: "name" },
    { label: "Created By", path: "createdBy", type: "user" },
    { label: "Players", path: "players", type: "count" },
    { label: "Tournament", path: "tournament" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  tickets: [
    { label: "Title", path: "title" },
    { label: "User", path: "user", type: "user" },
    { label: "Type", path: "type", type: "status" },
    { label: "Status", path: "status", type: "status" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  adminAuditLogs: [
    { label: "Action", path: "action", type: "status" },
    { label: "Admin", path: "actor", type: "user" },
    { label: "Target", path: "targetUser", type: "user" },
    { label: "Note", path: "note" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
};

const TournamentPayoutDetails = ({
  record,
  onOpenPayout,
}: {
  record: Record<string, unknown>;
  onOpenPayout: (id: string) => void;
}) => {
  const tournamentId = getObjectId(record._id);
  const results = Array.isArray(record.results) ? record.results : [];
  const paidTotal = getTournamentPaidTotal(record);
  const isPaid = results.length > 0 && paidTotal > 0;
  const status = String(record.status || "unknown");
  const canPay = tournamentId && status === "completed";

  return (
    <div className="min-h-0 overflow-y-auto px-6 pb-6 pr-4">
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-glass-border bg-card/50 p-4 lg:col-span-2">
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Tournament</p>
          <h3 className="mt-1 font-heading text-xl font-bold">{formatFieldValue(record.title)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {cleanLabel(String(record.game || ""))} - {cleanLabel(String(record.type || ""))} - {formatDateTime(String(record.startAt || ""))}
          </p>
        </div>
        <div className={`rounded-lg border p-4 ${isPaid ? "border-accent/30 bg-accent/10" : "border-secondary/30 bg-secondary/10"}`}>
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Prize Status</p>
          <p className={`mt-1 font-heading text-xl font-bold ${isPaid ? "text-accent" : "text-secondary"}`}>
            {isPaid ? "Paid" : "Not paid"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{isPaid ? `${formatCurrency(paidTotal)} sent to winners` : "Creator wallet payout is pending"}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-glass-border bg-card/50 p-3">
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Creator</p>
          <p className="mt-1 truncate font-heading text-sm font-bold">{getUserLabel(record.organizer)}</p>
        </div>
        <div className="rounded-lg border border-glass-border bg-card/50 p-3">
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Prize Setup</p>
          <p className="mt-1 font-heading text-sm font-bold">{formatPrizeSummary(record)}</p>
        </div>
        <div className="rounded-lg border border-glass-border bg-card/50 p-3">
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Creator Earnings</p>
          <p className="mt-1 font-heading text-sm font-bold">{formatCurrency(Number(record.organizerEarnings || 0))}</p>
        </div>
        <div className="rounded-lg border border-glass-border bg-card/50 p-3">
          <p className="font-heading text-[10px] uppercase text-muted-foreground">Entry Fee</p>
          <p className="mt-1 font-heading text-sm font-bold">{formatCurrency(Number(record.entryFee || 0))}</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-glass-border bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-heading text-sm font-bold">Winner Payouts</h4>
            <p className="text-xs text-muted-foreground">{isPaid ? "Money transferred from creator wallet to winner wallets." : "Select winners in payout center to transfer money."}</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenPayout(tournamentId)}
            disabled={!canPay}
          >
            {isPaid ? "View Results" : "Pay Winners"}
          </Button>
        </div>

        {results.length === 0 ? (
          <div className="rounded-lg border border-glass-border py-8 text-center">
            <p className="font-heading text-sm">No payout result saved</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status === "completed" ? "Admin can open payout center and pay winners." : "Complete the tournament before paying winners."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((result, index) => {
              const row = asRecord(result) || {};
              const paidTo = getPaidToDetails(row);
              return (
                <div key={String(row._id || index)} className="grid gap-3 rounded-lg border border-glass-border px-3 py-3 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="truncate font-heading text-sm font-semibold">Paid to: {paidTo.name}</p>
                      <p className="break-all text-[10px] text-muted-foreground">User ID: {paidTo.userId}</p>
                    </div>
                    <div className="grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-2">
                      <p className="truncate">Game Name: <span className="font-heading text-foreground">{paidTo.gameName}</span></p>
                      <p className="truncate">Game ID: <span className="font-heading text-foreground">{paidTo.gameId}</span></p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {Number(row.position || 0) > 0 ? `Position #${row.position}` : "Kill based"} - {Number(row.kills || 0)} kills
                    </p>
                  </div>
                  <div className="text-right md:min-w-24">
                    <p className="font-heading text-sm font-bold text-accent">{formatCurrency(Number(row.prizeWon || 0))}</p>
                    <p className="text-[10px] text-muted-foreground">{cleanLabel(String(row.prizeMode || ""))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="rounded-lg border border-glass-border bg-background/60 p-3">
        <summary className="cursor-pointer font-heading text-xs text-muted-foreground">Advanced redacted data</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>
    </div>
  );
};

const sectionConfig: Record<string, { title: string; description: string; icon: LucideIcon; collections: string[] }> = {
  users: { title: "Users", description: "User accounts, role state, contact fields, and account activity", icon: Users, collections: ["users", "wallets"] },
  creators: { title: "Creators", description: "Creator-facing records including users, channels, and subscriptions", icon: Crown, collections: ["users", "channels", "subscriptions"] },
  tournaments: { title: "Tournaments", description: "Tournament records, teams, registrations, and results", icon: Trophy, collections: ["tournaments", "registrations", "teams"] },
  revenue: { title: "Revenue", description: "Payment, ledger, and wallet movement data", icon: CircleDollarSign, collections: ["payments", "walletTransactions", "ledgers"] },
  wallet: { title: "Wallet Flow", description: "Wallet balances, wallet transactions, ledgers, and payments", icon: Wallet, collections: ["wallets", "walletTransactions", "ledgers", "payments"] },
  verified: { title: "Verified IDs", description: "Game account verification and registration records", icon: ShieldCheck, collections: ["gameAccounts", "registrations"] },
  support: { title: "Support", description: "Tickets, reports, notifications, and related users", icon: Ticket, collections: ["tickets", "reports", "notifications", "users"] },
  creatorRequests: { title: "Creator Requests", description: "Pending creator access requests awaiting admin review", icon: Crown, collections: ["users"] },
  finance: { title: "Finance", description: "Payments, withdrawals, wallet transactions, and ledger entries", icon: Wallet, collections: ["payments", "walletTransactions", "ledgers", "wallets"] },
  audit: { title: "Audit Logs", description: "Admin role changes and permission decisions", icon: ListChecks, collections: ["adminAuditLogs"] },
  database: { title: "Database", description: "All redacted database records available to admin users", icon: Database, collections: ["users", "wallets", "payments", "walletTransactions", "ledgers", "tournaments", "registrations", "teams", "channels", "subscriptions", "gameAccounts", "leaderboards", "tickets", "reports", "notifications", "adminAuditLogs"] },
};

const TransactionAmount = ({ record }: { record: AdminUserTransactionRecord }) => {
  const isCredit = String(record.direction || "").toUpperCase() === "CREDIT";
  const isDebit = String(record.direction || "").toUpperCase() === "DEBIT";
  const sign = isCredit ? "+" : isDebit ? "-" : "";
  const color = isCredit ? "text-accent" : isDebit ? "text-destructive" : "text-foreground";

  return (
    <p className={`font-heading text-sm font-bold ${color}`}>
      {sign}{formatCurrency(Number(record.amount || 0))}
    </p>
  );
};

const UserTransactionHistoryPanel = ({
  history,
  loading,
  page,
  onPageChange,
}: {
  history: AdminUserTransactionHistory | null;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) => {
  const records = history?.records ?? [];
  const wallet = history?.wallet;

  return (
    <div className="mb-4 rounded-lg border border-glass-border bg-background/50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="font-heading text-sm font-bold">Wallet & Transaction History</h4>
          <p className="mt-1 text-xs text-muted-foreground">Payments, wallet movements, and ledger entries for this account.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[360px]">
          <div className="rounded-lg border border-glass-border bg-card/50 p-2">
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <p className="font-heading font-bold text-accent">{formatCurrency(wallet?.balance || 0)}</p>
          </div>
          <div className="rounded-lg border border-glass-border bg-card/50 p-2">
            <p className="text-[10px] text-muted-foreground">Locked</p>
            <p className="font-heading font-bold text-secondary">{formatCurrency(wallet?.lockedBalance || 0)}</p>
          </div>
          <div className="rounded-lg border border-glass-border bg-card/50 p-2">
            <p className="text-[10px] text-muted-foreground">Entries</p>
            <p className="font-heading font-bold">{formatNumber(history?.totals.all || 0)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-glass-border py-8 text-center">
          <p className="font-heading text-sm">No transactions found</p>
          <p className="mt-1 text-xs text-muted-foreground">This user has no payments, wallet moves, or ledger entries yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div key={`${record.source}-${record._id}`} className="grid gap-3 rounded-lg border border-glass-border bg-card/40 px-3 py-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-glass-border px-2 py-0.5 font-heading text-[10px] text-muted-foreground">
                    {cleanLabel(record.source)}
                  </span>
                  <StatusBadge value={record.status} />
                </div>
                <p className="mt-2 truncate font-heading text-sm font-semibold">{cleanLabel(record.title || record.category || "Transaction")}</p>
                <p className="mt-1 break-all text-[10px] text-muted-foreground">{record.transactionId || record.referenceId || record._id}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(record.createdAt)}</p>
              </div>
              <div className="text-left md:min-w-32 md:text-right">
                <TransactionAmount record={record} />
                {record.platformFee ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">Fee {formatCurrency(record.platformFee)}</p>
                ) : null}
                {record.balanceAfter !== undefined ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">After {formatCurrency(record.balanceAfter)}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {history && history.pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Page {history.page} / {history.pages}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onPageChange(Math.max(page - 1, 1))} disabled={page <= 1 || loading}>
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= history.pages || loading}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDetailScreen = () => {
  const navigate = useNavigate();
  const { section = "database" } = useParams<{ section: string }>();
  const config = sectionConfig[section] ?? sectionConfig.database;
  const [activeCollection, setActiveCollection] = useState(config.collections[0]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AdminCollectionRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [updatingPermission, setUpdatingPermission] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<AdminUserTransactionHistory | null>(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const Icon = config.icon;

  useEffect(() => {
    setActiveCollection(config.collections[0]);
    setPage(1);
    setSearch("");
    setData(null);
  }, [config.collections, section]);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminCollectionRecords(activeCollection, {
        page,
        limit: 25,
        search,
        creatorRequestStatus: section === "creatorRequests" && activeCollection === "users" ? "pending" : undefined,
      });
      setData(res.data);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Load admin details", fallback: "Failed to load records." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  }, [activeCollection, page, search, section]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const columns = collectionColumns[activeCollection] ?? defaultColumns;
  const detailEntries = selectedRecord
    ? Object.entries(selectedRecord).filter(shouldShowDetailField).sort(([a], [b]) => {
        const aIndex = importantFieldOrder.indexOf(a);
        const bIndex = importantFieldOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
    : [];
  const selectedCreatorRequest = asRecord(selectedRecord?.creatorRequest);
  const selectedUserId = getObjectId(selectedRecord?._id);
  const selectedWalletUserId = getObjectId(selectedRecord?.user);
  const transactionUserId = activeCollection === "users"
    ? selectedUserId
    : activeCollection === "wallets"
      ? selectedWalletUserId
      : "";
  const selectedRoles = Array.isArray(selectedRecord?.role)
    ? selectedRecord.role.map(String)
    : selectedRecord?.role
      ? [String(selectedRecord.role)]
      : [];
  const isSelectedCreator = selectedRoles.includes("creator");
  const creatorRequestStatus = String(selectedCreatorRequest?.status || "none").toLowerCase();

  useEffect(() => {
    setTransactionPage(1);
    setTransactionHistory(null);
  }, [transactionUserId]);

  useEffect(() => {
    if (!transactionUserId) {
      setTransactionHistory(null);
      return;
    }

    let cancelled = false;
    setTransactionLoading(true);

    getAdminUserTransactionHistory(transactionUserId, { page: transactionPage, limit: 10 })
      .then((res) => {
        if (!cancelled) setTransactionHistory(res.data);
      })
      .catch((error) => {
        if (cancelled) return;
        const errorToast = getErrorToast(error, { action: "Load transactions", fallback: "Could not load transaction history." });
        toast.error(errorToast.title, { description: errorToast.description });
      })
      .finally(() => {
        if (!cancelled) setTransactionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transactionPage, transactionUserId]);

  const handleCreatorPermission = async (status: "approved" | "rejected" | "removed") => {
    if (!selectedUserId) {
      toast.error("User ID missing", { description: "Reload this page and open the user again." });
      return;
    }
    const note = window.prompt(
      status === "approved"
        ? "Approval message for user (optional)"
        : status === "removed"
          ? "Why are you removing creator access? This message will be sent."
          : "Why are you rejecting this creator request? This message will be sent.",
    )?.trim();
    if (note === undefined) return;

    try {
      setUpdatingPermission(true);
      const res = await updateCreatorPermission(selectedUserId, { status, note });
      const updatedUser = asRecord(res.data.user);
      if (updatedUser) {
        setSelectedRecord(updatedUser);
        setData((current) => current
          ? {
              ...current,
              records: current.records.map((record) => getObjectId(record._id) === selectedUserId ? updatedUser : record),
            }
          : current);
      }
      toast.success(res.message || (status === "approved" ? "Creator access approved" : status === "removed" ? "Creator access removed" : "Creator access rejected"));
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Update creator permission", fallback: "Could not update creator permission." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingPermission(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-10 sm:px-5">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg glass">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="flex items-center gap-2 font-heading text-2xl font-bold">
                <Icon className={`h-5 w-5 ${section === "verified" ? "text-accent" : "text-primary"}`} />
                {config.title} Details
              </h1>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={loadRecords} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <GlassCard>
          <div className="mb-4 flex flex-wrap gap-2">
            {config.collections.map((collection) => (
              <button
                key={collection}
                type="button"
                onClick={() => {
                  setActiveCollection(collection);
                  setPage(1);
                  setData(null);
                }}
                className={`rounded-lg border px-3 py-2 font-heading text-xs transition-colors ${
                  activeCollection === collection
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-glass-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cleanLabel(collection)}
              </button>
            ))}
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-2 rounded-lg border border-glass-border bg-background px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search username, title, name, email, phone, status"
                className="min-w-0 flex-1 bg-transparent text-sm font-heading outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <Button type="button" variant="outline" onClick={loadRecords} disabled={loading}>
              Load
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !data || data.records.length === 0 ? (
            <div className="rounded-lg border border-glass-border py-10 text-center">
              <p className="font-heading text-sm">No records found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another section, table, or search term.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Showing {data.records.length} of {formatNumber(data.total)} records from {data.label}
                </span>
                <span>
                  Page {data.page} / {Math.max(data.pages, 1)}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={`${column.path}-${column.label}`}>{column.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((record, index) => (
                    <TableRow key={String(record._id ?? index)}>
                      {columns.map((column) => {
                        const value = getNestedValue(record, column.path);
                        const displayValue = column.type === "prize" ? formatPrizeSummary(record) : formatFieldValue(value, column.type);
                        const isStatus = column.type === "status" || column.path === "status";
                        return (
                          <TableCell key={`${record._id ?? index}-${column.path}`} className="max-w-[220px]">
                            {isStatus ? (
                              <StatusBadge value={displayValue} />
                            ) : (
                              <span className="block truncate text-sm" title={displayValue}>
                                {displayValue}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRecord(record)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1}>
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => value + 1)} disabled={page >= data.pages}>
                  Next
                </Button>
              </div>
            </>
          )}
        </GlassCard>

        <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
            <DialogHeader className="border-b border-glass-border px-6 pb-4 pt-6 pr-12">
              <DialogTitle className="font-heading">Record Details</DialogTitle>
              <DialogDescription>Only populated fields are shown. Sensitive fields are redacted before display.</DialogDescription>
            </DialogHeader>
            {selectedRecord && activeCollection === "tournaments" ? (
              <TournamentPayoutDetails
                record={selectedRecord}
                onOpenPayout={(id) => {
                  if (!id) return;
                  setSelectedRecord(null);
                  navigate(`/tournament/${id}/distribute-prizes`);
                }}
              />
            ) : selectedRecord && (
              <div className="min-h-0 overflow-y-auto px-6 pb-6 pr-4">
                {activeCollection === "users" && (
                  <div className="mb-4 rounded-lg border border-glass-border bg-background/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-sm font-bold">Creator Permission</p>
                          <StatusBadge value={isSelectedCreator ? "active" : creatorRequestStatus} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isSelectedCreator
                            ? "This user can create tournaments."
                            : `Current request: ${cleanLabel(creatorRequestStatus)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isSelectedCreator && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleCreatorPermission("approved")}
                            disabled={updatingPermission}
                          >
                            {updatingPermission ? "Updating..." : "Approve Creator"}
                          </Button>
                        )}
                        {!isSelectedCreator && creatorRequestStatus === "pending" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreatorPermission("rejected")}
                            disabled={updatingPermission}
                          >
                            Reject
                          </Button>
                        )}
                        {isSelectedCreator && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCreatorPermission("removed")}
                            disabled={updatingPermission}
                          >
                            {updatingPermission ? "Updating..." : "Remove Creator"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {transactionUserId && (
                  <UserTransactionHistoryPanel
                    history={transactionHistory}
                    loading={transactionLoading}
                    page={transactionPage}
                    onPageChange={setTransactionPage}
                  />
                )}
                {detailEntries.length === 0 ? (
                  <div className="mb-4 rounded-lg border border-glass-border py-10 text-center">
                    <p className="font-heading text-sm">No displayable fields</p>
                    <p className="mt-1 text-xs text-muted-foreground">This record only contains empty or redacted values.</p>
                  </div>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {detailEntries.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-glass-border bg-card/50 p-3">
                        <p className="mb-1 font-heading text-[10px] uppercase text-muted-foreground">{cleanLabel(key)}</p>
                        <p className="break-words text-sm text-foreground">{formatFieldValue(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <details className="rounded-lg border border-glass-border bg-background/60 p-3">
                  <summary className="cursor-pointer font-heading text-xs text-muted-foreground">Advanced redacted data</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDetailScreen;
