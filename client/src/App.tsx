import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Auth from "@/pages/auth";
import Accounts from "@/pages/accounts";
import Dashboard from "@/pages/dashboard";
import People from "@/pages/people";
import Vehicles from "@/pages/vehicles";
import Settings from "@/pages/settings";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Auth} />
      <Route path="/accounts">
        <AuthCheck>
          <Accounts />
        </AuthCheck>
      </Route>
      <Route path="/dashboard/:accountId">
        <AuthCheck>
          <Dashboard />
        </AuthCheck>
      </Route>
      <Route path="/people/:accountId">
        <AuthCheck>
          <People />
        </AuthCheck>
      </Route>
      <Route path="/vehicles/:accountId">
        <AuthCheck>
          <Vehicles />
        </AuthCheck>
      </Route>
      <Route path="/settings/:accountId">
        <AuthCheck>
          <Settings />
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
