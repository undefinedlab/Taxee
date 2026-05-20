import axios, { type AxiosInstance } from "axios";

export type CircleEnvironment = "sandbox" | "production";

interface CircleWallet {
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

interface CircleBalance {
  token: { id: string; blockchain: string; symbol: string; decimals: number };
  amount: string;
  updateDate: string;
}

interface CircleTransactionResult {
  id: string;
  state: string;
  txHash?: string;
  createDate: string;
}

/**
 * Thin wrapper around Circle Programmable Wallets + Paymaster APIs.
 *
 * Only the methods taxee actually calls are implemented:
 *   - getWallet / listWallets
 *   - getBalances
 *   - createContractExecution (calls TaxeeExecutor or TaxeeLotRegistry)
 *   - getTransaction (for polling status)
 *
 * Full Circle API docs: https://developers.circle.com/w3s/reference
 */
export class CircleClient {
  private readonly client: AxiosInstance;
  private readonly environment: CircleEnvironment;

  constructor(apiKey: string, environment: CircleEnvironment = "sandbox") {
    this.environment = environment;
    const baseURL =
      environment === "production"
        ? "https://api.circle.com/v1/w3s"
        : "https://api.circle.com/v1/w3s";

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
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

  async createContractExecution(params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: unknown[];
    feeLevel?: "LOW" | "MEDIUM" | "HIGH";
  }): Promise<CircleTransactionResult> {
    const res = await this.client.post<{ data: { transaction: CircleTransactionResult } }>(
      "/transactions/contractExecution",
      {
        walletId:             params.walletId,
        contractAddress:      params.contractAddress,
        abiFunctionSignature: params.abiFunctionSignature,
        abiParameters:        params.abiParameters,
        feeLevel:             params.feeLevel ?? "MEDIUM",
      }
    );
    return res.data.data.transaction;
  }

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
    const intervalMs  = opts.intervalMs  ?? 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tx = await this.getTransaction(transactionId);
      if (tx.state === "CONFIRMED" || tx.state === "FAILED") {
        return tx;
      }
      await sleep(intervalMs);
    }

    throw new Error(`Transaction ${transactionId} did not confirm after ${maxAttempts} attempts`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
