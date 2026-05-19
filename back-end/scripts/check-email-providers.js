// Usage:
//   node scripts/check-email-providers.js
//
// This script loads back-end/.env and runs provider health checks (nodemailer.verify()).

import "../env.js";
import { createHostingerProvider } from "../src/services/email/providers/hostinger.provider.js";
import { createSendPlusProvider } from "../src/services/email/providers/sendplus.provider.js";

const providers = [createHostingerProvider(), createSendPlusProvider()];

const run = async () => {
  for (const p of providers) {
    const configured = p.isConfigured();
    if (!configured) {
      console.log(`[${p.name}] configured=false (missing env vars)`);
      continue;
    }

    const res = await p.healthCheck();
    if (res.ok) {
      console.log(`[${p.name}] ok=true`);
    } else {
      console.log(`[${p.name}] ok=false reason="${res.reason || "unknown"}"`);
    }
  }
};

run().catch((err) => {
  console.error("Provider check failed:", err?.message || err);
  process.exit(1);
});

