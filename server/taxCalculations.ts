import { storage } from "./storage";
import type { TaxRate, Receipt } from "@shared/schema";

/**
 * Calculate tax refund for a receipt based on Missouri fuel tax increases
 * @param receipt - The receipt object with date, gallons, and total amount
 * @returns Object with tax calculation details including refund amount
 */
export async function calculateReceiptTaxRefund(receipt: Receipt): Promise<{
  taxRate: TaxRate | null;
  baseRate: number;
  increase: number;
  gallons: number;
  refundAmount: number;
}> {
  // Get the tax rate for the receipt date
  const taxRate = await storage.getTaxRateByDate(receipt.date);
  
  if (!taxRate) {
    return {
      taxRate: null,
      baseRate: 0,
      increase: 0,
      gallons: parseFloat(receipt.gallons) || 0,
      refundAmount: 0,
    };
  }
  
  const gallons = parseFloat(receipt.gallons);
  const baseRate = parseFloat(taxRate.baseRate);
  const increase = parseFloat(taxRate.increase);
  
  // Validate all numeric values
  if (isNaN(gallons) || isNaN(baseRate) || isNaN(increase)) {
    console.warn(`Invalid tax calculation data for receipt ${receipt.id}: gallons=${receipt.gallons}, baseRate=${taxRate.baseRate}, increase=${taxRate.increase}`);
    return {
      taxRate,
      baseRate: 0,
      increase: 0,
      gallons: 0,
      refundAmount: 0,
    };
  }
  
  // Refund = gallons * increase per gallon
  const refundAmount = gallons * increase;
  
  return {
    taxRate,
    baseRate: isNaN(baseRate) ? 0 : baseRate,
    increase: isNaN(increase) ? 0 : increase,
    gallons: isNaN(gallons) ? 0 : gallons,
    refundAmount: isNaN(refundAmount) ? 0 : parseFloat(refundAmount.toFixed(2)),
  };
}

/**
 * Calculate total refund for multiple receipts
 * @param receipts - Array of receipt objects
 * @returns Total refund amount across all receipts
 */
export async function calculateTotalRefund(receipts: Receipt[]): Promise<number> {
  let totalRefund = 0;
  
  for (const receipt of receipts) {
    const calculation = await calculateReceiptTaxRefund(receipt);
    totalRefund += calculation.refundAmount;
  }
  
  return parseFloat(totalRefund.toFixed(2));
}

/**
 * Calculate refund for receipts grouped by fiscal year
 * Optimized to fetch tax rates once and reuse for all receipts
 * @param receipts - Array of receipt objects
 * @returns Map of fiscal year to total refund amount
 */
export async function calculateRefundByFiscalYear(receipts: Receipt[]): Promise<Map<string, number>> {
  const refundByYear = new Map<string, number>();
  
  // Get unique dates to minimize DB queries
  const uniqueDates = Array.from(new Set(receipts.map(r => r.date)));
  const taxRateCache = new Map<string, TaxRate | null>();
  
  // Pre-fetch tax rates for all unique dates
  for (const date of uniqueDates) {
    const rate = await storage.getTaxRateByDate(date);
    taxRateCache.set(date, rate || null);
  }
  
  // Calculate refunds using cached tax rates
  for (const receipt of receipts) {
    const taxRate = taxRateCache.get(receipt.date);
    
    if (!taxRate) {
      continue; // Skip receipts without tax rates
    }
    
    const gallons = parseFloat(receipt.gallons);
    const increase = parseFloat(taxRate.increase);
    
    // Validate numeric values - skip invalid data
    if (isNaN(gallons) || isNaN(increase)) {
      console.warn(`Skipping invalid receipt ${receipt.id} in refund calculation: gallons=${receipt.gallons}, increase=${taxRate.increase}`);
      continue;
    }
    
    const refundAmount = gallons * increase;
    const currentTotal = refundByYear.get(receipt.fiscalYear) || 0;
    refundByYear.set(receipt.fiscalYear, currentTotal + refundAmount);
  }
  
  // Round all values
  for (const [year, amount] of refundByYear.entries()) {
    refundByYear.set(year, parseFloat(amount.toFixed(2)));
  }
  
  return refundByYear;
}
