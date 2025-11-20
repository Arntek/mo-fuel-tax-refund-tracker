import { type Receipt, type InsertReceipt } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getAllReceipts(): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private receipts: Map<string, Receipt>;

  constructor() {
    this.receipts = new Map();
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).sort((a, b) => {
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    const receipt: Receipt = {
      ...insertReceipt,
      id,
      createdAt: new Date(),
    };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const existing = this.receipts.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: Receipt = {
      ...existing,
      ...updates,
    };
    this.receipts.set(id, updated);
    return updated;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    return this.receipts.delete(id);
  }
}

export const storage = new MemStorage();
