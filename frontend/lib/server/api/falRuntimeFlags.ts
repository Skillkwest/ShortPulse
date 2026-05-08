/**
 * Centralized Fal runtime config.
 * Keeps env parsing strict and deterministic for server-side handlers.
 */
import {
  parseGenerationAdmissionGlobalMax,
  parseGenerationAdmissionMode,
  parseGenerationAdmissionRetryAfterSeconds,
  parseGenerationAdmissionTierLimits,
} from "./generationAdmission/generationAdmissionPolicy";
import type { GenerationAdmissionConfig } from "./generationAdmission/types";

export type FalRuntimeFlags = {
  modelAllowlist: Set<string>;
  statusTransientFailuresEnabled: boolean;
  reconcilerEnabled: boolean;
  reconcilerCronSecret: string | null;
  reconcilerBatchSize: number;
  reconcilerMaxAttempts: number;
  reconcilerMinAgeSeconds: number;
  reconcilerLeaseSeconds: number;
  publicApiBaseUrl: string | null;
  admission: GenerationAdmissionConfig;
  reservationCleanupEnabled: boolean;
  reservationCleanupMinAgeSeconds: number;
  reservationCleanupBatchSize: number;
  providerAttachedReservationCleanupEnabled: boolean;
  providerAttachedReservationCleanupMinAgeSeconds: number;
  providerAttachedReservationOrphanMinAgeSeconds: number;
  queueBaseBackoffSeconds: number;
  queueMaxWaitSeconds: number;
  recoveryProbeTimeoutMs: number;
  noMediaExhaustMinAgeSeconds: number;
  runningExhaustMinAgeSeconds: number;
  runningHardTimeoutSeconds: number;
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

const normalizeBaseUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.protocol.startsWith("http")) return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

const parseAllowlist = (value: string | undefined): Set<string> => {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
};

const matchAllowlistEntry = (modelId: string, entry: string): boolean => {
  if (entry === "*") return true;
  if (entry.endsWith("*")) {
    return modelId.startsWith(entry.slice(0, -1));
  }
  return modelId === entry;
};

export const readFalRuntimeFlags = (): FalRuntimeFlags => ({
  modelAllowlist: parseAllowlist(process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST),
  statusTransientFailuresEnabled: parseBoolean(
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED,
    false
  ),
  reconcilerEnabled: parseBoolean(process.env.SHORTPULSE_FAL_RECONCILER_ENABLED, false),
  reconcilerCronSecret: process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET?.trim() || null,
  reconcilerBatchSize: parseInteger(process.env.SHORTPULSE_FAL_RECONCILER_BATCH_SIZE, 25, 1),
  reconcilerMaxAttempts: parseInteger(process.env.SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS, 5, 1),
  reconcilerMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS,
    120,
    0
  ),
  reconcilerLeaseSeconds: parseInteger(process.env.SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS, 120, 1),
  publicApiBaseUrl: normalizeBaseUrl(
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL ?? process.env.APP_BASE_URL
  ),
  admission: {
    mode: parseGenerationAdmissionMode(process.env.SHORTPULSE_FAL_ADMISSION_MODE),
    globalMax: parseGenerationAdmissionGlobalMax(process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX),
    tierLimits: parseGenerationAdmissionTierLimits(
      process.env.SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON
    ),
    retryAfterSeconds: parseGenerationAdmissionRetryAfterSeconds(
      process.env.SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS
    ),
    sharedProviderEnabled: parseBoolean(
      process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED,
      false
    ),
    sharedProviderGlobalMax: parseGenerationAdmissionGlobalMax(
      process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX ??
        process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX
    ),
  },
  reservationCleanupEnabled: parseBoolean(
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED,
    parseBoolean(process.env.SHORTPULSE_FAL_RECONCILER_ENABLED, false)
  ),
  reservationCleanupMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS,
    900,
    0
  ),
  reservationCleanupBatchSize: parseInteger(
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE,
    200,
    1
  ),
  providerAttachedReservationCleanupEnabled: parseBoolean(
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_ENABLED,
    parseBoolean(process.env.SHORTPULSE_FAL_RECONCILER_ENABLED, false)
  ),
  providerAttachedReservationCleanupMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS,
    7200,
    0
  ),
  providerAttachedReservationOrphanMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS,
    86400,
    0
  ),
  queueBaseBackoffSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS,
    3,
    1
  ),
  queueMaxWaitSeconds: parseInteger(process.env.SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS, 1200, 60),
  recoveryProbeTimeoutMs: parseInteger(
    process.env.SHORTPULSE_FAL_RECOVERY_PROBE_TIMEOUT_MS,
    15000,
    1000
  ),
  noMediaExhaustMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS,
    7200,
    0
  ),
  runningExhaustMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS,
    7200,
    0
  ),
  runningHardTimeoutSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS,
    0,
    0
  ),
});

export const isFalRuntimeEnabledForModel = (
  modelId: string,
  flags: FalRuntimeFlags = readFalRuntimeFlags()
): boolean => {
  if (!flags.modelAllowlist.size) return true;
  for (const entry of flags.modelAllowlist) {
    if (matchAllowlistEntry(modelId, entry)) return true;
  }
  return false;
};
