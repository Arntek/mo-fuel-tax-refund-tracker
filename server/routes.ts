// Blueprint references: javascript_object_storage, javascript_openai_ai_integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { transcribeReceipt } from "./openai";
import { calculateReceiptTaxRefund, calculateRefundByFiscalYear } from "./taxCalculations";
import { 
  insertReceiptSchema, 
  insertUserSchema, 
  insertAccountSchema,
  insertVehicleSchema,
  insertAccountMemberSchema,
  insertFiscalYearPlanSchema
} from "@shared/schema";
import multer from "multer";
import { createAuthCodeForEmail, verifyAuthCode, createSession, getUserFromSession } from "./auth";
import cookieParser from "cookie-parser";
import * as stripeService from "./stripe";
import express from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function authMiddleware(req: any, res: any, next: any) {
  const sessionId = req.cookies?.sessionId;
  const userId = await getUserFromSession(sessionId);
  
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  req.userId = userId;
  next();
}

async function accountAccessMiddleware(req: any, res: any, next: any) {
  const accountId = req.params.accountId || req.body.accountId;
  
  if (!accountId) {
    return res.status(400).json({ error: "Account ID required" });
  }
  
  const isMember = await storage.isUserAccountMember(accountId, req.userId);
  
  if (!isMember) {
    return res.status(403).json({ error: "Not a member of this account" });
  }
  
  req.accountId = accountId;
  next();
}

