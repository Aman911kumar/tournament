import { recordRequestMetric } from "../services/monitoring.service.js";

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
    });

    next();
};

export default requestMetrics;
