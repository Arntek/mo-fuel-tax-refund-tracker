import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, Vehicle } from "@shared/schema";

export default function VehicleEdit() {
  const params = useParams();
  const accountId = params.accountId || "";
  const vehicleId = params.vehicleId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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

  const { data: vehicle, isLoading: vehicleLoading } = useQuery<Vehicle>({
    queryKey: ["/api/accounts", accountId, "vehicles", vehicleId],
    enabled: !!accountId && !!vehicleId,
  });

  useEffect(() => {
    if (vehicle) {
      setNickname(vehicle.nickname || "");
      setVin(vehicle.vin || "");
      setYear(vehicle.year?.toString() || "");
      setMake(vehicle.make || "");
      setModel(vehicle.model || "");
      setFuelType(vehicle.fuelType || "");
      setWeightUnder26000(vehicle.weightUnder26000 ?? true);
    }
  }, [vehicle]);

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

  const updateVehicleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}/vehicles/${vehicleId}`, {
        method: "PUT",
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
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "vehicles", vehicleId] });
      toast({
        title: "Vehicle updated",
        description: "The vehicle has been updated successfully",
      });
      setLocation(`/vehicles/${accountId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update vehicle",
        variant: "destructive",
      });
    },
  });

  if (!accountId || !vehicleId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || vehicleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading vehicle...</p>
        </div>
      </div>
    );
  }

  if (accountError || !account || !vehicle) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Vehicle Not Found</CardTitle>
            <CardDescription>
              This vehicle could not be loaded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-back-to-vehicles">
              <Link href={`/vehicles/${accountId}`}>
                Back to Vehicles
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Edit Vehicle</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
            <CardDescription>Update vehicle information</CardDescription>
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
                onClick={() => updateVehicleMutation.mutate()}
                disabled={!year || !make || !model || !fuelType || updateVehicleMutation.isPending}
                data-testid="button-save-vehicle"
              >
                {updateVehicleMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation(`/vehicles/${accountId}`)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
