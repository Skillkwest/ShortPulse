/**
 * Admin pricing custom-row manifest defaults, normalization, and equality helpers.
 * These rows add operator-authored display rows without changing pricing-policy math.
 */
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "./falModelIds";
import { getModelConfig } from "./modelRegistry";
import {
  buildModelPricingVariantId,
  resolveModelPricingVariantId,
  type ModelPricingVariantParts,
} from "./modelPricingVariants";
import type { ModelPricingPolicyDocument } from "./pricingPolicy";

export const ADMIN_PRICING_CUSTOM_ROWS_SCHEMA_VERSION = 1;

export type AdminPricingCustomRowSpec = ModelPricingVariantParts;

export type AdminPricingCustomRowOverrides = {
  markupBps: number | null;
  providerUsdOverride: number | null;
  providerUsdPerSecondOverride: number | null;
};

export type AdminPricingCustomRow = {
  displayRowId: string;
  label: string | null;
  variantId: string;
  spec: AdminPricingCustomRowSpec;
  overrides: AdminPricingCustomRowOverrides;
};

export type AdminPricingCustomRowsDocument = {
  schemaVersion: 1;
  rowsByModel: Record<string, AdminPricingCustomRow[]>;
};

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const asNullableBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asNullableInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveCustomRowVariantId = (
  modelId: string,
  spec: AdminPricingCustomRowSpec,
  fallbackVariantId: string | null
): string => {
  if (fallbackVariantId) return fallbackVariantId;
  if (!getModelConfig(modelId)) {
    return buildModelPricingVariantId(spec);
  }
  return resolveModelPricingVariantId({
    modelId,
    variantBaseId: spec.baseVariantId ?? undefined,
    aspect: spec.aspect ?? undefined,
    resolution: spec.resolution ?? undefined,
    audio: spec.audio ?? undefined,
    inputVideoCount: spec.videoInput == null ? undefined : spec.videoInput === true ? 1 : 0,
    inputImageCount: spec.inputImageCount ?? undefined,
    inputFidelity: spec.inputFidelity ?? undefined,
    maskPresent: spec.maskPresent ?? undefined,
  });
};

/**
 * Resolves a stored custom-row specification against a target pricing policy.
 * Generic document normalization intentionally preserves stored legacy ids.
 */
export const resolveAdminPricingCustomRowTargetVariantId = ({
  modelId,
  spec,
  pricingPolicy,
}: {
  modelId: string;
  spec: AdminPricingCustomRowSpec;
  pricingPolicy: ModelPricingPolicyDocument;
}): string =>
  getModelConfig(modelId)
    ? resolveModelPricingVariantId({
        modelId,
        variantBaseId: spec.baseVariantId ?? undefined,
        aspect: spec.aspect ?? undefined,
        resolution: spec.resolution ?? undefined,
        audio: spec.audio ?? undefined,
        inputVideoCount: spec.videoInput == null ? undefined : spec.videoInput === true ? 1 : 0,
        inputImageCount: spec.inputImageCount ?? undefined,
        inputFidelity: spec.inputFidelity ?? undefined,
        maskPresent: spec.maskPresent ?? undefined,
        pricingPolicy,
      })
    : buildModelPricingVariantId(spec);

const normalizeCustomRowSpec = (value: unknown): AdminPricingCustomRowSpec => {
  const record = asObjectRecord(value);
  const inputImageCount = asNullableInteger(record?.inputImageCount);
  return {
    baseVariantId: asNullableString(record?.baseVariantId),
    aspect: asNullableString(record?.aspect),
    resolution: asNullableString(record?.resolution),
    audio: asNullableBoolean(record?.audio),
    videoInput: asNullableBoolean(record?.videoInput),
    inputImageCount: inputImageCount != null ? Math.max(0, inputImageCount) : null,
    inputFidelity: asNullableString(record?.inputFidelity),
    maskPresent: asNullableBoolean(record?.maskPresent),
  };
};

const normalizeCustomRowOverrides = (value: unknown): AdminPricingCustomRowOverrides => {
  const record = asObjectRecord(value);
  return {
    markupBps: asNullableInteger(record?.markupBps),
    providerUsdOverride: asNullableNumber(record?.providerUsdOverride),
    providerUsdPerSecondOverride: asNullableNumber(record?.providerUsdPerSecondOverride),
  };
};

const normalizeCustomRow = (modelId: string, value: unknown): AdminPricingCustomRow | null => {
  const record = asObjectRecord(value);
  const displayRowId = asNullableString(record?.displayRowId);
  if (!displayRowId) return null;
  const spec = normalizeCustomRowSpec(record?.spec);
  const variantId = resolveCustomRowVariantId(modelId, spec, asNullableString(record?.variantId));
  return {
    displayRowId,
    label: asNullableString(record?.label),
    variantId,
    spec,
    overrides: normalizeCustomRowOverrides(record?.overrides),
  };
};

