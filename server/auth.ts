import { randomBytes } from "crypto";
import { storage } from "./storage";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@receipttracker.com";
const FROM_NAME = process.env.FROM_NAME;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export function generateAuthCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function sendAuthCodeEmail(email: string, code: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log("========================================");
    console.log("SENDGRID NOT CONFIGURED - DEV MODE");
    console.log("AUTH CODE EMAIL");
    console.log(`To: ${email}`);
    console.log(`Code: ${code}`);
    console.log("========================================");
    console.log("Set SENDGRID_API_KEY and FROM_EMAIL environment variables to send real emails.");
    return;
  }

  try {
    await sgMail.send({
      to: email,
      from: FROM_NAME ? { email: FROM_EMAIL, name: FROM_NAME } : FROM_EMAIL,
      subject: "Your Receipt Tracker Login Code",
      text: `Your login code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Receipt Tracker Login</h2>
          <p>Your login code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #6b7280;">This code will expire in 15 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error("Failed to send email via SendGrid:", error);
    console.log("========================================");
    console.log("FALLBACK - AUTH CODE (EMAIL SEND FAILED)");
    console.log(`To: ${email}`);
    console.log(`Code: ${code}`);
    console.log("========================================");
  }
}

export async function sendInvitationEmail(
  toEmail: string, 
  accountName: string, 
  role: string,
  inviterName?: string
): Promise<void> {
  const appUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : process.env.REPLIT_DOMAINS?.split(",")[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` 
      : "http://localhost:5000";
  
  if (!SENDGRID_API_KEY) {
    console.log("========================================");
    console.log("SENDGRID NOT CONFIGURED - DEV MODE");
    console.log("INVITATION EMAIL");
    console.log(`To: ${toEmail}`);
    console.log(`Account: ${accountName}`);
    console.log(`Role: ${role}`);
    console.log(`Link: ${appUrl}`);
    console.log("========================================");
    return;
  }

  const invitedBy = inviterName ? ` by ${inviterName}` : "";
  
  try {
    await sgMail.send({
      to: toEmail,
      from: FROM_NAME ? { email: FROM_EMAIL, name: FROM_NAME } : FROM_EMAIL,
      subject: `You've been invited to join ${accountName}`,
      text: `You've been invited${invitedBy} to join ${accountName} as a ${role} on MO Fuel Tax Refund.\n\nTo accept this invitation, visit ${appUrl} and sign in with this email address.\n\nIf you weren't expecting this invitation, you can safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">You've Been Invited!</h2>
          <p>You've been invited${invitedBy} to join <strong>${accountName}</strong> as a <strong>${role}</strong> on MO Fuel Tax Refund.</p>
          <div style="margin: 30px 0;">
            <a href="${appUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #6b7280;">Sign in with this email address (${toEmail}) to view and accept your invitation.</p>
          <p style="color: #6b7280; font-size: 14px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`Invitation email sent to ${toEmail} for account ${accountName}`);
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }
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

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await storage.createSession({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

export async function getUserFromSession(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) {
    return null;
  }

  const session = await storage.getSession(sessionId);
  
  if (!session) {
    return null;
  }

  return session.userId;
}
