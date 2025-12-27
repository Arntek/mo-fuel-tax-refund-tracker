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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Users, 
  Calendar, 
  Receipt, 
  Loader2, 
  ShieldCheck, 
  Search,
  CreditCard,
  TrendingUp,
  RotateCcw,
  CheckCircle,
  Clock,
  Building2,
  Tag,
  Percent,
  Ban,
  AlertTriangle,
  ChevronRight,
  X,
  ExternalLink
} from "lucide-react";
import type { User, FiscalYearPlan } from "@shared/schema";
import { format } from "date-fns";

type UserWithStats = User & {
  totalReceipts: number;
  totalRefund: number;
  accountCount: number;
};

type AdminStats = {
  totalRevenue: number;
  netRevenue: number;
  totalRefunded: number;
  paidAccounts: number;
  trialAccounts: number;
  totalAccounts: number;
  discountCodesUsed: number;
  totalDiscounted: number;
};

type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  fiscalYear: string | null;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type AdminAccount = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  fiscalYear: string;
  status: string;
  paidAt: string | null;
  stripePaymentIntentId: string | null;
  receiptCount: number;
};

type StripePayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  fiscalYear: string | null;
  accountId: string | null;
  accountName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  description: string | null;
  refunded: boolean;
};

export default function Admin() {
  const { toast } = useToast();
  const [newPlan, setNewPlan] = useState({
    fiscalYear: "",
    name: "",
    description: "",
    priceInCents: 1200,
  });
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  
  // Drill-down selection state for Users tab
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const [newDiscountCode, setNewDiscountCode] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 100,
    maxRedemptions: "",
    fiscalYear: "",
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

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", selectedFiscalYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFiscalYear && selectedFiscalYear !== "all") {
        params.set("fiscalYear", selectedFiscalYear);
      }
      const res = await fetch(`/api/admin/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AdminAccount[]>({
    queryKey: ["/api/admin/accounts", selectedFiscalYear, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFiscalYear && selectedFiscalYear !== "all") {
        params.set("fiscalYear", selectedFiscalYear);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      const res = await fetch(`/api/admin/accounts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{ payments: StripePayment[] }>({
    queryKey: ["/api/admin/payments", selectedFiscalYear, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFiscalYear && selectedFiscalYear !== "all") {
        params.set("fiscalYear", selectedFiscalYear);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      const res = await fetch(`/api/admin/payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });
  
  const payments = paymentsData?.payments || [];

  const { data: discountCodesData, isLoading: discountCodesLoading } = useQuery<{ codes: DiscountCode[] }>({
    queryKey: ["/api/admin/discount-codes"],
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

  const refundMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      setRefundingPaymentId(paymentIntentId);
      return apiRequest(`/api/admin/payments/${paymentIntentId}/refund`, {
        method: "POST",
        body: JSON.stringify({ reason: "Admin initiated refund" }),
      });
    },
    onSuccess: () => {
      setRefundingPaymentId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Refunded", description: "Payment has been refunded" });
    },
    onError: (error: any) => {
      setRefundingPaymentId(null);
      toast({ title: "Error", description: error.message || "Failed to process refund", variant: "destructive" });
    },
  });

  const createDiscountCodeMutation = useMutation({
    mutationFn: async (data: typeof newDiscountCode) => {
      return apiRequest("/api/admin/discount-codes", {
        method: "POST",
        body: JSON.stringify({
          code: data.code.toUpperCase(),
          description: data.description || null,
          discountType: data.discountType,
          discountValue: data.discountType === "percentage" ? data.discountValue : data.discountValue,
          maxRedemptions: data.maxRedemptions ? parseInt(data.maxRedemptions) : null,
          fiscalYear: data.fiscalYear || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
      toast({ title: "Created", description: "Discount code created successfully" });
      setNewDiscountCode({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: 100,
        maxRedemptions: "",
        fiscalYear: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create discount code", variant: "destructive" });
    },
  });

  const deactivateDiscountCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/discount-codes/${id}/deactivate`, {
        method: "PUT",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
      toast({ title: "Deactivated", description: "Discount code has been deactivated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to deactivate discount code", variant: "destructive" });
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

  const handleRefund = (paymentIntentId: string, accountName: string) => {
    if (confirm(`Are you sure you want to refund the payment for "${accountName}"? This action cannot be undone.`)) {
      refundMutation.mutate(paymentIntentId);
    }
  };

  const handleCreateDiscountCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscountCode.code) {
      toast({ title: "Error", description: "Code is required", variant: "destructive" });
      return;
    }
    createDiscountCodeMutation.mutate(newDiscountCode);
  };

  const handleDeactivateDiscountCode = (id: string, code: string) => {
    if (confirm(`Are you sure you want to deactivate the discount code "${code}"?`)) {
      deactivateDiscountCodeMutation.mutate(id);
    }
  };

  const discountCodes = discountCodesData?.codes || [];

  // Derived data for drill-down navigation
  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;
  const userAccounts = selectedUserId 
    ? accounts.filter(a => a.ownerEmail === selectedUser?.email)
    : [];
  const selectedAccount = selectedAccountId 
    ? accounts.find(a => a.id === selectedAccountId) 
    : null;
  const accountPayments = selectedAccountId
    ? payments.filter(p => p.accountId === selectedAccountId)
    : [];

  // Handle drill-down navigation
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedAccountId(null);
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleClearSelection = () => {
    setSelectedUserId(null);
    setSelectedAccountId(null);
  };

  const handleBackToUser = () => {
    setSelectedAccountId(null);
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
        <Tabs 
          defaultValue="overview" 
          className="space-y-6"
          onValueChange={(value) => {
            // Clear search when switching to Users tab to avoid confusion
            if (value === "users") {
              setSearchQuery("");
            }
            // Clear drill-down selection when leaving Users tab
            if (value !== "users") {
              setSelectedUserId(null);
              setSelectedAccountId(null);
            }
          }}
        >
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <TrendingUp className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2" data-testid="tab-payments">
              <CreditCard className="w-4 h-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2" data-testid="tab-discounts">
              <Tag className="w-4 h-4" />
              Discounts
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2" data-testid="tab-plans">
              <Calendar className="w-4 h-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                <SelectTrigger className="w-[200px]" data-testid="select-fiscal-year-overview">
                  <SelectValue placeholder="All Fiscal Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fiscal Years</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.fiscalYear} value={plan.fiscalYear}>
                      FY {plan.fiscalYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-net-revenue">
                      ${((stats?.netRevenue || 0) / 100).toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    After refunds
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Captured</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold" data-testid="text-total-revenue">
                      ${((stats?.totalRevenue || 0) / 100).toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Gross revenue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-total-refunded">
                      ${((stats?.totalRefunded || 0) / 100).toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Money returned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Discounted</CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-total-discounted">
                      ${((stats?.totalDiscounted || 0) / 100).toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {stats?.discountCodesUsed || 0} codes used
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paid Accounts</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold" data-testid="text-paid-accounts">
                      {stats?.paidAccounts || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Active subscriptions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trial Accounts</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold" data-testid="text-trial-accounts">
                      {stats?.trialAccounts || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    In trial period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="text-2xl font-bold" data-testid="text-total-accounts">
                      {stats?.totalAccounts || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    All registered accounts
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Management</CardTitle>
                <CardDescription>
                  View and manage all Stripe payments. Filter by fiscal year or search by name/email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                    <SelectTrigger className="w-[200px]" data-testid="select-fiscal-year-payments">
                      <SelectValue placeholder="All Fiscal Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fiscal Years</SelectItem>
                      {plans.map((plan) => (
                        <SelectItem key={plan.fiscalYear} value={plan.fiscalYear}>
                          FY {plan.fiscalYear}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-payments"
                    />
                  </div>
                </div>

                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments found matching your criteria.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment ID</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="font-mono text-xs">
                            {payment.id.slice(0, 20)}...
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.accountName || "-"}
                          </TableCell>
                          <TableCell>
                            <div>{payment.userName || "-"}</div>
                            <div className="text-xs text-muted-foreground">{payment.userEmail || "-"}</div>
                          </TableCell>
                          <TableCell>{payment.fiscalYear || "-"}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${(payment.amount / 100).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              payment.refunded ? "destructive" :
                              payment.status === "succeeded" ? "default" :
                              "outline"
                            }>
                              {payment.refunded ? "Refunded" :
                               payment.status === "succeeded" ? "Paid" :
                               payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(payment.created * 1000), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {!payment.refunded && payment.status === "succeeded" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleRefund(payment.id, payment.accountName || payment.userEmail || "this payment")}
                                disabled={refundingPaymentId !== null}
                                data-testid={`button-refund-${payment.id}`}
                              >
                                {refundingPaymentId === payment.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                Refund
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discount Codes Tab */}
          <TabsContent value="discounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Discount Code
                </CardTitle>
                <CardDescription>
                  Create a new discount code. This will also create a coupon in Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDiscountCode} className="grid gap-4 md:grid-cols-6">
                  <div className="space-y-2">
                    <Label htmlFor="discountCode">Code</Label>
                    <Input
                      id="discountCode"
                      placeholder="SAVE20"
                      value={newDiscountCode.code}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, code: e.target.value.toUpperCase() })}
                      data-testid="input-discount-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountDesc">Description</Label>
                    <Input
                      id="discountDesc"
                      placeholder="20% off"
                      value={newDiscountCode.description}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, description: e.target.value })}
                      data-testid="input-discount-desc"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountType">Type</Label>
                    <Select value={newDiscountCode.discountType} onValueChange={(v: "percentage" | "fixed") => setNewDiscountCode({ ...newDiscountCode, discountType: v })}>
                      <SelectTrigger data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">
                      {newDiscountCode.discountType === "percentage" ? "Percent Off" : "Amount (cents)"}
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      value={newDiscountCode.discountValue}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, discountValue: parseInt(e.target.value) || 0 })}
                      data-testid="input-discount-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxRedemptions">Max Uses</Label>
                    <Input
                      id="maxRedemptions"
                      type="number"
                      placeholder="Unlimited"
                      value={newDiscountCode.maxRedemptions}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, maxRedemptions: e.target.value })}
                      data-testid="input-max-redemptions"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={createDiscountCodeMutation.isPending}
                      className="w-full"
                      data-testid="button-create-discount"
                    >
                      {createDiscountCodeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discount Codes</CardTitle>
                <CardDescription>
                  Manage discount codes and view usage statistics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {discountCodesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : discountCodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No discount codes created yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead className="text-center">Uses</TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discountCodes.map((code) => (
                        <TableRow key={code.id} data-testid={`row-discount-${code.id}`}>
                          <TableCell className="font-mono font-medium">
                            {code.code}
                          </TableCell>
                          <TableCell>
                            {code.description || "-"}
                          </TableCell>
                          <TableCell>
                            {code.discountType === "percentage" ? (
                              <span className="flex items-center gap-1">
                                <Percent className="w-3 h-3" />
                                {code.discountValue}%
                              </span>
                            ) : (
                              <span>${(code.discountValue / 100).toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {code.redemptionCount}
                            {code.maxRedemptions && ` / ${code.maxRedemptions}`}
                          </TableCell>
                          <TableCell>
                            {code.fiscalYear || "All"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={code.active ? "default" : "secondary"}>
                              {code.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {code.active && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleDeactivateDiscountCode(code.id, code.code)}
                                disabled={deactivateDiscountCodeMutation.isPending}
                                data-testid={`button-deactivate-${code.id}`}
                              >
                                <Ban className="w-3 h-3" />
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
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
                  Manage fiscal year plans and their pricing.
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab - Three Column Drill-Down Layout */}
          <TabsContent value="users" className="space-y-4">
            {/* Breadcrumb Navigation */}
            {(selectedUserId || selectedAccountId) && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-4 py-2">
                <button
                  onClick={handleClearSelection}
                  className="text-primary hover:underline font-medium"
                  data-testid="breadcrumb-users"
                >
                  Users
                </button>
                {selectedUser && (
                  <>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <button
                      onClick={handleBackToUser}
                      className={`font-medium ${selectedAccountId ? 'text-primary hover:underline' : 'text-foreground'}`}
                      data-testid="breadcrumb-user"
                    >
                      {selectedUser.firstName} {selectedUser.lastName}
                    </button>
                  </>
                )}
                {selectedAccount && (
                  <>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground" data-testid="breadcrumb-account">
                      {selectedAccount.name}
                    </span>
                  </>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="gap-1 h-7"
                  data-testid="button-clear-selection"
                >
                  <X className="w-3 h-3" />
                  Clear
                </Button>
              </div>
            )}

            {/* Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Column 1: Users List */}
              <Card className={`${selectedUserId ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Users
                    <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found.
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      {users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleSelectUser(u.id)}
                          className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover-elevate flex items-center gap-3 ${
                            selectedUserId === u.id ? 'bg-primary/10' : ''
                          }`}
                          data-testid={`row-user-${u.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {u.firstName} {u.lastName}
                              {u.isAdmin && (
                                <Badge variant="default" className="text-xs py-0">Admin</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div>{u.accountCount} accounts</div>
                            <div>{u.totalReceipts} receipts</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 2: Accounts for Selected User */}
              {selectedUserId && (
                <Card className={`${selectedAccountId ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Accounts
                      <Badge variant="secondary" className="ml-auto">{userAccounts.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Accounts owned by {selectedUser?.firstName} {selectedUser?.lastName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {accountsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : userAccounts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No accounts found for this user.
                      </div>
                    ) : (
                      <div className="max-h-[500px] overflow-y-auto">
                        {userAccounts.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => handleSelectAccount(account.id)}
                            className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover-elevate flex items-center gap-3 ${
                              selectedAccountId === account.id ? 'bg-primary/10' : ''
                            }`}
                            data-testid={`row-account-${account.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{account.name}</div>
                              <div className="text-sm text-muted-foreground">
                                FY {account.fiscalYear} • {account.receiptCount} receipts
                              </div>
                            </div>
                            <Badge variant={
                              account.status === 'paid' ? 'default' :
                              account.status === 'trial' ? 'secondary' :
                              'outline'
                            }>
                              {account.status === 'paid' ? 'Paid' :
                               account.status === 'trial' ? 'Trial' :
                               account.status}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  {/* Admin toggle for selected user */}
                  {selectedUser && (
                    <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30">
                      <div className="text-sm">
                        <span className="font-medium">Admin Access</span>
                        <span className="text-muted-foreground ml-2">
                          {selectedUser.isAdmin ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <Switch
                        checked={selectedUser.isAdmin}
                        onCheckedChange={(checked) => toggleAdminMutation.mutate({ userId: selectedUser.id, isAdmin: checked })}
                        disabled={selectedUser.id === user?.id}
                        data-testid={`switch-admin-${selectedUser.id}`}
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* Column 3: Payments for Selected Account */}
              {selectedAccountId && (
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Payments
                      <Badge variant="secondary" className="ml-auto">{accountPayments.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Payments for {selectedAccount?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {paymentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : accountPayments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No payments found for this account.
                      </div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto">
                        {accountPayments.map((payment) => (
                          <div
                            key={payment.id}
                            className="px-4 py-3 border-b last:border-b-0"
                            data-testid={`payment-detail-${payment.id}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-lg">
                                ${(payment.amount / 100).toFixed(2)}
                              </span>
                              <Badge variant={
                                payment.refunded ? "destructive" :
                                payment.status === "succeeded" ? "default" :
                                "outline"
                              }>
                                {payment.refunded ? "Refunded" :
                                 payment.status === "succeeded" ? "Paid" :
                                 payment.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>{format(new Date(payment.created * 1000), "MMM d, yyyy 'at' h:mm a")}</div>
                              {payment.fiscalYear && <div>Fiscal Year: {payment.fiscalYear}</div>}
                              <div className="font-mono text-xs truncate">{payment.id}</div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              {!payment.refunded && payment.status === "succeeded" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleRefund(payment.id, selectedAccount?.name || "this payment")}
                                  disabled={refundingPaymentId !== null}
                                  data-testid={`button-refund-${payment.id}`}
                                >
                                  {refundingPaymentId === payment.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3" />
                                  )}
                                  Refund
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                asChild
                              >
                                <a 
                                  href={`https://dashboard.stripe.com/payments/${payment.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid={`link-stripe-${payment.id}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Stripe
                                </a>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
