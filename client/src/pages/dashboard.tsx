import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { UploadZone } from "@/components/upload-zone";
import { DeadlineBanner } from "@/components/deadline-banner";
import { AccountHeader } from "@/components/account-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Check } from "lucide-react";

type Account = any;
type Vehicle = any;

export default function Dashboard() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
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

          {vehicles.length > 0 && (
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
                    <UploadZone accountId={accountId} vehicleId={selectedVehicleId} />
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
    </div>
  );
}

