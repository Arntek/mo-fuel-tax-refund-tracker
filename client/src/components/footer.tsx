import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground" data-testid="text-copyright">
            &copy; {currentYear} Arntek DBA MO Fuel Tax Refund. All rights reserved.
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy">
              <span className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md cursor-pointer" data-testid="link-privacy">
                Privacy Policy
              </span>
            </Link>
            <Link href="/security">
              <span className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md cursor-pointer" data-testid="link-security">
                Security
              </span>
            </Link>
            <Link href="/cookies">
              <span className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md cursor-pointer" data-testid="link-cookies">
                Cookie Policy
              </span>
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
