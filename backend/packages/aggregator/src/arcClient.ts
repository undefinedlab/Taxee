import axios, { type AxiosInstance } from "axios";
import type { ArcRecord } from "@taxee/shared";

/**
 * Arc API client — writes immutable disposal records to the Arc ledger.
 *
 * Arc is Circle's on-chain financial ledger. taxee writes one record per
 * disposal execution, providing users with a pre-filled Form 8949 data source.
 *
 * Every write is mandatory — the execution layer will not proceed without
 * a successful Arc record (fail-closed on audit).
 *
 * Docs: https://developers.circle.com/arc/reference (confirm URL before production)
 */
export class ArcClient {
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Write a disposal record to the Arc ledger.
   * Returns the Arc-assigned record ID used for referencing in receipts.
   */
  async writeDisposalRecord(record: Omit<ArcRecord, "id" | "createdAt">): Promise<string> {
    const res = await this.client.post<{ id: string }>("/disposals", record);
    return res.data.id;
  }

  /**
   * Fetch a single Arc record by ID (for verification / receipts).
   */
  async getRecord(recordId: string): Promise<ArcRecord> {
    const res = await this.client.get<ArcRecord>(`/disposals/${recordId}`);
    return res.data;
  }

  /**
   * List all disposal records for an agent, optionally filtered by date range.
   */
  async listRecords(params: {
    agentId: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ records: ArcRecord[]; nextCursor?: string }> {
    const res = await this.client.get<{ records: ArcRecord[]; nextCursor?: string }>(
      "/disposals",
      { params }
    );
    return res.data;
  }
}
