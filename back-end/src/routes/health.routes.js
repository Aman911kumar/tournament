import express from "express";
import mongoose from "mongoose";
import { getRuntimeConfig } from "../utils/runtime.js";

const router = express.Router();

const getDbState = () => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    return states[mongoose.connection.readyState] || "unknown";
};

const buildHealth = () => {
    const isDevelopment = process.env.NODE_ENV === "development";
    const runtime = getRuntimeConfig();

    return {
        ok: mongoose.connection.readyState === 1,
        status: mongoose.connection.readyState === 1 ? "ready" : "degraded",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        runtime: {
            platform: runtime.platform,
            role: runtime.role,
            realtimeEnabled: runtime.realtimeEnabled,
            backgroundWorkersEnabled: runtime.backgroundWorkersEnabled,
        },
        database: {
            state: getDbState(),
            ...(isDevelopment
                ? {
                    name: mongoose.connection.name || "",
                    host: mongoose.connection.host || "",
                }
                : {}),
        },
        memory: {
            rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
    };
};

router.get("/", (req, res) => {
    const health = buildHealth();
    res.status(health.ok ? 200 : 503).json(health);
});

router.get("/ready", (req, res) => {
    const health = buildHealth();
    res.status(health.ok ? 200 : 503).json({
        ok: health.ok,
        status: health.status,
        database: health.database.state,
        runtime: health.runtime,
    });
});

router.get("/warmup", (req, res) => {
    const health = buildHealth();
    res.status(health.ok ? 200 : 503).json({
        ok: health.ok,
        status: health.status,
        warmed: health.ok,
        timestamp: health.timestamp,
        runtime: health.runtime,
    });
});

export default router;
