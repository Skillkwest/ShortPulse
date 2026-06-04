/**
 * Shared model-pricing policy defaults, document normalization, and per-model resolution.
 */

export type CreditRoundingMode = "nearest-5" | "ceil";
export type ModelPricingPolicySource = "control_plane" | "fallback";

export type ModelPricingPerModelOverride = {
  creditUsdScale?: number;
  markupBps?: number;
  roundingIncrement?: number;
  providerUsdOverride?: number;
  providerUsdPerSecondOverride?: number;
  billedCreditsOverride?: number;
  runtimeAuthorities?: ModelPricingRuntimeAuthorities;
  variants?: Record<string, ModelPricingVariantOverride>;
};

export type ModelPricingVariantOverride = {
  creditUsdScale?: number;
  markupBps?: number;
  roundingIncrement?: number;
  providerUsdOverride?: number;
  providerUsdPerSecondOverride?: number;
  billedCreditsOverride?: number;
};

export type ModelPricingRuntimeAuthorityWorkflow =
  | "create_image"
  | "edit_image"
  | "video"
  | "sound";

export type ModelPricingRuntimeAuthorityUnitBasis =
  | "flat"
  | "per_image"
  | "per_second"
  | "per_minute"
  | "per_1k_chars"
  | "per_50k_chars"
  | "per_1m_tokens";

export type ModelPricingRuntimeAuthorityQuantityDriver =
  | "generation_count"
  | "input_image_count"
  | "output_image_count"
  | "duration_seconds"
  | "source_duration_seconds"
  | "input_video_count"
  | "text_characters";

export type ModelPricingRuntimeAuthority = {
  mode: "runtime_quantity_derived";
  workflow: ModelPricingRuntimeAuthorityWorkflow;
  unitBasis: ModelPricingRuntimeAuthorityUnitBasis;
  quantityDrivers: ModelPricingRuntimeAuthorityQuantityDriver[];
};

export type ModelPricingRuntimeAuthorities = Partial<
  Record<ModelPricingRuntimeAuthorityWorkflow, ModelPricingRuntimeAuthority>
>;

export type ModelPricingPolicyDocument = {
  schemaVersion: 1 | 2 | 3 | 4;
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
  providerUsdOverride: number | null;
  providerUsdPerSecondOverride: number | null;
  billedCreditsOverride: number | null;
  variantId: string | null;
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
export const DEFAULT_MARKUP_BPS = 6_000;
export const DEFAULT_CREDIT_ROUNDING_MODE: CreditRoundingMode = "ceil";
export const DEFAULT_CREDIT_ROUNDING_INCREMENT = 1;
export const MODEL_PRICING_POLICY_SCHEMA_VERSION = 4;
export const MODEL_PRICING_POLICY_VERSION = "runtime-default-v4";

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

const asPositiveDecimal = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const asNonNegativeInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
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

const RUNTIME_AUTHORITY_WORKFLOWS = [
  "create_image",
  "edit_image",
  "video",
  "sound",
] as const satisfies ModelPricingRuntimeAuthorityWorkflow[];

const RUNTIME_AUTHORITY_UNIT_BASES = [
  "flat",
  "per_image",
  "per_second",
  "per_minute",
  "per_1k_chars",
  "per_50k_chars",
  "per_1m_tokens",
] as const satisfies ModelPricingRuntimeAuthorityUnitBasis[];

const RUNTIME_AUTHORITY_QUANTITY_DRIVERS = [
  "generation_count",
  "input_image_count",
  "output_image_count",
  "duration_seconds",
  "source_duration_seconds",
  "input_video_count",
  "text_characters",
] as const satisfies ModelPricingRuntimeAuthorityQuantityDriver[];

const isRuntimeAuthorityWorkflow = (value: string): value is ModelPricingRuntimeAuthorityWorkflow =>
  (RUNTIME_AUTHORITY_WORKFLOWS as readonly string[]).includes(value);

const isRuntimeAuthorityUnitBasis = (
  value: string
): value is ModelPricingRuntimeAuthorityUnitBasis =>
  (RUNTIME_AUTHORITY_UNIT_BASES as readonly string[]).includes(value);

const isRuntimeAuthorityQuantityDriver = (
  value: string
): value is ModelPricingRuntimeAuthorityQuantityDriver =>
  (RUNTIME_AUTHORITY_QUANTITY_DRIVERS as readonly string[]).includes(value);

const normalizeRuntimeAuthority = (value: unknown): ModelPricingRuntimeAuthority | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  if (record.mode !== "runtime_quantity_derived") return null;
  const workflow = typeof record.workflow === "string" ? record.workflow.trim() : "";
  const unitBasis = typeof record.unitBasis === "string" ? record.unitBasis.trim() : "";
  const quantityDrivers = Array.isArray(record.quantityDrivers)
    ? record.quantityDrivers
        .filter((driver): driver is string => typeof driver === "string")
        .map((driver) => driver.trim())
        .filter(isRuntimeAuthorityQuantityDriver)
    : [];

  if (
    !isRuntimeAuthorityWorkflow(workflow) ||
    !isRuntimeAuthorityUnitBasis(unitBasis) ||
    quantityDrivers.length === 0
  ) {
    return null;
  }

  return {
    mode: "runtime_quantity_derived",
    workflow,
    unitBasis,
    quantityDrivers: Array.from(new Set(quantityDrivers)),
  };
};

