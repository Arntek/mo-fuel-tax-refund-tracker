import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import {
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type AuthCode,
  type InsertAuthCode,
  type Account,
  type InsertAccount,
  type AccountMember,
  type InsertAccountMember,
  type Vehicle,
  type InsertVehicle,
  type Receipt,
  type InsertReceipt,
} from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export interface IStorage {
  // User operations
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;
  deleteExpiredSessions(): Promise<void>;

  // Auth code operations
  createAuthCode(authCode: InsertAuthCode): Promise<AuthCode>;
  getAuthCodeByEmailAndCode(email: string, code: string): Promise<AuthCode | undefined>;
  deleteAuthCode(id: string): Promise<boolean>;
  deleteExpiredAuthCodes(): Promise<void>;

  // Account operations
  getAccountById(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, updates: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  getUserAccounts(userId: string): Promise<(Account & { role: string; memberCount: number })[]>;

  // Account member operations
  getAccountMembers(accountId: string): Promise<(AccountMember & { user: User })[]>;
  addAccountMember(member: InsertAccountMember): Promise<AccountMember>;
  updateMemberRole(accountId: string, userId: string, role: string): Promise<AccountMember | undefined>;
  deactivateAccountMember(accountId: string, userId: string): Promise<AccountMember | undefined>;
  reactivateAccountMember(accountId: string, userId: string): Promise<AccountMember | undefined>;
  removeAccountMember(accountId: string, userId: string): Promise<boolean>;
  isUserAccountMember(accountId: string, userId: string): Promise<boolean>;
  getUserRole(accountId: string, userId: string): Promise<string | undefined>;

  // Vehicle operations
  getAccountVehicles(accountId: string): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;

  // Receipt operations
  getAccountReceipts(accountId: string): Promise<(Receipt & { uploadedByUser: User; vehicle: Vehicle | null })[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // User operations
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  // Session operations
  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(schema.sessions).values(insertSession).returning();
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).limit(1);
    if (session && session.expiresAt < new Date()) {
      await this.deleteSession(id);
      return undefined;
    }
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(schema.sessions).where(eq(schema.sessions.expiresAt, new Date()));
  }

  // Auth code operations
  async createAuthCode(insertAuthCode: InsertAuthCode): Promise<AuthCode> {
    const [authCode] = await db.insert(schema.authCodes).values(insertAuthCode).returning();
    return authCode;
  }

  async getAuthCodeByEmailAndCode(email: string, code: string): Promise<AuthCode | undefined> {
    const [authCode] = await db
      .select()
      .from(schema.authCodes)
      .where(and(eq(schema.authCodes.email, email), eq(schema.authCodes.code, code)))
      .limit(1);
    
    if (authCode && authCode.expiresAt < new Date()) {
      await this.deleteAuthCode(authCode.id);
      return undefined;
    }
    return authCode;
  }

  async deleteAuthCode(id: string): Promise<boolean> {
    const result = await db.delete(schema.authCodes).where(eq(schema.authCodes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteExpiredAuthCodes(): Promise<void> {
    await db.delete(schema.authCodes).where(eq(schema.authCodes.expiresAt, new Date()));
  }

  // Account operations
  async getAccountById(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, id)).limit(1);
    return account;
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const [account] = await db.insert(schema.accounts).values(insertAccount).returning();
    await db.insert(schema.accountMembers).values({
      accountId: account.id,
      userId: insertAccount.ownerId,
      role: "owner",
    });
    return account;
  }

  async updateAccount(id: string, updates: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db.update(schema.accounts).set(updates).where(eq(schema.accounts.id, id)).returning();
    return updated;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserAccounts(userId: string): Promise<(Account & { role: string; memberCount: number })[]> {
    const result = await db
      .select()
      .from(schema.accounts)
      .innerJoin(schema.accountMembers, eq(schema.accounts.id, schema.accountMembers.accountId))
      .where(and(eq(schema.accountMembers.userId, userId), eq(schema.accountMembers.active, true)))
      .orderBy(desc(schema.accounts.createdAt));

    const accountsWithCounts = await Promise.all(
      result.map(async (row) => {
        const members = await db
          .select()
          .from(schema.accountMembers)
          .where(and(eq(schema.accountMembers.accountId, row.accounts.id), eq(schema.accountMembers.active, true)));
        return {
          ...row.accounts,
          role: row.account_members.role,
          memberCount: members.length,
        };
      })
    );

    return accountsWithCounts;
  }

  // Account member operations
  async getAccountMembers(accountId: string): Promise<(AccountMember & { user: User })[]> {
    const members = await db
      .select({
        id: schema.accountMembers.id,
        accountId: schema.accountMembers.accountId,
        userId: schema.accountMembers.userId,
        role: schema.accountMembers.role,
        active: schema.accountMembers.active,
        createdAt: schema.accountMembers.createdAt,
        user: schema.users,
      })
      .from(schema.accountMembers)
      .innerJoin(schema.users, eq(schema.accountMembers.userId, schema.users.id))
      .where(eq(schema.accountMembers.accountId, accountId));

    return members;
  }

  async addAccountMember(insertMember: InsertAccountMember): Promise<AccountMember> {
    const [member] = await db.insert(schema.accountMembers).values(insertMember).returning();
    return member;
  }

  async updateMemberRole(accountId: string, userId: string, role: string): Promise<AccountMember | undefined> {
    const [updated] = await db
      .update(schema.accountMembers)
      .set({ role })
      .where(and(eq(schema.accountMembers.accountId, accountId), eq(schema.accountMembers.userId, userId)))
      .returning();
    return updated;
  }

  async deactivateAccountMember(accountId: string, userId: string): Promise<AccountMember | undefined> {
    const [updated] = await db
      .update(schema.accountMembers)
      .set({ active: false })
      .where(and(eq(schema.accountMembers.accountId, accountId), eq(schema.accountMembers.userId, userId)))
      .returning();
    return updated;
  }

  async reactivateAccountMember(accountId: string, userId: string): Promise<AccountMember | undefined> {
    const [updated] = await db
      .update(schema.accountMembers)
      .set({ active: true })
      .where(and(eq(schema.accountMembers.accountId, accountId), eq(schema.accountMembers.userId, userId)))
      .returning();
    return updated;
  }

  async removeAccountMember(accountId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(schema.accountMembers)
      .where(and(eq(schema.accountMembers.accountId, accountId), eq(schema.accountMembers.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async isUserAccountMember(accountId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(schema.accountMembers)
      .where(and(
        eq(schema.accountMembers.accountId, accountId),
        eq(schema.accountMembers.userId, userId),
        eq(schema.accountMembers.active, true)
      ))
      .limit(1);
    return !!member;
  }

  async getUserRole(accountId: string, userId: string): Promise<string | undefined> {
    const [member] = await db
      .select()
      .from(schema.accountMembers)
      .where(and(
        eq(schema.accountMembers.accountId, accountId),
        eq(schema.accountMembers.userId, userId),
        eq(schema.accountMembers.active, true)
      ))
      .limit(1);
    return member?.role;
  }

  // Vehicle operations
  async getAccountVehicles(accountId: string): Promise<Vehicle[]> {
    return db.select().from(schema.vehicles).where(eq(schema.vehicles.accountId, accountId));
  }

  async getVehicleById(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1);
    return vehicle;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(schema.vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db.update(schema.vehicles).set(updates).where(eq(schema.vehicles.id, id)).returning();
    return updated;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const result = await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Receipt operations
  async getAccountReceipts(accountId: string): Promise<(Receipt & { uploadedByUser: User; vehicle: Vehicle | null })[]> {
    const receipts = await db
      .select({
        receipt: schema.receipts,
        uploadedByUser: schema.users,
        vehicle: schema.vehicles,
      })
      .from(schema.receipts)
      .innerJoin(schema.users, eq(schema.receipts.uploadedBy, schema.users.id))
      .leftJoin(schema.vehicles, eq(schema.receipts.vehicleId, schema.vehicles.id))
      .where(eq(schema.receipts.accountId, accountId))
      .orderBy(desc(schema.receipts.createdAt));

    return receipts.map((r) => ({
      ...r.receipt,
      uploadedByUser: r.uploadedByUser,
      vehicle: r.vehicle,
    }));
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(schema.receipts).where(eq(schema.receipts.id, id)).limit(1);
    return receipt;
  }

  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const [receipt] = await db.insert(schema.receipts).values(insertReceipt).returning();
    return receipt;
  }

  async updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const [updated] = await db.update(schema.receipts).set(updates).where(eq(schema.receipts.id, id)).returning();
    return updated;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    const result = await db.delete(schema.receipts).where(eq(schema.receipts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DbStorage();
