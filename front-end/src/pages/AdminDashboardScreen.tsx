import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CircleDollarSign,
  Database,
  Crown,
  LayoutDashboard,
  ListChecks,
  RefreshCcw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminDashboardData,
  AdminCollectionRecords,
  AdminCollectionSummary,
  AdminWithdrawalRequest,
  CountBucket,
  getAdminCollectionRecords,
  getAdminCollections,
  getAdminDashboard,
  getAdminWithdrawals,
  updateCreatorPermission,
  updateWithdrawalStatus,
} from "@/api/admin";
import { formatCurrency, formatPrizeSummary, getErrorMessage, getErrorToast } from "@/lib/page-utils";

const bucketColors = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--neon-pink))",
  "hsl(var(--destructive))",
];

const formatNumber = (value: number | undefined) => Number(value || 0).toLocaleString("en-IN");

const formatShortDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

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
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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

const SectionHeader = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
    {action}
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  note,
  color,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  color: string;
  onClick?: () => void;
}) => (
  <GlassCard
    className={`min-h-[112px] ${onClick ? "cursor-pointer transition-all hover:neon-border" : ""}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-muted-foreground font-heading">{label}</p>
        <p className="mt-2 font-heading text-2xl font-bold leading-tight truncate">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground truncate">{note}</p>
  </GlassCard>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">{text}</div>
);

const DistributionList = ({ data }: { data: CountBucket[] }) => (
  <div className="space-y-3">
    {data.length === 0 ? (
      <p className="text-sm text-muted-foreground">No data yet</p>
    ) : (
      data.map((item, index) => (
        <div key={`${item._id}-${index}`} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: bucketColors[index % bucketColors.length] }}
            />
            <span className="text-sm font-heading truncate">{cleanLabel(item._id)}</span>
          </div>
          <span className="text-sm font-heading text-muted-foreground">{formatNumber(item.count)}</span>
        </div>
      ))
    )}
  </div>
);

const InsightBar = ({ label, count, total }: { label: string; count: number; total: number }) => {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-heading">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span>{formatNumber(count)} - {percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(percent, count ? 8 : 0)}%` }} />
      </div>
    </div>
  );
};

const getRecordSubtitle = (record: Record<string, unknown>) => {
  const parts = [record.status, record.role, record.type, record.game]
    .filter(Boolean)
    .map((value) => (Array.isArray(value) ? value.join(", ") : String(value)));
  return parts.length ? parts.join(" - ") : "Record";
};

const getRecordAmount = (record: Record<string, unknown>) => {
  const value = record.amount || record.balance || record.entryFee || record.prizePool;
  return typeof value === "number" ? formatCurrency(value) : "";
};

const getAdminUserLabel = (user?: { username?: string; email?: string; phone_number?: string } | null) =>
  user?.username || user?.email || user?.phone_number || "System";

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

const formatFieldValue = (value: unknown, type?: "date" | "money" | "status" | "user" | "count" | "prize") => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (type === "money" && typeof value === "number") return formatCurrency(value);
  if (type === "date" && typeof value === "string") return formatDateTime(value);
  if (type === "count" && typeof value === "number") return formatNumber(value);
  if (type === "status") return cleanLabel(String(value));
  if (type === "user") {
    const user = asRecord(value);
    if (user) return String(user.username || user.email || user.phone_number || user._id || "User");
  }
  if (Array.isArray(value)) {
    return value.length
      ? value.map(summarizeAdminValue).join(", ")
      : "No items";
  }
  if (typeof value === "object") return getRecordTitle(value as Record<string, unknown>);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

