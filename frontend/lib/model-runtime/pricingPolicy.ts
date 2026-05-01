/**
 * Shared model-pricing policy defaults, document normalization, and per-model resolution.
 */

export type CreditRoundingMode = "nearest-5" | "ceil";
export type ModelPricingPolicySource = "control_plane" | "fallback";

export type ModelPricingPerModelOverride = {
  creditUsdScale?: number;
  markupBps?: number;
  roundingIncrement?: number;
};

export type ModelPricingPolicyDocument = {
  schemaVersion: 1;
  global: {
    creditUsdScale: number;
    defaultRoundingMode: CreditRoundingMode;
    defaultRoundingIncrement: number;
  };
  perModel: Record<string, ModelPricingPerModelOverride>;
};

export type ResolvedModelPricingForModel = {
  creditUsdScale: number;
  markupBps: number;
  roundingMode: CreditRoundingMode;
  roundingIncrement: number;
};

export type ModelPricingPolicySnapshot = {
  version: string;
  activePolicyVersion: number | null;
  policySource: ModelPricingPolicySource;
  updatedAt: string | null;
  updatedByEmail: string | null;
  creditUsdScale: number;
  creditValueUsd: number;
  defaultRoundingMode: CreditRoundingMode;
  defaultRoundingIncrement: number;
  overrideCount: number;
  document: ModelPricingPolicyDocument;
};

export const CREDIT_USD_SCALE = 100; // 1 USD = 100 credits
export const USD_MICRO_SCALE = 1_000_000; // 1e-6 USD precision
export const DEFAULT_MARKUP_BPS = 0;
export const DEFAULT_CREDIT_ROUNDING_MODE: CreditRoundingMode = "ceil";
export const DEFAULT_CREDIT_ROUNDING_INCREMENT = 1;
export const MODEL_PRICING_POLICY_SCHEMA_VERSION = 1;
export const MODEL_PRICING_POLICY_VERSION = "runtime-default-v1";

const MIN_MARKUP_BPS = 0;
const MAX_MARKUP_BPS = 100_000;

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

const normalizeModelIdList = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : [...fallback];
};

const convertLegacyMultiplierToMarkupOverride = (multiplierBps: number): number =>
  multiplierBps - 10_000;

const normalizePerModelOverride = (value: unknown): ModelPricingPerModelOverride | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  const markupBps = asInteger(record.markupBps);
  const legacyMultiplierBps = asInteger(record.multiplierBps);
  const creditUsdScale = asInteger(record.creditUsdScale);
  const roundingIncrement = asInteger(record.roundingIncrement);

  const normalized: ModelPricingPerModelOverride = {};
  if (creditUsdScale != null && creditUsdScale > 0) {
    normalized.creditUsdScale = creditUsdScale;
  }
  if (markupBps != null) {
    normalized.markupBps = clampInteger(markupBps, MIN_MARKUP_BPS, MAX_MARKUP_BPS);
  } else if (legacyMultiplierBps != null && legacyMultiplierBps > 0) {
    normalized.markupBps = clampInteger(
      convertLegacyMultiplierToMarkupOverride(legacyMultiplierBps),
      MIN_MARKUP_BPS,
      MAX_MARKUP_BPS
    );
  }
  if (roundingIncrement != null && roundingIncrement > 0) {
    normalized.roundingIncrement = roundingIncrement;
  }

  return Object.keys(normalized).length ? normalized : null;
};

