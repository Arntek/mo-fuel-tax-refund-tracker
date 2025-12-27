import Stripe from "stripe";
import { db, storage } from "./storage";
import { users, fiscalYearPlans, accountSubscriptions, accounts, paymentLedger } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
  priceInCents: number
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
    stripeProductId: product.id,
    stripePriceId: price.id,
    active: true,
  });

  return { productId: product.id, priceId: price.id };
}

export async function updateFiscalYearPlan(
  id: string,
  updates: { name?: string; description?: string; priceInCents?: number; active?: boolean }
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
  cancelUrl: string
): Promise<string> {
  const [plan] = await db.select().from(fiscalYearPlans)
    .where(and(eq(fiscalYearPlans.fiscalYear, fiscalYear), eq(fiscalYearPlans.active, true)));

  if (!plan || !plan.stripePriceId) {
    throw new Error(`No active plan found for fiscal year ${fiscalYear}`);
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  const session = await requireStripe().checkout.sessions.create({
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
    },
    payment_intent_data: {
      metadata: {
        accountId,
        userId,
        fiscalYear,
      },
      description: `Missouri Form 4923-H Tax Refund - Fiscal Year ${fiscalYear}`,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

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

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(`[Stripe Webhook] Processing event: ${event.type}`);
  
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { accountId, fiscalYear, userId } = session.metadata || {};
      
      console.log(`[Stripe Webhook] checkout.session.completed - accountId: ${accountId}, fiscalYear: ${fiscalYear}`);

      if (accountId && fiscalYear) {
        const existingSub = await db.select().from(accountSubscriptions)
          .where(and(
            eq(accountSubscriptions.accountId, accountId),
            eq(accountSubscriptions.fiscalYear, fiscalYear)
          ));

        const now = new Date();
        const subscriptionData = {
          status: "active" as const,
          stripeCustomerId: session.customer as string,
          stripePaymentIntentId: session.payment_intent as string,
          stripeCheckoutSessionId: session.id,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          paidAt: now,
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
          });
          console.log(`[Stripe Webhook] Created payment ledger entry for ${paymentIntentId}`);
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
  canUpload: boolean;
  upgradeRequired: boolean;
}> {
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
      canUpload: true,
      upgradeRequired: false,
    };
  }

  if (subscription.status === "active") {
    return {
      status: "active",
      trialDaysRemaining: null,
      receiptCount: subscription.receiptCount,
      canUpload: true,
      upgradeRequired: false,
    };
  }

  const trialEndsAt = subscription.trialEndsAt;
  const now = new Date();
  const trialDaysRemaining = trialEndsAt 
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const trialExpired = trialEndsAt ? now > trialEndsAt : false;
  const receiptLimitReached = subscription.receiptCount >= 8;
  const upgradeRequired = trialExpired || receiptLimitReached;

  return {
    status: subscription.status,
    trialDaysRemaining,
    receiptCount: subscription.receiptCount,
    canUpload: !upgradeRequired,
    upgradeRequired,
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
