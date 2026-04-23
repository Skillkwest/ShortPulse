export const MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE = "Media storage limit exceeded";

const STORAGE_QUOTA_PATTERNS = [
  /media storage limit exceeded/i,
  /quota exceeded/i,
  /limit_bytes=/i,
];

export const isMediaStorageQuotaExceededError = (error: unknown): boolean => {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";
  return STORAGE_QUOTA_PATTERNS.some((pattern) => pattern.test(message));
};
