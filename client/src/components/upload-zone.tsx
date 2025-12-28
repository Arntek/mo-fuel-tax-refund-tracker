import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, Eye, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Receipt } from "@shared/schema";

type UploadZoneProps = {
  accountId: string;
  vehicleId: string;
  onViewReceipt?: (receipt: Receipt) => void;
};

export function UploadZone({ accountId, vehicleId, onViewReceipt }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedReceipt, setUploadedReceipt] = useState<Receipt | null>(null);
  const [showPostUploadDialog, setShowPostUploadDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      formData.append("vehicleId", vehicleId);
      
      const response = await fetch(`/api/accounts/${accountId}/receipts/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json() as Promise<Receipt>;
    },
    onMutate: () => {
      setIsUploading(true);
    },
    onSuccess: (receipt: Receipt) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "receipts"] });
      // Also invalidate subscription status to update the receipt counter
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "subscription"] });
      setIsUploading(false);
      setUploadedReceipt(receipt);
      setShowPostUploadDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    e.target.value = "";
  };

  const handleUploadAnother = () => {
    setShowPostUploadDialog(false);
    setUploadedReceipt(null);
  };

  const handleViewReceipt = () => {
    setShowPostUploadDialog(false);
    if (uploadedReceipt && onViewReceipt) {
      onViewReceipt(uploadedReceipt);
    }
    setUploadedReceipt(null);
  };

  return (
    <>
      <div
        className={`p-6 md:p-8 rounded-md border-2 border-dashed transition-all ${
          isDragging ? "border-primary bg-accent" : "border-muted-foreground/25"
        } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" data-testid="icon-uploading" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Uploading receipt...
                </h3>
                <p className="text-sm text-muted-foreground">
                  Saving image and starting AI processing
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                <Upload className="w-8 h-8 text-primary" data-testid="icon-upload" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Upload Receipt
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Drag and drop a receipt image, or click to browse
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  data-testid="button-upload"
                >
                  <Upload className="w-4 h-4" />
                  Browse Files
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-2"
                  data-testid="button-camera"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </Button>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-camera"
        />
      </div>

      <AlertDialog open={showPostUploadDialog} onOpenChange={setShowPostUploadDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receipt Uploaded</AlertDialogTitle>
            <AlertDialogDescription>
              Your receipt has been saved and AI is processing the details in the background.
              What would you like to do next?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleUploadAnother}
              className="gap-2"
              data-testid="button-upload-another"
            >
              <Plus className="w-4 h-4" />
              Upload Another
            </Button>
            <Button
              onClick={handleViewReceipt}
              className="gap-2"
              data-testid="button-view-receipt"
            >
              <Eye className="w-4 h-4" />
              View Receipt
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