const createBuiltInFlux2KleinCustomRow = ({
  displayRowId,
  label,
  baseVariantId,
}: {
  displayRowId: string;
  label: string;
  baseVariantId: string;
}): AdminPricingCustomRow => {
  const spec: AdminPricingCustomRowSpec = {
    baseVariantId,
    aspect: "1:1",
    resolution: "model_default",
    audio: null,
    videoInput: null,
    inputImageCount: null,
    inputFidelity: null,
    maskPresent: null,
  };
  return {
    displayRowId,
    label,
    variantId: buildModelPricingVariantId(spec),
    spec,
    overrides: {
      markupBps: null,
      providerUsdOverride: null,
      providerUsdPerSecondOverride: null,
    },
  };
};

const cloneCustomRowsByModel = (
  rowsByModel: Record<string, AdminPricingCustomRow[]>
): Record<string, AdminPricingCustomRow[]> =>
  Object.fromEntries(
    Object.entries(rowsByModel).map(([modelId, rows]) => [
      modelId,
      rows.map((row) => ({
        ...row,
        spec: { ...row.spec },
        overrides: { ...row.overrides },
      })),
    ])
  );

/**
 * Returns the built-in custom-row manifest used before operator-authored rows are merged.
 */
export const getDefaultAdminPricingCustomRowsDocument = (): AdminPricingCustomRowsDocument => ({
  schemaVersion: ADMIN_PRICING_CUSTOM_ROWS_SCHEMA_VERSION,
  rowsByModel: cloneCustomRowsByModel({
    [FAL_FLUX_2_KLEIN_9B_MODEL_ID]: [
      createBuiltInFlux2KleinCustomRow({
        displayRowId: "builtin:flux-2-klein-audio-companion-art",
        label: "Sound reference background companion art",
        baseVariantId: FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
      }),
      createBuiltInFlux2KleinCustomRow({
        displayRowId: "builtin:flux-2-klein-style-preview",
        label: "Text-only style creation generation",
        baseVariantId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
      }),
    ],
  }),
});

/**
 * Normalizes unknown JSON into the canonical custom-row manifest shape.
 */
export const normalizeAdminPricingCustomRowsDocument = (
  value: unknown
): AdminPricingCustomRowsDocument => {
  const defaults = getDefaultAdminPricingCustomRowsDocument();
  const record = asObjectRecord(value);
  if (!record) return defaults;

  const rowsByModelRecord = asObjectRecord(record.rowsByModel);
  const rowsByModel = cloneCustomRowsByModel(defaults.rowsByModel);
  const mergeNormalizedRow = (modelId: string, normalizedRow: AdminPricingCustomRow) => {
    const rows = rowsByModel[modelId] ?? [];
    const existingIndex = rows.findIndex(
      (candidate) => candidate.displayRowId === normalizedRow.displayRowId
    );
    if (existingIndex >= 0) {
      rows[existingIndex] = normalizedRow;
    } else {
      rows.push(normalizedRow);
    }
    rowsByModel[modelId] = rows;
  };

  const seenInputDisplayRowIdsByModel = new Map<string, Set<string>>();
  Object.entries(rowsByModelRecord ?? {}).forEach(([modelId, rows]) => {
    if (!Array.isArray(rows)) return;
    const seenDisplayRowIds = seenInputDisplayRowIdsByModel.get(modelId) ?? new Set<string>();
    seenInputDisplayRowIdsByModel.set(modelId, seenDisplayRowIds);
    rows.forEach((row) => {
      const normalizedRow = normalizeCustomRow(modelId, row);
      if (!normalizedRow || seenDisplayRowIds.has(normalizedRow.displayRowId)) {
        return;
      }
      seenDisplayRowIds.add(normalizedRow.displayRowId);
      mergeNormalizedRow(modelId, normalizedRow);
    });
  });

  return {
    schemaVersion: ADMIN_PRICING_CUSTOM_ROWS_SCHEMA_VERSION,
    rowsByModel,
  };
};

/**
 * Compacts a manifest into its canonical persisted shape.
 */
export const compactAdminPricingCustomRowsDocument = (
  value: unknown
): AdminPricingCustomRowsDocument => normalizeAdminPricingCustomRowsDocument(value);

/**
 * Compares two manifests after normalization so draft-vs-live dirty checks stay stable.
 */
export const adminPricingCustomRowsDocumentsEqual = (
  left: AdminPricingCustomRowsDocument | null | undefined,
  right: AdminPricingCustomRowsDocument | null | undefined
): boolean => {
  if (!left || !right) return false;
  return (
    JSON.stringify(compactAdminPricingCustomRowsDocument(left)) ===
    JSON.stringify(compactAdminPricingCustomRowsDocument(right))
  );
};
