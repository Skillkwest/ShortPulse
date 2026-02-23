import {
  getFalStatusBaseUrlsByModelId,
  getFalSubmitUrlByModelId,
  getFalTimeoutMsByModelId,
} from "../../model-runtime/modelCatalog";

export const getFalSubmitUrlRequired = (modelId: string): string => {
  const submitUrl = getFalSubmitUrlByModelId(modelId);
  if (!submitUrl) {
    throw new Error(`Missing falSubmitUrl in model catalog for ${modelId}`);
  }
  return submitUrl;
};

export const getFalStatusBaseUrlsRequired = (modelId: string): string[] => {
  const baseUrls = getFalStatusBaseUrlsByModelId(modelId);
  if (!baseUrls.length) {
    throw new Error(`Missing falStatusBaseUrls in model catalog for ${modelId}`);
  }
  return baseUrls;
};

export const getFalTimeoutMsOrDefault = (modelId: string, fallbackMs: number): number => {
  return getFalTimeoutMsByModelId(modelId) ?? fallbackMs;
};
