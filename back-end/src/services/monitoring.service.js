import { monitorEventLoopDelay } from "node:perf_hooks";
import { getSocketStats } from "./socket.service.js";

const MAX_RECENT_REQUESTS = 80;
const MAX_RECENT_ERRORS = 80;
const MAX_DURATIONS = 600;
const MAX_ENDPOINTS = 120;
const MAX_FRONTEND_EVENTS = 120;
const MAX_FRONTEND_ERRORS = 80;

const startedAt = new Date();
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

const metrics = {
    requestsTotal: 0,
    successTotal: 0,
    clientErrorTotal: 0,
    serverErrorTotal: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    durations: [],
    endpoints: new Map(),
    recentRequests: [],
    recentErrors: [],
    frontend: {
        eventsTotal: 0,
        errorsTotal: 0,
        performanceSamples: 0,
        totalPageLoadMs: 0,
        totalTtfbMs: 0,
        lcpSamples: [],
        clsSamples: [],
        fcpSamples: [],
        routes: new Map(),
        recentEvents: [],
        recentErrors: [],
    },
};

const sanitizeText = (value = "", maxLength = 220) =>
    String(value || "")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
        .replace(/\b\d{10,}\b/g, "[number]")
        .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[token]")
        .slice(0, maxLength);

const normalizePath = (value = "") => {
    const path = String(value || "/").split("?")[0] || "/";
    return path
        .replace(/[a-f\d]{24}/gi, ":id")
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
        .replace(/\b\d{5,}\b/g, ":num");
};

const pushLimited = (list, value, limit) => {
    list.push(value);
    if (list.length > limit) list.splice(0, list.length - limit);
};

const percentile = (values, percent) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
    return Math.round(sorted[index] * 100) / 100;
};

const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));

const toMb = (bytes) => Math.round(Number(bytes || 0) / 1024 / 1024);

const getStatusGroup = (statusCode) => {
    if (statusCode >= 500) return "5xx";
    if (statusCode >= 400) return "4xx";
    if (statusCode >= 300) return "3xx";
    if (statusCode >= 200) return "2xx";
    return "other";
};

const trimEndpointMap = () => {
    if (metrics.endpoints.size <= MAX_ENDPOINTS) return;
    const oldestKey = [...metrics.endpoints.entries()]
        .sort(([, a], [, b]) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime())[0]?.[0];
    if (oldestKey) metrics.endpoints.delete(oldestKey);
};

const updateEndpoint = ({ method, path, statusCode, durationMs }) => {
    const key = `${method} ${path}`;
    const current = metrics.endpoints.get(key) || {
        method,
        path,
        count: 0,
        errorCount: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        durations: [],
        statusGroups: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 },
        lastStatus: statusCode,
        lastSeen: new Date().toISOString(),
    };

    current.count += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    current.lastStatus = statusCode;
    current.lastSeen = new Date().toISOString();
    current.statusGroups[getStatusGroup(statusCode)] += 1;
    if (statusCode >= 400) current.errorCount += 1;
    pushLimited(current.durations, durationMs, 120);

    metrics.endpoints.set(key, current);
    trimEndpointMap();
};

export const recordRequestMetric = ({ method, path, statusCode, durationMs, requestId }) => {
    const safeDuration = round(durationMs);
    const safePath = normalizePath(path);
    const timestamp = new Date().toISOString();

    metrics.requestsTotal += 1;
    metrics.totalDurationMs += safeDuration;
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, safeDuration);
    pushLimited(metrics.durations, safeDuration, MAX_DURATIONS);

    if (statusCode >= 500) metrics.serverErrorTotal += 1;
    else if (statusCode >= 400) metrics.clientErrorTotal += 1;
    else metrics.successTotal += 1;

    const request = {
        requestId,
        method,
        path: safePath,
        statusCode,
        durationMs: safeDuration,
        timestamp,
    };

    pushLimited(metrics.recentRequests, request, MAX_RECENT_REQUESTS);
    if (statusCode >= 500) pushLimited(metrics.recentErrors, request, MAX_RECENT_ERRORS);
    updateEndpoint({ method, path: safePath, statusCode, durationMs: safeDuration });
};

const updateFrontendRoute = (route) => {
    if (!route) return;
    const key = normalizePath(route);
    const current = metrics.frontend.routes.get(key) || { route: key, count: 0, lastSeen: "" };
    current.count += 1;
    current.lastSeen = new Date().toISOString();
    metrics.frontend.routes.set(key, current);
};

