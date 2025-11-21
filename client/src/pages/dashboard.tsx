import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ReceiptTable } from "@/components/receipt-table";
import { DashboardSummary } from "@/components/dashboard-summary";
import { ExportSection } from "@/components/export-section";
import { DeadlineBanner } from "@/components/deadline-banner";
import { AccountHeader } from "@/components/account-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car } from "lucide-react";

type Receipt = any;
type Account = any;
type Vehicle = any;
type Member = any;

export default function Dashboard() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/accounts", accountId, "receipts"],
    enabled: !!accountId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
  });

  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (currentMonth >= 7) {
      return `${currentYear}-${currentYear + 1}`;
    } else {
      return `${currentYear - 1}-${currentYear}`;
    }
  };

  const fiscalYear = receipts.length > 0 
    ? receipts[0].fiscalYear 
    : getCurrentFiscalYear();

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || vehiclesLoading || receiptsLoading) {
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
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Upload Receipt</h2>
          
          {vehicles.length > 0 && (
            <div className="max-w-md">
              <Label htmlFor="vehicle-select">Select Vehicle</Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger id="vehicle-select" data-testid="select-vehicle">
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
            </div>
          )}

          {vehicles.length === 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  No Vehicles Added
                </CardTitle>
                <CardDescription>
                  Add at least one vehicle in settings before uploading receipts.
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

          {vehicles.length > 0 && !selectedVehicleId && (
            <Card className="border-accent">
              <CardHeader>
                <CardDescription>
                  Please select a vehicle before uploading a receipt.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {vehicles.length > 0 && selectedVehicleId && (
            <UploadZone accountId={accountId} vehicleId={selectedVehicleId} />
          )}
        </div>

        <DashboardSummary receipts={receipts} fiscalYear={fiscalYear} />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Receipts</h2>
          {receiptsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ReceiptTable receipts={receipts} accountId={accountId} />
          )}
        </div>

        <ExportSection receipts={receipts} />
      </main>
    </div>
  );
}

