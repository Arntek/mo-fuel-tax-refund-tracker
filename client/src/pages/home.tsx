import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "@shared/schema";
import { UploadZone } from "@/components/upload-zone";
import { DashboardSummary } from "@/components/dashboard-summary";
import { ReceiptTable } from "@/components/receipt-table";
import { ExportSection } from "@/components/export-section";
import { ReceiptModal } from "@/components/receipt-modal";
import { DeadlineBanner } from "@/components/deadline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, FileText } from "lucide-react";

export default function Home() {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const currentFiscalYear = getCurrentFiscalYear();
  const fiscalYearReceipts = receipts.filter(r => r.fiscalYear === currentFiscalYear);

  return (
    <div className="min-h-screen bg-background">
      <DeadlineBanner />
      
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  Gas Receipt Manager
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Missouri Form 4923-H Tax Refund
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">
        <UploadZone />

        <DashboardSummary receipts={fiscalYearReceipts} fiscalYear={currentFiscalYear} />

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <ReceiptTable 
              receipts={receipts} 
              onViewReceipt={setSelectedReceipt}
            />
            <ExportSection receipts={receipts} />
          </div>
        )}
      </main>

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
        <Camera className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No receipts yet
      </h3>
      <p className="text-muted-foreground max-w-md mb-8">
        Upload your first gas station receipt to get started. You can drag and drop an image or use your camera to capture it.
      </p>
    </div>
  );
}

function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}
