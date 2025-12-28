import Stripe from "stripe";
import { db, storage } from "./storage";
import { users, fiscalYearPlans, accountSubscriptions, accounts, paymentLedger, receiptPacks } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Pricing constants
export const BASE_PLAN_PRICE_CENTS = 1200; // $12
export const BASE_RECEIPT_LIMIT = 156; // 3 per week for 52 weeks
export const RECEIPT_PACK_PRICE_CENTS = 500; // $5
export const RECEIPT_PACK_SIZE = 52; // 1 per week for a year

function getStripeInstance(): Stripe | null {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.warn("STRIPE_SECRET_KEY not configured - Stripe features disabled");
    return null;
  }
  return new Stripe(apiKey, {
    apiVersion: "2025-12-15.clover",
  });
}

const stripe = getStripeInstance();

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return stripe !== null;
}

export async function createStripeCustomer(userId: string, email: string, name: string): Promise<string> {
  const customer = await requireStripe().customers.create({
    email,
    name,
    metadata: { userId },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));

  return customer.id;
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user) {
    throw new Error("User not found");
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  return createStripeCustomer(userId, user.email, `${user.firstName} ${user.lastName}`);
}

export async function createFiscalYearPlan(
  fiscalYear: string,
  name: string,
  description: string,
  priceInCents: number,
  baseReceiptLimit: number = BASE_RECEIPT_LIMIT,
  packPriceInCents: number = RECEIPT_PACK_PRICE_CENTS,
  packSize: number = RECEIPT_PACK_SIZE
): Promise<{ productId: string; priceId: string }> {
  const product = await requireStripe().products.create({
    name,
    description,
    metadata: { fiscalYear },
  });

  const price = await requireStripe().prices.create({
    product: product.id,
    unit_amount: priceInCents,
    currency: "usd",
    metadata: { fiscalYear },
  });

  await db.insert(fiscalYearPlans).values({
    fiscalYear,
    name,
    description,
    priceInCents,
    baseReceiptLimit,
    packPriceInCents,
    packSize,
    stripeProductId: product.id,
    stripePriceId: price.id,
    active: true,
  });

  return { productId: product.id, priceId: price.id };
}

export async function updateFiscalYearPlan(
  id: string,
  updates: { name?: string; description?: string; priceInCents?: number; active?: boolean; baseReceiptLimit?: number; packPriceInCents?: number; packSize?: number }
): Promise<void> {
  const [plan] = await db.select().from(fiscalYearPlans).where(eq(fiscalYearPlans.id, id));
  
  if (!plan) {
    throw new Error("Plan not found");
  }

  if (plan.stripeProductId && (updates.name || updates.description)) {
    await requireStripe().products.update(plan.stripeProductId, {
      name: updates.name || plan.name,
      description: updates.description || plan.description || undefined,
    });
  }

  if (updates.priceInCents && plan.stripeProductId) {
    if (plan.stripePriceId) {
      await requireStripe().prices.update(plan.stripePriceId, { active: false });
    }
    
    const newPrice = await requireStripe().prices.create({
      product: plan.stripeProductId,
      unit_amount: updates.priceInCents,
      currency: "usd",
      metadata: { fiscalYear: plan.fiscalYear },
    });
    
    updates = { ...updates, stripePriceId: newPrice.id } as any;
  }

  await db.update(fiscalYearPlans).set(updates).where(eq(fiscalYearPlans.id, id));
}

