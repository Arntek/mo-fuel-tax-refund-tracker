import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, Loader2, CheckCircle, AlertTriangle, FileText, Receipt, Plus, CreditCard } from "lucide-react";
import type { Account, FiscalYearPlan } from "@shared/schema";
import { Helmet } from "react-helmet";

type SubscriptionStatus = {
  status: "trial" | "active" | "expired" | "cancelled";
  trialDaysRemaining: number | null;
  receiptCount: number;
  receiptLimit: number;
  canUpload: boolean;
  upgradeRequired: boolean;
  needsMoreReceipts: boolean;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  description: string | null;
  receiptUrl: string | null;
  metadata: {
    accountId?: string;
    fiscalYear?: string;
  };
};

export default function Billing() {
  const params = useParams<{ accountId: string }>();
  const { accountId } = params;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

  useEffect(() => {
    if (!roleLoading && roleData && !isAdminOrOwner) {
      setLocation(`/upload/${accountId}`);
    }
  }, [roleLoading, roleData, isAdminOrOwner, accountId, setLocation]);

  const { data: account } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<FiscalYearPlan[]>({
    queryKey: ["/api/billing/plans"],
    enabled: isAdminOrOwner,
  });

  // Fetch subscription status for each plan
  const subscriptionQueries = useQueries({
    queries: plans.map((plan) => ({
      queryKey: ["/api/accounts", accountId, "subscription", plan.fiscalYear],
      queryFn: async () => {
        const response = await fetch(`/api/accounts/${accountId}/subscription?fiscalYear=${plan.fiscalYear}`);
        if (!response.ok) throw new Error("Failed to fetch subscription status");
        return response.json() as Promise<SubscriptionStatus>;
      },
      enabled: isAdminOrOwner && plans.length > 0,
    })),
  });

  const subscriptionStatusMap = new Map<string, SubscriptionStatus>();
  plans.forEach((plan, index) => {
    if (subscriptionQueries[index]?.data) {
      subscriptionStatusMap.set(plan.fiscalYear, subscriptionQueries[index].data!);
    }
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{ payments: Payment[] }>({
    queryKey: ["/api/billing/payments"],
    enabled: isAdminOrOwner,
  });

  const payments = paymentsData?.payments || [];

  // Track loading state per fiscal year for subscribe and purchase actions
  const [subscribingFiscalYear, setSubscribingFiscalYear] = useState<string | null>(null);
  const [purchasingPackFiscalYear, setPurchasingPackFiscalYear] = useState<string | null>(null);

  const createCheckoutMutation = useMutation({
    mutationFn: async (fiscalYear: string) => {
      setSubscribingFiscalYear(fiscalYear);
      const response = await apiRequest(`/api/accounts/${accountId}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          fiscalYear,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        // No redirect URL returned - clear loading state
        setSubscribingFiscalYear(null);
      }
    },
    onError: () => {
      setSubscribingFiscalYear(null);
      toast({ title: "Error", description: "Failed to start checkout", variant: "destructive" });
    },
  });

  const purchaseReceiptPackMutation = useMutation({
    mutationFn: async (fiscalYear: string) => {
      setPurchasingPackFiscalYear(fiscalYear);
      const response = await apiRequest(`/api/accounts/${accountId}/purchase-receipt-pack`, {
        method: "POST",
        body: JSON.stringify({
          fiscalYear,
          packCount: 1,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        // No redirect URL returned - clear loading state and refresh data
        setPurchasingPackFiscalYear(null);
        queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "subscription"] });
      }
    },
    onError: () => {
      setPurchasingPackFiscalYear(null);
      toast({ title: "Error", description: "Failed to start checkout for receipt pack", variant: "destructive" });
    },
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Billing & Subscription - Gas Receipt Tax Refund</title>
        <meta name="description" content="Manage your subscription and view payment history." />
      </Helmet>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <h2 className="text-2xl font-semibold">Billing & Subscription</h2>
        {account && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Managing billing for: <span className="font-medium text-foreground">{account.name}</span>
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Fiscal Year Subscriptions
            </CardTitle>
            <CardDescription>
              Subscribe to fiscal years to upload receipts for tax refund filing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {plansLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No fiscal year plans available yet</p>
                <p className="text-sm mt-1">Please check back later</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plans.filter(p => p.active).map((plan) => {
                  const subscriptionStatus = subscriptionStatusMap.get(plan.fiscalYear);
                  const isLoading = subscriptionQueries.find((q, i) => plans[i]?.fiscalYear === plan.fiscalYear)?.isLoading;
                  const packSize = plan.packSize || 52;
                  const packPrice = ((plan.packPriceInCents || 500) / 100).toFixed(2);

                  return (
                    <FiscalYearPlanCard
                      key={plan.id}
                      plan={plan}
                      subscriptionStatus={subscriptionStatus}
                      isLoading={isLoading}
                      packSize={packSize}
                      packPrice={packPrice}
                      onSubscribe={() => createCheckoutMutation.mutate(plan.fiscalYear)}
                      onPurchasePack={() => purchaseReceiptPackMutation.mutate(plan.fiscalYear)}
                      isSubscribing={subscribingFiscalYear === plan.fiscalYear}
                      isPurchasingPack={purchasingPackFiscalYear === plan.fiscalYear}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Payment History
            </CardTitle>
            <CardDescription>
              Your past subscription payments and receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No payment history yet</p>
                <p className="text-sm mt-1">Your payments will appear here after you subscribe</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`payment-${payment.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {payment.metadata.fiscalYear
                            ? `Fiscal Year ${payment.metadata.fiscalYear} Subscription`
                            : payment.description || "Subscription Payment"}
                        </p>
                        <Badge variant="secondary" className="text-xs">Paid</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.created * 1000).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">
                        ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                      </p>
                      {payment.receiptUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="gap-1"
                          data-testid={`button-receipt-${payment.id}`}
                        >
                          <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-4 h-4" />
                            Receipt
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

type FiscalYearPlanCardProps = {
  plan: FiscalYearPlan;
  subscriptionStatus: SubscriptionStatus | undefined;
  isLoading: boolean | undefined;
  packSize: number;
  packPrice: string;
  onSubscribe: () => void;
  onPurchasePack: () => void;
  isSubscribing: boolean;
  isPurchasingPack: boolean;
};

function FiscalYearPlanCard({
  plan,
  subscriptionStatus,
  isLoading,
  packSize,
  packPrice,
  onSubscribe,
  onPurchasePack,
  isSubscribing,
  isPurchasingPack,
}: FiscalYearPlanCardProps) {
  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const receiptProgress = subscriptionStatus
    ? Math.min(100, (subscriptionStatus.receiptCount / subscriptionStatus.receiptLimit) * 100)
    : 0;

  return (
    <div className="p-4 border rounded-lg space-y-4" data-testid={`plan-card-${plan.fiscalYear}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{plan.fiscalYear}</h3>
            {subscriptionStatus && <StatusBadge status={subscriptionStatus.status} />}
          </div>
          <p className="text-sm text-muted-foreground">{plan.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">${(plan.priceInCents / 100).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{plan.baseReceiptLimit} receipts</p>
        </div>
      </div>

      {subscriptionStatus?.status === "active" && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Receipt Usage</span>
              <span className="font-medium">
                {subscriptionStatus.receiptCount} / {subscriptionStatus.receiptLimit} receipts
              </span>
            </div>
            <Progress value={receiptProgress} className="h-2" />

            {subscriptionStatus.needsMoreReceipts ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Receipt limit reached. Add more to continue uploading.
                    </p>
                    <Button
                      size="sm"
                      onClick={onPurchasePack}
                      disabled={isPurchasingPack}
                      className="gap-1"
                      data-testid={`button-buy-pack-${plan.fiscalYear}`}
                    >
                      {isPurchasingPack ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Add {packSize} Receipts (${packPrice})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>{subscriptionStatus.receiptLimit - subscriptionStatus.receiptCount} receipts remaining</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPurchasePack}
                  disabled={isPurchasingPack}
                  className="gap-1"
                  data-testid={`button-add-pack-${plan.fiscalYear}`}
                >
                  {isPurchasingPack ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      Add {packSize} (${packPrice})
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {subscriptionStatus?.status === "trial" && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Trial Usage</span>
              <span className="font-medium">
                {subscriptionStatus.receiptCount} / {subscriptionStatus.receiptLimit} receipts
              </span>
            </div>
            <Progress value={receiptProgress} className="h-2" />

            {subscriptionStatus.trialDaysRemaining !== null && (
              <p className="text-sm text-muted-foreground">
                {subscriptionStatus.trialDaysRemaining} trial days remaining
              </p>
            )}

            {subscriptionStatus.upgradeRequired && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {subscriptionStatus.receiptCount >= subscriptionStatus.receiptLimit
                      ? "Trial receipt limit reached."
                      : "Trial period ended."}
                    {" "}Subscribe to continue.
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={onSubscribe}
              disabled={isSubscribing}
              className="w-full gap-2"
              data-testid={`button-subscribe-${plan.fiscalYear}`}
            >
              {isSubscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Subscribe for ${(plan.priceInCents / 100).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {(!subscriptionStatus || subscriptionStatus.status === "expired" || subscriptionStatus.status === "cancelled") && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {plan.baseReceiptLimit} receipt uploads included. Need more? Add {packSize} receipts for ${packPrice}.
            </p>
            <Button
              onClick={onSubscribe}
              disabled={isSubscribing}
              className="w-full gap-2"
              data-testid={`button-subscribe-${plan.fiscalYear}`}
            >
              {isSubscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Subscribe for ${(plan.priceInCents / 100).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus["status"] }) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Active</Badge>;
    case "trial":
      return <Badge variant="secondary">Trial</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "cancelled":
      return <Badge variant="outline">Cancelled</Badge>;
  }
}
