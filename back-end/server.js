import { startServer } from "./src/server.js";

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
