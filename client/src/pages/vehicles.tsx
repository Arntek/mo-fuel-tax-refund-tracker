import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Receipt, LogOut, ArrowLeft, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Account = any;
type Vehicle = any;

export default function Vehicles() {
  const params = useParams();
  const accountId = parseInt(params.accountId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [weightUnder26000, setWeightUnder26000] = useState(true);
  const [lookingUpVin, setLookingUpVin] = useState(false);

  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("selectedAccountId");
    setLocation("/accounts");
  };

  const handleVinLookup = async () => {
    if (vin.length !== 17) {
      toast({
        title: "Invalid VIN",
        description: "VIN must be exactly 17 characters",
        variant: "destructive",
      });
      return;
    }

    setLookingUpVin(true);
    try {
      const data = await apiRequest<any>(`/api/vin-lookup/${vin}`, { method: "GET" });
      setYear(data.year?.toString() || "");
      setMake(data.make || "");
      setModel(data.model || "");
      setFuelType(data.fuelType || "");
      toast({
        title: "VIN decoded",
        description: "Vehicle information has been populated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to lookup VIN",
        variant: "destructive",
      });
    } finally {
      setLookingUpVin(false);
    }
  };

  const addVehicleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}/vehicles`, {
        method: "POST",
        body: JSON.stringify({
          vin: vin || null,
          year: parseInt(year),
          make,
          model,
          fuelType,
          weightUnder26000,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "vehicles"] });
      setShowAddForm(false);
      setVin("");
      setYear("");
      setMake("");
      setModel("");
      setFuelType("");
      setWeightUnder26000(true);
      toast({
        title: "Vehicle added",
        description: "The vehicle has been added to the account",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add vehicle",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      return apiRequest(`/api/accounts/${accountId}/vehicles/${vehicleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "vehicles"] });
      toast({
        title: "Vehicle deleted",
        description: "The vehicle has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete vehicle",
        variant: "destructive",
      });
    },
  });

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || vehiclesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <button 
            onClick={handleSwitchAccount}
            className="text-left hover-elevate active-elevate-2 rounded-md px-2 py-1 flex items-center gap-1"
            data-testid="button-account-name"
          >
            <div>
              <h1 className="text-base sm:text-lg font-semibold">{account?.name || "Receipt Tracker"}</h1>
              <p className="text-xs text-muted-foreground">
                {account?.type === "family" ? "Family" : "Business"} Account
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Vehicles</h1>
        </div>

        <div className="space-y-4">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} data-testid="button-show-add-vehicle">
              Add Vehicle
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Add New Vehicle</CardTitle>
                <CardDescription>Add a vehicle to track gas receipts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="vin"
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      maxLength={17}
                      placeholder="17-character VIN"
                      data-testid="input-vin"
                    />
                    <Button
                      onClick={handleVinLookup}
                      disabled={vin.length !== 17 || lookingUpVin}
                      data-testid="button-lookup-vin"
                    >
                      {lookingUpVin ? "Looking up..." : "Lookup"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                      data-testid="input-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel-type">Fuel Type</Label>
                    <Input
                      id="fuel-type"
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value)}
                      required
                      data-testid="input-fuel-type"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    required
                    data-testid="input-make"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                    data-testid="input-model"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="weight"
                    checked={weightUnder26000}
                    onChange={(e) => setWeightUnder26000(e.target.checked)}
                    className="w-4 h-4"
                    data-testid="checkbox-weight"
                  />
                  <Label htmlFor="weight">Weight under 26,000 lbs</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => addVehicleMutation.mutate()}
                    disabled={!year || !make || !model || !fuelType || addVehicleMutation.isPending}
                    data-testid="button-save-vehicle"
                  >
                    Save Vehicle
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddForm(false)}
                    data-testid="button-cancel-add-vehicle"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Vehicles</h2>
            {vehicles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No vehicles added yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {vehicles.map((vehicle: any) => (
                  <Card key={vehicle.id}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {vehicle.fuelType} • {vehicle.weightUnder26000 ? "Under" : "Over"} 26,000 lbs
                            {vehicle.vin && ` • VIN: ${vehicle.vin}`}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                          disabled={deleteVehicleMutation.isPending}
                          data-testid={`button-delete-vehicle-${vehicle.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
