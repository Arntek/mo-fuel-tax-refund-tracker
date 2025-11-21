import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Receipt, Settings, LogOut, Users, Car, ChevronDown } from "lucide-react";
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
          <Link href={`/people/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-people">
              <Users className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={`/vehicles/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-vehicles">
              <Car className="w-4 h-4" />
            </Button>
          </Link>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-settings">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Account Settings</DialogTitle>
              </DialogHeader>
              <SettingsContent account={account} accountId={accountId} />
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

function SettingsContent({ account, accountId }: { account: Account; accountId: number }) {
  const { toast } = useToast();
  const [accountName, setAccountName] = useState(account?.name || "");
  const [accountType, setAccountType] = useState<"family" | "business">(account?.type || "family");

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: accountName, type: accountType }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId] });
      toast({
        title: "Account updated",
        description: "Your account details have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update account",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="account-name">Account Name</Label>
        <Input
          id="account-name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          data-testid="input-account-name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-type">Account Type</Label>
        <Select value={accountType} onValueChange={(value: "family" | "business") => setAccountType(value)}>
          <SelectTrigger id="account-type" data-testid="select-account-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button 
        onClick={() => updateAccountMutation.mutate()}
        disabled={!accountName || updateAccountMutation.isPending}
        data-testid="button-update-account"
      >
        Save Changes
      </Button>
    </div>
  );
}

