import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { Receipt, Users, Building2, ArrowRight, DollarSign, FileText, Calendar, Fuel } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"landing" | "email" | "code" | "signup">("landing");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"family" | "business">("family");
  const [loading, setLoading] = useState(false);
  const [userExists, setUserExists] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      try {
        await apiRequest("/api/auth/me", { method: "GET" });
        setLocation("/accounts");
      } catch {
        // User not logged in, stay on auth page
      }
    };
    checkSession();
  }, [setLocation]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest<{ userExists: boolean; message: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setUserExists(response.userExists);
      
      if (response.userExists) {
        setStep("code");
        toast({
          title: "Code sent",
          description: "Check your email for the verification code (or check server logs in development)",
        });
      } else {
        setStep("signup");
        toast({
          title: "Email not registered",
          description: "Please create an account first",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      toast({
        title: "Success",
        description: "You're now logged in",
      });

      setLocation("/accounts");
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid or expired code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          code,
          accountName: accountName || `${firstName} ${lastName}'s Account`,
          accountType,
        }),
      });

      toast({
        title: "Account created",
        description: "Welcome! Your account has been created.",
      });

      setLocation("/accounts");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === "landing") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">Receipt Tracker</h1>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-4xl w-full space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Track Your Receipts,<br />Simplify Your Taxes
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Manage gas receipts for Missouri Form 4923-H tax refunds. Perfect for families and businesses tracking fuel expenses.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="hover-elevate">
                <CardHeader>
                  <Users className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>For Families</CardTitle>
                  <CardDescription>
                    Track household fuel expenses, share receipts among family members, and manage multiple vehicles easily.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <Building2 className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>For Businesses</CardTitle>
                  <CardDescription>
                    Manage team receipts, add multiple team members, track fleet vehicles, and streamline tax filing.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="w-6 h-6 text-primary" />
                  <CardTitle className="text-2xl">Simple Pricing</CardTitle>
                </div>
                <div className="text-4xl font-bold text-primary">$12</div>
                <CardDescription className="text-base">per fiscal year</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">Free 30-day trial</p>
                <p className="text-sm text-muted-foreground">No credit card required to start</p>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => setStep("email")}
                data-testid="button-get-started"
                className="gap-2"
              >
                Start Your Free Trial
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Automatic receipt transcription with AI</p>
              <p>Vehicle management and tracking</p>
              <p>Multi-user accounts with role management</p>
              <p>Secure cloud storage</p>
            </div>
          </div>
        </main>

        <Separator />

        <section className="bg-muted/30 py-12 px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">What is Missouri Form 4923-H?</h3>
              <p className="text-muted-foreground">Understanding the Motor Fuel Tax Refund Program</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <FileText className="w-6 h-6 text-primary mb-2" />
                  <CardTitle className="text-lg">The Program</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    Missouri Form 4923-H allows residents to claim refunds on the motor fuel tax increases 
                    that went into effect starting October 2021. The Missouri Legislature passed Senate Bill 262 
                    in 2021, which gradually increases the state motor fuel tax over several years.
                  </p>
                  <p>
                    To help offset this burden on everyday Missourians, the state created a refund program 
                    allowing individuals to claim back the tax increase portion on fuel purchased for 
                    personal, non-commercial use.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Calendar className="w-6 h-6 text-primary mb-2" />
                  <CardTitle className="text-lg">Filing Timeline</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    The Missouri fiscal year runs from July 1 to June 30. Claims must be filed 
                    between July 1 and September 30 following the end of the fiscal year.
                  </p>
                  <p>
                    For example, for fuel purchased between July 1, 2024 and June 30, 2025, 
                    you can file your refund claim starting July 1, 2025 through September 30, 2025.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <Fuel className="w-6 h-6 text-primary mb-2" />
                <CardTitle className="text-lg">Tax Rate Increases & Refund Amounts</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-4">
                <p>
                  The base Missouri motor fuel tax was 17 cents per gallon prior to SB 262. 
                  The law phased in increases as follows:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-semibold text-foreground text-sm">Oct 2021</p>
                    <p className="text-primary font-bold">+2.5¢/gal</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-semibold text-foreground text-sm">Jul 2022</p>
                    <p className="text-primary font-bold">+5.0¢/gal</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-semibold text-foreground text-sm">Jul 2023</p>
                    <p className="text-primary font-bold">+7.5¢/gal</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-semibold text-foreground text-sm">Jul 2024</p>
                    <p className="text-primary font-bold">+10.0¢/gal</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md border-2 border-primary/30">
                    <p className="font-semibold text-foreground text-sm">Jul 2025</p>
                    <p className="text-primary font-bold">+12.5¢/gal</p>
                    <p className="text-xs text-muted-foreground">Maximum</p>
                  </div>
                </div>
                <p>
                  <strong className="text-foreground">Example:</strong> If you purchased 1,000 gallons of fuel 
                  during fiscal year 2024-2025 at the 10¢ increase rate, your refund would be approximately 
                  <strong className="text-primary"> $100.00</strong>. The average Missouri driver purchases 
                  about 500-800 gallons per year, potentially receiving <strong className="text-primary">$50-$80</strong> in refunds.
                </p>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Keep your gas station receipts throughout the year. This app helps you photograph, 
                organize, and calculate your refund automatically.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t py-6 px-4 text-center text-sm text-muted-foreground">
          <p>Receipt Tracker for Missouri Form 4923-H</p>
        </footer>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Enter your email to receive a login code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-request-code">
                {loading ? "Sending..." : "Send Login Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("landing")}
                data-testid="button-back"
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                  data-testid="input-code"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-verify-code">
                {loading ? "Verifying..." : "Verify & Login"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("email")}
                data-testid="button-back-to-email"
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Enter the verification code sent to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-code">Verification Code</Label>
                <Input
                  id="signup-code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                  data-testid="input-signup-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  data-testid="input-last-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name (Optional)</Label>
                <Input
                  id="account-name"
                  type="text"
                  placeholder="My Family Account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  data-testid="input-account-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <select
                  id="account-type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as "family" | "business")}
                  data-testid="select-account-type"
                >
                  <option value="family">Family</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-create-account">
                {loading ? "Creating..." : "Create Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("email")}
                data-testid="button-back-to-email-signup"
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