type RecordColumn = {
  label: string;
  path: string;
  type?: "date" | "money" | "status" | "user" | "count" | "prize";
};

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
  payments: [
    { label: "Provider", path: "provider" },
    { label: "Purpose", path: "meta.purpose", type: "status" },
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
    { label: "Created", path: "createdAt", type: "date" },
  ],
  channels: [
    { label: "Name", path: "name" },
    { label: "Handle", path: "handle" },
    { label: "Owner", path: "owner", type: "user" },
    { label: "Members", path: "memberCount", type: "count" },
    { label: "Active", path: "isActive" },
  ],
  gameAccounts: [
    { label: "User", path: "user", type: "user" },
    { label: "Game", path: "game", type: "status" },
    { label: "Game ID", path: "gameId" },
    { label: "Verified", path: "verified" },
    { label: "Updated", path: "updatedAt", type: "date" },
  ],
  tickets: [
    { label: "Title", path: "title" },
    { label: "User", path: "user", type: "user" },
    { label: "Type", path: "type", type: "status" },
    { label: "Status", path: "status", type: "status" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  reports: [
    { label: "Type", path: "type", type: "status" },
    { label: "Status", path: "status", type: "status" },
    { label: "User", path: "user", type: "user" },
    { label: "Created", path: "createdAt", type: "date" },
  ],
  notifications: [
    { label: "Title", path: "title" },
    { label: "User", path: "user", type: "user" },
    { label: "Read", path: "read" },
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

const formatDetailValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "No items";
  if (typeof value === "object") return getRecordTitle(value as Record<string, unknown>);
  return String(value);
};

const AdminDashboardScreen = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRequest[]>([]);
  const [collections, setCollections] = useState<AdminCollectionSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("users");
  const [collectionData, setCollectionData] = useState<AdminCollectionRecords | null>(null);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [adminTournamentSearch, setAdminTournamentSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [updatingWithdrawalId, setUpdatingWithdrawalId] = useState<string | null>(null);
  const [updatingCreatorId, setUpdatingCreatorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminDashboard(days);
      setDashboard(res.data);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load admin dashboard.");
      setError(message);
      const errorToast = getErrorToast(err, { action: "Load admin dashboard", fallback: "Failed to load admin dashboard." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  }, [days]);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setWithdrawalsLoading(true);
      const res = await getAdminWithdrawals("pending");
      setWithdrawals(res.data);
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Load withdrawals", fallback: "Failed to load withdrawal requests." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setWithdrawalsLoading(false);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await getAdminCollections();
      setCollections(res.data);
      const nonEmptyCollections = res.data.filter((item) => item.count > 0);
      const selectableCollections = nonEmptyCollections.length > 0 ? nonEmptyCollections : res.data;
      if (!selectableCollections.some((item) => item.key === selectedCollection) && selectableCollections[0]) {
        setSelectedCollection(selectableCollections[0].key);
      }
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Load database collections", fallback: "Failed to load database collections." });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  }, [selectedCollection]);

  const fetchCollectionRecords = useCallback(async () => {
    if (!selectedCollection) return;
    try {
      setCollectionsLoading(true);
      const res = await getAdminCollectionRecords(selectedCollection, {
        page: collectionPage,
        limit: 25,
        search: collectionSearch,
      });
      setCollectionData(res.data);
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Load database records", fallback: "Failed to load records." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setCollectionsLoading(false);
    }
  }, [collectionPage, collectionSearch, selectedCollection]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    fetchCollectionRecords();
  }, [fetchCollectionRecords]);

  const handleMarkWithdrawalPaid = async (withdrawal: AdminWithdrawalRequest) => {
    const payoutReference = window.prompt("Enter payout reference / UTR (optional)")?.trim() ?? "";
    try {
      setUpdatingWithdrawalId(withdrawal._id);
      await updateWithdrawalStatus(withdrawal._id, { status: "success", payoutReference });
      toast.success("Withdrawal marked as paid", {
        description: `${formatCurrency(withdrawal.amount)} payout status updated successfully.`,
      });
      fetchWithdrawals();
      fetchDashboard();
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Mark withdrawal paid", fallback: "Failed to update withdrawal." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  const handleMarkWithdrawalFailed = async (withdrawal: AdminWithdrawalRequest) => {
    const reason = window.prompt("Why did this payout fail? The wallet amount will be refunded.")?.trim();
    if (reason === undefined) return;

    try {
      setUpdatingWithdrawalId(withdrawal._id);
      await updateWithdrawalStatus(withdrawal._id, { status: "failed", reason });
      toast.success("Withdrawal marked as failed", {
        description: `${formatCurrency(withdrawal.amount)} refunded to the user's wallet.`,
      });
      fetchWithdrawals();
      fetchDashboard();
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Mark withdrawal failed", fallback: "Failed to update withdrawal." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  const handleCancelWithdrawal = async (withdrawal: AdminWithdrawalRequest) => {
    const reason = window.prompt("Cancel reason (optional). The wallet amount will be refunded.")?.trim();
    if (reason === undefined) return;

    try {
      setUpdatingWithdrawalId(withdrawal._id);
      await updateWithdrawalStatus(withdrawal._id, { status: "cancelled", reason });
      toast.success("Withdrawal cancelled", {
        description: `${formatCurrency(withdrawal.amount)} refunded to the user's wallet.`,
      });
      fetchWithdrawals();
      fetchDashboard();
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Cancel withdrawal", fallback: "Failed to cancel withdrawal." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  const handleCreatorPermission = async (
    user: { _id: string; username?: string; email?: string; phone_number?: string },
    status: "approved" | "rejected" | "removed",
  ) => {
    const label = user.username || user.email || user.phone_number || "this user";
    const promptText = status === "approved"
      ? `Approval message for ${label} (optional)`
      : status === "removed"
        ? `Why are you removing creator access for ${label}? This message will be sent.`
        : `Why are you rejecting ${label}? This message will be sent.`;
    const note = window.prompt(promptText)?.trim();
    if (note === undefined) return;

    try {
      setUpdatingCreatorId(user._id);
      await updateCreatorPermission(user._id, { status, note });
      toast.success(status === "approved" ? "Creator approved" : status === "removed" ? "Creator access removed" : "Creator rejected");
      fetchDashboard();
      if (selectedCollection === "users") fetchCollectionRecords();
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Update creator permission", fallback: "Could not update creator permission." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setUpdatingCreatorId(null);
    }
  };

  const activityData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.usersByDay.map((row, index) => ({
      date: formatShortDate(row.date),
      users: row.count,
      tournaments: dashboard.charts.tournamentsByDay[index]?.count || 0,
    }));
  }, [dashboard]);

  const revenueData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.revenueByDay.map((row) => ({
      date: formatShortDate(row.date),
      amount: row.amount,
      payments: row.count,
    }));
  }, [dashboard]);

  const statusData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.tournamentsByStatus.map((item, index) => ({
      name: cleanLabel(item._id),
      value: item.count,
      fill: bucketColors[index % bucketColors.length],
    }));
  }, [dashboard]);

  const gameData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.tournamentsByGame.map((item) => ({
      game: cleanLabel(item._id),
      count: item.count,
    }));
  }, [dashboard]);

  const tournamentMixRows = useMemo(() => {
    if (!dashboard) return [];
    const byStatus = new Map(dashboard.charts.tournamentsByStatus.map((item) => [String(item._id || "unknown"), item.count]));
    return ["running", "open", "completed", "cancelled", "draft"].map((status) => ({
      label: status === "running" ? "Live" : cleanLabel(status),
      count: byStatus.get(status) || 0,
    }));
  }, [dashboard]);

  const tournamentGameRows = useMemo(() => {
    if (!dashboard) return [];
    const max = Math.max(...dashboard.charts.tournamentsByGame.map((item) => item.count), 1);
    return dashboard.charts.tournamentsByGame.map((item) => ({
      label: cleanLabel(item._id),
      count: item.count,
      width: Math.max(8, Math.round((item.count / max) * 100)),
    }));
  }, [dashboard]);

  const filteredAdminTournaments = useMemo(() => {
    if (!dashboard) return [];
    const query = adminTournamentSearch.trim().toLowerCase();
    if (!query) return dashboard.tables.recentTournaments;

    return dashboard.tables.recentTournaments.filter((tournament) => {
      const values = [
        tournament.title,
        tournament.game,
        tournament.type,
        tournament.status,
        tournament.visibility,
        tournament.organizer?.username,
        tournament.channel?.name,
        tournament.channel?.handle,
      ];
      return values.some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [adminTournamentSearch, dashboard]);

  const visibleCollections = useMemo(() => {
    const nonEmptyCollections = collections.filter((collection) => collection.count > 0);
    return nonEmptyCollections.length > 0 ? nonEmptyCollections : collections;
  }, [collections]);

  const activeCollectionColumns = collectionColumns[selectedCollection] ?? defaultColumns;
  const selectedRecordEntries = selectedRecord
    ? Object.entries(selectedRecord).filter(shouldShowDetailField).sort(([a], [b]) => {
        const aIndex = importantFieldOrder.indexOf(a);
        const bIndex = importantFieldOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
    : [];

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <div className="h-12 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
              <div key={item} className="h-28 glass rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="h-80 glass rounded-xl animate-pulse" />
            <div className="h-80 glass rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto w-full max-w-xl">
          <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <GlassCard className="text-center py-10">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <h1 className="font-heading text-lg font-bold">Admin dashboard unavailable</h1>
            <p className="text-sm text-muted-foreground mt-2 break-words">{error}</p>
            <Button onClick={fetchDashboard} className="mt-5">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const kpis = [
    {
      icon: Users,
      label: "Users",
      value: formatNumber(dashboard.totals.users),
      note: `${formatNumber(dashboard.totals.activeUsers)} active, ${formatNumber(dashboard.totals.bannedUsers)} banned`,
      color: "text-primary",
      onClick: () => navigate("/admin/details/users"),
    },
    {
      icon: Crown,
      label: "Creators",
      value: formatNumber(dashboard.totals.creators),
      note: `${formatNumber(dashboard.totals.channels)} channels, ${formatNumber(dashboard.totals.channelMembers)} members`,
      color: "text-secondary",
      onClick: () => navigate("/admin/details/creators"),
    },
    {
      icon: Trophy,
      label: "Tournaments",
      value: formatNumber(dashboard.totals.tournaments),
      note: `${formatNumber(dashboard.totals.openTournaments)} open, ${formatNumber(dashboard.totals.runningTournaments)} running`,
      color: "text-accent",
      onClick: () => navigate("/admin/details/tournaments"),
    },
    {
      icon: CircleDollarSign,
      label: "Revenue",
      value: formatCurrency(dashboard.totals.totalRevenue),
      note: `${formatNumber(dashboard.totals.successfulPayments)} successful payments`,
      color: "text-neon-pink",
      onClick: () => navigate("/admin/details/revenue"),
    },
    {
      icon: Wallet,
      label: "Wallet Flow",
      value: formatCurrency(dashboard.totals.netWalletFlow),
      note: `${formatCurrency(dashboard.totals.walletCredits)} in, ${formatCurrency(dashboard.totals.walletDebits)} out`,
      color: "text-primary",
      onClick: () => navigate("/admin/details/wallet"),
    },
    {
      icon: ShieldCheck,
      label: "Verified IDs",
      value: formatNumber(dashboard.totals.verifiedGameAccounts),
      note: `${formatNumber(dashboard.totals.registrations)} tournament registrations`,
      color: "text-secondary",
      onClick: () => navigate("/admin/details/verified"),
    },
    {
      icon: Ticket,
      label: "Support",
      value: formatNumber(dashboard.totals.openTickets),
      note: "Open or in-progress tickets",
      color: "text-destructive",
      onClick: () => navigate("/admin/details/support"),
    },
  ];
  const tournamentFinance = dashboard.tournamentAnalytics?.finance ?? {};
  const tournamentReceived = Number(tournamentFinance.receivedMoney || 0);
  const tournamentPrizePaid = Number(tournamentFinance.prizePaid || 0);
  const tournamentPlatformFees = Number(tournamentFinance.platformFees || 0);
  const tournamentPendingPrizes = Number(tournamentFinance.pendingPrizes || 0);
  const payoutRate = tournamentReceived > 0
    ? Math.min(100, Math.round((tournamentPrizePaid / tournamentReceived) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background px-3 py-5 pb-10 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg glass"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Operations, payouts, analytics, and platform activity</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {[7, 30, 90].map((range) => (
              <Button
                key={range}
                type="button"
                size="sm"
                variant={days === range ? "default" : "outline"}
                onClick={() => setDays(range)}
                className="min-w-0 sm:min-w-16"
              >
                {range}d
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                fetchDashboard();
                fetchWithdrawals();
              }}
              disabled={loading || withdrawalsLoading}
              className="col-span-1 sm:col-span-1"
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading || withdrawalsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <GlassCard className="mb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <UserCheck className="h-4 w-4 text-secondary" />
                Become Creator Requests
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(dashboard.totals.pendingCreatorRequests)} users waiting for admin permission
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/details/creatorRequests")}>
              View Requests
            </Button>
          </div>

          {dashboard.tables.creatorRequests.length === 0 ? (
            <div className="mt-4 rounded-lg border border-glass-border py-6 text-center">
              <p className="font-heading text-sm">No creator requests pending</p>
              <p className="mt-1 text-xs text-muted-foreground">New requests will appear here first.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {dashboard.tables.creatorRequests.map((user) => (
                <div key={user._id} className="rounded-lg border border-glass-border bg-background/40 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm font-semibold">{user.username || user.email || user.phone_number}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email || user.phone_number || "No contact saved"}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Requested {formatDateTime(user.creatorRequest?.requestedAt)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleCreatorPermission(user, "approved")}
                        disabled={updatingCreatorId === user._id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreatorPermission(user, "rejected")}
                        disabled={updatingCreatorId === user._id}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>

        <div className="mb-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold">Tournament Control</h2>
              <p className="text-xs text-muted-foreground">Overall stats, payouts, visibility, and quick search</p>
            </div>
            <div className="flex w-full items-center gap-2 rounded-lg border border-glass-border bg-background px-3 py-2 lg:max-w-md">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={adminTournamentSearch}
                onChange={(event) => setAdminTournamentSearch(event.target.value)}
                placeholder="Search tournament, creator, game, status"
                className="min-w-0 flex-1 bg-transparent text-sm font-heading outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
                    <Trophy className="h-4 w-4 text-primary" />
                    Tournament Mix
                  </h3>
                  <p className="text-xs text-muted-foreground">Lifecycle and visibility summary</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-sm text-primary">{formatNumber(dashboard.totals.tournaments)} total</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatNumber(dashboard.totals.publicTournaments)} public, {formatNumber(dashboard.totals.privateTournaments)} private
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {tournamentMixRows.map((row) => (
                  <InsightBar key={row.label} label={row.label} count={row.count} total={dashboard.totals.tournaments} />
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
                    <ShieldCheck className="h-4 w-4 text-secondary" />
                    Payout Health
                  </h3>
                  <p className="text-xs text-muted-foreground">Entry fees, deductions, and prize distribution</p>
                </div>
                <span className="font-heading text-xs text-secondary">{payoutRate}% paid</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-secondary" style={{ width: `${payoutRate}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Entry collected</p>
                  <p className="font-heading font-bold text-accent">{formatCurrency(tournamentReceived)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Prize paid</p>
                  <p className="font-heading font-bold text-secondary">{formatCurrency(tournamentPrizePaid)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Platform fees</p>
                  <p className="font-heading font-bold text-primary">{formatCurrency(tournamentPlatformFees)}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/35 p-3">
                  <p className="text-[10px] text-muted-foreground">Pending prizes</p>
                  <p className="font-heading font-bold text-destructive">{formatCurrency(tournamentPendingPrizes)}</p>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-bold">Game Performance</h3>
                <span className="text-[10px] text-muted-foreground">By created tournaments</span>
              </div>
              {tournamentGameRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tournament game data yet.</p>
              ) : (
                <div className="space-y-3">
                  {tournamentGameRows.map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-[10px] font-heading">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span>{formatNumber(row.count)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${row.width}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-bold">Quick Search</h3>
                <Button size="sm" variant="outline" onClick={() => navigate("/admin/details/tournaments")}>All</Button>
              </div>
              <div className="space-y-2">
                {filteredAdminTournaments.length === 0 ? (
                  <p className="rounded-lg border border-glass-border py-8 text-center text-sm text-muted-foreground">
                    No tournament records match this search.
                  </p>
                ) : (
                  filteredAdminTournaments.slice(0, 5).map((tournament) => (
                    <button
                      key={tournament._id}
                      type="button"
                      onClick={() => navigate("/admin/details/tournaments")}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-glass-border bg-background/35 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-semibold">{tournament.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {cleanLabel(tournament.game)} - {tournament.organizer?.username || "Unknown creator"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge value={tournament.status} />
                        {tournament.visibility === "private" && <p className="mt-1 text-[10px] text-muted-foreground">Private</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-card/60 p-1 md:grid-cols-6">
            <TabsTrigger value="overview" className="gap-2 text-xs">
              <LayoutDashboard className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2 text-xs">
              <Wallet className="h-3.5 w-3.5" /> Finance
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="gap-2 text-xs">
              <Trophy className="h-3.5 w-3.5" /> Tournaments
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 text-xs">
              <Users className="h-3.5 w-3.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2 text-xs">
              <Ticket className="h-3.5 w-3.5" /> Support
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2 text-xs">
              <Database className="h-3.5 w-3.5" /> Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <GlassCard className="min-h-[320px]">
                <SectionHeader
                  icon={Activity}
                  title="Platform Growth"
                  description="New users and tournaments across the selected range"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/users")}>Details</Button>}
                />
                {activityData.length ? (
                  <ChartContainer
                    className="h-64 w-full"
                    config={{
                      users: { label: "Users", color: "hsl(var(--primary))" },
                      tournaments: { label: "Tournaments", color: "hsl(var(--accent))" },
                    }}
                  >
                    <AreaChart data={activityData} margin={{ left: -20, right: 10, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="users" stroke="var(--color-users)" fill="var(--color-users)" fillOpacity={0.2} />
                      <Area
                        type="monotone"
                        dataKey="tournaments"
                        stroke="var(--color-tournaments)"
                        fill="var(--color-tournaments)"
                        fillOpacity={0.16}
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <EmptyBlock text="No growth data yet" />
                )}
              </GlassCard>

              <GlassCard className="min-h-[320px]">
                <SectionHeader
                  icon={CircleDollarSign}
                  title="Revenue"
                  description="Successful deposit payment volume"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/revenue")}>Details</Button>}
                />
                {revenueData.length ? (
                  <ChartContainer className="h-64 w-full" config={{ amount: { label: "Revenue", color: "hsl(var(--accent))" } }}>
                    <BarChart data={revenueData} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `Rs.${Number(value) / 1000}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="amount" fill="var(--color-amount)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyBlock text="No revenue data yet" />
                )}
              </GlassCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <GlassCard>
                <SectionHeader
                  icon={Trophy}
                  title="Tournament Status"
                  description="Current lifecycle split"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/tournaments")}>Details</Button>}
                />
                {statusData.length ? (
                  <ChartContainer className="h-44 w-full" config={{ value: { label: "Count" } }}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <EmptyBlock text="No status data yet" />
                )}
                <DistributionList data={dashboard.charts.tournamentsByStatus} />
              </GlassCard>

              <GlassCard>
                <SectionHeader
                  icon={Trophy}
                  title="Games"
                  description="Tournament count by game"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/tournaments")}>Details</Button>}
                />
                {gameData.length ? (
                  <ChartContainer className="h-44 w-full" config={{ count: { label: "Tournaments", color: "hsl(var(--secondary))" } }}>
                    <BarChart data={gameData} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="game" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyBlock text="No game data yet" />
                )}
                <DistributionList data={dashboard.charts.tournamentsByGame} />
              </GlassCard>

              <GlassCard>
                <SectionHeader
                  icon={UserCheck}
                  title="Role & Payment Mix"
                  description="User roles and payment status distribution"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/users")}>Details</Button>}
                />
                <DistributionList data={dashboard.charts.usersByRole} />
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="mb-3 font-heading text-sm font-bold">Payment Status</h3>
                  <DistributionList data={dashboard.charts.paymentsByStatus} />
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-5">
            <GlassCard>
              <SectionHeader
                icon={CircleDollarSign}
                title="Transaction Details"
                description="Platform deductions, ledger movement, and recent financial activity"
                action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/finance")}>Details</Button>}
              />

              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Platform Fees</p>
                  <p className="mt-1 font-heading text-lg font-bold text-accent">{formatCurrency(dashboard.totals.platformFees || 0)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatNumber(dashboard.totals.platformFeeTransactionCount)} fee entries</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Ledger Entries</p>
                  <p className="mt-1 font-heading text-lg font-bold">{formatNumber(dashboard.totals.ledgerTransactions)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">All money movement records</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Pending Razorpay</p>
                  <p className="mt-1 font-heading text-lg font-bold text-secondary">{formatNumber(dashboard.totals.pendingRazorpayPayments)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Initiated or pending checkout</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Failed Razorpay</p>
                  <p className="mt-1 font-heading text-lg font-bold text-destructive">{formatNumber(dashboard.totals.failedRazorpayPayments)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Includes auto-timeout failures</p>
                </div>
              </div>

              {dashboard.charts.platformFeesByCategory.length > 0 && (
                <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dashboard.charts.platformFeesByCategory.slice(0, 6).map((item) => (
                    <div key={String(item._id)} className="flex items-center justify-between gap-3 rounded-lg border border-glass-border/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-xs">{cleanLabel(item._id)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatNumber(item.count)} deductions</p>
                      </div>
                      <p className="shrink-0 font-heading text-xs font-bold text-accent">{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.tables.recentFinanceTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No finance transactions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    dashboard.tables.recentFinanceTransactions.map((transaction) => (
                      <TableRow key={transaction._id}>
                        <TableCell>
                          <p className="font-heading text-sm font-semibold">{cleanLabel(transaction.category)}</p>
                          <p className="max-w-[220px] truncate text-[10px] text-muted-foreground">{transaction.transactionId}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateTime(transaction.createdAt)}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>From: {getAdminUserLabel(transaction.fromUser)}</p>
                          <p className="text-muted-foreground">To: {getAdminUserLabel(transaction.toUser)}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>{transaction.debitAccount || "NA"}</p>
                          <p className="text-muted-foreground">{transaction.creditAccount || "NA"}</p>
                        </TableCell>
                        <TableCell className="text-right font-heading text-sm font-bold">
                          {formatCurrency(transaction.amount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-heading text-sm text-accent">
                          {formatCurrency(transaction.platformFee || 0)}
                        </TableCell>
                        <TableCell><StatusBadge value={transaction.status} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <SectionHeader
                  icon={Wallet}
                  title="Pending Withdrawals"
                  description="Manual payouts waiting for admin confirmation"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/finance")}>Details</Button>}
                />
                <Button type="button" size="sm" variant="outline" onClick={fetchWithdrawals} disabled={withdrawalsLoading}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${withdrawalsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {withdrawalsLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="rounded-lg border border-glass-border py-8 text-center">
                  <p className="font-heading text-sm">No pending withdrawals</p>
                  <p className="mt-1 text-xs text-muted-foreground">New withdrawal requests will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal._id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-heading text-sm font-semibold">
                              {withdrawal.user?.username || withdrawal.user?.phone_number || "User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{withdrawal.user?.email || withdrawal.user?.phone_number || "No contact"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-heading text-xs">{withdrawal.meta?.method?.toUpperCase() || "PAYOUT"}</p>
                          <p className="max-w-[260px] truncate text-xs text-muted-foreground">{withdrawal.meta?.destination || "No destination"}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(withdrawal.createdAt)}</TableCell>
                        <TableCell className="text-right font-heading text-sm font-bold text-secondary">
                          {formatCurrency(withdrawal.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleMarkWithdrawalPaid(withdrawal)}
                              disabled={updatingWithdrawalId === withdrawal._id}
                            >
                              {updatingWithdrawalId === withdrawal._id ? "Updating..." : "Paid"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleMarkWithdrawalFailed(withdrawal)}
                              disabled={updatingWithdrawalId === withdrawal._id}
                            >
                              Failed + Refund
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelWithdrawal(withdrawal)}
                              disabled={updatingWithdrawalId === withdrawal._id}
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-5">
            <GlassCard>
              <SectionHeader
                icon={ListChecks}
                title="Recent Tournaments"
                description="Latest tournament records and their current status"
                action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/tournaments")}>Details</Button>}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Prize Pool</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.tables.recentTournaments.map((tournament) => (
                    <TableRow key={tournament._id}>
                      <TableCell>
                        <p className="font-heading text-sm font-semibold">{tournament.title}</p>
                        <p className="text-xs text-muted-foreground">By {tournament.organizer?.username || "Unknown"}</p>
                      </TableCell>
                      <TableCell>{cleanLabel(tournament.game)}</TableCell>
                      <TableCell><StatusBadge value={tournament.status} /></TableCell>
                      <TableCell className="text-right">{formatPrizeSummary(tournament)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tournament.startAt ? formatShortDate(tournament.startAt) : "No date"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          </TabsContent>

          <TabsContent value="users" className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <GlassCard>
                <SectionHeader
                  icon={ListChecks}
                  title="Recent Admin Actions"
                  description="Audit trail for role and permission changes"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/audit")}>Details</Button>}
                />
                <div className="space-y-3">
                  {dashboard.tables.recentAdminAuditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No admin actions logged yet</p>
                  ) : (
                    dashboard.tables.recentAdminAuditLogs.map((log) => (
                      <div key={log._id} className="rounded-lg border border-glass-border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-heading text-sm font-semibold">{cleanLabel(log.action)}</p>
                            <p className="text-xs text-muted-foreground">
                              {getAdminUserLabel(log.actor)} changed {getAdminUserLabel(log.targetUser)}
                            </p>
                            {log.note && <p className="mt-1 text-xs text-muted-foreground">{log.note}</p>}
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader
                  icon={Users}
                  title="Recent Users"
                  description="Newest accounts on the platform"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/users")}>Details</Button>}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.tables.recentUsers.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <p className="font-heading text-sm font-semibold">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email || user.phone_number || "No contact"}</p>
                        </TableCell>
                        <TableCell className="text-xs">{user.role?.map(cleanLabel).join(", ") || "User"}</TableCell>
                        <TableCell><StatusBadge value={user.isActive ? "active" : "banned"} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </GlassCard>

              <GlassCard>
                <SectionHeader
                  icon={Crown}
                  title="Top Creators"
                  description="Creators ranked by members and tournament volume"
                  action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/creators")}>Details</Button>}
                />
                <div className="space-y-3">
                  {dashboard.tables.topCreators.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No creators yet</p>
                  ) : (
                    dashboard.tables.topCreators.map((creator, index) => (
                      <div key={creator._id} className="flex flex-col gap-3 rounded-lg border border-glass-border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 font-heading text-xs text-primary">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-heading text-sm font-semibold">{creator.name}</p>
                            <p className="truncate text-xs text-muted-foreground">@{creator.handle}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                          <div className="text-left sm:text-right">
                            <p className="font-heading text-sm">{formatNumber(creator.memberCount)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatNumber(creator.tournamentCount)} tournaments</p>
                          </div>
                          {creator.owner?._id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreatorPermission({ _id: creator.owner!._id, username: creator.owner?.username }, "removed")}
                              disabled={updatingCreatorId === creator.owner._id}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="support" className="space-y-5">
            <GlassCard>
              <SectionHeader
                icon={Ticket}
                title="Latest Tickets"
                description="Newest support issues needing team attention"
                action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/support")}>Details</Button>}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.tables.recentTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No tickets yet</TableCell>
                    </TableRow>
                  ) : (
                    dashboard.tables.recentTickets.map((ticket) => (
                      <TableRow key={ticket._id}>
                        <TableCell className="font-heading text-sm font-semibold">{ticket.title}</TableCell>
                        <TableCell>{ticket.user?.username || ticket.user?.phone_number || "Unknown"}</TableCell>
                        <TableCell>{cleanLabel(ticket.type)}</TableCell>
                        <TableCell><StatusBadge value={ticket.status} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </GlassCard>
          </TabsContent>

          <TabsContent value="database" className="space-y-5">
            <GlassCard>
              <SectionHeader
                icon={Database}
                title="Database Explorer"
                description="Read-only admin records with passwords, tokens, secrets, and credentials redacted"
                action={<Button size="sm" variant="outline" onClick={() => navigate("/admin/details/database")}>Details</Button>}
              />

              <div className="mb-4 grid gap-3 lg:grid-cols-[260px_1fr_auto]">
                <select
                  value={selectedCollection}
                  onChange={(event) => {
                    setSelectedCollection(event.target.value);
                    setCollectionPage(1);
                  }}
                  className="rounded-lg border border-glass-border bg-background px-3 py-2.5 text-sm font-heading outline-none"
                >
                  {visibleCollections.map((collection) => (
                    <option key={collection.key} value={collection.key}>
                      {collection.label} ({formatNumber(collection.count)})
                    </option>
                  ))}
                </select>
                <input
                  value={collectionSearch}
                  onChange={(event) => {
                    setCollectionSearch(event.target.value);
                    setCollectionPage(1);
                  }}
                  placeholder="Search username, title, name, email, phone, status"
                  className="rounded-lg border border-glass-border bg-background px-3 py-2.5 text-sm font-heading outline-none"
                />
                <Button type="button" variant="outline" onClick={fetchCollectionRecords} disabled={collectionsLoading}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${collectionsLoading ? "animate-spin" : ""}`} />
                  Load
                </Button>
              </div>

              {collectionsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-28 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : !collectionData || collectionData.records.length === 0 ? (
                <div className="rounded-lg border border-glass-border py-10 text-center">
                  <p className="font-heading text-sm">No records found</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try another collection or search term.</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      Showing {collectionData.records.length} of {formatNumber(collectionData.total)} records from {collectionData.label}
                    </span>
                    <span>
                      Page {collectionData.page} / {Math.max(collectionData.pages, 1)}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeCollectionColumns.map((column) => (
                          <TableHead key={`${column.path}-${column.label}`}>{column.label}</TableHead>
                        ))}
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collectionData.records.map((record, index) => (
                        <TableRow key={String(record._id ?? index)}>
                          {activeCollectionColumns.map((column) => {
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCollectionPage((page) => Math.max(page - 1, 1))}
                      disabled={collectionPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCollectionPage((page) => page + 1)}
                      disabled={!collectionData || collectionPage >= collectionData.pages}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
            <DialogHeader className="border-b border-glass-border px-6 pb-4 pt-6 pr-12">
              <DialogTitle className="font-heading">Record Details</DialogTitle>
              <DialogDescription>
                Only populated fields are shown. Sensitive fields are redacted before display.
              </DialogDescription>
            </DialogHeader>

            {selectedRecord && (
              <div className="min-h-0 overflow-y-auto px-6 pb-6 pr-4">
                {selectedRecordEntries.length === 0 ? (
                  <div className="mb-4 rounded-lg border border-glass-border py-10 text-center">
                    <p className="font-heading text-sm">No displayable fields</p>
                    <p className="mt-1 text-xs text-muted-foreground">This record only contains empty or redacted values.</p>
                  </div>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedRecordEntries.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-glass-border bg-card/50 p-3">
                        <p className="mb-1 font-heading text-[10px] uppercase text-muted-foreground">{cleanLabel(key)}</p>
                        <p className="break-words text-sm text-foreground">{formatDetailValue(value)}</p>
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

export default AdminDashboardScreen;
