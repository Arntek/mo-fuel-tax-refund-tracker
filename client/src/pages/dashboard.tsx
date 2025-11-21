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
  const [formData, setFormData] = useState({
    name: account?.name || "",
    type: account?.type || "family",
    businessName: account?.businessName || "",
    fein: account?.fein || "",
    firstName: account?.firstName || "",
    middleInitial: account?.middleInitial || "",
    lastName: account?.lastName || "",
    ssn: account?.ssn || "",
    spouseFirstName: account?.spouseFirstName || "",
    spouseMiddleInitial: account?.spouseMiddleInitial || "",
    spouseLastName: account?.spouseLastName || "",
    spouseSsn: account?.spouseSsn || "",
    mailingAddress: account?.mailingAddress || "",
    city: account?.city || "",
    state: account?.state || "",
    zipCode: account?.zipCode || "",
    emailAddress: account?.emailAddress || "",
    phoneNumber: account?.phoneNumber || "",
    faxNumber: account?.faxNumber || "",
  });

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify(formData),
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

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label htmlFor="account-name">Account Name</Label>
        <Input
          id="account-name"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          data-testid="input-account-name"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="account-type">Account Type</Label>
        <Select value={formData.type} onValueChange={(value) => handleChange("type", value)}>
          <SelectTrigger id="account-type" data-testid="select-account-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-3">Tax Form Information</h3>
        
        <div className="space-y-2">
          <Label htmlFor="business-name">Business Name</Label>
          <Input
            id="business-name"
            value={formData.businessName}
            onChange={(e) => handleChange("businessName", e.target.value)}
            data-testid="input-business-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fein">FEIN</Label>
          <Input
            id="fein"
            value={formData.fein}
            onChange={(e) => handleChange("fein", e.target.value)}
            placeholder="XX-XXXXXXX"
            data-testid="input-fein"
          />
        </div>

        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              data-testid="input-first-name"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label htmlFor="mi">MI</Label>
            <Input
              id="mi"
              value={formData.middleInitial}
              onChange={(e) => handleChange("middleInitial", e.target.value)}
              maxLength={2}
              data-testid="input-middle-initial"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              data-testid="input-last-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ssn">Social Security Number</Label>
          <Input
            id="ssn"
            value={formData.ssn}
            onChange={(e) => handleChange("ssn", e.target.value)}
            placeholder="XXX-XX-XXXX"
            data-testid="input-ssn"
          />
        </div>

        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="spouse-first-name">Spouse's First Name</Label>
            <Input
              id="spouse-first-name"
              value={formData.spouseFirstName}
              onChange={(e) => handleChange("spouseFirstName", e.target.value)}
              data-testid="input-spouse-first-name"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label htmlFor="spouse-mi">MI</Label>
            <Input
              id="spouse-mi"
              value={formData.spouseMiddleInitial}
              onChange={(e) => handleChange("spouseMiddleInitial", e.target.value)}
              maxLength={2}
              data-testid="input-spouse-middle-initial"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="spouse-last-name">Spouse's Last Name</Label>
            <Input
              id="spouse-last-name"
              value={formData.spouseLastName}
              onChange={(e) => handleChange("spouseLastName", e.target.value)}
              data-testid="input-spouse-last-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="spouse-ssn">Spouse's Social Security Number</Label>
          <Input
            id="spouse-ssn"
            value={formData.spouseSsn}
            onChange={(e) => handleChange("spouseSsn", e.target.value)}
            placeholder="XXX-XX-XXXX"
            data-testid="input-spouse-ssn"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mailing-address">Mailing Address</Label>
          <Input
            id="mailing-address"
            value={formData.mailingAddress}
            onChange={(e) => handleChange("mailingAddress", e.target.value)}
            data-testid="input-mailing-address"
          />
        </div>

        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              data-testid="input-city"
            />
          </div>
          <div className="col-span-1 space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => handleChange("state", e.target.value)}
              maxLength={2}
              data-testid="input-state"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="zip-code">ZIP Code</Label>
            <Input
              id="zip-code"
              value={formData.zipCode}
              onChange={(e) => handleChange("zipCode", e.target.value)}
              data-testid="input-zip-code"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-address">Email Address</Label>
          <Input
            id="email-address"
            type="email"
            value={formData.emailAddress}
            onChange={(e) => handleChange("emailAddress", e.target.value)}
            data-testid="input-email-address"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number</Label>
            <Input
              id="phone-number"
              value={formData.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
              data-testid="input-phone-number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fax-number">Fax Number</Label>
            <Input
              id="fax-number"
              value={formData.faxNumber}
              onChange={(e) => handleChange("faxNumber", e.target.value)}
              data-testid="input-fax-number"
            />
          </div>
        </div>
      </div>

      <Button 
        onClick={() => updateAccountMutation.mutate()}
        disabled={!formData.name || updateAccountMutation.isPending}
        data-testid="button-update-account"
        className="w-full"
      >
        {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

