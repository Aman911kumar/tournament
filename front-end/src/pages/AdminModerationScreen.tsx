import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Flag, LoaderCircle, RefreshCcw, Search, ShieldAlert, UserX } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getModerationReports,
  reviewModerationReport,
  type ModerationReport,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from "@/api/moderation";
import { getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";
import { getNotificationSocket } from "@/lib/notification-socket";

const statuses: Array<"all" | ReportStatus> = ["all", "open", "under_review", "actioned", "resolved", "rejected", "closed"];
const categories: Array<"all" | ReportCategory> = [
  "all",
  "cheating",
  "abusive_behavior",
  "fake_results",
  "spam",
  "fraud_scam",
  "inappropriate_content",
  "payout_not_distributed",
  "wrong_payout",
  "room_details_issue",
  "creator",
  "player",
  "tournament",
  "other",
];
const severities: Array<"all" | ReportSeverity> = ["all", "critical", "high", "medium", "low"];
const reviewActions = [
  { value: "none", label: "Only update status" },
  { value: "warn", label: "Warn target user" },
  { value: "mute", label: "Mute 24h" },
  { value: "suspend", label: "Suspend 24h" },
  { value: "tournament_ban", label: "Tournament ban" },
  { value: "global_ban", label: "Global ban" },
  { value: "reject", label: "Reject report" },
  { value: "resolve", label: "Resolve report" },
];

const cleanLabel = (value?: string | null) =>
  String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const statusClass = (status: string) => {
  if (["open", "under_review"].includes(status)) return "border-secondary/30 bg-secondary/10 text-secondary";
  if (["actioned", "resolved", "closed"].includes(status)) return "border-accent/30 bg-accent/10 text-accent";
  if (status === "rejected") return "border-muted bg-muted/40 text-muted-foreground";
  return "border-glass-border bg-card text-muted-foreground";
};

const severityClass = (severity: string) => {
  if (severity === "critical") return "text-destructive";
  if (severity === "high") return "text-secondary";
  if (severity === "medium") return "text-primary";
  return "text-muted-foreground";
};

const getTargetUserId = (report: ModerationReport | null) =>
  report?.reportedUser?._id || report?.reportedCreator?._id || "";

const AdminModerationScreen = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<(typeof statuses)[number]>("open");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [severity, setSeverity] = useState<(typeof severities)[number]>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReportStatus>("under_review");
  const [reviewAction, setReviewAction] = useState("none");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getModerationReports({
        page,
        limit: 20,
        status: status === "all" ? undefined : status,
        category: category === "all" ? undefined : category,
        severity: severity === "all" ? undefined : severity,
        search: search.trim() || undefined,
      });
      setReports(result.reports);
      setTotal(result.total);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Load reports", fallback: "Could not load moderation reports." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  }, [category, page, search, severity, status]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;
    const refresh = () => loadReports();
    socket.on("moderation:report:new", refresh);
    socket.on("moderation:report:updated", refresh);
    return () => {
      socket.off("moderation:report:new", refresh);
      socket.off("moderation:report:updated", refresh);
    };
  }, [loadReports]);

  const stats = useMemo(() => {
    const openCount = reports.filter((report) => ["open", "under_review"].includes(report.status)).length;
    const highCount = reports.filter((report) => ["high", "critical"].includes(report.severity)).length;
    return [
      { label: "Loaded Reports", value: reports.length, icon: Flag, color: "text-primary" },
      { label: "Needs Review", value: openCount, icon: Clock, color: "text-secondary" },
      { label: "High Severity", value: highCount, icon: ShieldAlert, color: "text-destructive" },
      { label: "Total Matched", value: total, icon: CheckCircle2, color: "text-accent" },
    ];
  }, [reports, total]);

  const openReview = (report: ModerationReport) => {
    setSelectedReport(report);
    setReviewStatus(report.status === "open" ? "under_review" : report.status);
    setReviewAction("none");
    setReviewNote(report.resolution || report.adminResponse || "");
  };

  const submitReview = async () => {
    if (!selectedReport) return;
    if (reviewAction !== "none" && reviewNote.trim().length < 4) {
      toast.error("Moderation note required", { description: "Add a short reason before applying an action." });
      return;
    }

    try {
      setReviewLoading(true);
      const res = await reviewModerationReport(selectedReport._id, {
        status: reviewStatus,
        action: reviewAction,
        note: reviewNote.trim(),
        targetUser: getTargetUserId(selectedReport) || undefined,
        durationHours: ["mute", "suspend"].includes(reviewAction) ? 24 : undefined,
      });
      const updated = res.data;
      setReports((current) => current.map((report) => report._id === updated._id ? updated : report));
      setSelectedReport(updated);
      toast.success("Report reviewed", { description: res.message || "Moderation action saved." });
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Review report", fallback: "Could not review report." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="arena-shell min-h-screen px-4 py-6 pb-10 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-card/70">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="font-heading text-2xl font-bold">Moderation Center</h1>
              <p className="text-xs text-muted-foreground">Reports, evidence review, and player safety actions</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={loadReports} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <GlassCard key={item.label}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-heading text-[10px] uppercase text-muted-foreground">{item.label}</p>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="font-heading text-2xl font-bold">{item.value.toLocaleString("en-IN")}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="mb-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-glass-border bg-background/50 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search report title or message"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm">
              {statuses.map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}
            </select>
            <select value={category} onChange={(event) => { setCategory(event.target.value as typeof category); setPage(1); }} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm">
              {categories.map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}
            </select>
            <select value={severity} onChange={(event) => { setSeverity(event.target.value as typeof severity); setPage(1); }} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm">
              {severities.map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}
            </select>
          </div>
        </GlassCard>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted/70" />)}
          </div>
        ) : reports.length === 0 ? (
          <GlassCard className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-heading text-sm">No reports found</p>
            <p className="mt-1 text-xs text-muted-foreground">Change filters or wait for new player reports.</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <GlassCard key={report._id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 font-heading text-[10px] ${statusClass(report.status)}`}>{cleanLabel(report.status)}</span>
                      <span className={`font-heading text-[10px] uppercase ${severityClass(report.severity)}`}>{cleanLabel(report.severity)}</span>
                      <span className="rounded-full bg-muted/50 px-2 py-1 font-heading text-[10px] text-muted-foreground">{cleanLabel(report.category)}</span>
                    </div>
                    <h2 className="truncate font-heading text-base font-bold">{report.title || cleanLabel(report.targetType)}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{report.message || report.content}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <span>By {report.reporter?.username || report.createdBy?.username || "User"}</span>
                      <span>Target {report.reportedUser?.username || report.reportedCreator?.username || cleanLabel(report.targetType)}</span>
                      {report.tournament?.title && <span>{report.tournament.title}</span>}
                      <span>{formatDateTime(report.createdAt)}</span>
                    </div>
                  </div>
                  <Button type="button" onClick={() => openReview(report)} className="shrink-0">
                    Review
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1 || loading}>Previous</Button>
            <Button type="button" variant="outline" onClick={() => setPage((value) => value + 1)} disabled={reports.length < 20 || loading}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg bg-card/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Review Report</DialogTitle>
            <DialogDescription>Review evidence and apply a proportionate moderation action.</DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="rounded-lg border border-glass-border bg-card/50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 font-heading text-[10px] ${statusClass(selectedReport.status)}`}>{cleanLabel(selectedReport.status)}</span>
                  <span className={`font-heading text-[10px] uppercase ${severityClass(selectedReport.severity)}`}>{cleanLabel(selectedReport.severity)}</span>
                  <span className="rounded-full bg-muted/50 px-2 py-1 font-heading text-[10px] text-muted-foreground">{cleanLabel(selectedReport.category)}</span>
                </div>
                <h3 className="font-heading text-sm font-bold">{selectedReport.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedReport.message || selectedReport.content}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-glass-border bg-background/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Reporter</p>
                  <p className="mt-1 font-heading text-sm font-bold">{selectedReport.reporter?.username || selectedReport.createdBy?.username || "User"}</p>
                </div>
                <div className="rounded-lg border border-glass-border bg-background/50 p-3">
                  <p className="font-heading text-[10px] uppercase text-muted-foreground">Target</p>
                  <p className="mt-1 font-heading text-sm font-bold">{selectedReport.reportedUser?.username || selectedReport.reportedCreator?.username || cleanLabel(selectedReport.targetType)}</p>
                </div>
              </div>

              {(selectedReport.evidence?.matchProof || selectedReport.evidence?.videoUrl || selectedReport.evidence?.screenshots?.length) && (
                <div className="rounded-lg border border-glass-border bg-background/50 p-3">
                  <p className="mb-2 font-heading text-[10px] uppercase text-muted-foreground">Evidence</p>
                  {selectedReport.evidence?.matchProof && <p className="break-words text-xs text-muted-foreground">{selectedReport.evidence.matchProof}</p>}
                  {selectedReport.evidence?.videoUrl && <p className="mt-2 break-words text-xs text-primary">{selectedReport.evidence.videoUrl}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedReport.evidence?.screenshots || []).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-glass-border px-2 py-1 text-[10px] text-primary">
                        Screenshot
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-[10px] font-heading uppercase text-muted-foreground">Status</span>
                  <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ReportStatus)} className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm">
                    {statuses.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{cleanLabel(item)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-heading uppercase text-muted-foreground">Action</span>
                  <select value={reviewAction} onChange={(event) => setReviewAction(event.target.value)} className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm">
                    {reviewActions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-1 block text-[10px] font-heading uppercase text-muted-foreground">Moderation Note</span>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={4}
                  placeholder="Explain decision, warning, ban reason, or evidence outcome..."
                  className="w-full resize-none rounded-lg border border-glass-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              {reviewAction === "tournament_ban" && !selectedReport.tournament?._id && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">Tournament ban needs a report linked to a tournament.</p>
              )}
              {["warn", "mute", "suspend", "tournament_ban", "global_ban"].includes(reviewAction) && !getTargetUserId(selectedReport) && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">This action needs a target user or creator.</p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setSelectedReport(null)} disabled={reviewLoading}>Close</Button>
                <Button type="button" onClick={submitReview} disabled={reviewLoading}>
                  {reviewLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                  Save Review
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminModerationScreen;
