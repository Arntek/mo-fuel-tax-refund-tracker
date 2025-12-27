import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, Vehicle } from "@shared/schema";
import { Helmet } from "react-helmet";

export default function Vehicles() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";
  const [nickname, setNickname] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [weightUnder26000, setWeightUnder26000] = useState(true);
  const [lookingUpVin, setLookingUpVin] = useState(false);

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
  });

  // Separate active and inactive vehicles
  const { activeVehicles, inactiveVehicles } = useMemo(() => {
    const active = vehicles.filter(v => v.active);
    const inactive = vehicles.filter(v => !v.active);
    return { activeVehicles: active, inactiveVehicles: inactive };
  }, [vehicles]);


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
          nickname: nickname || null,
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
      setNickname("");
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
    mutationFn: async (vehicleId: string) => {
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
        <title>Vehicles - Gas Receipt Tax Refund</title>
        <meta name="description" content="Manage your vehicles for tax refund tracking." />
      </Helmet>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Vehicles</h1>
        </div>

        <div className="space-y-4">
          {isAdminOrOwner && !showAddForm && (
            <Button onClick={() => setShowAddForm(true)} data-testid="button-show-add-vehicle">
              Add Vehicle
            </Button>
          )}
          {isAdminOrOwner && showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Vehicle</CardTitle>
                <CardDescription>Add a vehicle to track gas receipts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname (Optional)</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g., My Truck, Work Van"
                    data-testid="input-nickname"
                  />
                </div>
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

          {/* Active Vehicles Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Active Vehicles</h2>
            {activeVehicles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active vehicles yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeVehicles.map(vehicle => (
                  <Card key={vehicle.id} data-testid={`card-vehicle-${vehicle.id}`}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">
                            {vehicle.nickname ? (
                              <>
                                {vehicle.nickname}
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                  ({vehicle.year} {vehicle.make} {vehicle.model})
                                </span>
                              </>
                            ) : (
                              `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                            )}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {vehicle.fuelType} • {vehicle.weightUnder26000 ? "Under" : "Over"} 26,000 lbs
                            {vehicle.vin && ` • VIN: ${vehicle.vin}`}
                          </CardDescription>
                        </div>
                        {isAdminOrOwner && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/vehicles/${accountId}/edit/${vehicle.id}`)}
                              data-testid={`button-edit-vehicle-${vehicle.id}`}
                            >
                              Edit
                            </Button>
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
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Vehicles Section */}
          {inactiveVehicles.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-muted-foreground">Inactive Vehicles</h2>
              <div className="space-y-2">
                {inactiveVehicles.map(vehicle => (
                  <Card key={vehicle.id} className="opacity-60" data-testid={`card-vehicle-inactive-${vehicle.id}`}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {vehicle.nickname ? (
                                <>
                                  {vehicle.nickname}
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({vehicle.year} {vehicle.make} {vehicle.model})
                                  </span>
                                </>
                              ) : (
                                `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                              )}
                            </CardTitle>
                            <Badge variant="secondary" className="ml-2" data-testid={`badge-inactive-${vehicle.id}`}>
                              Inactive
                            </Badge>
                          </div>
                          <CardDescription className="text-sm">
                            {vehicle.fuelType} • {vehicle.weightUnder26000 ? "Under" : "Over"} 26,000 lbs
                            {vehicle.vin && ` • VIN: ${vehicle.vin}`}
                          </CardDescription>
                        </div>
                        {isAdminOrOwner && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/vehicles/${accountId}/edit/${vehicle.id}`)}
                              data-testid={`button-edit-vehicle-inactive-${vehicle.id}`}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
