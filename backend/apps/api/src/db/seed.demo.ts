/**
 * Demo seed — inserts realistic tax lots for the first active agent.
 *
 * Portfolio designed to trigger all three opportunity types:
 *   • ETH bought at peak  → HARVEST  (sitting at -18% unrealized loss)
 *   • BTC bought 340 days ago at a gain → MATURATION PARK (32 days to LT threshold)
 *   • LINK severely down  → HARVEST  (sitting at -24% unrealized loss)
 *
 * Run:  pnpm --filter @taxee/api db:seed:demo
 */
import { db, agents, users, lots } from "@taxee/db";
import { eq } from "drizzle-orm";

const now   = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

async function main() {
  const allAgents = await db
    .select({ id: agents.id, userId: agents.userId, policy: agents.policy })
    .from(agents)
    .where(eq(agents.status, "active"))
    .limit(1);

  if (allAgents.length === 0) {
    console.error("No active agent found. Register via Telegram first, then re-run.");
    process.exit(1);
  }

  const agent = allAgents[0]!;
  const [user] = await db.select().from(users).where(eq(users.id, agent.userId));
  console.log(`Seeding demo lots for agent=${agent.id}  wallet=${user?.address ?? "?"}`);

  await db.delete(lots).where(eq(lots.agentId, agent.id));
  console.log("Cleared existing lots.");

  const demoLots = [
    // ── ETH: bought at $3 800, now ~$2 600 → -31% → HARVEST candidate ──────────
    {
      agentId:      agent.id,
      assetId:      "ETH",
      chainId:      8453,
      quantity:     "0.8",
      costBasisUsd: "3040.00",   // 0.8 ETH × $3800
      acquiredAt:   daysAgo(95),
      status:       "open" as const,
      txHash:       "0xeth_lot_1_demo",
    },
    {
      agentId:      agent.id,
      assetId:      "ETH",
      chainId:      8453,
      quantity:     "0.5",
      costBasisUsd: "1750.00",   // 0.5 ETH × $3500
      acquiredAt:   daysAgo(200),
      status:       "open" as const,
      txHash:       "0xeth_lot_2_demo",
    },

    // ── BTC: bought 340 days ago → 32 days to LT threshold → MATURATION candidate
    {
      agentId:      agent.id,
      assetId:      "BTC",
      chainId:      8453,
      quantity:     "0.015",
      costBasisUsd: "1050.00",   // 0.015 BTC × $70 000
      acquiredAt:   daysAgo(340),
      status:       "open" as const,
      txHash:       "0xbtc_lot_1_demo",
    },

    // ── LINK: bought at $18, now ~$13 → -28% → HARVEST candidate ────────────────
    {
      agentId:      agent.id,
      assetId:      "LINK",
      chainId:      8453,
      quantity:     "120",
      costBasisUsd: "2160.00",   // 120 LINK × $18
      acquiredAt:   daysAgo(45),
      status:       "open" as const,
      txHash:       "0xlink_lot_1_demo",
    },
  ];

  await db.insert(lots).values(demoLots);
  console.log(`✅ Seeded ${demoLots.length} demo lots.`);
  console.log("");
  console.log("Lots summary:");
  console.log("  ETH  × 1.3 @ avg $3,685 cost  (should be at ~$2,600 now → ~-29% loss → HARVEST)");
  console.log("  BTC  × 0.015 @ $70k          (340 days old → 32 days to LT → MATURATION)");
  console.log("  LINK × 120  @ $18 cost        (should be at ~$13 now → ~-28% loss → HARVEST)");
  console.log("");
  console.log("Now run the heartbeat to generate opportunities:");
  console.log("  pnpm --filter @taxee/agent dev:trigger");

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
