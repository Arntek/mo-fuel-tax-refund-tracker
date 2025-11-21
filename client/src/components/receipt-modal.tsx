import { useState } from "react";
import { Receipt } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ReceiptModalProps {
  receipt: Receipt;
  accountId: number;
  open: boolean;
  onClose: () => void;
}

export function ReceiptModal({ receipt, accountId, open, onClose }: ReceiptModalProps) {
  const [formData, setFormData] = useState({
    date: receipt.date,
    stationName: receipt.stationName,
    gallons: parseFloat(receipt.gallons).toString(),
    pricePerGallon: parseFloat(receipt.pricePerGallon).toString(),
    totalAmount: parseFloat(receipt.totalAmount).toString(),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest(`/api/accounts/${accountId}/receipts/${receipt.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
      toast({
        title: "Receipt updated",
        description: "Changes saved successfully",
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
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Details</DialogTitle>
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
              <Label htmlFor="stationName">Station Name</Label>
              <Input
                id="stationName"
                value={formData.stationName}
                onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
                required
                data-testid="input-edit-station"
              />
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

            <div className="pt-2 text-sm text-muted-foreground">
              <p>Fiscal Year: {receipt.fiscalYear}</p>
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
                data-testid="button-save-edit"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
