import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { UploadZone } from "@/components/upload-zone";
import { DeadlineBanner } from "@/components/deadline-banner";
import { ReceiptModal } from "@/components/receipt-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Car, Check, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { Receipt } from "@shared/schema";
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

type Account = any;
type Vehicle = any;

function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export default function Upload() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
  });

  const currentFiscalYear = getCurrentFiscalYear();

  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/accounts", accountId, "subscription", currentFiscalYear],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${accountId}/subscription?fiscalYear=${currentFiscalYear}`);
      if (!response.ok) return { 
        status: "trial" as const, 
        trialDaysRemaining: 30, 
        receiptCount: 0, 
        receiptLimit: 8,
        canUpload: true, 
        upgradeRequired: false,
        needsMoreReceipts: false 
      };
      return response.json();
    },
    enabled: !!accountId,
  });

  // Poll for the specific receipt when user clicks "View Receipt"
  const { data: viewingReceipt, isLoading: receiptLoading } = useQuery<Receipt>({
    queryKey: ["/api/accounts", accountId, "receipts", viewingReceiptId],
    enabled: !!viewingReceiptId,
    refetchInterval: (query) => {
      const data = query.state.data as Receipt | undefined;
      if (!data) return 1000;
      if (data.processingStatus === "completed" || data.processingStatus === "failed") {
        return false;
      }
      return 1000;
    },
  });

  // Load last selected vehicle from localStorage
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      const lastVehicleId = localStorage.getItem(`lastVehicle_${accountId}`);
      if (lastVehicleId && vehicles.some((v: Vehicle) => v.id === lastVehicleId)) {
        setSelectedVehicleId(lastVehicleId);
      }
    }
  }, [vehicles, accountId, selectedVehicleId]);

  // Save selected vehicle to localStorage
  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    localStorage.setItem(`lastVehicle_${accountId}`, vehicleId);
  };

  const handleViewReceipt = (receipt: Receipt) => {
    setViewingReceiptId(receipt.id);
  };

  const handleCloseModal = () => {
    setViewingReceiptId(null);
    queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
  };

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || vehiclesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading account...</p>
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

  const isProcessing = viewingReceipt && (viewingReceipt.processingStatus === "pending" || viewingReceipt.processingStatus === "processing");

  return (
    <>
      <Helmet>
        <title>Upload Receipts - Gas Receipt Tax Refund</title>
        <meta name="description" content="Upload and process gas station receipts for tax refund filing." />
      </Helmet>
      <DeadlineBanner />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Upload Receipt</h2>
          
          {vehicles.length === 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  No Vehicles Added
                </CardTitle>
                <CardDescription>
                  Add at least one vehicle before uploading receipts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/vehicles/${accountId}`}>
                  <Button data-testid="button-add-vehicle-prompt">
                    Add Vehicle
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {subscriptionStatus?.upgradeRequired && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                  {subscriptionStatus.status === "trial" ? "Upgrade Required" : "Need More Receipts"}
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  {subscriptionStatus.status === "trial" ? (
                    subscriptionStatus.receiptCount >= subscriptionStatus.receiptLimit
                      ? `You've reached the ${subscriptionStatus.receiptLimit}-receipt trial limit for ${currentFiscalYear}.`
                      : `Your 30-day trial for ${currentFiscalYear} has ended.`
                  ) : (
                    `You've used all ${subscriptionStatus.receiptLimit} receipts for ${currentFiscalYear}.`
                  )}
                  {" "}{subscriptionStatus.status === "trial" ? "Subscribe to continue uploading receipts." : "Purchase additional receipts to continue uploading."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Receipts uploaded: <span className="font-medium">{subscriptionStatus.receiptCount} / {subscriptionStatus.receiptLimit}</span>
                  </p>
                  <Progress value={Math.min(100, (subscriptionStatus.receiptCount / subscriptionStatus.receiptLimit) * 100)} className="h-2 mt-2" />
                </div>
                <Button asChild className="gap-2" data-testid="button-upgrade-upload">
                  <Link href={`/billing/${accountId}`}>
                    <CreditCard className="w-4 h-4" />
                    {subscriptionStatus.status === "trial" ? "Subscribe Now" : "Buy More Receipts"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {subscriptionStatus?.needsMoreReceipts && !subscriptionStatus?.upgradeRequired && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                  Need More Receipts
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  You've used all {subscriptionStatus.receiptLimit} receipts for {currentFiscalYear}. Purchase additional receipts to continue uploading.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Receipts uploaded: <span className="font-medium">{subscriptionStatus.receiptCount} / {subscriptionStatus.receiptLimit}</span>
                  </p>
                  <Progress value={Math.min(100, (subscriptionStatus.receiptCount / subscriptionStatus.receiptLimit) * 100)} className="h-2 mt-2" />
                </div>
                <Button asChild className="gap-2" data-testid="button-buy-more-upload">
                  <Link href={`/billing/${accountId}`}>
                    <CreditCard className="w-4 h-4" />
                    Buy More Receipts
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {subscriptionStatus?.status === "trial" && !subscriptionStatus?.upgradeRequired && (
            <Card className="border-muted">
              <CardContent className="py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    Trial: <span className="font-medium text-foreground">{subscriptionStatus.receiptCount}/{subscriptionStatus.receiptLimit} receipts</span>
                    {subscriptionStatus.trialDaysRemaining !== null && (
                      <span className="ml-2">
                        • <span className="font-medium text-foreground">{subscriptionStatus.trialDaysRemaining} days</span> remaining
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-xs">
                    <Link href={`/billing/${accountId}`}>
                      View Subscription
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {subscriptionStatus?.status === "active" && !subscriptionStatus?.needsMoreReceipts && (
            <Card className="border-muted">
              <CardContent className="py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    Active: <span className="font-medium text-foreground">{subscriptionStatus.receiptCount}/{subscriptionStatus.receiptLimit} receipts</span>
                    <span className="ml-2 text-green-600">
                      • {subscriptionStatus.receiptLimit - subscriptionStatus.receiptCount} remaining
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-xs">
                    <Link href={`/billing/${accountId}`}>
                      View Subscription
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {vehicles.length > 0 && !subscriptionStatus?.upgradeRequired && !subscriptionStatus?.needsMoreReceipts && (
            <>
              {/* Step 1: Select Vehicle */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      1
                    </span>
                    Select Vehicle
                  </CardTitle>
                  <CardDescription>
                    Choose which vehicle this receipt is for
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
                    <SelectTrigger id="vehicle-select" data-testid="select-vehicle" className="max-w-md">
                      <SelectValue placeholder="Choose a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle: Vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedVehicleId && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-600" />
                      Vehicle selected
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Upload Receipt */}
              {selectedVehicleId ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        2
                      </span>
                      Upload Receipt
                    </CardTitle>
                    <CardDescription>
                      Take a photo or upload an image of your gas receipt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UploadZone 
                      accountId={accountId} 
                      vehicleId={selectedVehicleId}
                      onViewReceipt={handleViewReceipt}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-muted-foreground/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-semibold">
                        2
                      </span>
                      Upload Receipt
                    </CardTitle>
                    <CardDescription>
                      Select a vehicle first to enable upload
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      {/* Processing indicator while waiting for AI */}
      {viewingReceiptId && isProcessing && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="py-8 text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing Receipt</h3>
              <p className="text-muted-foreground text-sm">
                AI is extracting details from your receipt. This usually takes a few seconds...
              </p>
              <Button 
                variant="outline" 
                onClick={() => setViewingReceiptId(null)} 
                className="mt-4"
                data-testid="button-cancel-processing"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Review Modal - only show when processing is complete */}
      {viewingReceipt && !isProcessing && (
        <ReceiptModal
          receipt={viewingReceipt}
          accountId={accountId}
          open={!!viewingReceipt && !isProcessing}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
