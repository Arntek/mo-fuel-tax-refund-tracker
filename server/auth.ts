import { randomBytes } from "crypto";
import { storage } from "./storage";

export function generateAuthCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function sendAuthCodeEmail(email: string, code: string): Promise<void> {
  console.log("========================================");
  console.log("AUTH CODE EMAIL");
  console.log(`To: ${email}`);
  console.log(`Code: ${code}`);
  console.log("========================================");
  console.log("In production, this would send an actual email.");
  console.log("For development, check the server logs above for the auth code.");
}

export async function createAuthCodeForEmail(email: string): Promise<string> {
  const code = generateAuthCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await storage.createAuthCode({
    email,
    code,
    expiresAt,
  });

  await sendAuthCodeEmail(email, code);
  return code;
}

export async function verifyAuthCode(email: string, code: string): Promise<boolean> {
  const authCode = await storage.getAuthCodeByEmailAndCode(email, code);
  
  if (!authCode) {
    return false;
  }

  await storage.deleteAuthCode(authCode.id);
  
  return true;
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await storage.createSession({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

export async function getUserFromSession(sessionId: string | undefined): Promise<number | null> {
  if (!sessionId) {
    return null;
  }

  const session = await storage.getSession(sessionId);
  
  if (!session) {
    return null;
  }

  return session.userId;
}
