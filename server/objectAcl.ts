export interface ObjectMetadata {
  contentType?: string;
  [key: string]: any;
}

// In-memory storage for object metadata
// Note: This is temporary storage that will be lost on server restart
// Content type is stored here to properly serve files with correct MIME types
const objectMetadata = new Map<string, ObjectMetadata>();

export async function setObjectMetadata(
  objectPath: string,
  metadata: ObjectMetadata,
): Promise<void> {
  objectMetadata.set(objectPath, metadata);
}

export async function getObjectMetadata(
  objectPath: string,
): Promise<ObjectMetadata | null> {
  return objectMetadata.get(objectPath) || null;
}

export async function deleteObjectMetadata(objectPath: string): Promise<void> {
  objectMetadata.delete(objectPath);
}
