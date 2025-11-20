import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  date: text("date").notNull(),
  stationName: text("station_name").notNull(),
  gallons: numeric("gallons", { precision: 10, scale: 3 }).notNull(),
  pricePerGallon: numeric("price_per_gallon", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

export const aiTranscriptionSchema = z.object({
  date: z.string(),
  stationName: z.string(),
  gallons: z.number(),
  pricePerGallon: z.number(),
  totalAmount: z.number(),
});

export type AiTranscription = z.infer<typeof aiTranscriptionSchema>;