export const recordFrontendMetric = (payload = {}, req = {}) => {
    const type = sanitizeText(payload.type || "event", 40);
    const route = normalizePath(payload.route || "/");
    const timestamp = new Date().toISOString();
    const event = {
        type,
        route,
        message: sanitizeText(payload.message || payload.name || "", 180),
        value: typeof payload.value === "number" ? round(payload.value) : undefined,
        timestamp,
        userAgent: sanitizeText(req.headers?.["user-agent"] || "", 140),
    };

    metrics.frontend.eventsTotal += 1;
    updateFrontendRoute(route);
    pushLimited(metrics.frontend.recentEvents, event, MAX_FRONTEND_EVENTS);

    if (type === "error" || type === "unhandledrejection") {
        metrics.frontend.errorsTotal += 1;
        pushLimited(metrics.frontend.recentErrors, event, MAX_FRONTEND_ERRORS);
    }

    if (type === "performance" && payload.metrics && typeof payload.metrics === "object") {
        const data = payload.metrics;
        metrics.frontend.performanceSamples += 1;
        if (typeof data.pageLoadMs === "number") metrics.frontend.totalPageLoadMs += data.pageLoadMs;
        if (typeof data.ttfbMs === "number") metrics.frontend.totalTtfbMs += data.ttfbMs;
        if (typeof data.lcpMs === "number") pushLimited(metrics.frontend.lcpSamples, data.lcpMs, MAX_DURATIONS);
        if (typeof data.cls === "number") pushLimited(metrics.frontend.clsSamples, data.cls, MAX_DURATIONS);
        if (typeof data.fcpMs === "number") pushLimited(metrics.frontend.fcpSamples, data.fcpMs, MAX_DURATIONS);
    }
};

export const getMonitoringSnapshot = () => {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.round(process.uptime());
    const startedMs = startedAt.getTime();
    const minutes = Math.max((Date.now() - startedMs) / 60000, 1);
    const frontend = metrics.frontend;
    const socket = getSocketStats();

    return {
        service: {
            status: metrics.serverErrorTotal > 0 ? "watch" : "healthy",
            startedAt: startedAt.toISOString(),
            uptimeSeconds,
            nodeEnv: process.env.NODE_ENV || "development",
            pid: process.pid,
        },
        realtime: {
            onlineUsers: socket.onlineUsers,
            connectedSockets: socket.sockets,
            redisAdapter: socket.redisAdapter,
        },
        backend: {
            requests: {
                total: metrics.requestsTotal,
                success: metrics.successTotal,
                clientErrors: metrics.clientErrorTotal,
                serverErrors: metrics.serverErrorTotal,
                rpm: round(metrics.requestsTotal / minutes),
                avgDurationMs: metrics.requestsTotal ? round(metrics.totalDurationMs / metrics.requestsTotal) : 0,
                p95DurationMs: percentile(metrics.durations, 95),
                maxDurationMs: round(metrics.maxDurationMs),
                errorRate: metrics.requestsTotal
                    ? round(((metrics.clientErrorTotal + metrics.serverErrorTotal) / metrics.requestsTotal) * 100)
                    : 0,
            },
            memory: {
                rssMb: toMb(memory.rss),
                heapUsedMb: toMb(memory.heapUsed),
                heapTotalMb: toMb(memory.heapTotal),
                externalMb: toMb(memory.external),
            },
            eventLoop: {
                meanMs: round(eventLoopDelay.mean / 1e6),
                maxMs: round(eventLoopDelay.max / 1e6),
                p95Ms: round(eventLoopDelay.percentile(95) / 1e6),
            },
            endpoints: [...metrics.endpoints.values()]
                .map((endpoint) => ({
                    method: endpoint.method,
                    path: endpoint.path,
                    count: endpoint.count,
                    errorCount: endpoint.errorCount,
                    avgDurationMs: endpoint.count ? round(endpoint.totalDurationMs / endpoint.count) : 0,
                    p95DurationMs: percentile(endpoint.durations, 95),
                    maxDurationMs: round(endpoint.maxDurationMs),
                    lastStatus: endpoint.lastStatus,
                    lastSeen: endpoint.lastSeen,
                    statusGroups: endpoint.statusGroups,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20),
            recentRequests: [...metrics.recentRequests].reverse().slice(0, 30),
            recentErrors: [...metrics.recentErrors].reverse().slice(0, 20),
        },
        frontend: {
            eventsTotal: frontend.eventsTotal,
            errorsTotal: frontend.errorsTotal,
            performanceSamples: frontend.performanceSamples,
            avgPageLoadMs: frontend.performanceSamples ? round(frontend.totalPageLoadMs / frontend.performanceSamples) : 0,
            avgTtfbMs: frontend.performanceSamples ? round(frontend.totalTtfbMs / frontend.performanceSamples) : 0,
            p95LcpMs: percentile(frontend.lcpSamples, 95),
            p95Cls: percentile(frontend.clsSamples, 95),
            p95FcpMs: percentile(frontend.fcpSamples, 95),
            topRoutes: [...frontend.routes.values()]
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            recentEvents: [...frontend.recentEvents].reverse().slice(0, 30),
            recentErrors: [...frontend.recentErrors].reverse().slice(0, 20),
        },
    };
};
