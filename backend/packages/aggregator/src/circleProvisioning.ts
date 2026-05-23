import { CircleClient, type CircleBlockchain, type CircleEnvironment } from "./circleClient.js";

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
    const wallet = await circle.createDeveloperWallet({
      idempotencyKey: params.idempotencyKey,
      walletSetId,
      blockchain:     params.blockchain ?? "BASE",
    });
    return { status: "provisioned", wallet };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", reason: msg };
  }
}