const normalizeRuntimeAuthorities = (value: unknown): ModelPricingRuntimeAuthorities | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  const normalized = Object.entries(record).reduce<ModelPricingRuntimeAuthorities>(
    (accumulator, [workflow, authority]) => {
      if (!isRuntimeAuthorityWorkflow(workflow)) return accumulator;
      const nextAuthority = normalizeRuntimeAuthority(authority);
      if (nextAuthority) {
        accumulator[workflow] = nextAuthority;
      }
      return accumulator;
    },
    {}
  );

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeVariantOverride = (value: unknown): ModelPricingVariantOverride | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  const markupBps = asInteger(record.markupBps);
  const legacyMultiplierBps = asInteger(record.multiplierBps);
  const creditUsdScale = asInteger(record.creditUsdScale);
  const roundingIncrement = asInteger(record.roundingIncrement);
  const providerUsdOverride = asPositiveDecimal(record.providerUsdOverride);
  const providerUsdPerSecondOverride = asPositiveDecimal(record.providerUsdPerSecondOverride);
  const billedCreditsOverride = asNonNegativeInteger(record.billedCreditsOverride);

  const normalized: ModelPricingVariantOverride = {};
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
  if (providerUsdOverride != null) {
    normalized.providerUsdOverride = providerUsdOverride;
  }
  if (providerUsdPerSecondOverride != null) {
    normalized.providerUsdPerSecondOverride = providerUsdPerSecondOverride;
  }
  if (billedCreditsOverride != null) {
    normalized.billedCreditsOverride = billedCreditsOverride;
  }

  return Object.keys(normalized).length ? normalized : null;
};

