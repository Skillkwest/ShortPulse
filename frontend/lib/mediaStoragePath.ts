/**
 * Shared media storage-path validation helpers.
 * Enforces user-scoped, non-traversing, forward-slash-only object keys.
 */

const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

type StoragePathIssue =
  | "empty"
  | "leading_slash"
  | "backslash"
  | "traversal_segment"
  | "outside_user_scope";

const normalize = (value: string): string => value.trim();

const isNamespaceTokenValid = (value: string): boolean => {
  const normalized = normalize(value);
  return Boolean(normalized) && !normalized.includes("/") && !normalized.includes("\\");
};

const detectShapeIssue = (path: string): Exclude<StoragePathIssue, "outside_user_scope"> | null => {
  if (!path) return "empty";
  if (path.startsWith("/")) return "leading_slash";
  if (path.includes("\\")) return "backslash";
  if (TRAVERSAL_SEGMENT_REGEX.test(path)) return "traversal_segment";
  return null;
};

const issueMessage = (issue: StoragePathIssue, userId: string): string => {
  if (issue === "empty") return "must not be empty.";
  if (issue === "leading_slash") return "must not start with '/'.";
  if (issue === "backslash") return "must not include backslashes.";
  if (issue === "traversal_segment") return "must not contain '../' traversal segments.";
  return `must start with '${userId}/'.`;
};

/**
 * Returns whether a storage path is valid for the provided user namespace.
 */
export const isUserScopedMediaStoragePath = (path: string, userId: string): boolean => {
  const normalizedPath = normalize(path);
  const normalizedUserId = normalize(userId);
  if (!isNamespaceTokenValid(normalizedUserId)) return false;
  const shapeIssue = detectShapeIssue(normalizedPath);
  if (shapeIssue) return false;
  return normalizedPath.startsWith(`${normalizedUserId}/`);
};

/**
 * Validates and returns a normalized user-scoped storage path.
 * Throws when the path is malformed or outside the user namespace.
 */
export const assertUserScopedMediaStoragePath = ({
  path,
  userId,
  label = "Storage path",
}: {
  path: string;
  userId: string;
  label?: string;
}): string => {
  const normalizedPath = normalize(path);
  const normalizedUserId = normalize(userId);
  if (!isNamespaceTokenValid(normalizedUserId)) {
    throw new Error(`${label}: user namespace is invalid.`);
  }
  const shapeIssue = detectShapeIssue(normalizedPath);
  if (shapeIssue) {
    throw new Error(`${label}: ${issueMessage(shapeIssue, normalizedUserId)}`);
  }
  if (!normalizedPath.startsWith(`${normalizedUserId}/`)) {
    throw new Error(`${label}: ${issueMessage("outside_user_scope", normalizedUserId)}`);
  }
  return normalizedPath;
};
