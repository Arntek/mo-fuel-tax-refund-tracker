import { Client } from "@replit/object-storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
  getObjectMetadata,
  setObjectMetadata,
  deleteObjectMetadata,
} from "./objectAcl";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!bucketId) {
  throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID environment variable is not set");
}

export const objectStorageClient = new Client(bucketId);

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPrivateObjectDir(): string {
    return ".private";
  }

  async uploadObject(fileBuffer: Buffer, contentType: string, accountId: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const objectPath = `${privateObjectDir}/${accountId}/receipts/${objectId}`;

    await objectStorageClient.uploadFromBytes(objectPath, fileBuffer);

    // Store content type in metadata
    await setObjectMetadata(objectPath, { contentType });

    return objectPath;
  }

  async downloadObjectAsBytes(objectPath: string): Promise<Buffer> {
    const exists = await objectStorageClient.exists(objectPath);
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const bytes = await objectStorageClient.downloadAsBytes(objectPath);
    return Buffer.from(bytes);
  }

  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const exists = await objectStorageClient.exists(objectPath);
      if (!exists) {
        throw new ObjectNotFoundError();
      }

      const aclPolicy = await getObjectAclPolicy(objectPath);
      const isPublic = aclPolicy?.visibility === "public";
      
      // Get stored content type from metadata
      const metadata = await getObjectMetadata(objectPath);
      const contentType = metadata?.contentType || "application/octet-stream";
      
      // Use downloadAsBytes for more reliable serving
      const bytes = await objectStorageClient.downloadAsBytes(objectPath);
      const buffer = Buffer.from(bytes);
      
      res.set({
        "Content-Type": contentType,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
        "Content-Length": buffer.length.toString(),
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        if (error instanceof ObjectNotFoundError) {
          res.status(404).json({ error: "File not found" });
        } else {
          res.status(500).json({ error: "Error downloading file" });
        }
      }
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    await objectStorageClient.delete(objectPath);
    // Clean up metadata
    await deleteObjectMetadata(objectPath);
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    
    const exists = await objectStorageClient.exists(objectEntityPath);
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    return objectEntityPath;
  }

  normalizeObjectPath(rawPath: string): string {
    const privateDir = this.getPrivateObjectDir();
    
    if (rawPath.startsWith(privateDir)) {
      const relativePath = rawPath.slice(privateDir.length);
      return `/objects${relativePath}`;
    }
    
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    await setObjectAclPolicy(rawPath, aclPolicy);
    return this.normalizeObjectPath(rawPath);
  }

  async canAccessObjectEntity({
    userId,
    objectPath,
    requestedPermission,
  }: {
    userId?: string;
    objectPath: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectPath,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
