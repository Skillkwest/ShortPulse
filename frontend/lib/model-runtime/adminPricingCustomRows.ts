/**
 * Admin pricing custom-row manifest defaults, normalization, and equality helpers.
 * These rows add operator-authored display rows without changing pricing-policy math.
 */
import { getModelConfig } from "./modelRegistry";
import {
  buildModelPricingVariantId,
  resolveModelPricingVariantId,
  type ModelPricingVariantParts,
} from "./modelPricingVariants";

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
  if (!getModelConfig(modelId)) {
    return fallbackVariantId ?? buildModelPricingVariantId(spec);
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

/**
 * Returns the empty custom-row manifest used when no operator-authored rows exist.
 */
export const getDefaultAdminPricingCustomRowsDocument = (): AdminPricingCustomRowsDocument => ({
  schemaVersion: ADMIN_PRICING_CUSTOM_ROWS_SCHEMA_VERSION,
  rowsByModel: {},
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
  const rowsByModel = Object.entries(rowsByModelRecord ?? {}).reduce<
    Record<string, AdminPricingCustomRow[]>
  >((accumulator, [modelId, rows]) => {
    if (!Array.isArray(rows)) return accumulator;
    const seenDisplayRowIds = new Set<string>();
    const normalizedRows = rows.reduce<AdminPricingCustomRow[]>((nextRows, row) => {
      const normalizedRow = normalizeCustomRow(modelId, row);
      if (!normalizedRow || seenDisplayRowIds.has(normalizedRow.displayRowId)) {
        return nextRows;
      }
      seenDisplayRowIds.add(normalizedRow.displayRowId);
      nextRows.push(normalizedRow);
      return nextRows;
    }, []);
    if (normalizedRows.length > 0) {
      accumulator[modelId] = normalizedRows;
    }
    return accumulator;
  }, {});

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
