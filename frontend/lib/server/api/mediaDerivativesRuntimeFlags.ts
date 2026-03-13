/**
 * Media derivative worker runtime flags.
 * Centralizes env parsing for `/api/internal/media-derivatives/run`.
 */

export type MediaDerivativesRuntimeFlags = {
  enabled: boolean;
  cronSecret: string | null;
  batchSize: number;
  maxAttempts: number;
  leaseSeconds: number;
  sourceSignedUrlTtlSeconds: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
  thumb240Quality: number;
  thumb480Quality: number;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseInteger = (value: string | undefined, fallback: number, min: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = parseInteger(value, fallback, min);
  return Math.min(max, parsed);
};

export const readMediaDerivativesRuntimeFlags = (): MediaDerivativesRuntimeFlags => ({
  enabled: parseBoolean(process.env.SHORTPULSE_MEDIA_DERIVATIVES_ENABLED, false),
  cronSecret: process.env.SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET?.trim() || null,
  batchSize: parseInteger(process.env.SHORTPULSE_MEDIA_DERIVATIVES_BATCH_SIZE, 20, 1),
  maxAttempts: parseInteger(process.env.SHORTPULSE_MEDIA_DERIVATIVES_MAX_ATTEMPTS, 5, 1),
  leaseSeconds: parseInteger(process.env.SHORTPULSE_MEDIA_DERIVATIVES_LEASE_SECONDS, 180, 1),
  sourceSignedUrlTtlSeconds: parseBoundedInteger(
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_SOURCE_SIGNED_URL_TTL_SECONDS,
    300,
    60,
    3600
  ),
  retryBaseSeconds: parseInteger(
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_RETRY_BASE_SECONDS,
    60,
    1
  ),
  retryMaxSeconds: parseInteger(
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_RETRY_MAX_SECONDS,
    1800,
    1
  ),
  thumb240Quality: parseBoundedInteger(
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_THUMB_240_QUALITY,
    58,
    20,
    100
  ),
  thumb480Quality: parseBoundedInteger(
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_THUMB_480_QUALITY,
    62,
    20,
    100
  ),
});
