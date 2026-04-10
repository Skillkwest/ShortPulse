/**
 * Shared recovery-lag backpressure helper.
 * Reads live stale-work signals and reduces shared-provider admission headroom when recovery
 * is visibly falling behind, without changing any client-facing contract.
 */
import { resolveProviderFromModelId } from "../../providerIntegration/providerRuntimeConfig";
import { getSupabaseAdmin } from "../supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type RecoveryBackpressureLevel = 0 | 1 | 2;

export type RecoveryBackpressureSignals = {
  staleProviderAttachedReservations: number;
  staleRecoverableGenerations: number;
  recentQueueWaitTimeouts: number;
  recentRecoveryP95Ms: number | null;
};

export type RecoveryBackpressureDecision = {
  level: RecoveryBackpressureLevel;
  requestedGlobalMax: number;
  effectiveGlobalMax: number;
  reduction: number;
  signals: RecoveryBackpressureSignals;
};

const STALE_AGE_MS = 2 * 60 * 60 * 1000;
const RECENT_WINDOW_MS = 15 * 60 * 1000;
const LEVEL_ONE_STALE_THRESHOLD = 10;
const LEVEL_TWO_STALE_THRESHOLD = 25;
const LEVEL_ONE_TIMEOUT_THRESHOLD = 1;
const LEVEL_TWO_TIMEOUT_THRESHOLD = 3;
const LEVEL_ONE_RECOVERY_P95_MS = 5 * 60 * 1000;
const LEVEL_TWO_RECOVERY_P95_MS = 10 * 60 * 1000;
const LEVEL_ONE_REDUCTION = 1;
const LEVEL_TWO_REDUCTION = 2;
const ACTIVE_RECOVERY_STATES = ["queued", "recovering"];
const ACTIVE_GENERATION_STATUSES = ["pending", "submitted", "running", "fail"];
const DECISION_CACHE_TTL_MS = 30 * 1000;
const TELEMETRY_COOLDOWN_MS = 60 * 1000;

type CachedDecisionEntry = {
  expiresAtMs: number;
  decision: RecoveryBackpressureDecision;
};

const decisionCache = new Map<string, CachedDecisionEntry>();
const telemetryCooldowns = new Map<string, number>();

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const percentile95 = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index] ?? null;
};

const buildCacheKey = ({
  provider,
  requestedGlobalMax,
}: {
  provider: string;
  requestedGlobalMax: number;
}): string => `${provider}:${requestedGlobalMax}`;

const cloneDecision = (
  decision: RecoveryBackpressureDecision,
  requestedGlobalMax: number
): RecoveryBackpressureDecision => {
  const effectiveGlobalMax = Math.min(requestedGlobalMax, decision.effectiveGlobalMax);
  return {
    ...decision,
    requestedGlobalMax,
    effectiveGlobalMax,
    reduction: Math.max(0, requestedGlobalMax - effectiveGlobalMax),
    signals: { ...decision.signals },
  };
};

const isSupportedSharedProvider = (provider: string): boolean =>
  provider === "fal" || provider === "kie";

const matchesProviderFamily = ({
  provider,
  modelId,
  providerLabel,
}: {
  provider: string;
  modelId: string | null;
  providerLabel: string | null;
}): boolean => {
  const normalizedProviderLabel = providerLabel?.trim().toLowerCase() ?? null;
  if (normalizedProviderLabel) {
    return (
      normalizedProviderLabel === provider || normalizedProviderLabel.startsWith(`${provider}_`)
    );
  }
  if (!modelId) return false;
  return resolveProviderFromModelId({ modelId, fallback: provider }) === provider;
};

const readStaleProviderAttachedReservations = async ({
  provider,
  staleBeforeIso,
}: {
  provider: string;
  staleBeforeIso: string;
}): Promise<number> => {
  const response = await getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("model_id", { count: "exact", head: true })
    .eq("status", "reserved")
    .not("provider_request_id", "is", null)
    .lte("created_at", staleBeforeIso)
    .ilike("model_id", `${provider}%`);
  if (response.error) throw response.error;
  return response.count ?? 0;
};

const readStaleRecoverableGenerations = async ({
  provider,
  staleBeforeIso,
}: {
  provider: string;
  staleBeforeIso: string;
}): Promise<number> => {
  const response = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE_GENERATION_STATUSES)
    .in("recovery_state", ACTIVE_RECOVERY_STATES)
    .lte("created_at", staleBeforeIso)
    .ilike("provider", `${provider}%`);
  if (response.error) throw response.error;
  return response.count ?? 0;
};

const readRecentQueueWaitTimeouts = async ({
  provider,
  recentAfterIso,
}: {
  provider: string;
  recentAfterIso: string;
}): Promise<number> => {
  const response = await getSupabaseAdmin()
    .from("app_error_events")
    .select("metadata")
    .eq("source", "telemetry.queue.dispatch.exhausted")
    .gte("occurred_at", recentAfterIso);
  if (response.error) throw response.error;

  return (Array.isArray(response.data) ? response.data : []).reduce((count, row) => {
    const metadata = asObject(row)?.metadata;
    const errorCode = asString(asObject(metadata)?.error_code)?.toUpperCase();
    const modelId = asString(asObject(metadata)?.model_id);
    if (errorCode !== "QUEUE_WAIT_TIMEOUT") return count;
    return matchesProviderFamily({ provider, modelId, providerLabel: null }) ? count + 1 : count;
  }, 0);
};

