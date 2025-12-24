import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { ArrowLeft, Cookie } from "lucide-react";

export default function Cookies() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Cookie Policy</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Cookie Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">What Are Cookies</h2>
              <p className="text-muted-foreground">
                Cookies are small text files that are stored on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">How We Use Cookies</h2>
              <p className="text-muted-foreground">
                MO Fuel Tax Refund uses cookies for the following purposes:
              </p>
              
              <h3 className="font-medium mt-4">Essential Cookies</h3>
              <p className="text-muted-foreground text-sm">
                These cookies are necessary for the website to function properly. They enable core functionality such as:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                <li><strong>Session Management</strong> - To keep you logged in as you navigate the application</li>
                <li><strong>Security</strong> - To help protect your account from unauthorized access</li>
              </ul>

              <h3 className="font-medium mt-4">Preference Cookies</h3>
              <p className="text-muted-foreground text-sm">
                These cookies remember your preferences, such as:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                <li><strong>Theme Preference</strong> - To remember your light/dark mode preference</li>
                <li><strong>Table Settings</strong> - To remember pagination preferences (items per page)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Cookies We Use</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Cookie Name</th>
                      <th className="text-left py-2 pr-4">Purpose</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">session_id</td>
                      <td className="py-2 pr-4">Authentication session</td>
                      <td className="py-2">7 days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">theme</td>
                      <td className="py-2 pr-4">Light/dark mode preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Third-Party Cookies</h2>
              <p className="text-muted-foreground">
                We use Stripe for payment processing, which may set its own cookies when you interact with payment forms. Stripe's cookie usage is governed by their own privacy and cookie policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Managing Cookies</h2>
              <p className="text-muted-foreground">
                Most web browsers allow you to control cookies through their settings. You can usually:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>View cookies stored on your device</li>
                <li>Delete all or specific cookies</li>
                <li>Block all cookies or cookies from specific websites</li>
                <li>Set preferences for different types of cookies</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Please note that blocking essential cookies may impact the functionality of the application. You may not be able to log in or use certain features if essential cookies are blocked.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Updates to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about our use of cookies, please contact us through the application support channels.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
