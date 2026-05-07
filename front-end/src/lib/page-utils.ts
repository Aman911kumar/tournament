import { ApiError } from "@/api/client";

export const formatCurrency = (value: number | string) => {
  const numberValue = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(numberValue)) {
    return "₹0";
  }

  const sign = numberValue < 0 ? "-" : "";
  return `${sign}₹${Math.abs(numberValue).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

type PrizeSummaryInput = {
  prizePool?: unknown;
  prizeMode?: unknown;
  killPrizeAmount?: unknown;
};

export const formatPrizeSummary = (tournament?: PrizeSummaryInput | null, options: { killPrefix?: boolean } = {}) => {
  if (!tournament) return formatCurrency(0);

  const prizeMode = String(tournament.prizeMode || "position");
  const positionPrize = Number(tournament.prizePool || 0);
  const killPrize = Number(tournament.killPrizeAmount || 0);
  const killText = `${formatCurrency(killPrize)}/kill`;

  if (prizeMode === "kill") return options.killPrefix ? `Kill: ${killText}` : killText;
  if (prizeMode === "both") return `${formatCurrency(positionPrize)} + ${killText}`;
  return formatCurrency(positionPrize);
};

export const getPrizeSortValue = (tournament?: PrizeSummaryInput | null) => {
  if (!tournament) return 0;

  const prizeMode = String(tournament.prizeMode || "position");
  const positionPrize = Number(tournament.prizePool || 0);
  const killPrize = Number(tournament.killPrizeAmount || 0);

  if (prizeMode === "kill") return killPrize;
  if (prizeMode === "both") return positionPrize + killPrize;
  return positionPrize;
};

const humanizeErrorDetail = (detail: Record<string, unknown>) => {
  const field = detail.field ?? detail.path ?? detail.param ?? detail.name;
  const message = detail.message ?? detail.msg ?? detail.error ?? detail.reason;

  if (field && message) return `${String(field)}: ${String(message)}`;
  if (message) return String(message);
  if (field) return String(field);

  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
};

export const getErrorSourceLabel = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.source === "network" || error.status === 0) return "Network";
    if (error.source === "backend") return `Backend ${error.status}`;
    return "Client";
  }

  if (error instanceof TypeError) return "Frontend";
  return "App";
};

export const getErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
};

export const getErrorDetails = (error: unknown) => {
  if (!(error instanceof ApiError) || error.errors.length === 0) {
    return "";
  }

  return error.errors
    .map((detail) => humanizeErrorDetail(detail))
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
};

export const getErrorToast = (
  error: unknown,
  options: {
    action?: string;
    fallback?: string;
  } = {},
) => {
  const source = getErrorSourceLabel(error);
  const message = getErrorMessage(error, options.fallback ?? "Something went wrong");
  const details = getErrorDetails(error);
  const endpoint =
    error instanceof ApiError && error.endpoint
      ? `${error.method.toUpperCase()} ${error.endpoint}`
      : "";
  const requestId = error instanceof ApiError && error.requestId ? error.requestId : "";

  return {
    title: `${options.action ?? "Request"} failed`,
    description: [
      `[${source}] ${message}`,
      details ? `Details: ${details}` : "",
      endpoint ? `Endpoint: ${endpoint}` : "",
      requestId ? `Request ID: ${requestId}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
};

export const getSuccessToast = (message: string, context?: string) => ({
  title: context ?? "Success",
  description: message,
});
