/**
 * Centralized Fal runtime rollout flags.
 * Keeps env parsing strict and deterministic for server-side handlers.
 */
import {
  parseGenerationAdmissionGlobalMax,
  parseGenerationAdmissionMode,
  parseGenerationAdmissionRetryAfterSeconds,
  parseGenerationAdmissionTierLimits,
} from "./generationAdmission/generationAdmissionPolicy";
import type { GenerationAdmissionConfig } from "./generationAdmission/types";

export type FalIntegrationMode = "legacy" | "shadow" | "on";
export type FalWebhookVerifyMode = "dual" | "fal_only" | "hmac_only";

export type FalRuntimeFlags = {
  integrationMode: FalIntegrationMode;
  videoSubmitCanonicalMode: "off" | "shadow" | "on";
  videoQueueCompatNormalizationEnabled: boolean;
  modelAllowlist: Set<string>;
  statusTransientFailuresEnabled: boolean;
  reconcilerEnabled: boolean;
  reconcilerCronSecret: string | null;
  reconcilerBatchSize: number;
  reconcilerMaxAttempts: number;
  reconcilerMinAgeSeconds: number;
  reconcilerLeaseSeconds: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold15m: number;
  webhookEnabled: boolean;
  webhookVerifyMode: FalWebhookVerifyMode;
  webhookJwksUrl: string | null;
  webhookToleranceSeconds: number;
  webhookCanaryUserAllowlist: Set<string>;
  webhookCanaryModelAllowlist: Set<string>;
  publicApiBaseUrl: string | null;
  directDebitFallbackEnabled: boolean;
  admission: GenerationAdmissionConfig;
  reservationCleanupEnabled: boolean;
  reservationCleanupMinAgeSeconds: number;
  reservationCleanupBatchSize: number;
  providerAttachedReservationCleanupEnabled: boolean;
  providerAttachedReservationCleanupMinAgeSeconds: number;
  providerAttachedReservationOrphanMinAgeSeconds: number;
  admissionAtomicEnabled: boolean;
  queueEnabled: boolean;
  queueMaxPerUser: number;
  queueDispatchBatchSize: number;
  queueLeaseSeconds: number;
  queueMaxAttempts: number;
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

const parseMode = (value: string | undefined): FalIntegrationMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "legacy" || normalized === "shadow" || normalized === "on") {
    return normalized;
  }
  return "legacy";
};

const parseVideoSubmitCanonicalMode = (value: string | undefined): "off" | "shadow" | "on" => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "off" || normalized === "shadow" || normalized === "on") {
    return normalized;
  }
  return "on";
};

const parseWebhookVerifyMode = (value: string | undefined): FalWebhookVerifyMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "dual" || normalized === "fal_only" || normalized === "hmac_only") {
    return normalized;
  }
  return "dual";
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
  integrationMode: parseMode(process.env.SHORTPULSE_FAL_INTEGRATION_MODE),
  videoSubmitCanonicalMode: parseVideoSubmitCanonicalMode(
    process.env.SHORTPULSE_VIDEO_SUBMIT_CANONICAL_MODE
  ),
  videoQueueCompatNormalizationEnabled: parseBoolean(
    process.env.SHORTPULSE_VIDEO_QUEUE_COMPAT_NORMALIZATION_ENABLED,
    true
  ),
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
  circuitBreakerEnabled: parseBoolean(process.env.SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED, false),
  circuitBreakerThreshold15m: parseInteger(
    process.env.SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M,
    20,
    1
  ),
  webhookEnabled: parseBoolean(process.env.SHORTPULSE_FAL_WEBHOOK_ENABLED, false),
  webhookVerifyMode: parseWebhookVerifyMode(process.env.SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE),
  webhookJwksUrl:
    process.env.SHORTPULSE_FAL_WEBHOOK_JWKS_URL?.trim() ||
    "https://rest.alpha.fal.ai/.well-known/jwks.json",
  webhookToleranceSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_WEBHOOK_TOLERANCE_SECONDS,
    300,
    1
  ),
  webhookCanaryUserAllowlist: parseAllowlist(
    process.env.SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST
  ),
  webhookCanaryModelAllowlist: parseAllowlist(
    process.env.SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST
  ),
  publicApiBaseUrl: normalizeBaseUrl(
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL ?? process.env.APP_BASE_URL
  ),
  directDebitFallbackEnabled: parseBoolean(
    process.env.SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED,
    false
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
  admissionAtomicEnabled: parseBoolean(process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED, false),
  queueEnabled: parseBoolean(process.env.SHORTPULSE_FAL_QUEUE_ENABLED, false),
  queueMaxPerUser: parseInteger(process.env.SHORTPULSE_FAL_QUEUE_MAX_PER_USER, 20, 1),
  queueDispatchBatchSize: parseInteger(process.env.SHORTPULSE_FAL_QUEUE_DISPATCH_BATCH_SIZE, 25, 1),
  queueLeaseSeconds: parseInteger(process.env.SHORTPULSE_FAL_QUEUE_LEASE_SECONDS, 30, 1),
  queueMaxAttempts: parseInteger(process.env.SHORTPULSE_FAL_QUEUE_MAX_ATTEMPTS, 5, 1),
  queueBaseBackoffSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS,
    5,
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
  if (flags.integrationMode === "legacy") return false;
  if (!flags.modelAllowlist.size) return true;
  for (const entry of flags.modelAllowlist) {
    if (matchAllowlistEntry(modelId, entry)) return true;
  }
  return false;
};