export const getDefaultModelPricingPolicyDocument = (): ModelPricingPolicyDocument => ({
  schemaVersion: MODEL_PRICING_POLICY_SCHEMA_VERSION,
  global: {
    creditUsdScale: CREDIT_USD_SCALE,
    defaultRoundingMode: DEFAULT_CREDIT_ROUNDING_MODE,
    defaultRoundingIncrement: DEFAULT_CREDIT_ROUNDING_INCREMENT,
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
  const legacyExceptionRoundingModelIds = normalizeModelIdList(
    globalRecord?.exceptionRoundingModelIds,
    []
  );

  const normalizedPerModel = Object.entries(perModelRecord ?? {}).reduce<
    Record<string, ModelPricingPerModelOverride>
  >((accumulator, [modelId, override]) => {
    const normalized = normalizePerModelOverride(override);
    if (normalized) {
      accumulator[modelId] = normalized;
    }
    return accumulator;
  }, {});

  legacyExceptionRoundingModelIds.forEach((modelId) => {
    const currentOverride = normalizedPerModel[modelId] ?? {};
    if (
      typeof currentOverride.roundingIncrement === "number" &&
      currentOverride.roundingIncrement > 0
    ) {
      return;
    }
    normalizedPerModel[modelId] = {
      ...currentOverride,
      roundingIncrement: 1,
    };
  });

  return {
    schemaVersion: MODEL_PRICING_POLICY_SCHEMA_VERSION,
    global: {
      creditUsdScale:
        creditUsdScale != null && creditUsdScale > 0
          ? creditUsdScale
          : defaults.global.creditUsdScale,
      defaultRoundingMode: defaults.global.defaultRoundingMode,
      defaultRoundingIncrement: defaults.global.defaultRoundingIncrement,
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
      typeof override.creditUsdScale === "number" &&
      override.creditUsdScale > 0 &&
      override.creditUsdScale !== normalized.global.creditUsdScale
    ) {
      nextOverride.creditUsdScale = override.creditUsdScale;
    }

    if (typeof override.markupBps === "number" && override.markupBps >= MIN_MARKUP_BPS) {
      nextOverride.markupBps = override.markupBps;
    }

    if (typeof override.roundingIncrement === "number" && override.roundingIncrement > 0) {
      nextOverride.roundingIncrement = override.roundingIncrement;
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

const modelPricingOverridesEqual = (
  left: ModelPricingPerModelOverride,
  right: ModelPricingPerModelOverride
): boolean =>
  left.creditUsdScale === right.creditUsdScale &&
  left.markupBps === right.markupBps &&
  left.roundingIncrement === right.roundingIncrement;

export const modelPricingPolicyDocumentsEqual = (
  left: ModelPricingPolicyDocument | null | undefined,
  right: ModelPricingPolicyDocument | null | undefined
): boolean => {
  if (!left || !right) return false;

  const leftPolicy = compactModelPricingPolicyDocument(left);
  const rightPolicy = compactModelPricingPolicyDocument(right);
  if (
    leftPolicy.schemaVersion !== rightPolicy.schemaVersion ||
    leftPolicy.global.creditUsdScale !== rightPolicy.global.creditUsdScale ||
    leftPolicy.global.defaultRoundingMode !== rightPolicy.global.defaultRoundingMode ||
    leftPolicy.global.defaultRoundingIncrement !== rightPolicy.global.defaultRoundingIncrement
  ) {
    return false;
  }

  const leftModelIds = Object.keys(leftPolicy.perModel).sort();
  const rightModelIds = Object.keys(rightPolicy.perModel).sort();
  if (leftModelIds.length !== rightModelIds.length) return false;

  return leftModelIds.every((modelId, index) => {
    if (modelId !== rightModelIds[index]) return false;
    const leftOverride = leftPolicy.perModel[modelId];
    const rightOverride = rightPolicy.perModel[modelId];
    return Boolean(
      leftOverride && rightOverride && modelPricingOverridesEqual(leftOverride, rightOverride)
    );
  });
};

export const resolveModelPricingForModel = (
  policy: ModelPricingPolicyDocument | null | undefined,
  modelId: string
): ResolvedModelPricingForModel => {
  const normalized = compactModelPricingPolicyDocument(policy);
  const override = normalized.perModel[modelId] ?? null;
  const roundingIncrement = override?.roundingIncrement ?? DEFAULT_CREDIT_ROUNDING_INCREMENT;

  return {
    creditUsdScale: override?.creditUsdScale ?? normalized.global.creditUsdScale,
    markupBps: override?.markupBps ?? DEFAULT_MARKUP_BPS,
    roundingMode: roundingIncrement > 1 ? "nearest-5" : "ceil",
    roundingIncrement,
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
    defaultRoundingMode: normalized.global.defaultRoundingMode,
    defaultRoundingIncrement: normalized.global.defaultRoundingIncrement,
    overrideCount: Object.keys(normalized.perModel).length,
    document: normalized,
  };
};
