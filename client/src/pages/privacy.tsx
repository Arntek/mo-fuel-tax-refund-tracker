import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { ArrowLeft, Shield } from "lucide-react";

export default function Privacy() {
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
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Privacy Policy</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                Arntek DBA MO Fuel Tax Refund ("we," "our," or "us") operates the MO Fuel Tax Refund application. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Information We Collect</h2>
              <p className="text-muted-foreground">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Account information (name, email address)</li>
                <li>Tax form information (Missouri Form 4923-H data)</li>
                <li>Vehicle information (VIN, make, model, year, fuel type)</li>
                <li>Receipt images and transcribed data (station name, gallons, prices, dates)</li>
                <li>Payment information (processed securely through Stripe)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
              <p className="text-muted-foreground">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process fuel tax refund calculations and generate Form 4923-H data</li>
                <li>Process payments and subscriptions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Information Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy. We may share information with:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Service providers who assist in operating our service (e.g., Stripe for payments, OpenAI for receipt transcription)</li>
                <li>Law enforcement if required by law or to protect our rights</li>
                <li>Account members you explicitly share access with</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate security measures to protect your personal information. All data is encrypted in transit using TLS/SSL. Receipt images and sensitive data are stored securely in cloud storage with access controls.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide services. Receipt data is retained for the applicable tax filing period plus any legally required retention period. You may request deletion of your account and associated data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Your Rights</h2>
              <p className="text-muted-foreground">You have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy, please contact us through the application support channels.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
