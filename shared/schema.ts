import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, serial, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("session_user_id_idx").on(table.userId),
  expiresAtIdx: index("session_expires_at_idx").on(table.expiresAt),
}));

export const authCodes = pgTable("auth_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("auth_code_email_idx").on(table.email),
  codeIdx: index("auth_code_code_idx").on(table.code),
}));

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("family"),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accountMembers = pgTable("account_members", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountUserIdx: index("account_member_idx").on(table.accountId, table.userId),
}));

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  vin: varchar("vin", { length: 17 }),
  year: integer("year").notNull(),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  fuelType: varchar("fuel_type", { length: 50 }).notNull(),
  weightUnder26000: boolean("weight_under_26000").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("vehicle_account_idx").on(table.accountId),
}));

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  date: text("date").notNull(),
  stationName: text("station_name").notNull(),
  gallons: numeric("gallons", { precision: 10, scale: 3 }).notNull(),
  pricePerGallon: numeric("price_per_gallon", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("receipt_account_idx").on(table.accountId),
  vehicleIdx: index("receipt_vehicle_idx").on(table.vehicleId),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

export const insertAuthCodeSchema = createInsertSchema(authCodes).omit({
  id: true,
  createdAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
});

export const insertAccountMemberSchema = createInsertSchema(accountMembers).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
}).extend({
  vin: z.string().length(17, "VIN must be exactly 17 characters").optional().or(z.literal("")),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  gallons: z.string().or(z.number()).transform(val => String(val)),
  pricePerGallon: z.string().or(z.number()).transform(val => String(val)),
  totalAmount: z.string().or(z.number()).transform(val => String(val)),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type AuthCode = typeof authCodes.$inferSelect;
export type InsertAuthCode = z.infer<typeof insertAuthCodeSchema>;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type AccountMember = typeof accountMembers.$inferSelect;
export type InsertAccountMember = z.infer<typeof insertAccountMemberSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;

export const aiTranscriptionSchema = z.object({
  date: z.string(),
  stationName: z.string(),
  gallons: z.number(),
  pricePerGallon: z.number(),
  totalAmount: z.number(),
});

export type AiTranscription = z.infer<typeof aiTranscriptionSchema>;