const normalizePerModelOverride = (value: unknown): ModelPricingPerModelOverride | null => {
  const record = asObjectRecord(value);
  if (!record) return null;

  const baseOverride = normalizeVariantOverride(value) ?? {};
  const runtimeAuthorities = normalizeRuntimeAuthorities(record.runtimeAuthorities);
  const variantsRecord = asObjectRecord(record.variants);
  const normalizedVariants = Object.entries(variantsRecord ?? {}).reduce<
    Record<string, ModelPricingVariantOverride>
  >((accumulator, [variantId, override]) => {
    const normalized = normalizeVariantOverride(override);
    if (normalized) {
      accumulator[variantId] = normalized;
    }
    return accumulator;
  }, {});

  const normalized: ModelPricingPerModelOverride = { ...baseOverride };
  if (runtimeAuthorities) {
    normalized.runtimeAuthorities = runtimeAuthorities;
  }
  if (Object.keys(normalizedVariants).length > 0) {
    normalized.variants = normalizedVariants;
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

    if (typeof override.providerUsdOverride === "number" && override.providerUsdOverride > 0) {
      nextOverride.providerUsdOverride = override.providerUsdOverride;
    }

    if (
      typeof override.providerUsdPerSecondOverride === "number" &&
      override.providerUsdPerSecondOverride > 0
    ) {
      nextOverride.providerUsdPerSecondOverride = override.providerUsdPerSecondOverride;
    }

    if (typeof override.billedCreditsOverride === "number" && override.billedCreditsOverride >= 0) {
      nextOverride.billedCreditsOverride = override.billedCreditsOverride;
    }

    if (override.runtimeAuthorities && Object.keys(override.runtimeAuthorities).length > 0) {
      nextOverride.runtimeAuthorities = override.runtimeAuthorities;
    }

    const compactedVariants = Object.entries(override.variants ?? {}).reduce<
      Record<string, ModelPricingVariantOverride>
    >((variantAccumulator, [variantId, variantOverride]) => {
      const nextVariantOverride: ModelPricingVariantOverride = {};

      if (
        typeof variantOverride.creditUsdScale === "number" &&
        variantOverride.creditUsdScale > 0 &&
        variantOverride.creditUsdScale !==
          (nextOverride.creditUsdScale ?? normalized.global.creditUsdScale)
      ) {
        nextVariantOverride.creditUsdScale = variantOverride.creditUsdScale;
      }

      if (
        typeof variantOverride.markupBps === "number" &&
        variantOverride.markupBps >= MIN_MARKUP_BPS
      ) {
        nextVariantOverride.markupBps = variantOverride.markupBps;
      }

      if (
        typeof variantOverride.roundingIncrement === "number" &&
        variantOverride.roundingIncrement > 0
      ) {
        nextVariantOverride.roundingIncrement = variantOverride.roundingIncrement;
      }

      if (
        typeof variantOverride.providerUsdOverride === "number" &&
        variantOverride.providerUsdOverride > 0
      ) {
        nextVariantOverride.providerUsdOverride = variantOverride.providerUsdOverride;
      }

      if (
        typeof variantOverride.providerUsdPerSecondOverride === "number" &&
        variantOverride.providerUsdPerSecondOverride > 0
      ) {
        nextVariantOverride.providerUsdPerSecondOverride =
          variantOverride.providerUsdPerSecondOverride;
      }

      if (
        typeof variantOverride.billedCreditsOverride === "number" &&
        variantOverride.billedCreditsOverride >= 0
      ) {
        nextVariantOverride.billedCreditsOverride = variantOverride.billedCreditsOverride;
      }

      if (Object.keys(nextVariantOverride).length > 0) {
        variantAccumulator[variantId] = nextVariantOverride;
      }
      return variantAccumulator;
    }, {});

    if (Object.keys(compactedVariants).length > 0) {
      nextOverride.variants = compactedVariants;
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
  left.roundingIncrement === right.roundingIncrement &&
  left.providerUsdOverride === right.providerUsdOverride &&
  left.providerUsdPerSecondOverride === right.providerUsdPerSecondOverride &&
  left.billedCreditsOverride === right.billedCreditsOverride &&
  JSON.stringify(left.runtimeAuthorities ?? {}) ===
    JSON.stringify(right.runtimeAuthorities ?? {}) &&
  JSON.stringify(left.variants ?? {}) === JSON.stringify(right.variants ?? {});

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
  modelId: string,
  variantId: string | null = null
): ResolvedModelPricingForModel => {
  const normalized = compactModelPricingPolicyDocument(policy);
  const override = normalized.perModel[modelId] ?? null;
  const variantOverride = variantId ? (override?.variants?.[variantId] ?? null) : null;
  const roundingIncrement =
    variantOverride?.roundingIncrement ??
    override?.roundingIncrement ??
    DEFAULT_CREDIT_ROUNDING_INCREMENT;

  return {
    creditUsdScale:
      variantOverride?.creditUsdScale ??
      override?.creditUsdScale ??
      normalized.global.creditUsdScale,
    markupBps: variantOverride?.markupBps ?? override?.markupBps ?? DEFAULT_MARKUP_BPS,
    roundingMode: roundingIncrement > 1 ? "nearest-5" : "ceil",
    roundingIncrement,
    providerUsdOverride:
      variantOverride?.providerUsdOverride ?? override?.providerUsdOverride ?? null,
    providerUsdPerSecondOverride:
      variantOverride?.providerUsdPerSecondOverride ??
      override?.providerUsdPerSecondOverride ??
      null,
    billedCreditsOverride:
      variantOverride?.billedCreditsOverride ?? override?.billedCreditsOverride ?? null,
    variantId,
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
    overrideCount: Object.values(normalized.perModel).reduce(
      (count, override) => count + 1 + Object.keys(override.variants ?? {}).length,
      0
    ),
    document: normalized,
  };
};
