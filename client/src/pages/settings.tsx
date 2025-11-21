import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountHeader } from "@/components/account-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Account } from "@shared/schema";

export default function Settings() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
  });

  const [formData, setFormData] = useState({
    name: "",
    type: "family" as "family" | "business",
    businessName: "",
    fein: "",
    firstName: "",
    middleInitial: "",
    lastName: "",
    ssn: "",
    spouseFirstName: "",
    spouseMiddleInitial: "",
    spouseLastName: "",
    spouseSsn: "",
    mailingAddress: "",
    city: "",
    state: "",
    zipCode: "",
    emailAddress: "",
    phoneNumber: "",
    faxNumber: "",
  });

  // Sync account data when it loads
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || "",
        type: (account.type as "family" | "business") || "family",
        businessName: account.businessName || "",
        fein: account.fein || "",
        firstName: account.firstName || "",
        middleInitial: account.middleInitial || "",
        lastName: account.lastName || "",
        ssn: account.ssn || "",
        spouseFirstName: account.spouseFirstName || "",
        spouseMiddleInitial: account.spouseMiddleInitial || "",
        spouseLastName: account.spouseLastName || "",
        spouseSsn: account.spouseSsn || "",
        mailingAddress: account.mailingAddress || "",
        city: account.city || "",
        state: account.state || "",
        zipCode: account.zipCode || "",
        emailAddress: account.emailAddress || "",
        phoneNumber: account.phoneNumber || "",
        faxNumber: account.faxNumber || "",
      });
    }
  }, [account]);

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


  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading) {
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

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <Link href={`/dashboard/${accountId}`}>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Account Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your account details and tax form information
            </p>
          </div>

          <div className="space-y-4">
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
              <h3 className="font-semibold mb-3">Tax Form Information (Form 4923-H)</h3>
              
              <div className="space-y-4">
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
        </div>
      </main>
    </div>
  );
}