export async function createCheckoutSession(
  accountId: string,
  userId: string,
  fiscalYear: string,
  successUrl: string,
  cancelUrl: string,
  options?: {
    discountCodeId?: string;
    stripePromotionCodeId?: string | null;
  }
): Promise<string> {
  const [plan] = await db.select().from(fiscalYearPlans)
    .where(and(eq(fiscalYearPlans.fiscalYear, fiscalYear), eq(fiscalYearPlans.active, true)));

  if (!plan || !plan.stripePriceId) {
    throw new Error(`No active plan found for fiscal year ${fiscalYear}`);
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      accountId,
      userId,
      fiscalYear,
      discountCodeId: options?.discountCodeId || "",
    },
    payment_intent_data: {
      metadata: {
        accountId,
        userId,
        fiscalYear,
        discountCodeId: options?.discountCodeId || "",
      },
      description: `Missouri Form 4923-H Tax Refund - Fiscal Year ${fiscalYear}`,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  // Apply Stripe promotion code if available
  if (options?.stripePromotionCodeId) {
    sessionParams.discounts = [{ promotion_code: options.stripePromotionCodeId }];
  } else {
    // Allow user to enter promotion codes if no pre-applied discount
    sessionParams.allow_promotion_codes = true;
  }

  const session = await requireStripe().checkout.sessions.create(sessionParams);

  return session.url || "";
}

export async function createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await requireStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function createReceiptPackCheckoutSession(
  accountId: string,
  userId: string,
  fiscalYear: string,
  successUrl: string,
  cancelUrl: string,
  packCount: number = 1
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId);
  
  // Get pack pricing from the fiscal year plan (with fallback to defaults)
  const [plan] = await db.select().from(fiscalYearPlans)
    .where(eq(fiscalYearPlans.fiscalYear, fiscalYear));
  const packSize = plan?.packSize || RECEIPT_PACK_SIZE;
  const packPriceInCents = plan?.packPriceInCents || RECEIPT_PACK_PRICE_CENTS;
  
  const totalReceiptsAdded = packCount * packSize;
  const totalPrice = packCount * packPriceInCents;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Receipt Pack (${totalReceiptsAdded} receipts)`,
            description: `Add ${totalReceiptsAdded} additional receipt uploads for fiscal year ${fiscalYear}`,
          },
          unit_amount: totalPrice,
        },
        quantity: 1,
      },
    ],
    metadata: {
      accountId,
      userId,
      fiscalYear,
      productType: "receipt_pack",
      packSize: String(totalReceiptsAdded),
    },
    payment_intent_data: {
      metadata: {
        accountId,
        userId,
        fiscalYear,
        productType: "receipt_pack",
        packSize: String(totalReceiptsAdded),
      },
      description: `Receipt Pack - ${totalReceiptsAdded} additional receipts for FY ${fiscalYear}`,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  const session = await requireStripe().checkout.sessions.create(sessionParams);
  return session.url || "";
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(`[Stripe Webhook] Processing event: ${event.type}`);
  
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { accountId, fiscalYear, userId, discountCodeId } = session.metadata || {};
      
      console.log(`[Stripe Webhook] checkout.session.completed - accountId: ${accountId}, fiscalYear: ${fiscalYear}, discountCodeId: ${discountCodeId}`);

      if (accountId && fiscalYear) {
        // Check if this is a receipt pack purchase
        const isReceiptPack = session.metadata?.productType === "receipt_pack";
        
        if (isReceiptPack) {
          // Handle receipt pack purchase
          const packSize = parseInt(session.metadata?.packSize || String(RECEIPT_PACK_SIZE));
          const priceInCents = session.amount_total || RECEIPT_PACK_PRICE_CENTS;
          
          // Create receipt pack record
          await storage.createReceiptPack({
            accountId,
            fiscalYear,
            receiptsAdded: packSize,
            priceInCents,
            stripePaymentIntentId: session.payment_intent as string,
            stripeCheckoutSessionId: session.id,
          });
          
          // Update subscription's receiptLimit
          const totalFromPacks = await storage.getTotalReceiptsAddedByPacks(accountId, fiscalYear);
          const [plan] = await db.select().from(fiscalYearPlans)
            .where(eq(fiscalYearPlans.fiscalYear, fiscalYear));
          const baseLimit = plan?.baseReceiptLimit || BASE_RECEIPT_LIMIT;
          
          await db.update(accountSubscriptions)
            .set({ receiptLimit: baseLimit + totalFromPacks })
            .where(and(
              eq(accountSubscriptions.accountId, accountId),
              eq(accountSubscriptions.fiscalYear, fiscalYear)
            ));
          
          console.log(`[Stripe Webhook] Receipt pack purchased for account ${accountId}, new limit: ${baseLimit + totalFromPacks}`);
        } else {
          // Handle regular subscription purchase
          const existingSub = await db.select().from(accountSubscriptions)
            .where(and(
              eq(accountSubscriptions.accountId, accountId),
              eq(accountSubscriptions.fiscalYear, fiscalYear)
            ));

          // Get the base receipt limit from the plan
          const [plan] = await db.select().from(fiscalYearPlans)
            .where(eq(fiscalYearPlans.fiscalYear, fiscalYear));
          const baseReceiptLimit = plan?.baseReceiptLimit || BASE_RECEIPT_LIMIT;

          const now = new Date();
          const subscriptionData = {
            status: "active" as const,
            stripeCustomerId: session.customer as string,
            stripePaymentIntentId: session.payment_intent as string,
            stripeCheckoutSessionId: session.id,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
            paidAt: now,
            receiptLimit: baseReceiptLimit,
          };

          if (existingSub.length > 0) {
            console.log(`[Stripe Webhook] Updating existing subscription for account ${accountId}`);
            await db.update(accountSubscriptions)
              .set(subscriptionData)
              .where(and(
                eq(accountSubscriptions.accountId, accountId),
                eq(accountSubscriptions.fiscalYear, fiscalYear)
              ));
          } else {
            console.log(`[Stripe Webhook] Creating new subscription for account ${accountId}`);
            await db.insert(accountSubscriptions).values({
              accountId,
              fiscalYear,
              ...subscriptionData,
            });
          }
        }

        // Create payment ledger entry
        if (session.payment_intent) {
          const paymentIntentId = typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : session.payment_intent.id;
          
          const amountTotal = session.amount_total || 0;
          await storage.upsertPaymentLedgerEntry({
            paymentIntentId,
            accountId,
            userId: userId || null,
            fiscalYear,
            amountCaptured: amountTotal,
            amountRefunded: 0,
            netAmount: amountTotal,
            currency: session.currency || "usd",
            status: "succeeded",
            stripeCustomerId: session.customer as string,
            description: `Missouri Form 4923-H Tax Refund - Fiscal Year ${fiscalYear}`,
            discountCodeId: discountCodeId || null,
          });
          console.log(`[Stripe Webhook] Created payment ledger entry for ${paymentIntentId}`);
        }
        
        // Record discount code redemption if applicable
        if (discountCodeId && userId) {
          try {
            const amountDiscounted = session.total_details?.amount_discount || 0;
            const paymentIntentIdForRedemption = session.payment_intent 
              ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
              : undefined;
            await storage.recordDiscountCodeRedemption({
              discountCodeId,
              accountId,
              userId,
              fiscalYear,
              amountDiscounted,
              paymentIntentId: paymentIntentIdForRedemption,
            });
            console.log(`[Stripe Webhook] Recorded discount code redemption: ${discountCodeId} with paymentIntent: ${paymentIntentIdForRedemption}`);
          } catch (err) {
            console.error(`[Stripe Webhook] Failed to record discount code redemption:`, err);
          }
        }
        
        console.log(`[Stripe Webhook] Subscription activated for account ${accountId}, fiscal year ${fiscalYear}`);
      } else {
        console.warn(`[Stripe Webhook] Missing metadata - accountId: ${accountId}, fiscalYear: ${fiscalYear}`);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' 
        ? charge.payment_intent 
        : charge.payment_intent?.id;
      
      if (paymentIntentId) {
        const existingEntry = await storage.getPaymentLedgerEntry(paymentIntentId);
        const amountRefunded = charge.amount_refunded || 0;
        const amountCaptured = charge.amount || 0;
        const netAmount = amountCaptured - amountRefunded;
        
        if (existingEntry) {
          // Update existing ledger entry with refund info
          await storage.upsertPaymentLedgerEntry({
            ...existingEntry,
            amountRefunded,
            netAmount,
            status: amountRefunded >= amountCaptured ? "refunded" : "partially_refunded",
          });
          console.log(`[Stripe Webhook] Updated ledger entry for refund: ${paymentIntentId}`);
        } else {
          // Create new ledger entry from charge (for historical payments)
          const metadata = charge.metadata || {};
          await storage.upsertPaymentLedgerEntry({
            paymentIntentId,
            accountId: metadata.accountId || null,
            userId: metadata.userId || null,
            fiscalYear: metadata.fiscalYear || null,
            amountCaptured,
            amountRefunded,
            netAmount,
            currency: charge.currency || "usd",
            status: amountRefunded >= amountCaptured ? "refunded" : "partially_refunded",
            stripeCustomerId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || null,
            description: charge.description || null,
            receiptUrl: charge.receipt_url || null,
          });
          console.log(`[Stripe Webhook] Created ledger entry for historical refund: ${paymentIntentId}`);
        }
      }
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const latestCharge = (paymentIntent as any).latest_charge as Stripe.Charge | null;
      
      await storage.upsertPaymentLedgerEntry({
        paymentIntentId: paymentIntent.id,
        accountId: metadata.accountId || null,
        userId: metadata.userId || null,
        fiscalYear: metadata.fiscalYear || null,
        amountCaptured: paymentIntent.amount,
        amountRefunded: 0,
        netAmount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: "succeeded",
        stripeCustomerId: typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id || null,
        description: paymentIntent.description || null,
        receiptUrl: latestCharge?.receipt_url || null,
      });
      console.log(`[Stripe Webhook] Created/updated ledger entry for payment: ${paymentIntent.id}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { accountId, fiscalYear } = subscription.metadata || {};

      if (accountId && fiscalYear) {
        await db.update(accountSubscriptions)
          .set({
            status: "canceled",
            canceledAt: new Date(),
          })
          .where(and(
            eq(accountSubscriptions.accountId, accountId),
            eq(accountSubscriptions.fiscalYear, fiscalYear)
          ));
      }
      break;
    }
  }
}

