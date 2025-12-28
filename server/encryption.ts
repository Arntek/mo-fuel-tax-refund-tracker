import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (!ENCRYPTION_KEY && IS_PRODUCTION) {
  throw new Error("FATAL: ENCRYPTION_KEY environment variable must be set in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
}

if (!ENCRYPTION_KEY) {
  console.warn("WARNING: ENCRYPTION_KEY not set. Using derived key for development only - this is INSECURE for production!");
}

function getKey(): Buffer {
  if (ENCRYPTION_KEY) {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
    }
    return keyBuffer;
  }
  
  if (IS_PRODUCTION) {
    throw new Error("ENCRYPTION_KEY is required in production");
  }
  
  const fallbackKey = crypto.createHash("sha256").update(`dev-key-${process.env.REPL_ID || 'local'}`).digest();
  return fallbackKey;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString("base64");
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  try {
    const key = getKey();
    const data = Buffer.from(ciphertext, "base64");
    
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  } catch {
    // Silently return original value if decryption fails (e.g., unencrypted legacy data)
    return ciphertext;
  }
}

export function createSearchHash(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getKey();
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(plaintext.toUpperCase());
  return hmac.digest("base64");
}

export function encryptWithSearchHash(plaintext: string): { encrypted: string; searchHash: string } {
  if (!plaintext) return { encrypted: plaintext, searchHash: plaintext };
  
  const encrypted = encrypt(plaintext);
  const searchHash = createSearchHash(plaintext);
  
  return { encrypted, searchHash };
}

export function encryptSSN(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const cleaned = ssn.replace(/\D/g, "");
  if (cleaned.length !== 9) return null;
  return encrypt(cleaned);
}

export function decryptSSN(encryptedSSN: string | null | undefined): string | null {
  if (!encryptedSSN) return null;
  return decrypt(encryptedSSN);
}

export function formatSSN(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const cleaned = ssn.replace(/\D/g, "");
  // Handle already formatted SSN or 9-digit SSN
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }
  // Return original if it looks like it's already formatted
  if (/^\d{3}-\d{2}-\d{4}$/.test(ssn)) {
    return ssn;
  }
  // Return original if not a valid SSN format (legacy unencrypted data)
  return ssn;
}

export function formatEIN(ein: string | null | undefined): string | null {
  if (!ein) return null;
  const cleaned = ein.replace(/\D/g, "");
  // Handle already formatted EIN or 9-digit EIN
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }
  // Return original if it looks like it's already formatted
  if (/^\d{2}-\d{7}$/.test(ein)) {
    return ein;
  }
  // Return original if not a valid EIN format (legacy unencrypted data)
  return ein;
}

export function maskSSN(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const cleaned = ssn.replace(/\D/g, "");
  if (cleaned.length !== 9) return null;
  return `XXX-XX-${cleaned.slice(5)}`;
}

export function encryptVIN(vin: string | null | undefined): { encrypted: string | null; searchHash: string | null } {
  if (!vin) return { encrypted: null, searchHash: null };
  const normalizedVin = vin.toUpperCase().trim();
  return {
    encrypted: encrypt(normalizedVin),
    searchHash: createSearchHash(normalizedVin)
  };
}

export function decryptVIN(encryptedVIN: string | null | undefined): string | null {
  if (!encryptedVIN) return null;
  return decrypt(encryptedVIN);
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
