export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

export interface ObjectMetadata {
  contentType?: string;
  [key: string]: any;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }

  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// In-memory storage for ACL policies and metadata
// Note: This is temporary storage that will be lost on server restart
// For production, this should be moved to database storage
const aclPolicies = new Map<string, ObjectAclPolicy>();
const objectMetadata = new Map<string, ObjectMetadata>();

export async function setObjectAclPolicy(
  objectPath: string,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  aclPolicies.set(objectPath, aclPolicy);
}

export async function getObjectAclPolicy(
  objectPath: string,
): Promise<ObjectAclPolicy | null> {
  return aclPolicies.get(objectPath) || null;
}

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
  aclPolicies.delete(objectPath);
  objectMetadata.delete(objectPath);
}

export async function canAccessObject({
  userId,
  objectPath,
  requestedPermission,
}: {
  userId?: string;
  objectPath: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectPath);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
