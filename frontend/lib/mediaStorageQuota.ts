/**
 * Shared media storage quota helpers.
 * Normalizes machine-readable quota failures into one canonical user-facing contract.
 */
export const MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE = "Media storage limit exceeded";
export const MEDIA_STORAGE_FULL_REMEDIATION_MESSAGE =
  "Delete media, upgrade your plan, or add recurring storage before saving more files.";
export const MEDIA_STORAGE_FULL_USER_MESSAGE = `Your media storage is full. ${MEDIA_STORAGE_FULL_REMEDIATION_MESSAGE}`;
export const MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL = "Manage storage";
export const MEDIA_STORAGE_MANAGE_STORAGE_CTA_HREF = "/profile?section=storage";

const STORAGE_QUOTA_PATTERNS = [
  /media storage limit exceeded/i,
  /quota exceeded/i,
  /limit_bytes=/i,
];

const resolveMediaStorageQuotaTextCandidates = (error: unknown): string[] => {
  if (!error) return [];
  if (typeof error === "string") return [error];
  if (error instanceof Error) return [error.message];
  if (typeof error === "object") {
    const record = error as {
      error?: unknown;
      details?: unknown;
      message?: unknown;
    };
    return [record.error, record.details, record.message].flatMap((value) =>
      typeof value === "string" && value.trim().length > 0 ? [value] : []
    );
  }
  return [];
};

export type MediaStorageQuotaUiCopy = {
  title: typeof MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE;
  message: typeof MEDIA_STORAGE_FULL_USER_MESSAGE;
  remediationMessage: typeof MEDIA_STORAGE_FULL_REMEDIATION_MESSAGE;
  ctaLabel: typeof MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL;
  ctaHref: typeof MEDIA_STORAGE_MANAGE_STORAGE_CTA_HREF;
};

export const isMediaStorageQuotaExceededError = (error: unknown): boolean => {
  const messages = resolveMediaStorageQuotaTextCandidates(error);
  return messages.some((message) =>
    STORAGE_QUOTA_PATTERNS.some((pattern) => pattern.test(message))
  );
};

export const normalizeMediaStorageQuotaUiCopy = (
  error: unknown
): MediaStorageQuotaUiCopy | null => {
  if (!isMediaStorageQuotaExceededError(error)) return null;
  return {
    title: MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
    message: MEDIA_STORAGE_FULL_USER_MESSAGE,
    remediationMessage: MEDIA_STORAGE_FULL_REMEDIATION_MESSAGE,
    ctaLabel: MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL,
    ctaHref: MEDIA_STORAGE_MANAGE_STORAGE_CTA_HREF,
  };
};
