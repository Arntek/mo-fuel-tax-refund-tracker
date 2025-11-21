import { useState } from "react";
import { Receipt } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, ArrowUpDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReceiptModal } from "@/components/receipt-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReceiptTableProps {
  receipts: Receipt[];
  accountId: string;
}

type SortField = "date" | "stationName" | "gallons" | "totalAmount";
type SortDirection = "asc" | "desc";

export function ReceiptTable({ receipts, accountId }: ReceiptTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/accounts/${accountId}/receipts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
      toast({
        title: "Receipt deleted",
        description: "The receipt has been removed successfully",
      });
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the receipt",
        variant: "destructive",
      });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedReceipts = [...receipts].sort((a, b) => {
    let aVal: string | number = a[sortField];
    let bVal: string | number = b[sortField];

    if (sortField === "gallons" || sortField === "totalAmount") {
      aVal = parseFloat(aVal as string);
      bVal = parseFloat(bVal as string);
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">All Receipts</h2>
        
        <div className="hidden md:block">
          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-20">Preview</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-1 hover-elevate active-elevate-2 px-2 py-1 -mx-2 -my-1 rounded"
                      data-testid="button-sort-date"
                    >
                      Date
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("stationName")}
                      className="flex items-center gap-1 hover-elevate active-elevate-2 px-2 py-1 -mx-2 -my-1 rounded"
                      data-testid="button-sort-station"
                    >
                      Station
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort("gallons")}
                      className="flex items-center gap-1 ml-auto hover-elevate active-elevate-2 px-2 py-1 -mx-2 -my-1 rounded"
                      data-testid="button-sort-gallons"
                    >
                      Gallons
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Price/Gal</TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort("totalAmount")}
                      className="flex items-center gap-1 ml-auto hover-elevate active-elevate-2 px-2 py-1 -mx-2 -my-1 rounded"
                      data-testid="button-sort-total"
                    >
                      Total
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReceipts.map((receipt) => (
                  <TableRow key={receipt.id} className="hover-elevate" data-testid={`row-receipt-${receipt.id}`}>
                    <TableCell>
                      <img
                        src={receipt.imageUrl}
                        alt="Receipt thumbnail"
                        className="w-14 h-14 object-cover rounded"
                        data-testid={`img-receipt-${receipt.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-date-${receipt.id}`}>
                      {formatDate(receipt.date)}
                    </TableCell>
                    <TableCell data-testid={`text-station-${receipt.id}`}>
                      {receipt.stationName}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-gallons-${receipt.id}`}>
                      {parseFloat(receipt.gallons).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-price-${receipt.id}`}>
                      ${parseFloat(receipt.pricePerGallon).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold" data-testid={`text-total-${receipt.id}`}>
                      ${parseFloat(receipt.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setViewingReceipt(receipt)}
                          data-testid={`button-view-${receipt.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(receipt.id)}
                          data-testid={`button-delete-${receipt.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="md:hidden space-y-4">
          {sortedReceipts.map((receipt) => (
            <div
              key={receipt.id}
              className="border rounded-md p-4 space-y-3 hover-elevate"
              data-testid={`card-receipt-${receipt.id}`}
            >
              <div className="flex gap-3">
                <img
                  src={receipt.imageUrl}
                  alt="Receipt"
                  className="w-20 h-20 object-cover rounded"
                  data-testid={`img-receipt-mobile-${receipt.id}`}
                />
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-foreground" data-testid={`text-date-mobile-${receipt.id}`}>
                    {formatDate(receipt.date)}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-station-mobile-${receipt.id}`}>
                    {receipt.stationName}
                  </div>
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-year-${receipt.id}`}>
                    FY {receipt.fiscalYear}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Gallons</div>
                  <div className="font-mono" data-testid={`text-gallons-mobile-${receipt.id}`}>
                    {parseFloat(receipt.gallons).toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Price/Gal</div>
                  <div className="font-mono" data-testid={`text-price-mobile-${receipt.id}`}>
                    ${parseFloat(receipt.pricePerGallon).toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-lg font-semibold font-mono" data-testid={`text-total-mobile-${receipt.id}`}>
                    ${parseFloat(receipt.totalAmount).toFixed(2)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingReceipt(receipt)}
                    data-testid={`button-view-mobile-${receipt.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteId(receipt.id)}
                    data-testid={`button-delete-mobile-${receipt.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewingReceipt && (
        <ReceiptModal
          receipt={viewingReceipt}
          accountId={accountId}
          open={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this receipt? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
