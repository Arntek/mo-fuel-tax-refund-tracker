import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CreditCard, Receipt, Calendar, Loader2, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import type { Account, FiscalYearPlan } from "@shared/schema";

type SubscriptionStatus = {
  status: "trial" | "active" | "expired" | "cancelled";
  trialDaysRemaining: number | null;
  receiptCount: number;
  canUpload: boolean;
  upgradeRequired: boolean;
};

export default function Billing() {
  const params = useParams<{ accountId: string }>();
  const { accountId } = params;
  const { toast } = useToast();

  const { data: account } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
  });

  const currentFiscalYear = getCurrentFiscalYear();

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/accounts", accountId, "subscription", currentFiscalYear],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/subscription?fiscalYear=${currentFiscalYear}`);
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      return response.json();
    },
  });

  const { data: plans = [] } = useQuery<FiscalYearPlan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (fiscalYear: string) => {
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
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start checkout", variant: "destructive" });
    },
  });

  const openBillingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/accounts/${accountId}/billing-portal`, {
        method: "POST",
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to open billing portal", variant: "destructive" });
    },
  });

  const currentPlan = plans.find((p) => p.fiscalYear === currentFiscalYear);
  const trialProgress = subscriptionStatus ? Math.min(100, (subscriptionStatus.receiptCount / 8) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Billing & Subscription</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
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
              {currentFiscalYear} Subscription Status
            </CardTitle>
            <CardDescription>
              Your current subscription status for fiscal year {currentFiscalYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {statusLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : subscriptionStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Status</p>
                    <StatusBadge status={subscriptionStatus.status} />
                  </div>
                  {subscriptionStatus.status === "active" ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : subscriptionStatus.upgradeRequired ? (
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  ) : null}
                </div>

                {subscriptionStatus.status === "trial" && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trial Receipt Usage</span>
                        <span className="font-medium">
                          {subscriptionStatus.receiptCount} / 8 receipts
                        </span>
                      </div>
                      <Progress value={trialProgress} className="h-2" />

                      {subscriptionStatus.trialDaysRemaining !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Trial Days Remaining</span>
                          <span className="font-medium">
                            {subscriptionStatus.trialDaysRemaining} days
                          </span>
                        </div>
                      )}

                      {subscriptionStatus.upgradeRequired && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-medium text-amber-800 dark:text-amber-200">
                                Trial Limit Reached
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-300">
                                {subscriptionStatus.receiptCount >= 8
                                  ? "You've uploaded 8 receipts."
                                  : "Your 30-day trial has ended."}
                                {" "}Subscribe to continue uploading receipts for this fiscal year.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {subscriptionStatus.status !== "active" && currentPlan && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{currentPlan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Unlimited receipt uploads for {currentFiscalYear}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          ${(currentPlan.priceInCents / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">one-time payment</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => createCheckoutMutation.mutate(currentFiscalYear)}
                      disabled={createCheckoutMutation.isPending}
                      className="w-full gap-2"
                      size="lg"
                      data-testid="button-subscribe"
                    >
                      {createCheckoutMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Subscribe Now
                        </>
                      )}
                    </Button>
                  </>
                )}

                {subscriptionStatus.status === "active" && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Subscription Active
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          You have unlimited receipt uploads for {currentFiscalYear}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Unable to load subscription status. Please try again later.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Manage Billing
            </CardTitle>
            <CardDescription>
              View payment history, update payment method, and manage your subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => openBillingPortalMutation.mutate()}
              disabled={openBillingPortalMutation.isPending}
              className="gap-2"
              data-testid="button-billing-portal"
            >
              {openBillingPortalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Open Billing Portal
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
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

function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}
