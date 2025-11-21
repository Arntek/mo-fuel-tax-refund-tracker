import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Receipt, Upload, Settings, LogOut, Users, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UploadZone } from "@/components/upload-zone";
import { ReceiptTable } from "@/components/receipt-table";
import { DashboardSummary } from "@/components/dashboard-summary";
import { ExportSection } from "@/components/export-section";
import { DeadlineBanner } from "@/components/deadline-banner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Receipt = any;
type Account = any;
type Vehicle = any;
type Member = any;

export default function Dashboard() {
  const params = useParams();
  const accountId = parseInt(params.accountId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("members");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const { data: account } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/accounts", accountId, "receipts"],
    enabled: !!accountId,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/accounts", accountId, "vehicles"],
    enabled: !!accountId,
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/accounts", accountId, "members"],
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <button 
            onClick={handleSwitchAccount}
            className="text-left hover-elevate active-elevate-2 rounded-md px-2 py-1"
            data-testid="button-account-name"
          >
            <h1 className="text-base sm:text-lg font-semibold">{account?.name || "Receipt Tracker"}</h1>
            <p className="text-xs text-muted-foreground">
              {account?.type === "family" ? "Family" : "Business"} Account
            </p>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-settings">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Account Settings</DialogTitle>
              </DialogHeader>
              <SettingsContent accountId={accountId} members={members} vehicles={vehicles} activeTab={settingsTab} onTabChange={setSettingsTab} />
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

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
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
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
                <Button 
                  onClick={() => {
                    setSettingsTab("vehicles");
                    setSettingsOpen(true);
                  }} 
                  data-testid="button-add-vehicle-prompt"
                >
                  Add Vehicle
                </Button>
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
            <UploadZone accountId={accountId} vehicleId={parseInt(selectedVehicleId)} />
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

function SettingsContent({ accountId, members, vehicles, activeTab, onTabChange }: { accountId: number; members: Member[]; vehicles: Vehicle[]; activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
      </TabsList>
      <TabsContent value="members" className="space-y-4">
        <MembersTab accountId={accountId} members={members} />
      </TabsContent>
      <TabsContent value="vehicles" className="space-y-4">
        <VehiclesTab accountId={accountId} vehicles={vehicles} />
      </TabsContent>
    </Tabs>
  );
}

function MembersTab({ accountId, members }: { accountId: number; members: Member[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const { toast } = useToast();

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      setEmail("");
      toast({
        title: "Member added",
        description: "The member has been added to the account",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/accounts/${accountId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the account",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-medium">Add Member</h3>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-member-email"
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-32" data-testid="select-member-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => addMemberMutation.mutate()}
            disabled={!email || addMemberMutation.isPending}
            data-testid="button-add-member"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Current Members</h3>
        <div className="space-y-2">
          {members.map((member: any) => (
            <Card key={member.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{member.user.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {member.user.email} • {member.role}
                    </CardDescription>
                  </div>
                  {member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberMutation.mutate(member.userId)}
                      disabled={removeMemberMutation.isPending}
                      data-testid={`button-remove-member-${member.userId}`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function VehiclesTab({ accountId, vehicles }: { accountId: number; vehicles: Vehicle[] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [weightUnder26000, setWeightUnder26000] = useState(true);
  const [lookingUpVin, setLookingUpVin] = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="space-y-4">
      {!showAddForm ? (
        <Button onClick={() => setShowAddForm(true)} data-testid="button-show-add-vehicle">
          Add Vehicle
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
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

      <div className="space-y-2">
        <h3 className="font-medium">Current Vehicles</h3>
        <div className="space-y-2">
          {vehicles.map((vehicle: any) => (
            <Card key={vehicle.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </CardTitle>
                    <CardDescription className="text-xs">
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
      </div>
    </div>
  );
}
