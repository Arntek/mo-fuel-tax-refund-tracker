import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText, Calendar, AlertTriangle } from "lucide-react";
import type { Account, Receipt, FiscalYearPlan } from "@shared/schema";
import { Helmet } from "react-helmet";
import { useFiscalYearSelection } from "@/hooks/use-fiscal-year-selection";
import { useToast } from "@/hooks/use-toast";

interface ReceiptsResponse {
  receipts: Receipt[];
  refundTotals: Record<string, number>;
}

type SubscriptionStatus = {
  status: "trial" | "active" | "expired" | "cancelled";
  trialDaysRemaining: number | null;
  receiptCount: number;
  receiptLimit: number;
  canUpload: boolean;
  upgradeRequired: boolean;
  needsMoreReceipts: boolean;
};

export default function Export() {
  const { accountId } = useParams<{ accountId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: receiptsData, isLoading: receiptsLoading } = useQuery<ReceiptsResponse>({
    queryKey: ["/api/accounts", accountId, "receipts"],
    enabled: !!accountId,
  });

  const receipts = receiptsData?.receipts || [];

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<FiscalYearPlan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const { selectedFiscalYear: rawSelectedFiscalYear, setSelectedFiscalYear, currentFiscalYear } = useFiscalYearSelection(accountId || "");
  
  const activePlans = plans.filter(p => p.active);
  
  // Export page requires a specific fiscal year, not "all"
  // If "all" is selected or the value is invalid, default to current fiscal year or first active plan
  const selectedFiscalYear = (rawSelectedFiscalYear && rawSelectedFiscalYear !== "all" && activePlans.some(p => p.fiscalYear === rawSelectedFiscalYear))
    ? rawSelectedFiscalYear
    : (activePlans.find(p => p.fiscalYear === currentFiscalYear)?.fiscalYear || activePlans[0]?.fiscalYear || currentFiscalYear);

  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/accounts", accountId, "subscription", selectedFiscalYear],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/subscription?fiscalYear=${selectedFiscalYear}`);
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      return response.json() as Promise<SubscriptionStatus>;
    },
    enabled: !!accountId && !!selectedFiscalYear,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

  const canExport = subscriptionStatus?.status === "trial" || subscriptionStatus?.status === "active";
  const yearReceipts = receipts.filter(r => r.fiscalYear === selectedFiscalYear);

  const handleExport = () => {
    if (!canExport) {
      toast({
        title: "Export not available",
        description: "You need an active subscription or trial to export receipts for this fiscal year.",
        variant: "destructive",
      });
      return;
    }

    if (yearReceipts.length === 0) {
      toast({
        title: "No receipts to export",
        description: `No receipts found for fiscal year ${selectedFiscalYear}`,
        variant: "destructive",
      });
      return;
    }

    const csv = generateCSV(yearReceipts);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gas-receipts-fy-${selectedFiscalYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Downloaded ${yearReceipts.length} receipts for FY ${selectedFiscalYear}`,
    });
  };

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    setLocation(`/upload/${accountId}`);
    return null;
  }

  if (accountLoading || receiptsLoading || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Account Not Found</CardTitle>
            <CardDescription>
              This account could not be loaded. Please try switching to a different account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-switch-account-error">
              <Link href="/accounts">
                Switch Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>Export Data - Gas Receipt Tax Refund</title>
        <meta name="description" content="Export your gas receipt data for tax filing." />
      </Helmet>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <h2 className="text-2xl font-semibold">Export Data</h2>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Export Data</CardTitle>
                <CardDescription className="mt-1">
                  Download receipt data for Missouri Form 4923-H
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-md p-4">
              <p className="text-sm text-foreground mb-2 font-medium">
                Submission Guidelines
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fiscal year runs from July 1 to June 30</li>
                <li>• Submit between July 1 and September 30 of the following year</li>
                <li>• Keep original receipts for your records</li>
                <li>• CSV format is compatible with Form 4923-H</li>
              </ul>
            </div>

            {activePlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No fiscal year plans available yet</p>
                <p className="text-sm mt-1">Please check back later</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  <div className="flex-1 w-full sm:w-auto space-y-2">
                    <Label htmlFor="export-fiscal-year" className="text-sm font-medium text-foreground">
                      Select Fiscal Year
                    </Label>
                    <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                      <SelectTrigger id="export-fiscal-year" className="w-full" data-testid="select-fiscal-year">
                        <SelectValue placeholder="Select a fiscal year" />
                      </SelectTrigger>
                      <SelectContent>
                        {activePlans.map((plan) => (
                          <SelectItem key={plan.fiscalYear} value={plan.fiscalYear} data-testid={`option-year-${plan.fiscalYear}`}>
                            FY {plan.fiscalYear} {plan.fiscalYear === currentFiscalYear ? "(Current)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleExport}
                    disabled={!canExport || yearReceipts.length === 0 || subscriptionLoading}
                    className="gap-2 w-full sm:w-auto"
                    data-testid="button-export"
                  >
                    {subscriptionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Export to CSV
                  </Button>
                </div>

                {subscriptionLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !canExport ? (
                  <div className="flex items-center gap-3 p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Subscription Required
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You need an active subscription or free trial for FY {selectedFiscalYear} to export receipts.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" data-testid="button-go-to-billing">
                      <Link href={`/billing/${accountId}`}>
                        Subscribe
                      </Link>
                    </Button>
                  </div>
                ) : yearReceipts.length > 0 ? (
                  <div className="flex items-center justify-between p-3 bg-accent/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Ready to export</span>
                      <Badge variant="secondary">
                        {subscriptionStatus?.status === "trial" ? "Trial" : "Subscribed"}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-foreground" data-testid="text-export-count">
                      {yearReceipts.length} receipt{yearReceipts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <span className="text-sm text-muted-foreground">
                      No receipts found for FY {selectedFiscalYear}
                    </span>
                    <Button asChild variant="outline" size="sm" data-testid="button-upload-receipt">
                      <Link href={`/upload/${accountId}`}>
                        Upload Receipt
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function generateCSV(receipts: Receipt[]): string {
  const headers = ["Date", "Station Name", "Gallons", "Price per Gallon", "Total Amount", "Fiscal Year"];
  const rows = receipts.map(r => [
    r.date,
    `"${(r.stationName || "").replace(/"/g, '""')}"`,
    parseFloat(r.gallons || "0").toFixed(3),
    parseFloat(r.pricePerGallon || "0").toFixed(3),
    parseFloat(r.totalAmount || "0").toFixed(2),
    r.fiscalYear,
  ]);

  return [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");
}
