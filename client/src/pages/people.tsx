import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Receipt, LogOut, Users, Car, Settings, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = any;
type Member = any;

export default function People() {
  const params = useParams();
  const accountId = parseInt(params.accountId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
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

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/accounts/${accountId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
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

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (accountLoading || membersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading people...</p>
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
          <Link href={`/dashboard/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-dashboard">
              <Receipt className="w-4 h-4" />
            </Button>
          </Link>
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
          <Link href={`/settings/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
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
          <h1 className="text-2xl font-bold">People</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Member</CardTitle>
              <CardDescription>Invite someone to join this account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Members</h2>
            <div className="space-y-2">
              {members.map((member: any) => (
                <Card key={member.id}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">
                          {member.user.firstName} {member.user.lastName}
                        </CardTitle>
                        <CardDescription className="text-sm truncate">
                          {member.user.email}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground capitalize">{member.role}</span>
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
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
