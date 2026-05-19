import connect_db from "./src/database/dataBaseConnect.js";
import { initEmailSystem } from "./src/services/email/index.js";

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down email worker...`);
  // BullMQ worker shutdown is handled internally by process exit for now.
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

try {
  // Connect DB so optional email delivery logging can work.
  await connect_db();
  await initEmailSystem();
  console.log("Email worker started");
} catch (error) {
  console.error("Email worker failed to start:", error?.message || error);
  process.exit(1);
}

