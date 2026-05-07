import express from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './env.js';
import connect_db from './src/database/dataBaseConnect.js';
import routes from './src/routes/all.routes.js';
import cookieParser from 'cookie-parser';
import errorHandler from './src/middlewares/errorHandler.middleware.js';
import ApiError from './src/utils/ApiError.js';
import path from "path";
import { expireStaleRazorpayPayments } from './src/services/paymentExpiry.service.js';

const __dirname = path.resolve();
const distPath = path.join(__dirname, "dist");

// App configuration
const app = express();

// CORS configuration
const configuredOrigins = CORS_ORIGIN
    ? CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

const allowedOrigins = [
    "http://localhost:3000",
    // "tournament4-shubham9876794207-3100s-projects.vercel.app",
    "https://battle4arena.vercel.app",
    // "http://192.168.29.138:8080",
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

// // Serve static files
// app.use(express.static("public"));
// app.use(express.static(distPath))
// // 🔥 SPA fallback (IMPORTANT)
// app.use( (req, res) => {
//     res.sendFile(path.resolve("dist/index.html"));
// });

// All routes
app.use('/api/v1', routes);

app.use("/", (req, res) => {
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
        expireStaleRazorpayPayments().catch((err) => {
            console.error("Initial Razorpay payment expiry failed:", err);
        });
        setInterval(() => {
            expireStaleRazorpayPayments().catch((err) => {
                console.error("Razorpay payment expiry failed:", err);
            });
        }, 60 * 1000);

        app.listen(PORT, () => {
            console.log(`Server is listening on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("DB connection failed: ", err);
    });
