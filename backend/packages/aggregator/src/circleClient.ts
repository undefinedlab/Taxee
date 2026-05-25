import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";

export type CircleEnvironment = "sandbox" | "production";

export type CircleBlockchain =
  | "ETH"
  | "ETH-SEPOLIA"
  | "BASE"
  | "BASE-SEPOLIA"
  | "MATIC"
  | "ARB";

export interface CircleWallet {
  id: string;
  state: string;
  walletSetId: string;
  custodyType: string;
  address: string;
  blockchain: string;
  accountType: string;
  updateDate: string;
  createDate: string;
}

export interface CircleBalance {
  token: { id: string; blockchain: string; symbol: string; decimals: number };
  amount: string;
  updateDate: string;
}

export interface CircleTransactionResult {
  id: string;
  state: string;
  txHash?: string;
  createDate: string;
}

/**
 * Circle Programmable Wallets client — developer-controlled wallet tier.
 *
 * All mutation operations (wallet creation, contract execution) require
 * entity secret encryption: the 32-byte hex entitySecret is RSA-OAEP-SHA256
 * encrypted with the entity's public key and sent as `entitySecretCiphertext`.
 *
 * CCTP support: `burnUsdcForCCTP` calls `TokenMessenger.depositForBurn` via
 * Circle wallet, then `pollAttestation` polls Circle's Iris API for the
 * cross-chain attestation needed to relay on the destination chain.
 *
 * Paymaster: pass `paymasterWalletId` to `createDeveloperContractExecution`
 * to sponsor gas in USDC via Circle's ERC-4337 Paymaster on Base.
 *
 * Full docs: https://developers.circle.com/w3s/reference
 */
export class CircleClient {
  private readonly client: AxiosInstance;
  private readonly irisClient: AxiosInstance;
  private readonly environment: CircleEnvironment;
  private readonly entitySecret: string | undefined;
  private cachedPublicKey?: string;

