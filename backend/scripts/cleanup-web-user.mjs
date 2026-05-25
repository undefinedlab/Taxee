#!/usr/bin/env node
/**
 * Clean web onboarding state for a taxee user (agents + unlinked users.address).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/cleanup-web-user.mjs <userId-uuid>
 *   DATABASE_URL=... node scripts/cleanup-web-user.mjs --by-address 0x...
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "db", "package.json"),
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const args = process.argv.slice(2);
const byAddress = args[0] === "--by-address";
const target = byAddress ? args[1]?.toLowerCase() : args[0];

if (!target) {
  console.error(
    "Usage:\n  DATABASE_URL=... node scripts/cleanup-web-user.mjs <userId>\n  DATABASE_URL=... node scripts/cleanup-web-user.mjs --by-address 0x...",
  );
  process.exit(1);
}

const postgres = require("postgres");
const sql = postgres(url, { max: 1 });

let userId = target;
if (byAddress) {
  if (!/^0x[a-f0-9]{40}$/.test(target)) {
    console.error("Invalid address");
    process.exit(1);
  }
  const rows = await sql`SELECT id, address FROM users WHERE lower(address) = ${target}`;
  if (rows.length === 0) {
    console.log("No user with address", target);
    await sql.end();
    process.exit(0);
  }
  userId = rows[0].id;
  console.log("Found user", userId, "address", rows[0].address);
}

const agents = await sql`DELETE FROM agents WHERE user_id = ${userId} RETURNING id`;
const [user] = await sql`
  UPDATE users SET address = NULL WHERE id = ${userId} RETURNING id, address
`;

console.log({
  userId,
  deletedAgents: agents.length,
  userAddressAfter: user?.address ?? null,
});

await sql.end();
