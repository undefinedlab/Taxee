import crypto from "node:crypto";
import { CircleClient, type CircleBlockchain, type CircleEnvironment } from "./circleClient.js";

function toUUID(input: string): string {
  const h = crypto.createHash("md5").update(input).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

export interface ProvisionedWallet {
  id:         string;
  address:    string;
  blockchain: string;
}

export interface CircleProvisioningResult {
  status:  "provisioned" | "skipped" | "failed";
  wallet?: ProvisionedWallet;
  reason?: string;
}

/**
 * Provision a Circle developer-controlled wallet for a user/agent.
 *
 * Reads the four required env vars; returns a structured result rather than throwing
 * so callers can render a clean "wallet creation skipped/failed" status to the user
 * without halting the rest of agent setup.
 *
 * Defaults to Base mainnet since the executor + park contracts live there. Override
 * `blockchain` for testnets or other chains.
 */
export async function provisionCircleWallet(params: {
  idempotencyKey: string;
  blockchain?:    CircleBlockchain;
}): Promise<CircleProvisioningResult> {
  const apiKey       = process.env["CIRCLE_API_KEY"];
  const entitySecret = process.env["CIRCLE_ENTITY_SECRET"];
  const walletSetId  = process.env["CIRCLE_WALLET_SET_ID"];

  if (!apiKey || !entitySecret || !walletSetId) {
    return {
      status: "skipped",
      reason: "CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, or CIRCLE_WALLET_SET_ID not set",
    };
  }

  const env: CircleEnvironment = (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as CircleEnvironment;

  try {
    const circle = new CircleClient(apiKey, env, entitySecret);
    const defaultChain: CircleBlockchain = env === "production"
      ? "BASE"
      : (process.env["CIRCLE_WALLET_BLOCKCHAIN"] ?? "ARC-TESTNET") as CircleBlockchain;
    const wallet = await circle.createDeveloperWallet({
      idempotencyKey: toUUID(params.idempotencyKey),
      walletSetId,
      blockchain:     params.blockchain ?? defaultChain,
    });
    return { status: "provisioned", wallet };
  } catch (err: unknown) {
    const axiosData = (err as any)?.response?.data;
    const msg = axiosData
      ? JSON.stringify(axiosData)
      : err instanceof Error ? err.message : String(err);
    return { status: "failed", reason: msg };
  }
}
