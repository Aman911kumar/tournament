import { API_BASE_URL } from "@/api/client";

type PerformancePayload = {
  pageLoadMs?: number;
  ttfbMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  cls?: number;
};

const MAX_TEXT = 220;
let started = false;
let latestLcpMs = 0;
let latestFcpMs = 0;
let cumulativeCls = 0;

const sanitizeText = (value: unknown, maxLength = MAX_TEXT) =>
  String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{10,}\b/g, "[number]")
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[token]")
    .slice(0, maxLength);

const getRoute = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
};

const sendMonitoringEvent = (payload: Record<string, unknown>) => {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    route: sanitizeText(payload.route ?? getRoute(), 120),
    pageUrl: getRoute(),
    timestamp: new Date().toISOString(),
  });
  const url = `${API_BASE_URL}/monitoring/frontend`;

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // Fetch fallback below handles browsers that block sendBeacon.
  }

  fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Monitoring must never interrupt the user flow.
  });
};

export const recordFrontendEvent = (payload: Record<string, unknown>) => {
  sendMonitoringEvent(payload);
};

const reportPerformance = () => {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const payload: PerformancePayload = {
    lcpMs: latestLcpMs || undefined,
    fcpMs: latestFcpMs || undefined,
    cls: cumulativeCls ? Number(cumulativeCls.toFixed(4)) : undefined,
  };

  if (navigation) {
    payload.pageLoadMs = Math.round(navigation.loadEventEnd || navigation.duration);
    payload.ttfbMs = Math.round(navigation.responseStart - navigation.requestStart);
  }

  sendMonitoringEvent({
    type: "performance",
    name: "page-load",
    metrics: payload,
  });
};

const observePerformance = () => {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") latestFcpMs = Math.round(entry.startTime);
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });
  } catch {
    // Older browsers may not support a specific observer type.
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) latestLcpMs = Math.round(last.startTime);
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // Optional metric.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[]) {
        if (!entry.hadRecentInput) cumulativeCls += Number(entry.value || 0);
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    // Optional metric.
  }
};

export const initFrontendMonitoring = () => {
  if (started || typeof window === "undefined") return;
  started = true;

  observePerformance();

  window.addEventListener("error", (event) => {
    sendMonitoringEvent({
      type: "error",
      name: sanitizeText(event.filename || "window-error", 80),
      message: sanitizeText(event.message),
      value: event.lineno || undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "Unhandled promise rejection");
    sendMonitoringEvent({
      type: "unhandledrejection",
      name: "promise-rejection",
      message: sanitizeText(reason),
    });
  });

  window.addEventListener("load", () => {
    window.setTimeout(reportPerformance, 1500);
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      sendMonitoringEvent({
        type: "navigation",
        name: "page-hidden",
      });
    }
  });
};
