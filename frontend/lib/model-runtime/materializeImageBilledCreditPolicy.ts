import { buildDefaultPricingParams, listPricingModelConfigs } from "./pricing";
import { resolveModelPricingVariantId } from "./modelPricingVariants";
import type { ModelConfig } from "./modelRegistry";
import {
  getDefaultAdminPricingCustomRowsDocument,
  resolveAdminPricingCustomRowTargetVariantId,
  type AdminPricingCustomRowsDocument,
} from "./adminPricingCustomRows";
import { normalizeCreateImageBilledPricingParams } from "./createImageBilledCredits";
import {
  compactModelPricingPolicyDocument,
  resolveModelBillingVariantProfile,
  resolveModelPricingForModel,
  type ModelPricingBilledCreditsQuantityRule,
  type ModelPricingPerModelOverride,
  type ModelPricingPolicyDocument,
  type ModelPricingVariantOverride,
} from "./pricingPolicy";
import { resolvePricingGridCostBreakdown } from "./pricingGridBilledCredits";
import {
  resolvePricingGridAspectOptions,
  shouldExpandAspectPricingVariants,
  shouldExpandCustomerVideoInputPricingVariants,
  shouldExpandResolutionPricingVariants,
} from "./pricingGridVariantRules";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "./providerModelIds";
import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "./klingMotionControlPricing";
import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
} from "./elevenLabsModels";

type ImageVariantBase = { editLike: boolean };

export class IncompletePublishedPricingPolicyError extends Error {
  readonly missingPublishedRows: string[];
  readonly missingCustomRows: string[];

