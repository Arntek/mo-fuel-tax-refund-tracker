import { Receipt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, DollarSign, FileText, Calendar } from "lucide-react";

interface DashboardSummaryProps {
  receipts: Receipt[];
  fiscalYear: string;
}

export function DashboardSummary({ receipts, fiscalYear }: DashboardSummaryProps) {
  const totalGallons = receipts.reduce((sum, r) => sum + parseFloat(r.gallons), 0);
  const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
  const receiptCount = receipts.length;

  const daysUntilDeadline = getDaysUntilDeadline();

  const summaryCards = [
    {
      title: "Total Gallons",
      value: totalGallons.toFixed(3),
      icon: Fuel,
      subtitle: `FY ${fiscalYear}`,
      testId: "text-total-gallons",
    },
    {
      title: "Total Amount",
      value: `$${totalAmount.toFixed(2)}`,
      icon: DollarSign,
      subtitle: `FY ${fiscalYear}`,
      testId: "text-total-amount",
    },
    {
      title: "Receipts",
      value: receiptCount.toString(),
      icon: FileText,
      subtitle: `FY ${fiscalYear}`,
      testId: "text-receipt-count",
    },
  ];

  if (daysUntilDeadline !== null) {
    summaryCards.push({
      title: "Days Until Deadline",
      value: daysUntilDeadline.toString(),
      icon: Calendar,
      subtitle: "Submit before Sept 30",
      testId: "text-days-until-deadline",
    });
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          Fiscal Year {fiscalYear} Summary
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          July 1, {fiscalYear.split('-')[0]} - June 30, {fiscalYear.split('-')[1]}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
              <card.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground" data-testid={card.testId}>
                {card.value}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getDaysUntilDeadline(): number | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 7 && month <= 9) {
    const deadline = new Date(year, 8, 30);
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }

  return null;
}
