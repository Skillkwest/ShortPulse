/**
 * Media storage lifecycle dry-run runtime flags.
 * Centralizes env parsing for `/api/internal/media-storage-lifecycle/run`.
 */

export type MediaStorageLifecycleRuntimeFlags = {
  enabled: boolean;
  cronSecret: string | null;
  cleanupTtlDays: number;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const readMediaStorageLifecycleRuntimeFlags = (): MediaStorageLifecycleRuntimeFlags => ({
  enabled: parseBoolean(process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_ENABLED, false),
  cronSecret: process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_CRON_SECRET?.trim() || null,
  cleanupTtlDays: parseBoundedInteger(
    process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_TTL_DAYS,
    7,
    1,
    90
  ),
});
