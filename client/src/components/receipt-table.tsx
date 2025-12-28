import { useState, useEffect } from "react";
import { Receipt } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Eye, Trash2, ArrowUpDown, AlertCircle, Loader2, XCircle } from "lucide-react";
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

type ReceiptWithTaxRefund = Receipt & { taxRefund?: number };

interface ReceiptTableProps {
  receipts: ReceiptWithTaxRefund[];
  accountId: string;
}

type SortField = "date" | "stationName" | "gallons" | "totalAmount";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE_KEY = "receipts_items_per_page";
const DEFAULT_ITEMS_PER_PAGE = 25;

export function ReceiptTable({ receipts, accountId }: ReceiptTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptWithTaxRefund | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_ITEMS_PER_PAGE;
    const stored = localStorage.getItem(ITEMS_PER_PAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_ITEMS_PER_PAGE;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ITEMS_PER_PAGE_KEY, itemsPerPage.toString());
    }
  }, [itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [receipts.length, itemsPerPage]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/accounts/${accountId}/receipts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
      // Also invalidate subscription status to update the receipt counter
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "subscription"] });
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
    let aVal: string | number = a[sortField] || "";
    let bVal: string | number = b[sortField] || "";

    if (sortField === "gallons" || sortField === "totalAmount") {
      aVal = parseFloat(aVal as string) || 0;
      bVal = parseFloat(bVal as string) || 0;
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedReceipts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReceipts = sortedReceipts.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  return (
    <>
      <div className="space-y-4">
        
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
                  <TableHead className="text-right">Tax Refund</TableHead>
                  <TableHead className="text-right w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReceipts.map((receipt) => (
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
                      {receipt.processingStatus === "pending" || receipt.processingStatus === "processing" ? (
                        <span className="text-muted-foreground">Processing...</span>
                      ) : receipt.processingStatus === "failed" ? (
                        <span className="text-destructive">Failed</span>
                      ) : (
                        formatDate(receipt.date)
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-station-${receipt.id}`}>
                      {receipt.processingStatus === "completed" || receipt.processingStatus === undefined ? receipt.stationName : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-gallons-${receipt.id}`}>
                      {receipt.processingStatus === "completed" || receipt.processingStatus === undefined ? parseFloat(receipt.gallons || "0").toFixed(3) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-price-${receipt.id}`}>
                      {receipt.processingStatus === "completed" || receipt.processingStatus === undefined ? `$${parseFloat(receipt.pricePerGallon || "0").toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold" data-testid={`text-total-${receipt.id}`}>
                      {receipt.processingStatus === "completed" || receipt.processingStatus === undefined ? `$${parseFloat(receipt.totalAmount || "0").toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary font-semibold" data-testid={`text-refund-${receipt.id}`}>
                      {receipt.processingStatus === "completed" && receipt.taxRefund !== undefined ? `$${parseFloat(receipt.taxRefund.toString()).toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {receipt.processingStatus === "pending" || receipt.processingStatus === "processing" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : receipt.processingStatus === "failed" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingReceipt(receipt)}
                            data-testid={`button-view-${receipt.id}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewingReceipt(receipt)}
                            data-testid={`button-view-${receipt.id}`}
                            className={!receipt.validated ? "text-destructive hover:text-destructive" : ""}
                          >
                            {receipt.validated ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                          </Button>
                        )}
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
          {paginatedReceipts.map((receipt) => {
            const isProcessing = receipt.processingStatus === "pending" || receipt.processingStatus === "processing";
            const isFailed = receipt.processingStatus === "failed";
            const isComplete = receipt.processingStatus === "completed" || receipt.processingStatus === undefined;
            
            return (
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
                      {isProcessing ? (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </span>
                      ) : isFailed ? (
                        <span className="text-destructive flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          Processing Failed
                        </span>
                      ) : (
                        formatDate(receipt.date)
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`text-station-mobile-${receipt.id}`}>
                      {isComplete ? receipt.stationName : "-"}
                    </div>
                    {isComplete && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-year-${receipt.id}`}>
                        FY {receipt.fiscalYear}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {isComplete && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Gallons</div>
                      <div className="font-mono" data-testid={`text-gallons-mobile-${receipt.id}`}>
                        {parseFloat(receipt.gallons || "0").toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Price/Gal</div>
                      <div className="font-mono" data-testid={`text-price-mobile-${receipt.id}`}>
                        ${parseFloat(receipt.pricePerGallon || "0").toFixed(3)}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="space-y-1">
                    {isComplete && (
                      <>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Amount</div>
                          <div className="text-lg font-semibold font-mono" data-testid={`text-total-mobile-${receipt.id}`}>
                            ${parseFloat(receipt.totalAmount || "0").toFixed(2)}
                          </div>
                        </div>
                        {receipt.taxRefund !== undefined && (
                          <div>
                            <div className="text-sm text-muted-foreground">Tax Refund</div>
                            <div className="text-base font-semibold font-mono text-primary" data-testid={`text-refund-mobile-${receipt.id}`}>
                              ${parseFloat(receipt.taxRefund.toString()).toFixed(2)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {isFailed && (
                      <p className="text-sm text-muted-foreground">
                        Click view to see details or delete
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isProcessing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingReceipt(receipt)}
                        data-testid={`button-view-mobile-${receipt.id}`}
                        className={isFailed || !receipt.validated ? "text-destructive border-destructive hover:text-destructive" : ""}
                      >
                        {isFailed ? (
                          <XCircle className="w-4 h-4 mr-1" />
                        ) : receipt.validated ? (
                          <Eye className="w-4 h-4 mr-1" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mr-1" />
                        )}
                        {isFailed ? "View" : receipt.validated ? "View" : "Validate"}
                      </Button>
                    )}
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
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-20" data-testid="select-items-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" data-testid="option-25">25</SelectItem>
                  <SelectItem value="50" data-testid="option-50">50</SelectItem>
                  <SelectItem value="100" data-testid="option-100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, sortedReceipts.length)} of {sortedReceipts.length}
              </span>
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    data-testid="button-previous-page"
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber: number;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                        data-testid={`button-page-${pageNumber}`}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    data-testid="button-next-page"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
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
