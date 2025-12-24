import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, serial, integer, boolean, index, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("session_user_id_idx").on(table.userId),
  expiresAtIdx: index("session_expires_at_idx").on(table.expiresAt),
}));

export const authCodes = pgTable("auth_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("auth_code_email_idx").on(table.email),
  codeIdx: index("auth_code_code_idx").on(table.code),
}));

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("family"),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  totalReceiptsUploaded: integer("total_receipts_uploaded").notNull().default(0),
  businessName: varchar("business_name", { length: 255 }),
  fein: varchar("fein", { length: 20 }),
  firstName: varchar("first_name", { length: 255 }),
  middleInitial: varchar("middle_initial", { length: 10 }),
  lastName: varchar("last_name", { length: 255 }),
  ssn: varchar("ssn", { length: 20 }),
  spouseFirstName: varchar("spouse_first_name", { length: 255 }),
  spouseMiddleInitial: varchar("spouse_middle_initial", { length: 10 }),
  spouseLastName: varchar("spouse_last_name", { length: 255 }),
  spouseSsn: varchar("spouse_ssn", { length: 20 }),
  mailingAddress: text("mailing_address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  emailAddress: varchar("email_address", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  faxNumber: varchar("fax_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accountMembers = pgTable("account_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountUserIdx: index("account_member_idx").on(table.accountId, table.userId),
}));

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  vin: varchar("vin", { length: 17 }),
  nickname: varchar("nickname", { length: 100 }),
  year: integer("year").notNull(),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  fuelType: varchar("fuel_type", { length: 50 }).notNull(),
  weightUnder26000: boolean("weight_under_26000").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("vehicle_account_idx").on(table.accountId),
}));

export const vehicleMembers = pgTable("vehicle_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  vehicleUserIdx: index("vehicle_member_idx").on(table.vehicleId, table.userId),
}));

export const taxRates = pgTable("tax_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  fuelType: varchar("fuel_type", { length: 50 }).notNull().default("Motor Fuel"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  baseRate: numeric("base_rate", { precision: 10, scale: 3 }).notNull(),
  increase: numeric("increase", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("tax_rate_date_idx").on(table.startDate, table.endDate),
}));

export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  date: text("date").notNull(),
  stationName: text("station_name").notNull(),
  sellerStreet: text("seller_street"),
  sellerCity: text("seller_city"),
  sellerState: varchar("seller_state", { length: 2 }),
  sellerZip: varchar("seller_zip", { length: 10 }),
  validated: boolean("validated").notNull().default(false),
  processingStatus: varchar("processing_status", { length: 20 }).notNull().default("pending"),
  processingError: text("processing_error"),
  gallons: numeric("gallons", { precision: 10, scale: 3 }),
  pricePerGallon: numeric("price_per_gallon", { precision: 10, scale: 3 }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
  fiscalYear: text("fiscal_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("receipt_account_idx").on(table.accountId),
  vehicleIdx: index("receipt_vehicle_idx").on(table.vehicleId),
}));

export const fiscalYearPlans = pgTable("fiscal_year_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  fiscalYear: text("fiscal_year").notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  priceInCents: integer("price_in_cents").notNull().default(1200),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accountSubscriptions = pgTable("account_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  fiscalYear: text("fiscal_year").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("trial"),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  receiptCount: integer("receipt_count").notNull().default(0),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountFiscalYearIdx: index("account_subscription_idx").on(table.accountId, table.fiscalYear),
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

export const insertVehicleMemberSchema = createInsertSchema(vehicleMembers).omit({
  id: true,
  createdAt: true,
});

export const insertTaxRateSchema = createInsertSchema(taxRates).omit({
  id: true,
  createdAt: true,
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  gallons: z.string().or(z.number()).transform(val => String(val)).optional(),
  pricePerGallon: z.string().or(z.number()).transform(val => String(val)).optional(),
  totalAmount: z.string().or(z.number()).transform(val => String(val)).optional(),
  processingStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  processingError: z.string().optional().nullable(),
});

export const insertFiscalYearPlanSchema = createInsertSchema(fiscalYearPlans).omit({
  id: true,
  createdAt: true,
});

export const insertAccountSubscriptionSchema = createInsertSchema(accountSubscriptions).omit({
  id: true,
  createdAt: true,
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

export type VehicleMember = typeof vehicleMembers.$inferSelect;
export type InsertVehicleMember = z.infer<typeof insertVehicleMemberSchema>;

export type TaxRate = typeof taxRates.$inferSelect;
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;

export type FiscalYearPlan = typeof fiscalYearPlans.$inferSelect;
export type InsertFiscalYearPlan = z.infer<typeof insertFiscalYearPlanSchema>;

export type AccountSubscription = typeof accountSubscriptions.$inferSelect;
export type InsertAccountSubscription = z.infer<typeof insertAccountSubscriptionSchema>;

export const aiTranscriptionSchema = z.object({
  date: z.string().nullable(),
  stationName: z.string(),
  sellerStreet: z.string().optional().nullable(),
  sellerCity: z.string().optional().nullable(),
  sellerState: z.string().optional().nullable(),
  sellerZip: z.string().optional().nullable(),
  gallons: z.number().nullable(),
  pricePerGallon: z.number().nullable(),
  totalAmount: z.number().nullable(),
});

export type AiTranscription = z.infer<typeof aiTranscriptionSchema>;
