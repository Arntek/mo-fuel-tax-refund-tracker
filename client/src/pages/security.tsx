import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { ArrowLeft, Lock, CheckCircle } from "lucide-react";

export default function Security() {
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
            <Lock className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Security</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Security Practices</CardTitle>
            <p className="text-sm text-muted-foreground">How we protect your data</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">Our Commitment to Security</h2>
              <p className="text-muted-foreground">
                At MO Fuel Tax Refund, we take the security of your personal and financial information seriously. We implement industry-standard security measures to protect your data from unauthorized access, disclosure, alteration, and destruction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Security Measures</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Encryption in Transit</h3>
                    <p className="text-muted-foreground text-sm">All data transmitted between your browser and our servers is encrypted using TLS 1.3 (Transport Layer Security).</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Secure Authentication</h3>
                    <p className="text-muted-foreground text-sm">We use passwordless magic code authentication via email, eliminating risks associated with weak or reused passwords.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Secure Payment Processing</h3>
                    <p className="text-muted-foreground text-sm">All payment processing is handled by Stripe, a PCI-DSS Level 1 certified payment processor. We never store your credit card information on our servers.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Access Controls</h3>
                    <p className="text-muted-foreground text-sm">Role-based access control ensures that only authorized users can access account data. Account owners control who has access to their information.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Secure File Storage</h3>
                    <p className="text-muted-foreground text-sm">Receipt images are stored in secure cloud storage with access controls. Each account's data is isolated from other accounts.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">Regular Security Updates</h3>
                    <p className="text-muted-foreground text-sm">We regularly update our software and dependencies to patch security vulnerabilities and implement the latest security best practices.</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Third-Party Services</h2>
              <p className="text-muted-foreground">
                We use trusted third-party services that maintain their own security certifications:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Stripe</strong> - PCI-DSS Level 1 certified for payment processing</li>
                <li><strong>Google Cloud</strong> - SOC 2 Type II certified for file storage</li>
                <li><strong>OpenAI</strong> - For AI-powered receipt transcription (data processing only)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Reporting Security Issues</h2>
              <p className="text-muted-foreground">
                If you discover a security vulnerability, please report it to us immediately through our support channels. We appreciate responsible disclosure and will work to address any issues promptly.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
