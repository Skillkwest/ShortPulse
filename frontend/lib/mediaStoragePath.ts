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
const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

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
 * Returns whether a storage path is in the user-scoped Character Manager namespace.
 */
export const isCharacterScopedMediaStoragePath = (path: string, userId: string): boolean => {
  const normalizedPath = normalize(path);
  const normalizedUserId = normalize(userId);
  if (!isUserScopedMediaStoragePath(normalizedPath, normalizedUserId)) return false;
  return normalizedPath.startsWith(`${normalizedUserId}/characters/`);
};

/** Returns whether a path is canonical durable Voice Changer source-video authority. */
export const isVoiceChangerSourceVideoStoragePath = (path: string, userId: string): boolean => {
  const normalizedPath = normalize(path);
  const normalizedUserId = normalize(userId);
  return (
    isUserScopedMediaStoragePath(normalizedPath, normalizedUserId) &&
    normalizedPath.startsWith(`${normalizedUserId}/voice-changer/source-video/`)
  );
};

/**
 * Returns whether a path-like string or media URL points at the Character Manager namespace.
 */
export const isCharacterScopedMediaUrl = (value: string): boolean => {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;
  const decodedValue = decodeSafe(normalizedValue);
  try {
    const parsedUrl = new URL(decodedValue);
    return parsedUrl.pathname.toLowerCase().includes("/characters/");
  } catch {
    const normalizedLower = decodedValue.toLowerCase();
    return normalizedLower.includes("/characters/") || normalizedLower.includes("%2fcharacters%2f");
  }
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
