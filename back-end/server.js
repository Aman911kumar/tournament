import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import { PORT, CORS_ORIGIN } from './env.js';
import connect_db from './src/database/dataBaseConnect.js';
import routes from './src/routes/all.routes.js';
import cookieParser from 'cookie-parser';
import errorHandler from './src/middlewares/errorHandler.middleware.js';
import { globalApiLimiter } from './src/middlewares/rateLimit.middleware.js';
import securityHeaders from './src/middlewares/securityHeaders.middleware.js';
import requestMetrics from './src/middlewares/requestMetrics.middleware.js';
import ApiError from './src/utils/ApiError.js';
import path from "path";
import { expireStaleRazorpayPayments } from './src/services/paymentExpiry.service.js';
import { initSocket } from './src/services/socket.service.js';

const __dirname = path.resolve();
const distPath = path.join(__dirname, "dist");

// App configuration
const app = express();
const httpServer = createServer(app);
const serverPort = PORT || 8000;
let paymentExpiryRunning = false;
let paymentExpiryTimer = null;

const runPaymentExpiry = async () => {
    if (paymentExpiryRunning) return;
    paymentExpiryRunning = true;
    try {
        await expireStaleRazorpayPayments();
    } catch (err) {
        console.error("Razorpay payment expiry failed:", err);
    } finally {
        paymentExpiryRunning = false;
    }
};

const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    if (paymentExpiryTimer) clearInterval(paymentExpiryTimer);
    httpServer.close(async () => {
        await mongoose.connection.close(false).catch((error) => {
            console.error("MongoDB close failed:", error);
        });
        console.log("HTTP server closed");
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);

// CORS configuration
const configuredOrigins = CORS_ORIGIN
    ? CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

const allowedOrigins = [
    "http://localhost:3000",
    // "tournament4-shubham9876794207-3100s-projects.vercel.app",
    "https://battle4arena.vercel.app",
    "http://192.168.29.138:8080",
    "http://localhost:8080",
    ...configuredOrigins,
];
const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin) || localDevOriginPattern.test(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
    },
}));

// Body parsers
app.use(express.json({ limit: "50kb" })); // JSON payload limit
app.use(express.urlencoded({ extended: true, limit: "50kb" })); // form data
app.use(cookieParser())

app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
});

app.use(requestMetrics);

// // Serve static files
// app.use(express.static("public"));
// app.use(express.static(distPath))
// // 🔥 SPA fallback (IMPORTANT)
// app.use( (req, res) => {
//     res.sendFile(path.resolve("dist/index.html"));
// });

// All routes
app.use('/api/v1', globalApiLimiter, routes);

app.get("/", (req, res) => {
    res.json("server is live")
})


app.use((req, res, next) => {
    next(new ApiError(404, `API endpoint doesn’t exist`));
    // next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Error handling middleware (should be last)
app.use(errorHandler);

// DB connection & server start

connect_db()
    .then(() => {
        initSocket(httpServer, allowedOrigins);
        runPaymentExpiry();
        paymentExpiryTimer = setInterval(runPaymentExpiry, 60 * 1000);
        paymentExpiryTimer.unref?.();

        httpServer.listen(serverPort, () => {
            console.log(`Server is listening on http://localhost:${serverPort}`);
        });
    })
    .catch((err) => {
        console.error("DB connection failed: ", err);
    });

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