async function adminMiddleware(req: any, res: any, next: any) {
  const role = await storage.getUserRole(req.accountId, req.userId);
  
  if (role !== "owner" && role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}

async function siteAdminMiddleware(req: any, res: any, next: any) {
  const user = await storage.getUserById(req.userId);
  
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Site admin access required" });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  
  const objectStorageService = new ObjectStorageService();

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectPath = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectPath, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/auth/request-code", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      
      await createAuthCodeForEmail(email);
      
      res.json({ 
        success: true, 
        userExists: !!existingUser,
        message: existingUser 
          ? "Login code sent to your email" 
          : "This email is not registered. Please sign up first."
      });
    } catch (error) {
      console.error("Error requesting auth code:", error);
      res.status(500).json({ error: "Failed to send auth code" });
    }
  });

  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code required" });
      }
      
      const isValid = await verifyAuthCode(email, code);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: "User not found. Please sign up first." });
      }
      
      const sessionId = await createSession(user.id);
      
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });
      
      res.json({ success: true, user });
    } catch (error) {
      console.error("Error verifying code:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, firstName, lastName, code, accountName, accountType } = req.body;
      
      if (!email || !firstName || !lastName || !code) {
        return res.status(400).json({ error: "Email, first name, last name, and code required" });
      }
      
      const isValid = await verifyAuthCode(email, code);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }
      
      const validated = insertUserSchema.parse({ email, firstName, lastName });
      const user = await storage.createUser(validated);
      
      const account = await storage.createAccount({
        name: accountName || `${firstName} ${lastName}'s Account`,
        type: accountType || "family",
        ownerId: user.id,
      });
      
      const sessionId = await createSession(user.id);
      
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });
      
      res.json({ success: true, user, account });
    } catch (error) {
      console.error("Error signing up:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req: any, res) => {
    try {
      const sessionId = req.cookies?.sessionId;
      
      if (sessionId) {
        await storage.deleteSession(sessionId);
      }
      
      res.clearCookie("sessionId");
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.get("/api/accounts", authMiddleware, async (req: any, res) => {
    try {
      const accounts = await storage.getUserAccounts(req.userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error getting accounts:", error);
      res.status(500).json({ error: "Failed to get accounts" });
    }
  });

  app.get("/api/accounts/:accountId", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const account = await storage.getAccountById(req.accountId);
      
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      res.json(account);
    } catch (error) {
      console.error("Error getting account:", error);
      res.status(500).json({ error: "Failed to get account" });
    }
  });

  app.patch("/api/accounts/:accountId", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const validated = insertAccountSchema.partial().omit({ ownerId: true }).parse(req.body);
      const updated = await storage.updateAccount(req.accountId, validated);
      
      if (!updated) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.get("/api/accounts/:accountId/members", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const members = await storage.getAccountMembers(req.accountId);
      res.json(members);
    } catch (error) {
      console.error("Error getting members:", error);
      res.status(500).json({ error: "Failed to get members" });
    }
  });

  app.post("/api/accounts/:accountId/members", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { email, role } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }
      
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Auto-create user if they don't exist
        const emailParts = email.split('@')[0];
        user = await storage.createUser({
          email,
          firstName: emailParts,
          lastName: "",
        });
      }
      
      const existingMember = await storage.isUserAccountMember(req.accountId, user.id);
      
      if (existingMember) {
        return res.status(409).json({ error: "User is already a member" });
      }
      
      const member = await storage.addAccountMember({
        accountId: req.accountId,
        userId: user.id,
        role: role || "member",
      });
      
      res.json(member);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.put("/api/accounts/:accountId/members/:userId", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({ error: "Role required" });
      }
      
      const updated = await storage.updateMemberRole(req.accountId, userId, role);
      
      if (!updated) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/accounts/:accountId/members/:userId", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const account = await storage.getAccountById(req.accountId);
      
      if (account?.ownerId === userId) {
        return res.status(400).json({ error: "Cannot deactivate account owner" });
      }
      
      const deactivated = await storage.deactivateAccountMember(req.accountId, userId);
      
      if (!deactivated) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json(deactivated);
    } catch (error) {
      console.error("Error deactivating member:", error);
      res.status(500).json({ error: "Failed to deactivate member" });
    }
  });

  app.get("/api/accounts/:accountId/vehicles", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      // Get user role for filtering
      const role = await storage.getUserRole(req.accountId, req.userId);
      
      if (!role) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Filter vehicles based on role and assignments
      const vehicles = await storage.getAccountVehiclesForUser(req.accountId, req.userId, role);
      res.json(vehicles);
    } catch (error) {
      console.error("Error getting vehicles:", error);
      res.status(500).json({ error: "Failed to get vehicles" });
    }
  });

  app.get("/api/accounts/:accountId/vehicles/:id", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const id = req.params.id;
      const vehicle = await storage.getVehicleById(id);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      if (vehicle.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error getting vehicle:", error);
      res.status(500).json({ error: "Failed to get vehicle" });
    }
  });

  app.post("/api/accounts/:accountId/vehicles", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const validated = insertVehicleSchema.parse({
        ...req.body,
        accountId: req.accountId,
      });
      
      const vehicle = await storage.createVehicle(validated);
      res.json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.put("/api/accounts/:accountId/vehicles/:id", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const id = req.params.id;
      const validated = insertVehicleSchema.partial().parse(req.body);
      
      const updated = await storage.updateVehicle(id, validated);
      
      if (!updated) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/accounts/:accountId/vehicles/:id", authMiddleware, accountAccessMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const id = req.params.id;
      
      // Check if vehicle has receipts
      const hasReceipts = await storage.hasVehicleReceipts(id);
      
      if (hasReceipts) {
        // Deactivate instead of delete if receipts exist
        const deactivated = await storage.deactivateVehicle(id);
        if (!deactivated) {
          return res.status(404).json({ error: "Vehicle not found" });
        }
        return res.json({ success: true, deactivated: true });
      }
      
      // If no receipts, proceed with deletion
      const deleted = await storage.deleteVehicle(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      res.json({ success: true, deactivated: false });
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  app.get("/api/vin-lookup/:vin", authMiddleware, async (req, res) => {
    try {
      const { vin } = req.params;
      
      if (!vin || vin.length !== 17) {
        return res.status(400).json({ error: "Valid 17-character VIN required" });
      }
      
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
      );
      
      const data = await response.json();
      
      if (data.Results && data.Results[0]) {
        const result = data.Results[0];
        res.json({
          year: parseInt(result.ModelYear) || null,
          make: result.Make || "",
          model: result.Model || "",
          fuelType: result.FuelTypePrimary || "",
          gvwr: result.GVWR || "",
        });
      } else {
        res.status(404).json({ error: "VIN not found" });
      }
    } catch (error) {
      console.error("Error looking up VIN:", error);
      res.status(500).json({ error: "Failed to lookup VIN" });
    }
  });

  app.get("/api/accounts/:accountId/receipts", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const receipts = await storage.getAccountReceipts(req.accountId);
      
      // Pre-fetch all unique tax rates once
      const uniqueDates = Array.from(new Set(receipts.map(r => r.date)));
      const taxRateCache = new Map<string, any>();
      
      for (const date of uniqueDates) {
        const rate = await storage.getTaxRateByDate(date);
        taxRateCache.set(date, rate || null);
      }
      
      // Calculate refunds using cached tax rates - only for Missouri receipts
      const receiptsWithTax = receipts.map((receipt) => {
        const taxRate = taxRateCache.get(receipt.date);
        
        // Only Missouri purchases are eligible for refund
        const isMissouri = receipt.sellerState?.toUpperCase() === "MO";
        
        if (!taxRate || !isMissouri) {
          return {
            ...receipt,
            taxRefund: 0,
            taxBaseRate: 0,
            taxIncrease: 0,
            eligible: isMissouri,
          };
        }
        
        const gallons = parseFloat(receipt.gallons || "0");
        const baseRate = parseFloat(taxRate.baseRate);
        const increase = parseFloat(taxRate.increase);
        
        // Validate and calculate
        if (isNaN(gallons) || isNaN(baseRate) || isNaN(increase)) {
          console.warn(`Invalid tax data for receipt ${receipt.id}`);
          return {
            ...receipt,
            taxRefund: 0,
            taxBaseRate: 0,
            taxIncrease: 0,
            eligible: true,
          };
        }
        
        const refundAmount = gallons * increase;
        
        return {
          ...receipt,
          taxRefund: parseFloat(refundAmount.toFixed(2)),
          taxBaseRate: baseRate,
          taxIncrease: increase,
          eligible: true,
        };
      });
      
      // Calculate fiscal year totals from already-computed refunds (only eligible receipts)
      const refundByYear = new Map<string, number>();
      for (const receipt of receiptsWithTax) {
        if (!receipt.eligible) continue;
        const currentTotal = refundByYear.get(receipt.fiscalYear) || 0;
        refundByYear.set(receipt.fiscalYear, currentTotal + receipt.taxRefund);
      }
      
      const refundTotals = Object.fromEntries(refundByYear);
      
      res.json({
        receipts: receiptsWithTax,
        refundTotals,
      });
    } catch (error) {
      console.error("Error getting receipts:", error);
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.post("/api/accounts/:accountId/receipts/upload", authMiddleware, accountAccessMiddleware, upload.single("receipt"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Server-side subscription enforcement
      const fiscalYear = getFiscalYear(new Date().toISOString().split('T')[0]);
      const subscriptionStatus = await stripeService.getSubscriptionStatus(req.accountId, fiscalYear);
      
      if (subscriptionStatus.upgradeRequired) {
        return res.status(403).json({ 
          error: "Subscription required",
          message: subscriptionStatus.receiptCount >= 8 
            ? "You've reached the 8-receipt trial limit. Please subscribe to continue uploading receipts."
            : "Your 30-day trial has ended. Please subscribe to continue uploading receipts.",
          upgradeRequired: true
        });
      }

      const { vehicleId } = req.body;

      // Upload directly to object storage using Replit SDK, organized by accountId
      const objectPath = await objectStorageService.uploadObject(
        req.file.buffer,
        req.file.mimetype,
        req.accountId
      );

      // Set ACL policy for the uploaded object
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectPath,
        {
          owner: req.userId,
          visibility: "private",
        }
      );

      const fullImageUrl = `${req.protocol}://${req.get('host')}${normalizedPath}`;

      // Create receipt immediately with pending status (placeholder values for required fields)
      const receiptData = {
        accountId: req.accountId,
        vehicleId: vehicleId || null,
        uploadedBy: req.userId,
        imageUrl: fullImageUrl,
        date: new Date().toISOString().split('T')[0],
        stationName: "Processing...",
        fiscalYear: getFiscalYear(new Date().toISOString().split('T')[0]),
        processingStatus: "pending" as const,
      };

      const validated = insertReceiptSchema.parse(receiptData);
      const receipt = await storage.createReceipt(validated);
      
      // Increment the receipt counter for the account (legacy field)
      await storage.incrementReceiptCounter(req.accountId);
      
      // Increment the subscription receipt count for trial enforcement (fiscalYear already defined above)
      await stripeService.incrementReceiptCount(req.accountId, fiscalYear);

      // Return immediately to allow user to continue
      res.json(receipt);

      // Process AI transcription in background (after response sent)
      processReceiptInBackground(receipt.id, req.file.buffer, req.file.mimetype);
    } catch (error) {
      console.error("Error uploading receipt:", error);
      res.status(500).json({ 
        error: "Failed to process receipt",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Background processing function
  async function processReceiptInBackground(receiptId: string, fileBuffer: Buffer, mimeType: string) {
    try {
      // Update status to processing
      await storage.updateReceipt(receiptId, { processingStatus: "processing" });

      // Transcribe using AI
      const transcription = await transcribeReceipt(fileBuffer, mimeType);

      // Handle nullable date - use today's date as fallback if AI couldn't read the date
      const extractedDate = transcription.date || new Date().toISOString().split('T')[0];
      const fiscalYear = getFiscalYear(extractedDate);
      const gallons = normalizeNumeric(transcription.gallons) ?? undefined;
      const pricePerGallon = normalizeNumeric(transcription.pricePerGallon) ?? undefined;
      const totalAmount = normalizeNumeric(transcription.totalAmount) ?? undefined;

      // Update receipt with transcribed data
      await storage.updateReceipt(receiptId, {
        date: extractedDate,
        stationName: transcription.stationName,
        sellerStreet: transcription.sellerStreet ?? undefined,
        sellerCity: transcription.sellerCity ?? undefined,
        sellerState: transcription.sellerState ?? undefined,
        sellerZip: transcription.sellerZip ?? undefined,
        gallons,
        pricePerGallon,
        totalAmount,
        fiscalYear,
        processingStatus: "completed",
        processingError: transcription.date ? null : "Date could not be read - please verify",
      });

      console.log(`Receipt ${receiptId} processed successfully`);
    } catch (error) {
      console.error(`Error processing receipt ${receiptId}:`, error);
      await storage.updateReceipt(receiptId, {
        processingStatus: "failed",
        processingError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  app.put("/api/accounts/:accountId/receipts/:id", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getReceipt(id);
      if (!existing) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (existing.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
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

  // Get single receipt for status polling
  app.get("/api/accounts/:accountId/receipts/:id", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const receipt = await storage.getReceipt(id);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (receipt.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Calculate tax refund if the receipt is processed
      if (receipt.processingStatus === "completed" && receipt.gallons && receipt.date) {
        const taxInfo = await calculateReceiptTaxRefund(receipt);
        res.json({ ...receipt, ...taxInfo });
      } else {
        res.json(receipt);
      }
    } catch (error) {
      console.error("Error getting receipt:", error);
      res.status(500).json({ error: "Failed to get receipt" });
    }
  });

  app.delete("/api/accounts/:accountId/receipts/:id", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const receipt = await storage.getReceipt(id);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (receipt.accountId !== req.accountId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete image from object storage FIRST before deleting DB entry
      const objectPath = receipt.imageUrl.replace(`${req.protocol}://${req.get('host')}`, '');
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.deleteObject(objectFile);

      // Only delete DB entry after image is successfully deleted
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

  // ==================== ADMIN ROUTES ====================

  app.get("/api/admin/plans", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      const plans = await storage.getAllFiscalYearPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error getting plans:", error);
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  app.post("/api/admin/plans", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      if (!stripeService.isStripeConfigured()) {
        return res.status(503).json({ 
          error: "Stripe not configured", 
          message: "Please configure STRIPE_SECRET_KEY to enable plan creation" 
        });
      }

      const { fiscalYear, name, description, priceInCents } = req.body;
      
      if (!fiscalYear || !name) {
        return res.status(400).json({ error: "Fiscal year and name required" });
      }

      const result = await stripeService.createFiscalYearPlan(
        fiscalYear,
        name,
        description || `Subscription for fiscal year ${fiscalYear}`,
        priceInCents || 1200
      );

      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error creating plan:", error);
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  app.put("/api/admin/plans/:id", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      if (!stripeService.isStripeConfigured()) {
        return res.status(503).json({ 
          error: "Stripe not configured", 
          message: "Please configure STRIPE_SECRET_KEY to enable plan updates" 
        });
      }

      const { id } = req.params;
      const updates = req.body;

      await stripeService.updateFiscalYearPlan(id, updates);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  app.get("/api/admin/users", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      const users = await storage.getAllUsersWithStats();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/admin/users/:userId/payments", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUserById(userId);
      
      if (!user || !user.stripeCustomerId) {
        return res.json({ payments: [], invoices: [] });
      }

      const [payments, invoices] = await Promise.all([
        stripeService.getCustomerPayments(user.stripeCustomerId),
        stripeService.getCustomerInvoices(user.stripeCustomerId),
      ]);

      res.json({ payments, invoices });
    } catch (error) {
      console.error("Error getting user payments:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });

  app.put("/api/admin/users/:userId/admin", authMiddleware, siteAdminMiddleware, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isAdmin } = req.body;

      await storage.updateUserAdmin(userId, isAdmin);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ error: "Failed to update admin status" });
    }
  });

  // ==================== BILLING ROUTES ====================

  app.get("/api/accounts/:accountId/subscription", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const { fiscalYear } = req.query;
      
      if (!fiscalYear) {
        return res.status(400).json({ error: "Fiscal year required" });
      }

      const status = await stripeService.getSubscriptionStatus(req.accountId, fiscalYear as string);
      res.json(status);
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  app.get("/api/accounts/:accountId/subscriptions", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const subscriptions = await storage.getAccountSubscriptions(req.accountId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting subscriptions:", error);
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  app.post("/api/accounts/:accountId/checkout", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      if (!stripeService.isStripeConfigured()) {
        return res.status(503).json({ 
          error: "Stripe not configured", 
          message: "Payment processing is temporarily unavailable" 
        });
      }

      const { fiscalYear } = req.body;
      
      if (!fiscalYear) {
        return res.status(400).json({ error: "Fiscal year required" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/billing/${req.accountId}?payment=success`;
      const cancelUrl = `${baseUrl}/billing/${req.accountId}?payment=canceled`;

      const checkoutUrl = await stripeService.createCheckoutSession(
        req.accountId,
        req.userId,
        fiscalYear,
        successUrl,
        cancelUrl
      );

      res.json({ url: checkoutUrl });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/accounts/:accountId/billing-portal", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      if (!stripeService.isStripeConfigured()) {
        return res.status(503).json({ 
          error: "Stripe not configured", 
          message: "Billing portal is temporarily unavailable" 
        });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const returnUrl = `${baseUrl}/billing/${req.accountId}`;

      const portalUrl = await stripeService.createBillingPortalSession(req.userId, returnUrl);
      res.json({ url: portalUrl });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: "Failed to create billing portal session" });
    }
  });

  app.get("/api/billing/plans", async (req, res) => {
    try {
      const plans = await storage.getActiveFiscalYearPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error getting active plans:", error);
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  // NOTE: Stripe webhook is registered in server/index.ts BEFORE body parsers
  // to ensure raw body is available for signature verification

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

function normalizeNumeric(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).replace(/[$,]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) {
    return null;
  }
  return num.toString();
}
