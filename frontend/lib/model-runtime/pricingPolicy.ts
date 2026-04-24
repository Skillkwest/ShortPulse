/**
 * Shared model-pricing policy defaults, document normalization, and per-model resolution.
 */

export type CreditRoundingMode = "nearest-5" | "ceil";
export type ModelPricingPolicySource = "control_plane" | "fallback";

export type ModelPricingPerModelOverride = {
  multiplierBps?: number;
  roundingMode?: CreditRoundingMode | null;
};

export type ModelPricingPolicyDocument = {
  schemaVersion: 1;
  global: {
    creditUsdScale: number;
    markupBps: number;
    defaultRoundingMode: CreditRoundingMode;
    defaultRoundingIncrement: number;
    exceptionRoundingModelIds: string[];
  };
  perModel: Record<string, ModelPricingPerModelOverride>;
};

export type ResolvedModelPricingForModel = {
  creditUsdScale: number;
  markupBps: number;
  roundingMode: CreditRoundingMode;
  roundingIncrement: number;
  multiplierBps: number;
};

export type ModelPricingPolicySnapshot = {
  version: string;
  activePolicyVersion: number | null;
  policySource: ModelPricingPolicySource;
  updatedAt: string | null;
  updatedByEmail: string | null;
  creditUsdScale: number;
  creditValueUsd: number;
  markupBps: number;
  markupPercent: number;
  defaultRoundingMode: CreditRoundingMode;
  defaultRoundingIncrement: number;
  exceptionRoundingModelIds: string[];
  overrideCount: number;
  document: ModelPricingPolicyDocument;
};

export const CREDIT_USD_SCALE = 100; // 1 USD = 100 credits
export const USD_MICRO_SCALE = 1_000_000; // 1e-6 USD precision
export const DEFAULT_MARKUP_BPS = 300; // +3%
export const MARKUP_NUMERATOR = 103;
export const MARKUP_DENOMINATOR = 100;
export const DEFAULT_CREDIT_ROUNDING_MODE: CreditRoundingMode = "nearest-5";
export const DEFAULT_CREDIT_ROUNDING_INCREMENT = 5;
export const DEFAULT_MODEL_MULTIPLIER_BPS = 10_000;
export const MODEL_PRICING_POLICY_SCHEMA_VERSION = 1;
export const MODEL_PRICING_POLICY_VERSION = "runtime-default-v1";

export const EXCEPTION_ROUNDING_MODEL_IDS = [
  "fal-ai/flux-2/klein/9b",
  "fal-ai/bria/background/remove",
] as const;

const VALID_ROUNDING_MODES = new Set<CreditRoundingMode>(["nearest-5", "ceil"]);
const MIN_MARKUP_BPS = 0;
const MAX_MARKUP_BPS = 100_000;
const MIN_MODEL_MULTIPLIER_BPS = 1;
const MAX_MODEL_MULTIPLIER_BPS = 100_000;

const clampInteger = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.trunc(value)));

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

const asCreditRoundingMode = (value: unknown): CreditRoundingMode | null =>
  typeof value === "string" && VALID_ROUNDING_MODES.has(value as CreditRoundingMode)
    ? (value as CreditRoundingMode)
    : null;

const normalizeModelIdList = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : [...fallback];
};

const normalizePerModelOverride = (value: unknown): ModelPricingPerModelOverride | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  const multiplierBps = asInteger(record.multiplierBps);
  const roundingMode = asCreditRoundingMode(record.roundingMode);

  const normalized: ModelPricingPerModelOverride = {};
  if (multiplierBps != null && multiplierBps > 0) {
    normalized.multiplierBps = clampInteger(
      multiplierBps,
      MIN_MODEL_MULTIPLIER_BPS,
      MAX_MODEL_MULTIPLIER_BPS
    );
  }
  if (roundingMode) {
    normalized.roundingMode = roundingMode;
  }

  return Object.keys(normalized).length ? normalized : null;
};

export const getDefaultModelPricingPolicyDocument = (): ModelPricingPolicyDocument => ({
  schemaVersion: MODEL_PRICING_POLICY_SCHEMA_VERSION,
  global: {
    creditUsdScale: CREDIT_USD_SCALE,
    markupBps: DEFAULT_MARKUP_BPS,
    defaultRoundingMode: DEFAULT_CREDIT_ROUNDING_MODE,
    defaultRoundingIncrement: DEFAULT_CREDIT_ROUNDING_INCREMENT,
    exceptionRoundingModelIds: Array.from(EXCEPTION_ROUNDING_MODEL_IDS),
  },
  perModel: {},
});

