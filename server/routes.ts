// Blueprint references: javascript_object_storage, javascript_openai_ai_integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { transcribeReceipt } from "./openai";
import { 
  insertReceiptSchema, 
  insertUserSchema, 
  insertAccountSchema,
  insertVehicleSchema,
  insertAccountMemberSchema 
} from "@shared/schema";
import multer from "multer";
import { createAuthCodeForEmail, verifyAuthCode, createSession, getUserFromSession } from "./auth";
import cookieParser from "cookie-parser";

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
  const accountId = parseInt(req.params.accountId || req.body.accountId);
  
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  
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
      const { email, name, code, accountName, accountType } = req.body;
      
      if (!email || !name || !code) {
        return res.status(400).json({ error: "Email, name, and code required" });
      }
      
      const isValid = await verifyAuthCode(email, code);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }
      
      const validated = insertUserSchema.parse({ email, name });
      const user = await storage.createUser(validated);
      
      const account = await storage.createAccount({
        name: accountName || `${name}'s Account`,
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
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: "User not found. They must create an account first." });
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
      const userId = parseInt(req.params.userId);
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
      const userId = parseInt(req.params.userId);
      const account = await storage.getAccountById(req.accountId);
      
      if (account?.ownerId === userId) {
        return res.status(400).json({ error: "Cannot remove account owner" });
      }
      
      const deleted = await storage.removeAccountMember(req.accountId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.get("/api/accounts/:accountId/vehicles", authMiddleware, accountAccessMiddleware, async (req: any, res) => {
    try {
      const vehicles = await storage.getAccountVehicles(req.accountId);
      res.json(vehicles);
    } catch (error) {
      console.error("Error getting vehicles:", error);
      res.status(500).json({ error: "Failed to get vehicles" });
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVehicle(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      res.json({ success: true });
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
      res.json(receipts);
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

      const { vehicleId } = req.body;

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
        accountId: req.accountId,
        vehicleId: vehicleId ? parseInt(vehicleId) : null,
        uploadedBy: req.userId,
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

      try {
        const objectPath = receipt.imageUrl.replace(`${req.protocol}://${req.get('host')}`, '');
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await objectStorageService.deleteObject(objectFile);
      } catch (error) {
        console.error("Error deleting image from object storage:", error);
      }

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
