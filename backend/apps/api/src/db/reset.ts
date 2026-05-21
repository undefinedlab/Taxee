import { db } from "./client.js";
import { sql } from "drizzle-orm";

async function reset() {
  await db.execute(sql`TRUNCATE heartbeats, llm_logs, opportunities, lots, agents, wallets, users CASCADE`);
  console.log("✅ Database wiped — all users, wallets, agents, lots, opportunities cleared.");
  process.exit(0);
}

reset().catch((e) => { console.error(e); process.exit(1); });
