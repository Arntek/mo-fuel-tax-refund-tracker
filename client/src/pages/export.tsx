import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { AccountLayout } from "@/components/account-layout";
import { ExportSection } from "@/components/export-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Account, Receipt } from "@shared/schema";

export default function Export() {
  const { accountId } = useParams<{ accountId: string }>();
  const [, setLocation] = useLocation();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/accounts", accountId, "receipts"],
    enabled: !!accountId,
  });

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

  if (!accountId) {
    setLocation("/accounts");
    return null;
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    setLocation(`/dashboard/${accountId}`);
    return null;
  }

  if (accountLoading || receiptsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <AccountLayout accountId={accountId}>
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
      </AccountLayout>
    );
  }

  return (
    <AccountLayout accountId={accountId}>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <h2 className="text-2xl font-semibold">Export Data</h2>
        <ExportSection receipts={receipts} />
      </main>
    </AccountLayout>
  );
}
