/**
 * Shared helpers for operator-authored admin pricing custom rows.
 * These rows extend workbook display while still resolving through the canonical pricing helpers.
 */
import type {
  AdminPricingCustomRow,
  AdminPricingCustomRowSpec,
  AdminPricingCustomRowsDocument,
} from "../../lib/model-runtime/adminPricingCustomRows";
import { getDefaultAdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import { resolveModelPricingVariantId } from "../../lib/model-runtime/modelPricingVariants";
import { shouldExpandVideoInputPricingVariants } from "../../lib/model-runtime/pricingGridVariantRules";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import {
  shouldShowAudioSpecControl,
  shouldShowAspectSpecControl,
  shouldShowResolutionSpecControl,
  type ModelPricingSortOption,
} from "./pricingDrafts";
import { buildDraftPricingPreviewVariants } from "./pricingCostDocs";
import { sortAdminPricingPreviewVariants } from "./pricingWorkbookMath";
import type { AdminPricingModelRow, AdminPricingPreviewVariant } from "./types";

export type AdminPricingMergedPreviewVariantRow = {
  displayRowId: string;
  isCustomRow: boolean;
  customRow: AdminPricingCustomRow | null;
  variant: AdminPricingPreviewVariant;
};

export type AdminPricingCustomRowDraft = {
  baseVariantId: string | null;
  aspect: string | null;
  resolution: string | null;
  audio: boolean | null;
  videoInput: boolean | null;
};

export type AdminPricingCustomRowBaseOption = {
  value: string;
  label: string;
};

export type AdminPricingCustomRowSpecOptions = {
  baseOptions: AdminPricingCustomRowBaseOption[];
  aspectOptions: Array<{ value: string | null; label: string }>;
  resolutionOptions: Array<{ value: string | null; label: string }>;
  audioOptions: Array<{ value: boolean | null; label: string }>;
  videoInputOptions: Array<{ value: boolean | null; label: string }>;
};

const getDraftAspectOptions = (model: AdminPricingModelRow): Array<string | null> =>
  shouldShowAspectSpecControl(model)
    ? Array.from(new Set([model.defaultAspect, ...(model.allowedAspects ?? [])])).filter(
        (value): value is string => Boolean(value)
      )
    : [null];

const getDraftResolutionOptions = (model: AdminPricingModelRow): Array<string | null> =>
  shouldShowResolutionSpecControl(model)
    ? Array.from(new Set([model.defaultResolution ?? null, ...(model.allowedResolutions ?? [])]))
    : [null];

const getDraftAudioOptions = (model: AdminPricingModelRow): Array<boolean | null> =>
  shouldShowAudioSpecControl(model)
    ? [model.defaultAudio ?? true, !(model.defaultAudio ?? true)]
    : [null];

const getDraftVideoInputOptions = (model: AdminPricingModelRow): Array<boolean | null> =>
  shouldExpandVideoInputPricingVariants(model.pricingStrategy) ? [false, true] : [null];

const getUniqueBaseVariantOptions = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument
): AdminPricingCustomRowBaseOption[] => {
  const variants = buildDraftPricingPreviewVariants(model, pricingPolicy);
  const seen = new Set<string>();
  const options: AdminPricingCustomRowBaseOption[] = [];
  for (const variant of variants) {
    const baseVariantId = variant.id.split("|")[0] ?? "default";
    if (seen.has(baseVariantId)) continue;
    seen.add(baseVariantId);
    options.push({
      value: baseVariantId,
      label: variant.label,
    });
  }
  if (!options.length) {
    options.push({
      value: "default",
      label: "Default",
    });
  }
  return options;
};

export const buildAdminPricingCustomRowBaseOptions = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument
): AdminPricingCustomRowBaseOption[] => getUniqueBaseVariantOptions(model, pricingPolicy);

export const canAddAdminPricingCustomRow = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument
): boolean =>
  model.pricingAuthority === "shared_policy" &&
  buildDraftPricingPreviewVariants(model, pricingPolicy).length > 0;

export const buildAdminPricingCustomRowSpecOptions = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument
): AdminPricingCustomRowSpecOptions => ({
  baseOptions: getUniqueBaseVariantOptions(model, pricingPolicy),
  aspectOptions: getDraftAspectOptions(model).map((value) => ({
    value,
    label: value ?? "Default aspect",
  })),
  resolutionOptions: getDraftResolutionOptions(model).map((value) => ({
    value,
    label: value ?? "Default resolution",
  })),
  audioOptions: getDraftAudioOptions(model).map((value) => ({
    value,
    label: value == null ? "Default audio" : value ? "Audio on" : "Audio off",
  })),
  videoInputOptions: getDraftVideoInputOptions(model).map((value) => ({
    value,
    label: value == null ? "Default input" : value ? "With video input" : "No video input",
  })),
});

export const buildDefaultAdminPricingCustomRowDraft = ({
  model,
  pricingPolicy,
}: {
  model: AdminPricingModelRow;
  pricingPolicy: ModelPricingPolicyDocument;
}): AdminPricingCustomRowDraft =>
  buildAllAdminPricingCustomRowDrafts({
    model,
    pricingPolicy,
  })[0] ?? {
    baseVariantId: getUniqueBaseVariantOptions(model, pricingPolicy)[0]?.value ?? "default",
    aspect: shouldShowAspectSpecControl(model) ? model.defaultAspect : null,
    resolution: shouldShowResolutionSpecControl(model) ? (model.defaultResolution ?? null) : null,
    audio: shouldShowAudioSpecControl(model) ? (model.defaultAudio ?? true) : null,
    videoInput: shouldExpandVideoInputPricingVariants(model.pricingStrategy) ? false : null,
  };

