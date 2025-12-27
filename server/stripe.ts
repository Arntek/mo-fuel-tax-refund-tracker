import Stripe from "stripe";
import { db } from "./storage";
import { users, fiscalYearPlans, accountSubscriptions, accounts } from "@shared/schema";
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
      const { accountId, fiscalYear } = session.metadata || {};
      
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
        console.log(`[Stripe Webhook] Subscription activated for account ${accountId}, fiscal year ${fiscalYear}`);
      } else {
        console.warn(`[Stripe Webhook] Missing metadata - accountId: ${accountId}, fiscalYear: ${fiscalYear}`);
      }
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
  return refund;
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

export { stripe };
