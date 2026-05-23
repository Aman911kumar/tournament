import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";

import { CORS_ORIGIN } from "../env.js";
import routes from "./routes/all.routes.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import { globalApiLimiter } from "./middlewares/rateLimit.middleware.js";
import securityHeaders from "./middlewares/securityHeaders.middleware.js";
import requestMetrics from "./middlewares/requestMetrics.middleware.js";
import sanitizeRequest from "./middlewares/sanitizeRequest.middleware.js";
import ApiError from "./utils/ApiError.js";
import { getRuntimeConfig } from "./utils/runtime.js";

export const getAllowedOrigins = () => {
  const configuredOrigins = CORS_ORIGIN
    ? CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
  return [...configuredOrigins];
};

export const createApp = () => {
  const uploadPath = path.resolve(process.env.UPLOAD_DIR || "uploads");
  const runtime = getRuntimeConfig();

  const app = express();
  app.locals.runtime = runtime;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);

  // CORS configuration
  const allowedOrigins = getAllowedOrigins();
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

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // Body parsers
  app.use(express.json({ limit: "50kb" })); // JSON payload limit
  app.use(express.urlencoded({ extended: true, limit: "50kb" })); // form data
  app.use(cookieParser());

  app.use((req, res, next) => {
    const requestId =
      req.header("x-request-id") ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-b4a-platform", runtime.platform);
    res.setHeader("x-b4a-server-role", runtime.role);
    next();
  });

  app.use(requestMetrics);
  app.use(sanitizeRequest);

  app.use(
    "/uploads",
    express.static(uploadPath, {
      fallthrough: false,
      immutable: true,
      maxAge: "7d",
    })
  );

  // Serve static files
  app.use(express.static("public"));

  // All routes
  app.use("/api/v1", globalApiLimiter, routes);

  app.get("/", (req, res) => {
    res.json({
      ok: true,
      message: "server is live",
      platform: runtime.platform,
      role: runtime.role,
      realtimeEnabled: runtime.realtimeEnabled,
    });
  });

  app.use((req, res, next) => {
    next(new ApiError(404, `API endpoint doesn't exist`));
  });

  // Error handling middleware (should be last)
  app.use(errorHandler);

  return app;
};

export default createApp;