export async function getCustomerPayments(customerId: string): Promise<Stripe.PaymentIntent[]> {
  const payments = await requireStripe().paymentIntents.list({
    customer: customerId,
    limit: 100,
    expand: ["data.latest_charge"],
  });

  return payments.data;
}

export async function getCustomerInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  const invoices = await requireStripe().invoices.list({
    customer: customerId,
    limit: 100,
  });

  return invoices.data;
}

export async function getAllPayments(limit: number = 100): Promise<Stripe.PaymentIntent[]> {
  const payments = await requireStripe().paymentIntents.list({
    limit,
    expand: ["data.latest_charge"],
  });
  return payments.data;
}

export async function refundPayment(paymentIntentId: string, reason?: string): Promise<Stripe.Refund> {
  const refund = await requireStripe().refunds.create({
    payment_intent: paymentIntentId,
    reason: "requested_by_customer",
    metadata: {
      refundedBy: "admin",
      refundReason: reason || "Admin initiated refund",
    },
  });
  
  // Update payment ledger immediately after refund
  const pi = await requireStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const latestCharge = pi.latest_charge as Stripe.Charge | null;
  const amountRefunded = latestCharge?.amount_refunded || refund.amount;
  const amountCaptured = pi.amount;
  const netAmount = amountCaptured - amountRefunded;
  
  await storage.upsertPaymentLedgerEntry({
    paymentIntentId,
    accountId: pi.metadata?.accountId || null,
    userId: pi.metadata?.userId || null,
    fiscalYear: pi.metadata?.fiscalYear || null,
    amountCaptured,
    amountRefunded,
    netAmount,
    currency: pi.currency,
    status: amountRefunded >= amountCaptured ? "refunded" : "partially_refunded",
    stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null,
    description: pi.description || null,
    receiptUrl: latestCharge?.receipt_url || null,
  });
  console.log(`[Stripe] Updated ledger entry after refund: ${paymentIntentId}`);
  
  return refund;
}

