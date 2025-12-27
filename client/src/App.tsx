import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AccountLayout } from "@/components/account-layout";
import Auth from "@/pages/auth";
import Accounts from "@/pages/accounts";
import Upload from "@/pages/upload";
import Receipts from "@/pages/receipts";
import People from "@/pages/people";
import Vehicles from "@/pages/vehicles";
import VehicleEdit from "@/pages/vehicle-edit";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import Billing from "@/pages/billing";
import Export from "@/pages/export";
import Privacy from "@/pages/privacy";
import Security from "@/pages/security";
import Cookies from "@/pages/cookies";
import NotFound from "@/pages/not-found";

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function AccountRoutes() {
  const [location] = useLocation();
  
  const accountIdMatch = location.match(/^\/(upload|receipts|people|vehicles|settings|billing|export)\/([^/]+)/);
  const accountId = accountIdMatch?.[2] || "";
  
  if (!accountId) {
    return <Redirect to="/accounts" />;
  }

  return (
    <AccountLayout accountId={accountId}>
      <Switch>
        <Route path="/upload/:accountId" component={Upload} />
        <Route path="/receipts/:accountId" component={Receipts} />
        <Route path="/people/:accountId" component={People} />
        <Route path="/vehicles/:accountId/edit/:vehicleId" component={VehicleEdit} />
        <Route path="/vehicles/:accountId" component={Vehicles} />
        <Route path="/settings/:accountId" component={Settings} />
        <Route path="/billing/:accountId" component={Billing} />
        <Route path="/export/:accountId" component={Export} />
      </Switch>
    </AccountLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Auth} />
      <Route path="/accounts">
        <AuthCheck>
          <Accounts />
        </AuthCheck>
      </Route>
      <Route path="/admin">
        <AuthCheck>
          <Admin />
        </AuthCheck>
      </Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/security" component={Security} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/upload/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/receipts/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/people/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/vehicles/:accountId/edit/:vehicleId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/vehicles/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/settings/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/billing/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route path="/export/:accountId">
        <AuthCheck>
          <AccountRoutes />
        </AuthCheck>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
