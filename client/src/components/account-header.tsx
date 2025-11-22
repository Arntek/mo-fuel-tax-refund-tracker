import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Upload, Receipt, Settings, LogOut, Users, Car, ChevronDown, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Account = {
  id: string;
  name: string;
  type: string;
};

interface AccountHeaderProps {
  account: Account | undefined;
  accountId: string;
}

export function AccountHeader({ account, accountId }: AccountHeaderProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      queryClient.clear();
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
    setLocation("/accounts");
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
  };

  // Fallback header when account fails to load
  if (!account) {
    return (
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <Button 
            variant="ghost"
            onClick={handleSwitchAccount}
            className="text-left hover-elevate active-elevate-2 px-2 py-1"
            data-testid="button-switch-account-fallback"
          >
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-muted-foreground">Account unavailable</h1>
              <p className="text-xs text-muted-foreground">Click to switch accounts</p>
            </div>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout-fallback" aria-label="Logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-50">
      <div className="flex items-center gap-2 sm:gap-4">
        <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        <button 
          onClick={handleSwitchAccount}
          className="text-left hover-elevate active-elevate-2 rounded-md px-2 py-1 flex items-center gap-1"
          data-testid="button-account-name"
        >
          <div>
            <h1 className="text-base sm:text-lg font-semibold">{account.name}</h1>
            <p className="text-xs text-muted-foreground">
              {account.type === "family" ? "Family" : "Business"} Account
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
          <Button variant="ghost" size="icon" data-testid="button-dashboard" aria-label="Dashboard" asChild>
            <Link href={`/dashboard/${accountId}`}>
              <Upload className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-people" aria-label="People" asChild>
            <Link href={`/people/${accountId}`}>
              <Users className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-vehicles" aria-label="Vehicles" asChild>
            <Link href={`/vehicles/${accountId}`}>
              <Car className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-settings" aria-label="Settings" asChild>
            <Link href={`/settings/${accountId}`}>
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout" aria-label="Logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </nav>
        
        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-menu"
                aria-label="Open navigation menu"
                aria-controls="mobile-nav"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav id="mobile-nav" className="flex flex-col gap-4 mt-8" aria-label="Mobile navigation">
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-button-dashboard" asChild>
                  <Link href={`/dashboard/${accountId}`} onClick={closeMenu}>
                    <Upload className="w-5 h-5" />
                    <span>Dashboard</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-button-people" asChild>
                  <Link href={`/people/${accountId}`} onClick={closeMenu}>
                    <Users className="w-5 h-5" />
                    <span>People</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-button-vehicles" asChild>
                  <Link href={`/vehicles/${accountId}`} onClick={closeMenu}>
                    <Car className="w-5 h-5" />
                    <span>Vehicles</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3" data-testid="mobile-button-settings" asChild>
                  <Link href={`/settings/${accountId}`} onClick={closeMenu}>
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => { closeMenu(); handleLogout(); }} data-testid="mobile-button-logout">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
