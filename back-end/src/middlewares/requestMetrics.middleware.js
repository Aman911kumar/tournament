import { recordRequestMetric } from "../services/monitoring.service.js";

const SLOW_API_MS = Math.max(0, Number(process.env.SLOW_API_LOG_MS || 1500));
const LOG_SLOW_API = String(process.env.LOG_SLOW_API || "true").toLowerCase() !== "false";

const requestMetrics = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        recordRequestMetric({
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs,
            requestId: req.requestId,
        });

        if (LOG_SLOW_API && SLOW_API_MS > 0 && durationMs >= SLOW_API_MS) {
            console.warn("Slow API request:", {
                requestId: req.requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Math.round(durationMs),
            });
        }
    });

    next();
};

export default requestMetrics;
