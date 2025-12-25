import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AccountHeader } from "@/components/account-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, AccountMember, User } from "@shared/schema";

type MemberWithUser = AccountMember & { user: User };

export default function People() {
  const params = useParams();
  const accountId = params.accountId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

  useEffect(() => {
    if (!roleLoading && roleData && !isAdminOrOwner) {
      setLocation(`/dashboard/${accountId}`);
    }
  }, [roleLoading, roleData, isAdminOrOwner, accountId, setLocation]);

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/accounts", accountId, "members"],
    enabled: !!accountId && isAdminOrOwner,
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return null;
  }


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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/accounts/${accountId}/members/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      toast({
        title: "Role updated",
        description: "The member's role has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const deactivateMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/accounts/${accountId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Member deactivated",
        description: "The member has been deactivated from the account",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deactivate member",
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
              {members.filter(member => member.active).map(member => (
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
                        {member.role === "owner" ? (
                          <span className="text-sm text-muted-foreground capitalize">{member.role}</span>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => updateRoleMutation.mutate({ userId: member.userId, role: newRole })}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${member.userId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member" data-testid={`option-member-${member.userId}`}>Member</SelectItem>
                              <SelectItem value="admin" data-testid={`option-admin-${member.userId}`}>Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateMemberMutation.mutate(member.userId)}
                            disabled={deactivateMemberMutation.isPending}
                            data-testid={`button-deactivate-member-${member.userId}`}
                          >
                            Deactivate
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
