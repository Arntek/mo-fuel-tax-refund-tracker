import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { Receipt, Users, ChevronRight, LogOut, Plus, ShieldCheck, Mail, Check, X, Loader2 } from "lucide-react";
import type { User, Invitation, Account as AccountType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = {
  id: number;
  name: string;
  type: string;
  role: string;
  memberCount: number;
};

type InvitationWithAccount = Invitation & { account: AccountType };

export default function Accounts() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<"family" | "business">("family");

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: pendingInvitations = [] } = useQuery<InvitationWithAccount[]>({
    queryKey: ["/api/invitations"],
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(`/api/invitations/${invitationId}/accept`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Invitation accepted",
        description: "You've joined the account!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(`/api/invitations/${invitationId}/reject`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Invitation declined",
        description: "You've declined the invitation",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive",
      });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name: newAccountName, type: newAccountType }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setCreateDialogOpen(false);
      setNewAccountName("");
      setNewAccountType("family");
      toast({
        title: "Account created",
        description: "Your new account has been created successfully",
      });
      if (data.id) {
        handleSelectAccount(data.id);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
      setNewAccountName("");
      setNewAccountType("family");
    },
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

  const handleSelectAccount = (accountId: number) => {
    localStorage.setItem("selectedAccountId", accountId.toString());
    setLocation(`/dashboard/${accountId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading your accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-semibold">Receipt Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Select an Account</h2>
            <p className="text-muted-foreground">
              Choose which account you'd like to access
            </p>
          </div>

          {pendingInvitations.length > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Pending Invitations</CardTitle>
                </div>
                <CardDescription>
                  You've been invited to join these accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-background rounded-lg border"
                    data-testid={`invitation-${invitation.id}`}
                  >
                    <div>
                      <div className="font-medium">{invitation.account?.name || "Unknown Account"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{invitation.role}</Badge>
                        <span>{invitation.account?.type === "family" ? "Family" : "Business"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptInvitationMutation.mutate(invitation.id)}
                        disabled={acceptInvitationMutation.isPending || rejectInvitationMutation.isPending}
                        data-testid={`button-accept-${invitation.id}`}
                      >
                        {acceptInvitationMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectInvitationMutation.mutate(invitation.id)}
                        disabled={acceptInvitationMutation.isPending || rejectInvitationMutation.isPending}
                        data-testid={`button-decline-${invitation.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {user?.isAdmin && (
              <Card
                className="hover-elevate active-elevate-2 cursor-pointer transition-all border-primary/50 bg-primary/5"
                onClick={() => setLocation("/admin")}
                data-testid="card-admin-console"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Console Admin</CardTitle>
                        <CardDescription>
                          Manage fiscal year plans and site users
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            )}

            {accounts?.map((account) => (
              <Card
                key={account.id}
                className="hover-elevate active-elevate-2 cursor-pointer transition-all"
                onClick={() => handleSelectAccount(account.id)}
                data-testid={`card-account-${account.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{account.name}</CardTitle>
                        <CardDescription>
                          {account.type === "family" ? "Family" : "Business"} • {account.role} • {account.memberCount} {account.memberCount === 1 ? "member" : "members"}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {(!accounts || accounts.length === 0) && (
            <Card>
              <CardHeader className="text-center py-12">
                <CardTitle>No Accounts Found</CardTitle>
                <CardDescription>
                  You don't have access to any accounts yet. Create one to get started.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline" data-testid="button-create-account">
                <Plus className="w-4 h-4 mr-2" />
                Create New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-account-name">Account Name</Label>
                  <Input
                    id="new-account-name"
                    placeholder="e.g., Smith Family, ABC Corp"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    data-testid="input-new-account-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-account-type">Account Type</Label>
                  <Select value={newAccountType} onValueChange={(value: "family" | "business") => setNewAccountType(value)}>
                    <SelectTrigger id="new-account-type" data-testid="select-new-account-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    if (!newAccountName.trim()) {
                      toast({
                        title: "Validation error",
                        description: "Account name is required",
                        variant: "destructive",
                      });
                      return;
                    }
                    createAccountMutation.mutate();
                  }}
                  disabled={!newAccountName.trim() || createAccountMutation.isPending}
                  className="w-full"
                  data-testid="button-save-new-account"
                >
                  {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}