  constructor(
    apiKey: string,
    environment: CircleEnvironment = "sandbox",
    entitySecret?: string
  ) {
    this.environment = environment;
    this.entitySecret = entitySecret;

    this.client = axios.create({
      baseURL: "https://api.circle.com/v1/w3s",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    this.irisClient = axios.create({
      baseURL: environment === "production"
        ? "https://iris-api.circle.com"
        : "https://iris-api-sandbox.circle.com",
    });
  }

  // ─── Entity Secret Encryption (RSA-OAEP-SHA256) ──────────────────────────

  async getEntityPublicKey(): Promise<string> {
    const res = await this.client.get<{ data: { publicKey: string } }>(
      "/config/entity/publicKey"
    );
    return res.data.data.publicKey;
  }

  private async encryptEntitySecret(): Promise<string> {
    if (!this.entitySecret) {
      throw new Error(
        "CIRCLE_ENTITY_SECRET not set — developer-controlled wallet operations require it"
      );
    }

    if (!this.cachedPublicKey) {
      this.cachedPublicKey = await this.getEntityPublicKey();
    }

    const publicKey = crypto.createPublicKey({ key: this.cachedPublicKey, format: "pem" });
    const ciphertext = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(this.entitySecret, "hex")
    );
    return ciphertext.toString("base64");
  }

  // ─── Developer-Controlled Wallet Management ───────────────────────────────

  async createWalletSet(idempotencyKey: string): Promise<{ id: string }> {
    const entitySecretCiphertext = await this.encryptEntitySecret();
    const res = await this.client.post<{ data: { walletSet: { id: string } } }>(
      "/developer/walletSets",
      { idempotencyKey, entitySecretCiphertext }
    );
    return { id: res.data.data.walletSet.id };
  }

  async createDeveloperWallet(params: {
    idempotencyKey: string;
    walletSetId: string;
    blockchain: CircleBlockchain;
  }): Promise<{ id: string; address: string; blockchain: string }> {
    const entitySecretCiphertext = await this.encryptEntitySecret();
    const res = await this.client.post<{
      data: { wallets: Array<{ id: string; address: string; blockchain: string }> };
    }>("/developer/wallets", {
      idempotencyKey:        params.idempotencyKey,
      entitySecretCiphertext,
      walletSetId:           params.walletSetId,
      blockchains:           [params.blockchain],
      count:                 1,
    });
    const wallet = res.data.data.wallets[0];
    if (!wallet) throw new Error("Circle returned no wallet in createDeveloperWallet response");
    return wallet;
  }

  async getWallet(walletId: string): Promise<CircleWallet> {
    const res = await this.client.get<{ data: { wallet: CircleWallet } }>(
      `/wallets/${walletId}`
    );
    return res.data.data.wallet;
  }

  async listWallets(walletSetId: string): Promise<CircleWallet[]> {
    const res = await this.client.get<{ data: { wallets: CircleWallet[] } }>(
      `/wallets?walletSetId=${walletSetId}`
    );
    return res.data.data.wallets;
  }

  async getBalances(walletId: string): Promise<CircleBalance[]> {
    const res = await this.client.get<{ data: { tokenBalances: CircleBalance[] } }>(
      `/wallets/${walletId}/balances`
    );
    return res.data.data.tokenBalances;
  }

  // ─── User-Controlled Wallet Management ───────────────────────────────────

  /** Register a Circle user by your internal user ID. Idempotent. */
  async createCircleUser(userId: string): Promise<void> {
    await this.client.post("/users", { userId });
  }

  /** List user-controlled wallets for a Circle user (by taxee userId). */
  async listUserWallets(
    userId: string,
  ): Promise<Array<{ id: string; address: string; blockchain: string }>> {
    const res = await this.client.get<{
      data: { wallets: Array<{ id: string; address: string; blockchain: string }> };
    }>("/wallets", { params: { userId } });
    return res.data?.data?.wallets ?? [];
  }

  /**
   * Get a short-lived session token for a Circle user.
   * Returns `userToken` + `encryptionKey` — both are passed to the web SDK.
   */
  async getUserToken(userId: string): Promise<{ userToken: string; encryptionKey: string }> {
    const res = await this.client.post<{
      data: { userToken: string; encryptionKey: string };
    }>("/users/token", { userId });
    return res.data.data;
  }

  /**
   * Initialize a new Circle user — sets their PIN + security questions AND
   * creates their wallet in a single SDK challenge (INITIALIZE_USER_AND_WALLET).
   *
   * This must be called FIRST before any wallet creation or transaction challenges.
   * After the user completes this via the web SDK, subsequent operations use
   * createUserWallet() or createUserContractExecution().
   */
  async initializeUser(params: {
    userToken: string;
    idempotencyKey: string;
    blockchains: CircleBlockchain[];
  }): Promise<{ challengeId: string }> {
    const res = await this.client.post<{ data: { challengeId: string } }>(
      "/user/initialize",
      {
        idempotencyKey: params.idempotencyKey,
        blockchains:    params.blockchains,
      },
      { headers: { "X-User-Token": params.userToken } }
    );
    return { challengeId: res.data.data.challengeId };
  }

  /**
   * Initiate wallet creation for a user-controlled wallet.
   * Only call this AFTER the user has completed initializeUser() (PIN already set).
   * Returns a `challengeId` — pass it + `userToken` to the Circle web SDK.
   */
  async createUserWallet(params: {
    userToken: string;
    idempotencyKey: string;
    blockchains: CircleBlockchain[];
  }): Promise<{ challengeId: string }> {
    const res = await this.client.post<{ data: { challengeId: string } }>(
      "/user/wallets",
      {
        idempotencyKey: params.idempotencyKey,
        blockchains:    params.blockchains,
      },
      { headers: { "X-User-Token": params.userToken } }
    );
    return { challengeId: res.data.data.challengeId };
  }

  /**
   * Create an execution challenge for a user-controlled wallet transaction.
   * Returns a `challengeId` — pass it to the Circle web SDK for PIN confirmation.
   * Circle's MPC nodes co-sign only after the user confirms.
   */
  async createUserContractExecution(params: {
    userToken: string;
    idempotencyKey: string;
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: unknown[];
    feeLevel?: "LOW" | "MEDIUM" | "HIGH";
    paymasterWalletId?: string;
  }): Promise<{ challengeId: string }> {
    const res = await this.client.post<{ data: { challengeId: string } }>(
      "/user/transactions/contractExecution",
      {
        idempotencyKey:       params.idempotencyKey,
        walletId:             params.walletId,
        contractAddress:      params.contractAddress,
        abiFunctionSignature: params.abiFunctionSignature,
        abiParameters:        params.abiParameters,
        ...(params.paymasterWalletId
          ? { feeConfig: { type: "PAYMASTER", sponsorWalletId: params.paymasterWalletId } }
          : { feeLevel: params.feeLevel ?? "MEDIUM" }
        ),
      },
      { headers: { "X-User-Token": params.userToken } }
    );
    return { challengeId: res.data.data.challengeId };
  }

  // ─── Developer-Controlled Contract Execution ─────────────────────────────

  /**
   * Execute a contract call from a developer-controlled Circle wallet.
   *
   * Pass `paymasterWalletId` to sponsor gas in USDC via Circle Paymaster (Base only).
   * Omit it to pay gas in the chain's native token.
   */
  async createDeveloperContractExecution(params: {
    idempotencyKey: string;
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: unknown[];
    feeLevel?: "LOW" | "MEDIUM" | "HIGH";
    gasLimit?: string;
    paymasterWalletId?: string;
  }): Promise<CircleTransactionResult> {
    const entitySecretCiphertext = await this.encryptEntitySecret();
    const res = await this.client.post<{ data: { transaction: CircleTransactionResult } }>(
      "/developer/transactions/contractExecution",
      {
        idempotencyKey:        params.idempotencyKey,
        entitySecretCiphertext,
        walletId:              params.walletId,
        contractAddress:       params.contractAddress,
        abiFunctionSignature:  params.abiFunctionSignature,
        abiParameters:         params.abiParameters,
        ...(params.paymasterWalletId
          ? { feeConfig: { type: "PAYMASTER", sponsorWalletId: params.paymasterWalletId } }
          : { feeLevel: params.feeLevel ?? "MEDIUM" }
        ),
        ...(params.gasLimit ? { gasLimit: params.gasLimit } : {}),
      }
    );
    return res.data.data.transaction;
  }

  // ─── CCTP Cross-Chain Bridge ──────────────────────────────────────────────

  /**
   * Burn USDC on the source chain via CCTP TokenMessenger.
   *
   * Calls `depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken)`.
   * After confirmation, call `pollAttestation(txHash)` to get the Circle-signed attestation
   * needed to relay (mint) on the destination chain.
   *
   * CCTP domain IDs: ETH=0, ETH-SEPOLIA=0, BASE=6, BASE-SEPOLIA=6, ARB=3
   */
  async burnUsdcForCCTP(params: {
    idempotencyKey: string;
    walletId: string;
    tokenMessengerAddress: string;
    usdcAddress: string;
    amount: string;            // atomic units — 6 decimals (e.g. "1000000" = 1 USDC)
    destinationDomain: number;
    mintRecipient: string;     // bytes32-padded recipient on destination (0x + 64 hex chars)
    paymasterWalletId?: string;
  }): Promise<CircleTransactionResult> {
    return this.createDeveloperContractExecution({
      idempotencyKey:       params.idempotencyKey,
      walletId:             params.walletId,
      contractAddress:      params.tokenMessengerAddress,
      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
      abiParameters:        [
        params.amount,
        params.destinationDomain,
        params.mintRecipient,
        params.usdcAddress,
      ],
      ...(params.paymasterWalletId !== undefined ? { paymasterWalletId: params.paymasterWalletId } : {}),
    });
  }

  /**
   * Poll Circle's Iris attestation API for a CCTP burn.
   *
   * `messageHash` = keccak256 of the `message` bytes from the `MessageSent` event
   * emitted by `MessageTransmitter` on the source chain.
   *
   * Returns the Base64-encoded attestation once confirmed (can take 5–20 min on mainnet).
   */
  async getAttestation(messageHash: string): Promise<{
    status: "complete" | "pending_confirmations";
    attestation?: string;
  }> {
    const res = await this.irisClient.get<{ status: string; attestation?: string }>(
      `/attestations/${messageHash}`
    );
    return {
      status: res.data.status === "complete" ? "complete" : "pending_confirmations",
      ...(res.data.attestation !== undefined ? { attestation: res.data.attestation } : {}),
    };
  }

  async pollAttestation(
    messageHash: string,
    opts: { maxAttempts?: number; intervalMs?: number } = {}
  ): Promise<string> {
    const maxAttempts = opts.maxAttempts ?? 120;
    const intervalMs  = opts.intervalMs  ?? 10_000;

    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.getAttestation(messageHash);
      if (result.status === "complete" && result.attestation) {
        return result.attestation;
      }
      await sleep(intervalMs);
    }

    throw new Error(`CCTP attestation not complete after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 60_000} min)`);
  }

  // ─── Transaction Polling ──────────────────────────────────────────────────

  async getTransaction(transactionId: string): Promise<CircleTransactionResult> {
    const res = await this.client.get<{ data: { transaction: CircleTransactionResult } }>(
      `/transactions/${transactionId}`
    );
    return res.data.data.transaction;
  }

  async pollTransaction(
    transactionId: string,
    opts: { maxAttempts?: number; intervalMs?: number } = {}
  ): Promise<CircleTransactionResult> {
    const maxAttempts = opts.maxAttempts ?? 30;
    const intervalMs  = opts.intervalMs  ?? 3_000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tx = await this.getTransaction(transactionId);
      if (tx.state === "CONFIRMED" || tx.state === "FAILED") return tx;
      await sleep(intervalMs);
    }

    throw new Error(`Transaction ${transactionId} did not confirm after ${maxAttempts} attempts`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
