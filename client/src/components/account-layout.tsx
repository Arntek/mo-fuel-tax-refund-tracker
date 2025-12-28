import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Car, ChevronDown, Menu, Receipt, CreditCard, Upload, FileDown, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

type Account = any;

interface AccountLayoutProps {
  accountId: string;
  children: React.ReactNode;
  settingsContent?: React.ReactNode;
}

export function AccountLayout({ accountId, children, settingsContent }: AccountLayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/accounts", accountId, "my-role"],
    enabled: !!accountId,
  });

  const isAdminOrOwner = roleData?.role === "owner" || roleData?.role === "admin";

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

  const menuItems = [
    {
      title: "Upload",
      url: accountId ? `/upload/${accountId}` : "#",
      icon: Upload,
      testId: "button-upload",
    },
    {
      title: "Receipts",
      url: accountId ? `/receipts/${accountId}` : "#",
      icon: Receipt,
      testId: "button-receipts",
    },
    ...(isAdminOrOwner ? [
      {
        title: "People",
        url: accountId ? `/people/${accountId}` : "#",
        icon: Users,
        testId: "button-people",
      },
    ] : []),
    {
      title: "Vehicles",
      url: accountId ? `/vehicles/${accountId}` : "#",
      icon: Car,
      testId: "button-vehicles",
    },
    ...(isAdminOrOwner ? [
      {
        title: "Billing",
        url: accountId ? `/billing/${accountId}` : "#",
        icon: CreditCard,
        testId: "button-billing",
      },
      {
        title: "Export Data",
        url: accountId ? `/export/${accountId}` : "#",
        icon: FileDown,
        testId: "button-export",
      },
    ] : []),
  ];

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar collapsible="icon" className="hidden sm:flex border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
                <span className="truncate font-semibold text-sm leading-tight">
                  {account?.name || "Arntek"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {account?.type === "family" ? "Family" : "Business"}
                </span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.title}
                        isActive={location === item.url}
                        data-testid={item.testId}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={toggleTheme} tooltip={theme === "dark" ? "Light Mode" : "Dark Mode"}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSwitchAccount} tooltip="Switch Account">
                  <ChevronDown className="h-4 w-4 rotate-90" />
                  <span>Switch Account</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Header - only visible on small screens */}
          <header className="flex sm:hidden h-14 items-center gap-4 border-b bg-background px-4 sticky top-0 z-40">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="h-6 w-6 text-primary" />
                      <span className="font-bold text-lg">Arntek</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{account?.name}</p>
                  </div>
                  <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {menuItems.map((item) => (
                      <Link key={item.title} href={item.url}>
                        <Button 
                          variant={location === item.url ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3 px-3 h-11"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid={`mobile-${item.testId}`}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.title}
                        </Button>
                      </Link>
                    ))}
                  </nav>
                  <div className="p-4 border-t space-y-2">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-11"
                      onClick={toggleTheme}
                    >
                      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-11"
                      onClick={handleSwitchAccount}
                    >
                      <ChevronDown className="h-5 w-5 rotate-90" />
                      Switch Account
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div className="font-semibold truncate flex-1">{account?.name}</div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
