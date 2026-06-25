import { normalizeCreateImageBilledPricingParams } from "../../../lib/model-runtime/createImageBilledCredits";
import type { PricingParams } from "../../../lib/model-runtime/pricingTypes";
import { mergeCharacterAndUserReferences } from "./characterModePayload";
import { resolveCreateCharacterModeSubmitModel } from "./createCharacterModeModelMapping";
import { clampImageResolutionForModel } from "./imageResolution";

type CreatePricingCharacterBundle = {
  sheetReferenceStoragePaths?: string[] | null;
  sheetReferenceUrls?: string[] | null;
};

type ResolveCreatePricingTargetArgs = {
  modelId: string | null;
  aspect: string;
  resolution?: string | null;
  isCharacterModeEnabled: boolean;
  userReferenceImageUrls?: Array<string | null | undefined>;
  characterModeInjectionBundle?: CreatePricingCharacterBundle | null;
  costParamsForModel: (
    modelId: string,
    overrides?: Omit<PricingParams, "modelId">
  ) => PricingParams;
  maxInputImages?: number;
};

type CreatePricingTarget = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  inputImageCount: number;
};

const normalizeUniqueTrimmedValues = (
  values: Array<string | null | undefined>,
  limit?: number
): string[] => {
  const normalized = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
  if (typeof limit === "number" && limit >= 0) {
    return normalized.slice(0, limit);
  }
  return normalized;
};

export const resolveCreatePricingTarget = ({
  modelId,
  aspect,
  resolution,
  isCharacterModeEnabled,
  userReferenceImageUrls = [],
  characterModeInjectionBundle = null,
  costParamsForModel,
  maxInputImages = 8,
}: ResolveCreatePricingTargetArgs): CreatePricingTarget | null => {
  const effectiveModelId = resolveCreateCharacterModeSubmitModel({
    currentModelId: modelId,
    isCharacterModeEnabled,
  });
  if (!effectiveModelId) return null;

  const normalizedUserReferenceUrls = normalizeUniqueTrimmedValues(
    userReferenceImageUrls,
    maxInputImages
  );
  const characterReferenceStoragePaths = normalizeUniqueTrimmedValues(
    characterModeInjectionBundle?.sheetReferenceStoragePaths ?? [],
    maxInputImages
  );
  const characterReferenceUrls = normalizeUniqueTrimmedValues(
    characterModeInjectionBundle?.sheetReferenceUrls ?? [],
    maxInputImages
  );

  const inputImageCount =
    characterReferenceStoragePaths.length > 0
      ? Math.min(
          maxInputImages,
          characterReferenceStoragePaths.length + normalizedUserReferenceUrls.length
        )
      : mergeCharacterAndUserReferences(
          normalizedUserReferenceUrls,
          characterReferenceUrls,
          maxInputImages
        ).length;

  const params = normalizeCreateImageBilledPricingParams(
    effectiveModelId,
    costParamsForModel(effectiveModelId, {
      aspect,
      ...(resolution
        ? { resolution: clampImageResolutionForModel(effectiveModelId, resolution) }
        : {}),
      ...(inputImageCount > 0 ? { inputImageCount } : {}),
    })
  );

  return {
    modelId: effectiveModelId,
    params,
    inputImageCount,
  };
};