const readRecentRecoveryP95Ms = async ({
  provider,
  recentAfterIso,
}: {
  provider: string;
  recentAfterIso: string;
}): Promise<number | null> => {
  const response = await getSupabaseAdmin()
    .from("app_error_events")
    .select("metadata")
    .eq("source", "telemetry.generation.recovery.media_visible")
    .gte("occurred_at", recentAfterIso);
  if (response.error) throw response.error;

  const samples = (Array.isArray(response.data) ? response.data : []).flatMap((row) => {
    const metadata = asObject(asObject(row)?.metadata);
    if (!metadata) return [];
    const providerLabel = asString(metadata.provider);
    const modelId = asString(metadata.model_id);
    if (!matchesProviderFamily({ provider, modelId, providerLabel })) return [];
    const sample = asNumber(metadata.provider_terminal_to_media_visible_ms);
    return sample === null ? [] : [sample];
  });

  return percentile95(samples);
};

const resolveBackpressureLevel = ({
  staleProviderAttachedReservations,
  staleRecoverableGenerations,
  recentQueueWaitTimeouts,
  recentRecoveryP95Ms,
}: RecoveryBackpressureSignals): RecoveryBackpressureLevel => {
  const hitsLevelTwo =
    staleProviderAttachedReservations >= LEVEL_TWO_STALE_THRESHOLD ||
    staleRecoverableGenerations >= LEVEL_TWO_STALE_THRESHOLD ||
    recentQueueWaitTimeouts >= LEVEL_TWO_TIMEOUT_THRESHOLD ||
    (recentRecoveryP95Ms !== null && recentRecoveryP95Ms > LEVEL_TWO_RECOVERY_P95_MS);
  if (hitsLevelTwo) return 2;

  const hitsLevelOne =
    staleProviderAttachedReservations >= LEVEL_ONE_STALE_THRESHOLD ||
    staleRecoverableGenerations >= LEVEL_ONE_STALE_THRESHOLD ||
    recentQueueWaitTimeouts >= LEVEL_ONE_TIMEOUT_THRESHOLD ||
    (recentRecoveryP95Ms !== null && recentRecoveryP95Ms > LEVEL_ONE_RECOVERY_P95_MS);
  return hitsLevelOne ? 1 : 0;
};

/**
 * Reads live stale-work signals and returns a reduced shared-provider global max when recovery
 * pressure warrants slowing new intake.
 */
export const readRecoveryBackpressureDecision = async ({
  provider,
  requestedGlobalMax,
  nowMs = Date.now(),
}: {
  provider: string;
  requestedGlobalMax: number;
  nowMs?: number;
}): Promise<RecoveryBackpressureDecision> => {
  const buildNeutralDecision = (): RecoveryBackpressureDecision => ({
    level: 0,
    requestedGlobalMax,
    effectiveGlobalMax: requestedGlobalMax,
    reduction: 0,
    signals: {
      staleProviderAttachedReservations: 0,
      staleRecoverableGenerations: 0,
      recentQueueWaitTimeouts: 0,
      recentRecoveryP95Ms: null,
    },
  });

  if (!isSupportedSharedProvider(provider)) {
    return buildNeutralDecision();
  }

  const cacheKey = buildCacheKey({
    provider,
    requestedGlobalMax,
  });
  const cached = decisionCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cloneDecision(cached.decision, requestedGlobalMax);
  }

  try {
    const staleBeforeIso = new Date(nowMs - STALE_AGE_MS).toISOString();
    const recentAfterIso = new Date(nowMs - RECENT_WINDOW_MS).toISOString();
    const [
      staleProviderAttachedReservations,
      staleRecoverableGenerations,
      recentQueueWaitTimeouts,
      recentRecoveryP95Ms,
    ] = await Promise.all([
      readStaleProviderAttachedReservations({ provider, staleBeforeIso }),
      readStaleRecoverableGenerations({ provider, staleBeforeIso }),
      readRecentQueueWaitTimeouts({ provider, recentAfterIso }),
      readRecentRecoveryP95Ms({ provider, recentAfterIso }),
    ]);

    const signals: RecoveryBackpressureSignals = {
      staleProviderAttachedReservations,
      staleRecoverableGenerations,
      recentQueueWaitTimeouts,
      recentRecoveryP95Ms,
    };
    const level = resolveBackpressureLevel(signals);
    const requestedReduction =
      level === 2 ? LEVEL_TWO_REDUCTION : level === 1 ? LEVEL_ONE_REDUCTION : 0;
    const effectiveGlobalMax = Math.max(1, requestedGlobalMax - requestedReduction);

    const decision = {
      level,
      requestedGlobalMax,
      effectiveGlobalMax,
      reduction: Math.max(0, requestedGlobalMax - effectiveGlobalMax),
      signals,
    };
    decisionCache.set(cacheKey, {
      expiresAtMs: nowMs + DECISION_CACHE_TTL_MS,
      decision,
    });
    return cloneDecision(decision, requestedGlobalMax);
  } catch {
    return buildNeutralDecision();
  }
};

/**
 * Best-effort telemetry suppression for repetitive backpressure events.
 * Keeps signal visibility while avoiding one event per hot-path request.
 */
export const shouldEmitRecoveryBackpressureTelemetry = ({
  actor,
  provider,
  level,
  effectiveGlobalMax,
  nowMs = Date.now(),
}: {
  actor: "submit" | "queue_dispatch";
  provider: string;
  level: RecoveryBackpressureLevel;
  effectiveGlobalMax: number;
  nowMs?: number;
}): boolean => {
  if (level <= 0) return false;
  const key = `${actor}:${provider}:${level}:${effectiveGlobalMax}`;
  const nextAllowedAt = telemetryCooldowns.get(key) ?? 0;
  if (nextAllowedAt > nowMs) {
    return false;
  }
  telemetryCooldowns.set(key, nowMs + TELEMETRY_COOLDOWN_MS);
  return true;
};
