import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { ReceiptTable } from "@/components/receipt-table";
import { FiscalYearSummary } from "@/components/fiscal-year-summary";
import { DeadlineBanner } from "@/components/deadline-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Receipt = any;
type Account = any;

interface ReceiptsResponse {
  receipts: Receipt[];
  refundTotals: Record<string, number>;
}

export default function Receipts() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: receiptsData, isLoading: receiptsLoading } = useQuery<ReceiptsResponse>({
    queryKey: ["/api/accounts", accountId, "receipts"],
    enabled: !!accountId,
    refetchInterval: (query) => {
      const data = query.state.data as ReceiptsResponse | undefined;
      if (!data?.receipts) return false;
      const hasProcessing = data.receipts.some(
        (r: Receipt) => r.processingStatus === "pending" || r.processingStatus === "processing"
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const receipts = receiptsData?.receipts || [];
  const refundTotals = receiptsData?.refundTotals || {};

  // Get all unique fiscal years from receipts (memoized)
  const allFiscalYears = useMemo(() => {
    return Array.from(new Set(receipts.map((r: Receipt) => r.fiscalYear))).sort().reverse();
  }, [receipts]);
  
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("");

  // Update selected fiscal year when fiscal years change
  useEffect(() => {
    if (allFiscalYears.length > 0) {
      // If current selection is not in the list, reset to the first (most recent) year
      if (!allFiscalYears.includes(selectedFiscalYear)) {
        setSelectedFiscalYear(allFiscalYears[0]);
      }
    } else if (selectedFiscalYear) {
      // No receipts, clear selection
      setSelectedFiscalYear("");
    }
  }, [allFiscalYears, selectedFiscalYear]);

  // Filter receipts by selected fiscal year
  const filteredReceipts = selectedFiscalYear 
    ? receipts.filter((r: Receipt) => r.fiscalYear === selectedFiscalYear)
    : receipts;

  // Separate eligible (Missouri) and ineligible (other states) receipts
  const eligibleReceipts = filteredReceipts.filter((r: Receipt) => 
    r.sellerState?.toUpperCase() === "MO"
  );
  const ineligibleReceipts = filteredReceipts.filter((r: Receipt) => 
    r.sellerState && r.sellerState.toUpperCase() !== "MO"
  );
  const unclassifiedReceipts = filteredReceipts.filter((r: Receipt) => 
    !r.sellerState
  );

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || receiptsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading receipts...</p>
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
      <DeadlineBanner />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Fiscal Year Filter */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold">Receipts</h2>
          {allFiscalYears.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="fiscal-year-select" className="text-sm text-muted-foreground">
                Fiscal Year:
              </Label>
              <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                <SelectTrigger id="fiscal-year-select" data-testid="select-fiscal-year" className="w-40">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {allFiscalYears.map((year: string) => (
                    <SelectItem key={year} value={year}>
                      FY {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Tax Refund Summary - Only for eligible MO receipts */}
        {selectedFiscalYear && refundTotals[selectedFiscalYear] !== undefined && eligibleReceipts.length > 0 && (
          <Card data-testid="card-tax-refund-summary">
            <CardHeader>
              <CardTitle>Tax Refund Summary</CardTitle>
              <CardDescription>Total refund for FY {selectedFiscalYear} (Missouri purchases only)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary" data-testid="text-refund-amount">
                ${parseFloat(refundTotals[selectedFiscalYear].toString()).toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {eligibleReceipts.length} eligible receipt{eligibleReceipts.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards - Only for eligible receipts */}
        <FiscalYearSummary receipts={eligibleReceipts} fiscalYear={selectedFiscalYear} />

        {/* Eligible Receipts (Missouri) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Eligible Receipts</h3>
            <span className="text-sm text-muted-foreground">(Missouri purchases)</span>
          </div>
          {receiptsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : eligibleReceipts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No eligible Missouri receipts found{selectedFiscalYear ? ` for fiscal year ${selectedFiscalYear}` : ""}.
                </p>
                <Button asChild className="mt-4" data-testid="button-upload-receipt">
                  <Link href={`/upload/${accountId}`}>
                    Upload Receipt
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ReceiptTable receipts={eligibleReceipts} accountId={accountId} />
          )}
        </div>

        {/* Unclassified Receipts (missing state) */}
        {unclassifiedReceipts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-amber-600 dark:text-amber-400">Needs Review</h3>
              <span className="text-sm text-muted-foreground">(State not specified)</span>
            </div>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  These receipts need the seller state to be added to determine refund eligibility.
                </p>
                <ReceiptTable receipts={unclassifiedReceipts} accountId={accountId} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ineligible Receipts (other states) */}
        {ineligibleReceipts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-muted-foreground">Ineligible Receipts</h3>
              <span className="text-sm text-muted-foreground">(Out-of-state purchases)</span>
            </div>
            <Card className="border-muted">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Only fuel purchased in Missouri qualifies for Form 4923-H tax refunds.
                </p>
                <ReceiptTable receipts={ineligibleReceipts} accountId={accountId} />
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </>
  );
}
