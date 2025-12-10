import { useState } from "react";
import { Receipt } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

interface ReceiptModalProps {
  receipt: Receipt;
  accountId: string;
  open: boolean;
  onClose: () => void;
}

export function ReceiptModal({ receipt, accountId, open, onClose }: ReceiptModalProps) {
  const [formData, setFormData] = useState({
    date: receipt.date,
    stationName: receipt.stationName,
    sellerStreet: receipt.sellerStreet || "",
    sellerCity: receipt.sellerCity || "",
    sellerState: receipt.sellerState || "",
    sellerZip: receipt.sellerZip || "",
    gallons: parseFloat(receipt.gallons).toString(),
    pricePerGallon: parseFloat(receipt.pricePerGallon).toString(),
    totalAmount: parseFloat(receipt.totalAmount).toString(),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isUnvalidated = !receipt.validated;

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { validated?: boolean }) => {
      return apiRequest(`/api/accounts/${accountId}/receipts/${receipt.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
      toast({
        title: isUnvalidated ? "Receipt validated" : "Receipt updated",
        description: isUnvalidated ? "Receipt has been verified and saved" : "Changes saved successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUnvalidated) {
      updateMutation.mutate({ ...formData, validated: true });
    } else {
      updateMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isUnvalidated && <AlertCircle className="w-5 h-5 text-destructive" />}
            {isUnvalidated ? "Validate Receipt" : "Receipt Details"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="border rounded-md overflow-hidden bg-muted">
              <img
                src={receipt.imageUrl}
                alt="Receipt"
                className="w-full h-auto"
                data-testid="img-receipt-detail"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isUnvalidated && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                Please verify the AI-extracted details below match the receipt image.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="input-edit-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stationName">Seller Name</Label>
              <Input
                id="stationName"
                value={formData.stationName}
                onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
                required
                data-testid="input-edit-station"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerStreet">Street Address</Label>
              <Input
                id="sellerStreet"
                value={formData.sellerStreet}
                onChange={(e) => setFormData({ ...formData, sellerStreet: e.target.value })}
                placeholder="123 Main St"
                data-testid="input-edit-street"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="sellerCity">City</Label>
                <Input
                  id="sellerCity"
                  value={formData.sellerCity}
                  onChange={(e) => setFormData({ ...formData, sellerCity: e.target.value })}
                  placeholder="City"
                  data-testid="input-edit-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellerState">State</Label>
                <Input
                  id="sellerState"
                  value={formData.sellerState}
                  onChange={(e) => setFormData({ ...formData, sellerState: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="MO"
                  maxLength={2}
                  data-testid="input-edit-state"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellerZip">ZIP</Label>
                <Input
                  id="sellerZip"
                  value={formData.sellerZip}
                  onChange={(e) => setFormData({ ...formData, sellerZip: e.target.value })}
                  placeholder="12345"
                  data-testid="input-edit-zip"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gallons">Gallons</Label>
              <Input
                id="gallons"
                type="number"
                step="0.001"
                value={formData.gallons}
                onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                required
                data-testid="input-edit-gallons"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerGallon">Price per Gallon</Label>
              <Input
                id="pricePerGallon"
                type="number"
                step="0.01"
                value={formData.pricePerGallon}
                onChange={(e) => setFormData({ ...formData, pricePerGallon: e.target.value })}
                required
                data-testid="input-edit-price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                required
                data-testid="input-edit-total"
              />
            </div>

            <div className="pt-2 space-y-2 text-sm text-muted-foreground border-t">
              <p className="pt-2">
                <span className="font-medium">Fiscal Year:</span> {receipt.fiscalYear}
              </p>
              {receipt.taxRate !== undefined && (
                <p data-testid="text-tax-rate">
                  <span className="font-medium">Tax Rate:</span> ${parseFloat(receipt.taxRate.toString()).toFixed(3)}/gal
                </p>
              )}
              {receipt.taxRefund !== undefined && (
                <p className="text-base font-semibold text-primary" data-testid="text-tax-refund">
                  <span className="font-medium text-muted-foreground">Tax Refund:</span> ${parseFloat(receipt.taxRefund.toString()).toFixed(2)}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                variant={isUnvalidated ? "default" : "default"}
                data-testid="button-save-edit"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isUnvalidated ? "Validate" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