export async function syncPaymentsToLedger(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;
  
  try {
    const payments = await getAllPayments(100);
    
    for (const pi of payments) {
      try {
        if (pi.status !== "succeeded") continue;
        
        const latestCharge = (pi as any).latest_charge as Stripe.Charge | null;
        const amountRefunded = latestCharge?.amount_refunded || 0;
        const amountCaptured = pi.amount;
        const netAmount = amountCaptured - amountRefunded;
        
        let status = "succeeded";
        if (amountRefunded >= amountCaptured) {
          status = "refunded";
        } else if (amountRefunded > 0) {
          status = "partially_refunded";
        }
        
        await storage.upsertPaymentLedgerEntry({
          paymentIntentId: pi.id,
          accountId: pi.metadata?.accountId || null,
          userId: pi.metadata?.userId || null,
          fiscalYear: pi.metadata?.fiscalYear || null,
          amountCaptured,
          amountRefunded,
          netAmount,
          currency: pi.currency,
          status,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : null,
          description: pi.description || null,
          receiptUrl: latestCharge?.receipt_url || null,
        });
        synced++;
      } catch (err) {
        console.error(`[Stripe Sync] Error syncing payment ${pi.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error("[Stripe Sync] Error fetching payments:", err);
  }
  
  return { synced, errors };
}

export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await requireStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["charges.data.refunds"],
  });
}

export async function getSubscriptionStatus(
  accountId: string,
  fiscalYear: string
): Promise<{
  status: string;
  trialDaysRemaining: number | null;
  receiptCount: number;
  receiptLimit: number;
  canUpload: boolean;
  upgradeRequired: boolean;
  needsMoreReceipts: boolean;
}> {
  const TRIAL_RECEIPT_LIMIT = 8;
  
  const [subscription] = await db.select().from(accountSubscriptions)
    .where(and(
      eq(accountSubscriptions.accountId, accountId),
      eq(accountSubscriptions.fiscalYear, fiscalYear)
    ));

  if (!subscription) {
    return {
      status: "trial",
      trialDaysRemaining: 30,
      receiptCount: 0,
      receiptLimit: TRIAL_RECEIPT_LIMIT,
      canUpload: true,
      upgradeRequired: false,
      needsMoreReceipts: false,
    };
  }

  if (subscription.status === "active") {
    const receiptLimit = subscription.receiptLimit || BASE_RECEIPT_LIMIT;
    const receiptLimitReached = subscription.receiptCount >= receiptLimit;
    return {
      status: "active",
      trialDaysRemaining: null,
      receiptCount: subscription.receiptCount,
      receiptLimit,
      canUpload: !receiptLimitReached,
      upgradeRequired: false,
      needsMoreReceipts: receiptLimitReached,
    };
  }

  const trialEndsAt = subscription.trialEndsAt;
  const now = new Date();
  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const trialExpired = trialEndsAt ? now > trialEndsAt : false;
  const receiptLimitReached = subscription.receiptCount >= (subscription.receiptLimit || TRIAL_RECEIPT_LIMIT);
  const upgradeRequired = trialExpired || receiptLimitReached;

  return {
    status: subscription.status,
    trialDaysRemaining,
    receiptCount: subscription.receiptCount,
    receiptLimit: subscription.receiptLimit || TRIAL_RECEIPT_LIMIT,
    canUpload: !upgradeRequired,
    upgradeRequired,
    needsMoreReceipts: false,
  };
}

export async function incrementReceiptCount(accountId: string, fiscalYear: string): Promise<void> {
  const [subscription] = await db.select().from(accountSubscriptions)
    .where(and(
      eq(accountSubscriptions.accountId, accountId),
      eq(accountSubscriptions.fiscalYear, fiscalYear)
    ));

  if (!subscription) {
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(accountSubscriptions).values({
      accountId,
      fiscalYear,
      status: "trial",
      trialStartedAt: new Date(),
      trialEndsAt,
      receiptCount: 1,
    });
  } else {
    await db.update(accountSubscriptions)
      .set({ receiptCount: subscription.receiptCount + 1 })
      .where(eq(accountSubscriptions.id, subscription.id));
  }
}

export function getStripe(): Stripe {
  return requireStripe();
}

export async function createStripeCoupon(params: {
  discountType: "percentage" | "fixed";
  discountValue: number;
  code: string;
  description?: string;
}): Promise<{ couponId: string; promotionCodeId: string }> {
  const stripeInstance = requireStripe();
  
  // Create the coupon
  const couponParams: Stripe.CouponCreateParams = {
    duration: "once",
    metadata: { code: params.code },
  };
  
  if (params.discountType === "percentage") {
    couponParams.percent_off = params.discountValue;
  } else {
    couponParams.amount_off = params.discountValue;
    couponParams.currency = "usd";
  }
  
  if (params.description) {
    couponParams.name = params.description;
  }
  
  const coupon = await stripeInstance.coupons.create(couponParams);
  
  // Create a promotion code for this coupon
  const promotionCode = await stripeInstance.promotionCodes.create({
    promotion: {
      type: "coupon",
      coupon: coupon.id,
    },
    code: params.code,
    active: true,
  });
  
  return {
    couponId: coupon.id,
    promotionCodeId: promotionCode.id,
  };
}

export async function deactivateStripeCoupon(couponId: string): Promise<void> {
  const stripeInstance = requireStripe();
  await stripeInstance.coupons.del(couponId);
}

export async function getStripePromotionCode(code: string): Promise<Stripe.PromotionCode | null> {
  const stripeInstance = requireStripe();
  const promotionCodes = await stripeInstance.promotionCodes.list({
    code,
    active: true,
    limit: 1,
  });
  return promotionCodes.data[0] || null;
}

export { stripe };
