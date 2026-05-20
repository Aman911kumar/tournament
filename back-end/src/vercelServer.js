import connect_db from "./database/dataBaseConnect.js";
import { createApp } from "./app.js";

// Vercel Serverless entry:
// - no app.listen()
// - no Socket.IO / background workers
// - reuse app + Mongo connection across invocations
const app = createApp();

export default async function vercelServer(req, res) {
  try {
    await connect_db();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Database connection failed" }));
    return;
  }

  return app(req, res);
}
