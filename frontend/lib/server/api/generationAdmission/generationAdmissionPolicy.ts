/**
 * Pure generation admission policy logic.
 * Parses config and evaluates allow/deny decisions from a snapshot.
 */
import type { GenerationAdmissionTier } from "../../../model-runtime/generationAdmissionTiers";
import type {
  GenerationAdmissionDecision,
  GenerationAdmissionMode,
  GenerationAdmissionSnapshot,
  GenerationAdmissionTierLimits,
} from "./types";

const MIN_LIMIT = 1;
const MIN_RETRY_AFTER_SECONDS = 1;

export const DEFAULT_GENERATION_ADMISSION_MODE: GenerationAdmissionMode = "off";
export const DEFAULT_GENERATION_ADMISSION_GLOBAL_MAX = 4;
export const DEFAULT_GENERATION_ADMISSION_RETRY_AFTER_SECONDS = 20;
export const DEFAULT_GENERATION_ADMISSION_TIER_LIMITS: GenerationAdmissionTierLimits = {
  video_long: 2,
  image_heavy: 3,
  image_standard: 4,
};

const parsePositiveInteger = (value: unknown, fallback: number, min: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(min, parsed);
    }
  }
  return fallback;
};

/**
 * Parses admission mode from env-like input.
 */
export const parseGenerationAdmissionMode = (
  value: string | undefined
): GenerationAdmissionMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "off" || normalized === "shadow" || normalized === "enforce") {
    return normalized;
  }
  return DEFAULT_GENERATION_ADMISSION_MODE;
};

/**
 * Parses global concurrent generation max.
 */
export const parseGenerationAdmissionGlobalMax = (value: string | undefined): number =>
  parsePositiveInteger(value, DEFAULT_GENERATION_ADMISSION_GLOBAL_MAX, MIN_LIMIT);

/**
 * Parses retry-after seconds for admission denials.
 */
export const parseGenerationAdmissionRetryAfterSeconds = (value: string | undefined): number =>
  parsePositiveInteger(
    value,
    DEFAULT_GENERATION_ADMISSION_RETRY_AFTER_SECONDS,
    MIN_RETRY_AFTER_SECONDS
  );

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseTierLimitValue = (value: unknown, fallback: number): number =>
  parsePositiveInteger(value, fallback, MIN_LIMIT);

const withFallbackTierLimits = (
  candidate: Record<string, unknown>
): GenerationAdmissionTierLimits => {
  const tiers: GenerationAdmissionTier[] = ["video_long", "image_heavy", "image_standard"];
  const resolved = { ...DEFAULT_GENERATION_ADMISSION_TIER_LIMITS };
  for (const tier of tiers) {
    resolved[tier] = parseTierLimitValue(candidate[tier], resolved[tier]);
  }
  return resolved;
};

/**
 * Parses per-tier concurrent limits from JSON env input.
 */
export const parseGenerationAdmissionTierLimits = (
  value: string | undefined
): GenerationAdmissionTierLimits => {
  if (!value || !value.trim().length) {
    return { ...DEFAULT_GENERATION_ADMISSION_TIER_LIMITS };
  }
  try {
    const parsed = JSON.parse(value);
    const candidate = asRecord(parsed);
    if (!candidate) return { ...DEFAULT_GENERATION_ADMISSION_TIER_LIMITS };
    return withFallbackTierLimits(candidate);
  } catch {
    return { ...DEFAULT_GENERATION_ADMISSION_TIER_LIMITS };
  }
};

const resolveReason = ({
  overGlobal,
  overTier,
}: {
  overGlobal: boolean;
  overTier: boolean;
}): GenerationAdmissionDecision["reason"] => {
  if (overGlobal && overTier) return "global_and_tier_limit";
  if (overGlobal) return "global_limit";
  if (overTier) return "tier_limit";
  return null;
};

/**
 * Evaluates admission from a snapshot and configured mode.
 */
export const evaluateGenerationAdmissionDecision = ({
  mode,
  snapshot,
  retryAfterSeconds,
}: {
  mode: GenerationAdmissionMode;
  snapshot: GenerationAdmissionSnapshot;
  retryAfterSeconds: number;
}): GenerationAdmissionDecision => {
  const overGlobal = snapshot.globalActive > snapshot.globalMax;
  const overTier = snapshot.tierActive > snapshot.tierMax;
  const reason = resolveReason({ overGlobal, overTier });
  const wouldLimit = reason !== null;
  const enforced = mode === "enforce" && wouldLimit;

  return {
    mode,
    allowed: !enforced,
    enforced,
    wouldLimit,
    reason,
    retryAfterSeconds: Math.max(MIN_RETRY_AFTER_SECONDS, Math.trunc(retryAfterSeconds)),
    snapshot,
  };
};