const buildAllAdminPricingCustomRowDrafts = ({
  model,
  pricingPolicy,
}: {
  model: AdminPricingModelRow;
  pricingPolicy: ModelPricingPolicyDocument;
}): AdminPricingCustomRowDraft[] => {
  const baseOptions = getUniqueBaseVariantOptions(model, pricingPolicy);
  const aspectOptions = getDraftAspectOptions(model);
  const resolutionOptions = getDraftResolutionOptions(model);
  const audioOptions = getDraftAudioOptions(model);
  const videoInputOptions = getDraftVideoInputOptions(model);
  return baseOptions.flatMap((baseOption) =>
    aspectOptions.flatMap((aspect) =>
      resolutionOptions.flatMap((resolution) =>
        audioOptions.flatMap((audio) =>
          videoInputOptions.map((videoInput) => ({
            baseVariantId: baseOption.value,
            aspect,
            resolution,
            audio,
            videoInput,
          }))
        )
      )
    )
  );
};

const resolveCustomRowVariantId = ({
  model,
  draft,
}: {
  model: AdminPricingModelRow;
  draft: AdminPricingCustomRowDraft;
}): string =>
  resolveModelPricingVariantId({
    modelId: model.id,
    variantBaseId: draft.baseVariantId ?? undefined,
    aspect: draft.aspect ?? undefined,
    resolution: draft.resolution ?? undefined,
    audio: draft.audio ?? undefined,
    inputVideoCount: draft.videoInput == null ? undefined : draft.videoInput === true ? 1 : 0,
    ...(draft.baseVariantId === "edit"
      ? {
          inputImageCount: 1,
          inputFidelity: "high",
          maskPresent: false,
        }
      : {}),
  });

export const resolveAdminPricingCustomRowCandidate = ({
  model,
  pricingPolicy,
  draft,
}: {
  model: AdminPricingModelRow;
  pricingPolicy: ModelPricingPolicyDocument;
  draft: AdminPricingCustomRowDraft;
}): { variantId: string; variant: AdminPricingPreviewVariant } | null => {
  const variantId = resolveCustomRowVariantId({ model, draft });
  const variant =
    buildDraftPricingPreviewVariants(model, pricingPolicy, {
      aspect: draft.aspect ?? undefined,
      resolution: draft.resolution ?? undefined,
      audio: draft.audio ?? undefined,
      videoInput: draft.videoInput ?? undefined,
    }).find((candidate) => candidate.id === variantId) ?? null;
  return variant ? { variantId, variant } : null;
};

export const buildAdminPricingCustomRowSpec = (
  draft: AdminPricingCustomRowDraft
): AdminPricingCustomRowSpec => ({
  baseVariantId: draft.baseVariantId,
  aspect: draft.aspect,
  resolution: draft.resolution,
  audio: draft.audio,
  videoInput: draft.videoInput,
  inputImageCount: draft.baseVariantId === "edit" ? 1 : null,
  inputFidelity: draft.baseVariantId === "edit" ? "high" : null,
  maskPresent: draft.baseVariantId === "edit" ? false : null,
});

export const buildMergedPricingPreviewVariants = ({
  model,
  pricingPolicy,
  customRowsDocument = getDefaultAdminPricingCustomRowsDocument(),
  usageAmount = null,
}: {
  model: AdminPricingModelRow;
  pricingPolicy: ModelPricingPolicyDocument;
  customRowsDocument?: AdminPricingCustomRowsDocument | null;
  usageAmount?: number | null;
}): AdminPricingMergedPreviewVariantRow[] => {
  const builtInVariants = buildDraftPricingPreviewVariants(model, pricingPolicy, {
    usageAmount,
  });
  const rows: AdminPricingMergedPreviewVariantRow[] = builtInVariants.map((variant) => ({
    displayRowId: `builtin:${variant.id}`,
    isCustomRow: false,
    customRow: null,
    variant,
  }));
  const customRows =
    (customRowsDocument ?? getDefaultAdminPricingCustomRowsDocument()).rowsByModel[model.id] ?? [];

  for (const customRow of customRows) {
    const variant =
      buildDraftPricingPreviewVariants(model, pricingPolicy, {
        usageAmount,
        aspect: customRow.spec.aspect ?? undefined,
        resolution: customRow.spec.resolution ?? undefined,
        audio: customRow.spec.audio ?? undefined,
        videoInput: customRow.spec.videoInput ?? undefined,
      }).find((candidate) => candidate.id === customRow.variantId) ?? null;
    if (!variant) continue;
    rows.push({
      displayRowId: customRow.displayRowId,
      isCustomRow: true,
      customRow,
      variant,
    });
  }

  return rows;
};

export const sortMergedPricingPreviewVariantRows = ({
  model,
  rows,
  sortOption,
}: {
  model: AdminPricingModelRow;
  rows: AdminPricingMergedPreviewVariantRow[];
  sortOption?: ModelPricingSortOption;
}): AdminPricingMergedPreviewVariantRow[] => {
  if (!sortOption || sortOption === "model_asc" || sortOption === "model_desc") {
    return rows;
  }

  const sortPartition = (
    partition: AdminPricingMergedPreviewVariantRow[]
  ): AdminPricingMergedPreviewVariantRow[] => {
    const sortedVariants = sortAdminPricingPreviewVariants({
      model,
      variants: partition.map((row) => row.variant),
      sortOption,
    });
    return sortedVariants
      .map((variant) => partition.find((row) => row.variant.id === variant?.id) ?? null)
      .filter((row): row is AdminPricingMergedPreviewVariantRow => row !== null);
  };

  const builtInRows = rows.filter((row) => !row.isCustomRow);
  const customRows = rows.filter((row) => row.isCustomRow);
  return [...sortPartition(builtInRows), ...sortPartition(customRows)];
};
