import { useState, useEffect, useMemo } from "react";
import { Receipt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportSectionProps {
  receipts: Receipt[];
}

export function ExportSection({ receipts }: ExportSectionProps) {
  const { toast } = useToast();

  // Memoize fiscal years to prevent unnecessary recalculations
  const fiscalYears = useMemo(() => {
    return Array.from(new Set(receipts.map(r => r.fiscalYear))).sort().reverse();
  }, [receipts]);

  const [selectedYear, setSelectedYear] = useState<string>("");

  // Initialize selected year to the first available fiscal year (most recent)
  useEffect(() => {
    if (fiscalYears.length > 0 && !fiscalYears.includes(selectedYear)) {
      setSelectedYear(fiscalYears[0]);
    }
  }, [fiscalYears, selectedYear]);

  const yearReceipts = receipts.filter(r => r.fiscalYear === selectedYear);

  const handleExport = () => {
    if (yearReceipts.length === 0) {
      toast({
        title: "No receipts to export",
        description: `No receipts found for fiscal year ${selectedYear}`,
        variant: "destructive",
      });
      return;
    }

    const csv = generateCSV(yearReceipts);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gas-receipts-fy-${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Downloaded ${yearReceipts.length} receipts for FY ${selectedYear}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Export Data</CardTitle>
            <CardDescription className="mt-1">
              Download receipt data for Missouri Form 4923-H
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 border border-border rounded-md p-4">
          <p className="text-sm text-foreground mb-2 font-medium">
            Submission Guidelines
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Fiscal year runs from July 1 to June 30</li>
            <li>• Submit between July 1 and September 30 of the following year</li>
            <li>• Keep original receipts for your records</li>
            <li>• CSV format is compatible with Form 4923-H</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full sm:w-auto space-y-2">
            <label className="text-sm font-medium text-foreground">
              Select Fiscal Year
            </label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full" data-testid="select-fiscal-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((year) => (
                  <SelectItem key={year} value={year} data-testid={`option-year-${year}`}>
                    FY {year} ({receipts.filter(r => r.fiscalYear === year).length} receipts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            disabled={yearReceipts.length === 0}
            className="gap-2 w-full sm:w-auto"
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>

        {yearReceipts.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-accent/50 rounded-md">
            <span className="text-sm text-muted-foreground">
              Ready to export
            </span>
            <span className="text-sm font-semibold text-foreground" data-testid="text-export-count">
              {yearReceipts.length} receipt{yearReceipts.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function generateCSV(receipts: Receipt[]): string {
  const headers = ["Date", "Station Name", "Gallons", "Price per Gallon", "Total Amount", "Fiscal Year"];
  const rows = receipts.map(r => [
    r.date,
    `"${r.stationName.replace(/"/g, '""')}"`,
    parseFloat(r.gallons).toFixed(3),
    parseFloat(r.pricePerGallon).toFixed(3),
    parseFloat(r.totalAmount).toFixed(2),
    r.fiscalYear,
  ]);

  return [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");
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
