import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import { PORT } from "../env.js";
import connect_db from "./database/dataBaseConnect.js";
import { createApp, getAllowedOrigins } from "./app.js";
import { getRuntimeConfig } from "./utils/runtime.js";

const app = createApp();
let dbReadyPromise = null;
let httpServerStarted = false;

const ensureDatabase = () => {
  if (!dbReadyPromise) {
    dbReadyPromise = connect_db().catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }
  return dbReadyPromise;
};

const isMainModule = () => {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
};

export const startServer = async () => {
  if (httpServerStarted) return;
  httpServerStarted = true;

  const runtime = getRuntimeConfig();
  const httpServer = createServer(app);
  const serverPort = PORT || 8000;

  let paymentExpiryRunning = false;
  let paymentExpiryTimer = null;
  let adminMonitoringTimer = null;

  const allowedOrigins = getAllowedOrigins();

  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    if (paymentExpiryTimer) clearInterval(paymentExpiryTimer);
    if (adminMonitoringTimer) clearInterval(adminMonitoringTimer);
    httpServer.close(async () => {
      const { default: mongoose } = await import("mongoose");
      await mongoose.connection.close(false).catch((error) => {
        console.error("MongoDB close failed:", error);
      });
      console.log("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  await ensureDatabase();

  let socketService = null;
  if (runtime.realtimeEnabled) {
    socketService = await import("./services/socket.service.js");
    socketService.initSocket(httpServer, allowedOrigins);
  }

  if (runtime.backgroundWorkersEnabled) {
    const [
      { expireStaleRazorpayPayments },
      { getMonitoringSnapshot },
    ] = await Promise.all([
      import("./services/paymentExpiry.service.js"),
      import("./services/monitoring.service.js"),
    ]);
    socketService ||= await import("./services/socket.service.js");

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

    runPaymentExpiry();
    paymentExpiryTimer = setInterval(runPaymentExpiry, 60 * 1000);
    paymentExpiryTimer.unref?.();

    adminMonitoringTimer = setInterval(() => {
      socketService.emitToAdmins("admin:monitoring", getMonitoringSnapshot());
    }, Number(process.env.ADMIN_MONITORING_PUSH_MS || 10_000));
    adminMonitoringTimer.unref?.();
  }

  httpServer.listen(serverPort, () => {
    console.log(`Server is listening on http://localhost:${serverPort}`, {
      platform: runtime.platform,
      role: runtime.role,
      realtimeEnabled: runtime.realtimeEnabled,
      backgroundWorkersEnabled: runtime.backgroundWorkersEnabled,
    });
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

export const serverlessHandler = async (req, res) => {
  try {
    await ensureDatabase();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Database connection failed" }));
    return;
  }

  return app(req, res);
};

if (isMainModule()) {
  startServer().catch((err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
  });
}

export default serverlessHandler;
