/**
 * Centralized Fal runtime rollout flags.
 * Keeps env parsing strict and deterministic for server-side handlers.
 */

export type FalIntegrationMode = "legacy" | "shadow" | "on";

export type FalRuntimeFlags = {
  integrationMode: FalIntegrationMode;
  modelAllowlist: Set<string>;
  reconcilerEnabled: boolean;
  reconcilerCronSecret: string | null;
  reconcilerBatchSize: number;
  reconcilerMaxAttempts: number;
  reconcilerMinAgeSeconds: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold15m: number;
  webhookEnabled: boolean;
  directDebitFallbackEnabled: boolean;
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
  modelAllowlist: parseAllowlist(process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST),
  reconcilerEnabled: parseBoolean(process.env.SHORTPULSE_FAL_RECONCILER_ENABLED, false),
  reconcilerCronSecret: process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET?.trim() || null,
  reconcilerBatchSize: parseInteger(process.env.SHORTPULSE_FAL_RECONCILER_BATCH_SIZE, 25, 1),
  reconcilerMaxAttempts: parseInteger(process.env.SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS, 5, 1),
  reconcilerMinAgeSeconds: parseInteger(
    process.env.SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS,
    120,
    0
  ),
  circuitBreakerEnabled: parseBoolean(process.env.SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED, false),
  circuitBreakerThreshold15m: parseInteger(
    process.env.SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M,
    20,
    1
  ),
  webhookEnabled: parseBoolean(process.env.SHORTPULSE_FAL_WEBHOOK_ENABLED, false),
  directDebitFallbackEnabled: parseBoolean(
    process.env.SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED,
    false
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