  constructor({
    missingPublishedRows,
    missingCustomRows,
  }: {
    missingPublishedRows: string[];
    missingCustomRows: string[];
  }) {
    super(
      [
        missingPublishedRows.length
          ? `Missing published pricing rows for: ${missingPublishedRows.join(", ")}.`
          : null,
        missingCustomRows.length
          ? `Missing published custom pricing rows for: ${missingCustomRows.join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    this.name = "IncompletePublishedPricingPolicyError";
    this.missingPublishedRows = missingPublishedRows;
    this.missingCustomRows = missingCustomRows;
  }
}

export class InvalidPublishedPricingCustomRowsError extends Error {
  readonly conflicts: string[];

  constructor(conflicts: string[]) {
    super(`Invalid pricing custom-row migration: ${conflicts.join(", ")}.`);
    this.name = "InvalidPublishedPricingCustomRowsError";
    this.conflicts = conflicts;
  }
}

const orderWithDefaultFirst = <T extends string | null>(values: T[], defaultValue: T): T[] => {
  const ordered: T[] = [];
  if (values.some((value) => value === defaultValue)) {
    ordered.push(defaultValue);
  }
  values.forEach((value) => {
    if (!ordered.some((existing) => existing === value)) {
      ordered.push(value);
    }
  });
  return ordered.length ? ordered : [defaultValue];
};

const buildAspectOptions = (model: ModelConfig): string[] => {
  if (!shouldExpandAspectPricingVariants(model.pricingStrategy)) {
    return model.defaultAspect ? [model.defaultAspect] : [];
  }
  return orderWithDefaultFirst(
    resolvePricingGridAspectOptions({
      pricingStrategy: model.pricingStrategy,
      allowedAspects: model.allowedAspects,
      defaultAspect: model.defaultAspect,
    }),
    model.defaultAspect ?? null
  ).filter((value): value is string => Boolean(value));
};

const buildResolutionOptions = (model: ModelConfig): Array<string | null> => {
  if (!shouldExpandResolutionPricingVariants(model.pricingStrategy)) {
    return [model.defaultResolution ?? null];
  }
  return orderWithDefaultFirst(
    model.allowedResolutions?.length ? model.allowedResolutions : [model.defaultResolution ?? null],
    model.defaultResolution ?? null
  );
};

const buildImageVariantBases = (model: ModelConfig): ImageVariantBase[] => {
  if (model.mediaType !== "image") return [];
  const variantBases: ImageVariantBase[] = [];
  if (model.supportsTextToImage) {
    variantBases.push({ editLike: false });
  }
  if (model.supportsImageToImage) {
    variantBases.push({ editLike: true });
  }
  return variantBases;
};

const mergeVariantOverride = (
  override: ModelPricingPerModelOverride | undefined,
  variantId: string,
  billedCreditsOverride: number
): ModelPricingPerModelOverride => {
  const existingVariants = override?.variants ?? {};
  const existingVariant = existingVariants[variantId] ?? {};
  const nextVariant: ModelPricingVariantOverride = {
    ...existingVariant,
    billedCreditsOverride,
  };
  return {
    ...(override ?? {}),
    variants: {
      ...existingVariants,
      [variantId]: nextVariant,
    },
  };
};

const mergeCustomRowOverrides = (
  override: ModelPricingPerModelOverride | undefined,
  variantId: string,
  customOverrides: AdminPricingCustomRowsDocument["rowsByModel"][string][number]["overrides"]
): ModelPricingPerModelOverride => {
  const existingVariants = override?.variants ?? {};
  const existingVariant = { ...(existingVariants[variantId] ?? {}) };
  delete existingVariant.billedCreditsOverride;
  delete existingVariant.billedCreditsQuantityRule;
  delete existingVariant.markupBps;
  delete existingVariant.providerUsdOverride;
  delete existingVariant.providerUsdPerSecondOverride;
  const nextVariant: ModelPricingVariantOverride = {
    ...existingVariant,
    ...(customOverrides.markupBps != null ? { markupBps: customOverrides.markupBps } : {}),
    ...(customOverrides.providerUsdOverride != null
      ? { providerUsdOverride: customOverrides.providerUsdOverride }
      : {}),
    ...(customOverrides.providerUsdPerSecondOverride != null
      ? { providerUsdPerSecondOverride: customOverrides.providerUsdPerSecondOverride }
      : {}),
  };
  return {
    ...(override ?? {}),
    variants: {
      ...existingVariants,
      [variantId]: nextVariant,
    },
  };
};

const mergePublishedQuantityPricing = (
  override: ModelPricingPerModelOverride | undefined,
  variantId: string,
  input:
    | { billedCreditsOverride: number }
    | { billedCreditsQuantityRule: ModelPricingBilledCreditsQuantityRule }
): ModelPricingPerModelOverride => {
  const existingVariants = override?.variants ?? {};
  const existingVariant = { ...(existingVariants[variantId] ?? {}) };
  delete existingVariant.billedCreditsOverride;
  delete existingVariant.billedCreditsQuantityRule;
  return {
    ...(override ?? {}),
    variants: {
      ...existingVariants,
      [variantId]: {
        ...existingVariant,
        ...input,
      },
    },
  };
};

const resolvePublishedQuantityRule = ({
  breakdown,
  quantity,
  resolved,
  quantityBasis,
}: {
  breakdown: { usdRaw: number };
  quantity: number;
  resolved: ReturnType<typeof resolveModelPricingForModel>;
  quantityBasis: "per_second" | "per_output_second" | "per_1k_chars";
}): ModelPricingBilledCreditsQuantityRule => ({
  costCreditsPerUnit: Number(((breakdown.usdRaw / quantity) * resolved.creditUsdScale).toFixed(12)),
  markupBps: resolved.markupBps,
  roundingIncrement: resolved.roundingIncrement,
  quantityBasis,
});

const stripPublishedBilledCreditOverrides = (
  policy: ModelPricingPolicyDocument
): ModelPricingPolicyDocument => ({
  ...policy,
  perModel: Object.fromEntries(
    Object.entries(policy.perModel).map(([modelId, override]) => {
      const authoringOverride: ModelPricingPerModelOverride = { ...override };
      delete authoringOverride.billedCreditsOverride;
      delete authoringOverride.billedCreditsQuantityRule;
      if (override.variants) {
        authoringOverride.variants = Object.fromEntries(
          Object.entries(override.variants).map(([variantId, variantOverride]) => {
            const authoringVariant: ModelPricingVariantOverride = { ...variantOverride };
            delete authoringVariant.billedCreditsOverride;
            delete authoringVariant.billedCreditsQuantityRule;
            return [variantId, authoringVariant];
          })
        );
      }
      return [modelId, authoringOverride];
    })
  ),
});

/**
 * Produces a runtime-only policy document where billed credits are materialized
 * per pricing-grid variant for strict runtime paths. This preserves Scott's
 * admin pricing page as the calculator/authoring surface while letting product
 * runtime paths consume explicit billed-credit rows instead of falling back to
 * shared-policy math.
 */
export const materializeImageBilledCreditPolicy = (
  policy: ModelPricingPolicyDocument | null | undefined,
  customRowsDocument: AdminPricingCustomRowsDocument = getDefaultAdminPricingCustomRowsDocument(),
  options: { requireComplete?: boolean } = {}
): ModelPricingPolicyDocument => {
  const normalized = stripPublishedBilledCreditOverrides(compactModelPricingPolicyDocument(policy));
  const nextPolicy: ModelPricingPolicyDocument = {
    ...normalized,
    perModel: { ...normalized.perModel },
  };

  const pricingModels = listPricingModelConfigs();
  const requiredPublishedRows = new Map<string, { modelId: string; variantId: string }>();
  const recordRequiredPublishedRow = (modelId: string, variantId: string) => {
    requiredPublishedRows.set(`${modelId}:${variantId}`, { modelId, variantId });
  };
  const resolvedCustomVariantIds = new Map<string, string>();
  const resolveCustomVariantId = (
    modelId: string,
    row: AdminPricingCustomRowsDocument["rowsByModel"][string][number]
  ): string => {
    const rowKey = `${modelId}:${row.displayRowId}`;
    const existing = resolvedCustomVariantIds.get(rowKey);
    if (existing) return existing;
    const isCompositionNeutral =
      resolveModelBillingVariantProfile(normalized, modelId) === "seedance_composition_neutral_v1";
    if (isCompositionNeutral && row.spec.videoInput != null) {
      throw new InvalidPublishedPricingCustomRowsError([
        `${rowKey} retains legacy video-input semantics`,
      ]);
    }
    const variantId = isCompositionNeutral
      ? resolveAdminPricingCustomRowTargetVariantId({
          modelId,
          spec: row.spec,
          pricingPolicy: normalized,
        })
      : row.variantId;
    const duplicate = [...resolvedCustomVariantIds.entries()].find(
      ([key, candidate]) => key.startsWith(`${modelId}:`) && candidate === variantId
    );
    if (duplicate) {
      throw new InvalidPublishedPricingCustomRowsError([
        `${rowKey} and ${duplicate[0]} target ${variantId}`,
      ]);
    }
    if (requiredPublishedRows.has(`${modelId}:${variantId}`)) {
      throw new InvalidPublishedPricingCustomRowsError([
        `${rowKey} collides with built-in ${variantId}`,
      ]);
    }
    resolvedCustomVariantIds.set(rowKey, variantId);
    return variantId;
  };
  pricingModels.forEach((model) => {
    if (model.mediaType !== "image") return;
    const variantBases = buildImageVariantBases(model);
    if (!variantBases.length) return;
    const aspects = buildAspectOptions(model);
    const resolutions = buildResolutionOptions(model);

    variantBases.forEach((variantBase) => {
      aspects.forEach((aspect) => {
        resolutions.forEach((resolution) => {
          const params = normalizeCreateImageBilledPricingParams(
            model.id,
            buildDefaultPricingParams(model.id, {
              ...(aspect ? { aspect } : {}),
              ...(resolution ? { resolution } : {}),
              ...(variantBase.editLike
                ? {
                    inputImageCount: 1,
                    inputFidelity: "high" as const,
                  }
                : {}),
            })
          );
          const variantId = resolveModelPricingVariantId({
            modelId: model.id,
            ...params,
          });
          recordRequiredPublishedRow(model.id, variantId);

          const breakdown = resolvePricingGridCostBreakdown({
            modelId: model.id,
            params,
            pricingPolicy: normalized,
          });
          if (!breakdown?.credits || breakdown.credits <= 0) return;

          nextPolicy.perModel[model.id] = mergeVariantOverride(
            nextPolicy.perModel[model.id],
            variantId,
            breakdown.credits
          );
        });
      });
    });

    const activeCustomRows = customRowsDocument.rowsByModel[model.id] ?? [];
    activeCustomRows.forEach((row) => {
      const customVariantId = resolveCustomVariantId(model.id, row);
      const rowModelOverride = mergeCustomRowOverrides(
        nextPolicy.perModel[model.id],
        customVariantId,
        row.overrides
      );
      const rowPolicy: ModelPricingPolicyDocument = {
        ...nextPolicy,
        perModel: {
          ...nextPolicy.perModel,
          [model.id]: rowModelOverride,
        },
      };
      const params = normalizeCreateImageBilledPricingParams(
        model.id,
        buildDefaultPricingParams(model.id, {
          variantBaseId: row.spec.baseVariantId ?? undefined,
          aspect: row.spec.aspect ?? undefined,
          resolution: row.spec.resolution ?? undefined,
          audio: row.spec.audio ?? undefined,
          inputVideoCount:
            row.spec.videoInput == null ? undefined : row.spec.videoInput === true ? 1 : 0,
          inputImageCount: row.spec.inputImageCount ?? undefined,
          inputFidelity: row.spec.inputFidelity ?? undefined,
          maskPresent: row.spec.maskPresent ?? undefined,
        })
      );

      const breakdown = resolvePricingGridCostBreakdown({
        modelId: model.id,
        params,
        pricingPolicy: rowPolicy,
      });
      if (!breakdown?.credits || breakdown.credits <= 0) return;

      nextPolicy.perModel[model.id] = mergeVariantOverride(
        rowModelOverride,
        customVariantId,
        breakdown.credits
      );
    });
  });

  pricingModels.forEach((model) => {
    if (!model.mediaType.toLowerCase().includes("video")) return;
    const resolutions = buildResolutionOptions(model);
    const audioOptions =
      model.defaultAudio == null ||
      ["seedance-2-per-second", "seedance-2-fast-per-second"].includes(model.pricingStrategy ?? "")
        ? [null]
        : [true, false];
    const expandsCustomerVideoInput = shouldExpandCustomerVideoInputPricingVariants({
      modelId: model.id,
      pricingStrategy: model.pricingStrategy,
      pricingPolicy: normalized,
    });
    const videoInputOptions = expandsCustomerVideoInput ? [false, true] : [null];
    const variantBaseIds =
      model.id === KIE_KLING_30_MODEL_ID
        ? ["default", KIE_KLING_30_MOTION_CONTROL_VARIANT_ID]
        : ["default"];

    variantBaseIds.forEach((variantBaseId) => {
      resolutions.forEach((resolution) => {
        audioOptions.forEach((audio) => {
          videoInputOptions.forEach((videoInput) => {
            const durationSeconds = model.defaultDurationSeconds ?? 1;
            const inputVideoDurationSeconds = videoInput === true ? durationSeconds : null;
            const params = buildDefaultPricingParams(model.id, {
              variantBaseId,
              ...(resolution ? { resolution } : {}),
              ...(audio != null ? { audio } : {}),
              ...(videoInput != null ? { inputVideoCount: videoInput ? 1 : 0 } : {}),
              ...(inputVideoDurationSeconds != null ? { inputVideoDurationSeconds } : {}),
              durationSeconds,
            });
            const expectedVariantId = resolveModelPricingVariantId({
              modelId: model.id,
              ...params,
              pricingPolicy: normalized,
            });
            recordRequiredPublishedRow(model.id, expectedVariantId);
            const breakdown = resolvePricingGridCostBreakdown({
              modelId: model.id,
              params,
              pricingPolicy: normalized,
            });
            if (!breakdown || breakdown.usdRaw <= 0) return;
            const variantId = breakdown.variantId;
            const resolved = resolveModelPricingForModel(nextPolicy, model.id, variantId);
            if (
              resolved.billedCreditsOverride != null ||
              resolved.billedCreditsQuantityRule != null
            ) {
              return;
            }

            const isFlatPerGeneration = model.id === KIE_VEO_31_FAST_I2V_MODEL_ID;
            const billableSeconds = expandsCustomerVideoInput
              ? durationSeconds + (inputVideoDurationSeconds ?? 0)
              : durationSeconds;
            nextPolicy.perModel[model.id] = mergePublishedQuantityPricing(
              nextPolicy.perModel[model.id],
              variantId,
              isFlatPerGeneration
                ? { billedCreditsOverride: breakdown.credits }
                : {
                    billedCreditsQuantityRule: resolvePublishedQuantityRule({
                      breakdown,
                      quantity: billableSeconds,
                      resolved,
                      quantityBasis: expandsCustomerVideoInput ? "per_second" : "per_output_second",
                    }),
                  }
            );
          });
        });
      });
    });

    const activeCustomRows = customRowsDocument.rowsByModel[model.id] ?? [];
    activeCustomRows.forEach((row) => {
      const customVariantId = resolveCustomVariantId(model.id, row);
      const rowModelOverride = mergeCustomRowOverrides(
        nextPolicy.perModel[model.id],
        customVariantId,
        row.overrides
      );
      const rowPolicy: ModelPricingPolicyDocument = {
        ...nextPolicy,
        perModel: {
          ...nextPolicy.perModel,
          [model.id]: rowModelOverride,
        },
      };
      const durationSeconds = model.defaultDurationSeconds ?? 1;
      const hasVideoInput = row.spec.videoInput === true;
      const inputVideoDurationSeconds = hasVideoInput ? durationSeconds : null;
      const params = buildDefaultPricingParams(model.id, {
        variantBaseId: row.spec.baseVariantId ?? undefined,
        aspect: row.spec.aspect ?? undefined,
        resolution: row.spec.resolution ?? undefined,
        audio: row.spec.audio ?? undefined,
        inputVideoCount:
          row.spec.videoInput == null ? undefined : row.spec.videoInput === true ? 1 : 0,
        ...(inputVideoDurationSeconds != null ? { inputVideoDurationSeconds } : {}),
        durationSeconds,
      });
      const breakdown = resolvePricingGridCostBreakdown({
        modelId: model.id,
        params,
        pricingPolicy: rowPolicy,
      });
      if (!breakdown || breakdown.usdRaw <= 0) return;
      const resolved = resolveModelPricingForModel(rowPolicy, model.id, customVariantId);
      if (resolved.billedCreditsOverride != null || resolved.billedCreditsQuantityRule != null) {
        return;
      }
      const isFlatPerGeneration = model.id === KIE_VEO_31_FAST_I2V_MODEL_ID;
      const billableSeconds = expandsCustomerVideoInput
        ? durationSeconds + (inputVideoDurationSeconds ?? 0)
        : durationSeconds;
      nextPolicy.perModel[model.id] = mergePublishedQuantityPricing(
        rowModelOverride,
        customVariantId,
        isFlatPerGeneration
          ? { billedCreditsOverride: breakdown.credits }
          : {
              billedCreditsQuantityRule: resolvePublishedQuantityRule({
                breakdown,
                quantity: billableSeconds,
                resolved,
                quantityBasis: expandsCustomerVideoInput ? "per_second" : "per_output_second",
              }),
            }
      );
    });
  });

  pricingModels.forEach((model) => {
    if (model.mediaType !== "audio") return;
    const candidates: Array<{
      params: ReturnType<typeof buildDefaultPricingParams>;
      rateBasis: "flat" | "per_second" | "per_1k_chars";
      quantity: number;
    }> = [];
    if (model.id === ELEVENLABS_MUSIC_MODEL_ID) {
      const durationSeconds = model.defaultDurationSeconds ?? 60;
      candidates.push({
        params: buildDefaultPricingParams(model.id, { durationSeconds }),
        rateBasis: "per_second",
        quantity: durationSeconds,
      });
    } else if (model.id === ELEVENLABS_VOICE_CHANGER_MODEL_ID) {
      const sourceDurationSeconds = model.defaultSourceDurationSeconds ?? 60;
      candidates.push({
        params: buildDefaultPricingParams(model.id, { sourceDurationSeconds }),
        rateBasis: "per_second",
        quantity: sourceDurationSeconds,
      });
    } else if (model.id === ELEVENLABS_VOICEOVER_MODEL_ID) {
      candidates.push({
        params: buildDefaultPricingParams(model.id, { textCharacters: 1_000 }),
        rateBasis: "per_1k_chars",
        quantity: 1,
      });
    } else if (model.id === ELEVENLABS_SOUND_EFFECTS_MODEL_ID) {
      candidates.push(
        {
          params: buildDefaultPricingParams(model.id, {
            variantBaseId: ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
            generationCount: 1,
          }),
          rateBasis: "flat",
          quantity: 1,
        },
        {
          params: buildDefaultPricingParams(model.id, {
            variantBaseId: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
            durationSeconds: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS,
          }),
          rateBasis: "per_second",
          quantity: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS,
        }
      );
    }

    candidates.forEach(({ params, rateBasis, quantity }) => {
      const expectedVariantId = resolveModelPricingVariantId({
        modelId: model.id,
        ...params,
        pricingPolicy: normalized,
      });
      recordRequiredPublishedRow(model.id, expectedVariantId);
      const breakdown = resolvePricingGridCostBreakdown({
        modelId: model.id,
        params,
        pricingPolicy: normalized,
      });
      if (!breakdown || breakdown.usdRaw <= 0) return;
      const variantId = breakdown.variantId;
      const resolved = resolveModelPricingForModel(nextPolicy, model.id, variantId);
      if (resolved.billedCreditsOverride != null || resolved.billedCreditsQuantityRule != null) {
        return;
      }
      nextPolicy.perModel[model.id] = mergePublishedQuantityPricing(
        nextPolicy.perModel[model.id],
        variantId,
        rateBasis === "flat"
          ? { billedCreditsOverride: breakdown.credits }
          : {
              billedCreditsQuantityRule: resolvePublishedQuantityRule({
                breakdown,
                quantity,
                resolved,
                quantityBasis: rateBasis,
              }),
            }
      );
    });
  });

  const publishedPolicy = compactModelPricingPolicyDocument(nextPolicy);
  if (options.requireComplete) {
    const missingPublishedRows = [...requiredPublishedRows.values()]
      .filter(({ modelId, variantId }) => {
        const published = publishedPolicy.perModel[modelId]?.variants?.[variantId];
        return !(
          published?.billedCreditsOverride != null || published?.billedCreditsQuantityRule != null
        );
      })
      .map(({ modelId, variantId }) => `${modelId}:${variantId}`);
    const missingCustomRows = Object.entries(customRowsDocument.rowsByModel).flatMap(
      ([modelId, rows]) =>
        rows
          .filter((row) => {
            const variantId = resolveCustomVariantId(modelId, row);
            const published = publishedPolicy.perModel[modelId]?.variants?.[variantId];
            return !(
              published?.billedCreditsOverride != null ||
              published?.billedCreditsQuantityRule != null
            );
          })
          .map((row) => `${modelId}:${row.displayRowId}`)
    );
    if (missingPublishedRows.length || missingCustomRows.length) {
      throw new IncompletePublishedPricingPolicyError({
        missingPublishedRows,
        missingCustomRows,
      });
    }
  }
  return publishedPolicy;
};
