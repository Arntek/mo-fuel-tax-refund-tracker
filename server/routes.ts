// Blueprint references: javascript_object_storage, javascript_openai_ai_integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { transcribeReceipt } from "./openai";
import { insertReceiptSchema } from "@shared/schema";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.get("/api/receipts", async (req, res) => {
    try {
      const receipts = await storage.getAllReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Error getting receipts:", error);
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.post("/api/receipts/upload", upload.single("receipt"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: req.file.buffer,
        headers: {
          "Content-Type": req.file.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload to object storage");
      }

      const normalizedPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      const fullImageUrl = `${req.protocol}://${req.get('host')}${normalizedPath}`;

      const transcription = await transcribeReceipt(fullImageUrl);

      const fiscalYear = getFiscalYear(transcription.date);

      const gallons = normalizeNumeric(transcription.gallons);
      const pricePerGallon = normalizeNumeric(transcription.pricePerGallon);
      const totalAmount = normalizeNumeric(transcription.totalAmount);

      const receiptData = {
        imageUrl: fullImageUrl,
        date: transcription.date,
        stationName: transcription.stationName,
        gallons,
        pricePerGallon,
        totalAmount,
        fiscalYear,
      };

      const validated = insertReceiptSchema.parse(receiptData);
      const receipt = await storage.createReceipt(validated);

      res.json(receipt);
    } catch (error) {
      console.error("Error uploading receipt:", error);
      res.status(500).json({ 
        error: "Failed to process receipt",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/receipts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getReceipt(id);
      if (!existing) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const rawUpdates = req.body;
      
      if (rawUpdates.gallons !== undefined) {
        rawUpdates.gallons = normalizeNumeric(rawUpdates.gallons);
      }
      if (rawUpdates.pricePerGallon !== undefined) {
        rawUpdates.pricePerGallon = normalizeNumeric(rawUpdates.pricePerGallon);
      }
      if (rawUpdates.totalAmount !== undefined) {
        rawUpdates.totalAmount = normalizeNumeric(rawUpdates.totalAmount);
      }

      const updates = insertReceiptSchema.partial().parse(rawUpdates);
      
      const fiscalYear = getFiscalYear(updates.date || existing.date);
      const updatedReceipt = await storage.updateReceipt(id, {
        ...updates,
        fiscalYear,
      });

      if (!updatedReceipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      res.json(updatedReceipt);
    } catch (error) {
      console.error("Error updating receipt:", error);
      res.status(500).json({ error: "Failed to update receipt" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteReceipt(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting receipt:", error);
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

function getFiscalYear(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

function normalizeNumeric(value: string | number): string {
  const str = String(value).replace(/[$,]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return num.toString();
}
