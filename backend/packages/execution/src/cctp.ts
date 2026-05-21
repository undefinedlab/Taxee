import { createPublicClient, http, keccak256, toBytes, padHex, type Hex, type Chain } from "viem";
import { mainnet, sepolia, base, baseSepolia } from "viem/chains";
import type { CircleClient } from "@taxee/aggregator";

/**
 * CCTP V1 domain IDs — used in depositForBurn / receiveMessage calls.
 * https://developers.circle.com/stablecoins/docs/cctp-technical-reference
 */
export const CCTP_DOMAIN: Record<number, number> = {
  1:        0,  // Ethereum mainnet
  11155111: 0,  // Ethereum Sepolia
  8453:     6,  // Base mainnet
  84532:    6,  // Base Sepolia
  42161:    3,  // Arbitrum One
  137:      7,  // Polygon PoS
};

/** MessageTransmitter ABI — only the receiveMessage function needed for relay. */
const MESSAGE_TRANSMITTER_ABI = [
  {
    inputs: [
      { internalType: "bytes", name: "message",     type: "bytes" },
      { internalType: "bytes", name: "attestation", type: "bytes" },
    ],
    name:    "receiveMessage",
    outputs: [{ internalType: "bool", name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/** MessageTransmitter ABI — MessageSent event to extract message bytes from burn receipt. */
const MESSAGE_SENT_ABI = [
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "bytes", name: "message", type: "bytes" }],
    name: "MessageSent",
    type: "event",
  },
] as const;

const VIEM_CHAINS: Record<number, Chain> = {
  1:        mainnet,
  11155111: sepolia,
  8453:     base,
  84532:    baseSepolia,
};

export interface CctpBridgeParams {
  circle:                     CircleClient;
  sourceWalletId:             string;              // Circle developer wallet on source chain
  destinationWalletId:        string;              // Circle developer wallet on destination chain
  tokenMessengerAddress:      string;              // CCTP TokenMessenger on source chain
  messageTransmitterAddress:  string;              // CCTP MessageTransmitter on destination chain
  usdcSourceAddress:          string;              // USDC on source chain
  amountUsdc:                 string;              // atomic units (6 decimals, e.g. "1000000" = 1 USDC)
  sourceChainId:              number;
  destinationChainId:         number;
  destinationRecipient:       string;              // raw 0x address — will be bytes32-padded
  sourceRpcUrl:               string;              // viem RPC for reading source chain events
  paymasterWalletId?:         string;
}

export interface CctpBridgeResult {
  burnTxHash:     string;
  receiveTxHash:  string | undefined;
  attestation:    string | undefined;
}

/**
 * Bridge USDC from sourceChainId to destinationChainId using Circle CCTP V1.
 *
 * Full flow:
 *   1. Burn USDC on source chain (depositForBurn via Circle developer wallet)
 *   2. Parse `MessageSent` event from the burn receipt to get raw message bytes
 *   3. Hash the message bytes → messageHash
 *   4. Poll Circle Iris API until attestation is complete
 *   5. Relay on destination chain (receiveMessage via Circle developer wallet)
 */
export async function bridgeUsdcViaCctp(params: CctpBridgeParams): Promise<CctpBridgeResult> {
  const destinationDomain = CCTP_DOMAIN[params.destinationChainId];
  if (destinationDomain === undefined) {
    throw new Error(`No CCTP domain for chainId ${params.destinationChainId}`);
  }

  // bytes32-pad the recipient address: 0x + 24 zero bytes + 20 address bytes
  const mintRecipient = padHex(params.destinationRecipient as Hex, { size: 32, dir: "left" });

  // ── Step 1: Burn USDC on source chain ─────────────────────────────────────
  console.log(`[cctp] Burning ${params.amountUsdc} USDC atomic on chain ${params.sourceChainId}`);

  const burnTx = await params.circle.burnUsdcForCCTP({
    idempotencyKey:        `cctp-burn-${Date.now()}`,
    walletId:              params.sourceWalletId,
    tokenMessengerAddress: params.tokenMessengerAddress,
    usdcAddress:           params.usdcSourceAddress,
    amount:                params.amountUsdc,
    destinationDomain,
    mintRecipient,
    ...(params.paymasterWalletId !== undefined
      ? { paymasterWalletId: params.paymasterWalletId }
      : {}),
  });

  const confirmedBurn = await params.circle.pollTransaction(burnTx.id);
  if (confirmedBurn.state === "FAILED" || !confirmedBurn.txHash) {
    throw new Error(`CCTP burn transaction failed: ${burnTx.id}`);
  }

  const burnTxHash = confirmedBurn.txHash;
  console.log(`[cctp] Burn confirmed: ${burnTxHash}`);

  // ── Step 2: Parse MessageSent event from burn receipt ─────────────────────
  const sourceChain = VIEM_CHAINS[params.sourceChainId];
  if (!sourceChain) throw new Error(`No viem chain for sourceChainId ${params.sourceChainId}`);

  const viemClient = createPublicClient({
    chain:     sourceChain,
    transport: http(params.sourceRpcUrl),
  });

  const receipt = await viemClient.getTransactionReceipt({ hash: burnTxHash as Hex });

  // MessageSent event topic0 = keccak256("MessageSent(bytes)")
  const messageSentTopic = keccak256(toBytes("MessageSent(bytes)"));
  const messageSentLog = receipt.logs.find((log) => log.topics[0] === messageSentTopic);

  if (!messageSentLog) {
    throw new Error("MessageSent event not found in burn transaction receipt");
  }

  // Decode the ABI-encoded `bytes` from the log data
  // The data is: abi.encode(bytes) = offset(32) + length(32) + message_bytes
  const messageBytes = ("0x" + messageSentLog.data.slice(130)) as Hex; // skip 2+64+64 chars
  const messageHash  = keccak256(messageBytes);

  console.log(`[cctp] messageHash: ${messageHash} — polling Iris attestation...`);

  // ── Step 3: Poll Circle Iris for attestation ───────────────────────────────
  const attestation = await params.circle.pollAttestation(messageHash);
  console.log("[cctp] Attestation received");

  // ── Step 4: Relay on destination chain via Circle developer wallet ─────────
  const receiveTx = await params.circle.createDeveloperContractExecution({
    idempotencyKey:       `cctp-relay-${Date.now()}`,
    walletId:             params.destinationWalletId,
    contractAddress:      params.messageTransmitterAddress,
    abiFunctionSignature: "receiveMessage(bytes,bytes)",
    abiParameters:        [messageBytes, attestation],
    ...(params.paymasterWalletId !== undefined
      ? { paymasterWalletId: params.paymasterWalletId }
      : {}),
  });

  const confirmedRelay = await params.circle.pollTransaction(receiveTx.id);
  console.log(`[cctp] Relay confirmed: ${confirmedRelay.txHash}`);

  return {
    burnTxHash,
    receiveTxHash: confirmedRelay.txHash,
    attestation,
  };
}
