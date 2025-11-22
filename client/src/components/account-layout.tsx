import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Upload, Settings, LogOut, Users, Car, ChevronDown, Menu, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type Account = any;

interface AccountLayoutProps {
  accountId: number;
  children: React.ReactNode;
  settingsContent?: React.ReactNode;
}

export function AccountLayout({ accountId, children, settingsContent }: AccountLayoutProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading account...</p>
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

        <div className="hidden sm:flex items-center gap-1 sm:gap-2">
          <Link href={`/dashboard/${accountId}`}>
            <Button variant="ghost" size="icon" data-testid="button-dashboard">
              <Upload className="w-4 h-4" />
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
          {settingsContent && (
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-8">
                <Link href={`/dashboard/${accountId}`}>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-dashboard"
                  >
                    <Upload className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link href={`/people/${accountId}`}>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-people"
                  >
                    <Users className="w-4 h-4" />
                    People
                  </Button>
                </Link>
                <Link href={`/vehicles/${accountId}`}>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-vehicles"
                  >
                    <Car className="w-4 h-4" />
                    Vehicles
                  </Button>
                </Link>
                <div className="border-t my-2" />
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  data-testid="mobile-button-logout"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      {children}
    </div>
  );
}
