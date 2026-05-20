import { createServer } from "http";
import mongoose from "mongoose";

import { PORT } from "../env.js";
import connect_db from "./database/dataBaseConnect.js";
import { createApp, getAllowedOrigins } from "./app.js";

import { expireStaleRazorpayPayments } from "./services/paymentExpiry.service.js";
import { emitToAdmins, initSocket } from "./services/socket.service.js";
import { getMonitoringSnapshot } from "./services/monitoring.service.js";
import { initEmailSystem } from "./services/email/index.js";

export const startServer = async () => {
  const app = createApp();
  const httpServer = createServer(app);
  const serverPort = PORT || 8000;

  let paymentExpiryRunning = false;
  let paymentExpiryTimer = null;
  let adminMonitoringTimer = null;

  const isVercel = Boolean(process.env.VERCEL);
  const allowedOrigins = getAllowedOrigins();

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
    if (adminMonitoringTimer) clearInterval(adminMonitoringTimer);
    httpServer.close(async () => {
      await mongoose.connection.close(false).catch((error) => {
        console.error("MongoDB close failed:", error);
      });
      console.log("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  // DB connection & server start
  await connect_db();

  // Socket.IO should run only on long-running servers (Render/local). Vercel is serverless.
  if (!isVercel) {
    initSocket(httpServer, allowedOrigins);

    initEmailSystem().catch((error) => {
      console.error("Email worker failed to start:", error?.message || error);
    });

    runPaymentExpiry();
    paymentExpiryTimer = setInterval(runPaymentExpiry, 60 * 1000);
    paymentExpiryTimer.unref?.();

    adminMonitoringTimer = setInterval(() => {
      emitToAdmins("admin:monitoring", getMonitoringSnapshot());
    }, Number(process.env.ADMIN_MONITORING_PUSH_MS || 10_000));
    adminMonitoringTimer.unref?.();
  }

  httpServer.listen(serverPort, () => {
    console.log(`Server is listening on http://localhost:${serverPort}`);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

export default startServer;

