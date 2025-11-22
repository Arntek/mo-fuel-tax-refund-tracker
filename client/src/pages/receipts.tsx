import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { ReceiptTable } from "@/components/receipt-table";
import { DashboardSummary } from "@/components/dashboard-summary";
import { ExportSection } from "@/components/export-section";
import { DeadlineBanner } from "@/components/deadline-banner";
import { AccountHeader } from "@/components/account-header";
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
      <div className="min-h-screen flex flex-col bg-background">
        <AccountHeader account={account} accountId={accountId} />
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AccountHeader account={account} accountId={accountId} />

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

        {/* Tax Refund Summary */}
        {selectedFiscalYear && refundTotals[selectedFiscalYear] !== undefined && (
          <Card data-testid="card-tax-refund-summary">
            <CardHeader>
              <CardTitle>Tax Refund Summary</CardTitle>
              <CardDescription>Total refund for FY {selectedFiscalYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary" data-testid="text-refund-amount">
                ${parseFloat(refundTotals[selectedFiscalYear].toString()).toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <DashboardSummary receipts={filteredReceipts} fiscalYear={selectedFiscalYear} />

        {/* Receipt Table */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">All Receipts</h3>
          {receiptsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {selectedFiscalYear 
                    ? `No receipts found for fiscal year ${selectedFiscalYear}.`
                    : "No receipts uploaded yet. Upload your first receipt to get started."}
                </p>
                <Button asChild className="mt-4" data-testid="button-upload-receipt">
                  <Link href={`/dashboard/${accountId}`}>
                    Upload Receipt
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ReceiptTable receipts={filteredReceipts} accountId={accountId} />
          )}
        </div>

        {/* Export Section */}
        <ExportSection receipts={receipts} />
      </main>
    </div>
  );
}
