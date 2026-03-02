import {
  getFalStatusBaseUrlsByModelId,
  getFalSubmitUrlByModelId,
  getFalTimeoutMsByModelId,
  getKieStatusBaseUrlsByModelId,
  getKieSubmitUrlByModelId,
  getKieTimeoutMsByModelId,
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

export const getKieSubmitUrlRequired = (modelId: string): string => {
  const submitUrl = getKieSubmitUrlByModelId(modelId);
  if (!submitUrl) {
    throw new Error(`Missing kieSubmitUrl in model catalog for ${modelId}`);
  }
  return submitUrl;
};

export const getKieStatusBaseUrlsRequired = (modelId: string): string[] => {
  const baseUrls = getKieStatusBaseUrlsByModelId(modelId);
  if (!baseUrls.length) {
    throw new Error(`Missing kieStatusBaseUrls in model catalog for ${modelId}`);
  }
  return baseUrls;
};

export const getKieTimeoutMsOrDefault = (modelId: string, fallbackMs: number): number => {
  return getKieTimeoutMsByModelId(modelId) ?? fallbackMs;
};