export const normalizeModelPricingPolicyDocument = (value: unknown): ModelPricingPolicyDocument => {
  const defaults = getDefaultModelPricingPolicyDocument();
  const record = asObjectRecord(value);
  if (!record) return defaults;

  const globalRecord = asObjectRecord(record.global);
  const perModelRecord = asObjectRecord(record.perModel);

  const creditUsdScale = asInteger(globalRecord?.creditUsdScale);
  const markupBps = asInteger(globalRecord?.markupBps);
  const defaultRoundingMode = asCreditRoundingMode(globalRecord?.defaultRoundingMode);
  const defaultRoundingIncrement = asInteger(globalRecord?.defaultRoundingIncrement);

  const normalizedPerModel = Object.entries(perModelRecord ?? {}).reduce<
    Record<string, ModelPricingPerModelOverride>
  >((accumulator, [modelId, override]) => {
    const normalized = normalizePerModelOverride(override);
    if (normalized) {
      accumulator[modelId] = normalized;
    }
    return accumulator;
  }, {});

  return {
    schemaVersion: MODEL_PRICING_POLICY_SCHEMA_VERSION,
    global: {
      creditUsdScale:
        creditUsdScale != null && creditUsdScale > 0
          ? creditUsdScale
          : defaults.global.creditUsdScale,
      markupBps:
        markupBps != null
          ? clampInteger(markupBps, MIN_MARKUP_BPS, MAX_MARKUP_BPS)
          : defaults.global.markupBps,
      defaultRoundingMode: defaultRoundingMode ?? defaults.global.defaultRoundingMode,
      defaultRoundingIncrement:
        defaultRoundingIncrement != null && defaultRoundingIncrement > 0
          ? defaultRoundingIncrement
          : defaults.global.defaultRoundingIncrement,
      exceptionRoundingModelIds: normalizeModelIdList(
        globalRecord?.exceptionRoundingModelIds,
        defaults.global.exceptionRoundingModelIds
      ),
    },
    perModel: normalizedPerModel,
  };
};

export const compactModelPricingPolicyDocument = (value: unknown): ModelPricingPolicyDocument => {
  const normalized = normalizeModelPricingPolicyDocument(value);
  const compactedPerModel = Object.entries(normalized.perModel).reduce<
    Record<string, ModelPricingPerModelOverride>
  >((accumulator, [modelId, override]) => {
    const nextOverride: ModelPricingPerModelOverride = {};

    if (
      typeof override.multiplierBps === "number" &&
      override.multiplierBps !== DEFAULT_MODEL_MULTIPLIER_BPS
    ) {
      nextOverride.multiplierBps = override.multiplierBps;
    }

    if (override.roundingMode) {
      nextOverride.roundingMode = override.roundingMode;
    }

    if (Object.keys(nextOverride).length > 0) {
      accumulator[modelId] = nextOverride;
    }
    return accumulator;
  }, {});

  return {
    ...normalized,
    perModel: compactedPerModel,
  };
};

export const resolveModelPricingForModel = (
  policy: ModelPricingPolicyDocument | null | undefined,
  modelId: string
): ResolvedModelPricingForModel => {
  const normalized = compactModelPricingPolicyDocument(policy);
  const override = normalized.perModel[modelId] ?? null;
  const exceptionRoundingModelIdSet = new Set(normalized.global.exceptionRoundingModelIds);

  return {
    creditUsdScale: normalized.global.creditUsdScale,
    markupBps: normalized.global.markupBps,
    roundingMode:
      override?.roundingMode ??
      (exceptionRoundingModelIdSet.has(modelId) ? "ceil" : normalized.global.defaultRoundingMode),
    roundingIncrement: normalized.global.defaultRoundingIncrement,
    multiplierBps: override?.multiplierBps ?? DEFAULT_MODEL_MULTIPLIER_BPS,
  };
};

export const getModelPricingPolicySnapshot = (
  policy: ModelPricingPolicyDocument | null | undefined = getDefaultModelPricingPolicyDocument(),
  options: {
    activePolicyVersion?: number | null;
    policySource?: ModelPricingPolicySource;
    updatedAt?: string | null;
    updatedByEmail?: string | null;
  } = {}
): ModelPricingPolicySnapshot => {
  const normalized = compactModelPricingPolicyDocument(policy);
  const markupPercent = normalized.global.markupBps / 100;

  return {
    version:
      options.activePolicyVersion != null
        ? `policy-v${options.activePolicyVersion}`
        : MODEL_PRICING_POLICY_VERSION,
    activePolicyVersion: options.activePolicyVersion ?? null,
    policySource: options.policySource ?? "fallback",
    updatedAt: options.updatedAt ?? null,
    updatedByEmail: options.updatedByEmail ?? null,
    creditUsdScale: normalized.global.creditUsdScale,
    creditValueUsd: 1 / normalized.global.creditUsdScale,
    markupBps: normalized.global.markupBps,
    markupPercent,
    defaultRoundingMode: normalized.global.defaultRoundingMode,
    defaultRoundingIncrement: normalized.global.defaultRoundingIncrement,
    exceptionRoundingModelIds: [...normalized.global.exceptionRoundingModelIds],
    overrideCount: Object.keys(normalized.perModel).length,
    document: normalized,
  };
};
