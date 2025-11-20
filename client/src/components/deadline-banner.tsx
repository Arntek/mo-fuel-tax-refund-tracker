import { AlertCircle } from "lucide-react";

export function DeadlineBanner() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const isSubmissionWindow = month >= 7 && month <= 9;

  if (!isSubmissionWindow) {
    return null;
  }

  const deadline = new Date(year, 8, 30);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" data-testid="icon-deadline" />
          <p className="text-sm font-medium">
            <strong>Submission Window Open:</strong> You have {daysLeft} day{daysLeft !== 1 ? 's' : ''} to submit your Form 4923-H (deadline: September 30, {year})
          </p>
        </div>
      </div>
    </div>
  );
}
