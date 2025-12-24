import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Plus, DollarSign, Users, Calendar, Receipt, Loader2, ShieldCheck } from "lucide-react";
import type { User, FiscalYearPlan } from "@shared/schema";

type UserWithStats = User & {
  totalReceipts: number;
  totalRefund: number;
  accountCount: number;
};

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPlan, setNewPlan] = useState({
    fiscalYear: "",
    name: "",
    description: "",
    priceInCents: 1200,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<FiscalYearPlan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users"],
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof newPlan) => {
      return apiRequest("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan created", description: "Fiscal year plan created successfully" });
      setNewPlan({ fiscalYear: "", name: "", description: "", priceInCents: 1200 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create plan", variant: "destructive" });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}/admin`, {
        method: "PUT",
        body: JSON.stringify({ isAdmin }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Updated", description: "Admin status updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update admin status", variant: "destructive" });
    },
  });

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.fiscalYear || !newPlan.name) {
      toast({ title: "Error", description: "Fiscal year and name are required", variant: "destructive" });
      return;
    }
    createPlanMutation.mutate(newPlan);
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/accounts">
              <Button variant="outline" className="gap-2" data-testid="button-back-accounts">
                <ArrowLeft className="w-4 h-4" />
                Back to Accounts
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounts">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="plans" className="gap-2" data-testid="tab-plans">
              <Calendar className="w-4 h-4" />
              Fiscal Year Plans
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Fiscal Year Plan
                </CardTitle>
                <CardDescription>
                  Create a new plan for a fiscal year. This will create a product and price in Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePlan} className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">Fiscal Year</Label>
                    <Input
                      id="fiscalYear"
                      placeholder="2024-2025"
                      value={newPlan.fiscalYear}
                      onChange={(e) => setNewPlan({ ...newPlan, fiscalYear: e.target.value })}
                      data-testid="input-fiscal-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planName">Plan Name</Label>
                    <Input
                      id="planName"
                      placeholder="FY 2024-2025 Subscription"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      data-testid="input-plan-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (cents)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newPlan.priceInCents}
                      onChange={(e) => setNewPlan({ ...newPlan, priceInCents: parseInt(e.target.value) || 1200 })}
                      data-testid="input-price"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={createPlanMutation.isPending}
                      className="w-full"
                      data-testid="button-create-plan"
                    >
                      {createPlanMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Plan"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Plans</CardTitle>
                <CardDescription>
                  Manage fiscal year plans and their Stripe configurations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : plans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No plans created yet. Create your first fiscal year plan above.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Stripe Price ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell className="font-medium">{plan.fiscalYear}</TableCell>
                          <TableCell>{plan.name}</TableCell>
                          <TableCell>${(plan.priceInCents / 100).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={plan.active ? "default" : "secondary"}>
                              {plan.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {plan.stripePriceId || "Not set"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  View all users, their receipt counts, and manage admin access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-center">Accounts</TableHead>
                        <TableHead className="text-center">Receipts</TableHead>
                        <TableHead className="text-center">Stripe Customer</TableHead>
                        <TableHead className="text-center">Admin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">
                            {u.firstName} {u.lastName}
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="text-center">{u.accountCount}</TableCell>
                          <TableCell className="text-center">{u.totalReceipts}</TableCell>
                          <TableCell className="text-center">
                            {u.stripeCustomerId ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                {u.stripeCustomerId.substring(0, 14)}...
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={u.isAdmin}
                              onCheckedChange={(checked) => toggleAdminMutation.mutate({ userId: u.id, isAdmin: checked })}
                              disabled={u.id === user?.id}
                              data-testid={`switch-admin-${u.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
