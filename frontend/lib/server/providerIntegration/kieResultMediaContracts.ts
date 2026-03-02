/**
 * Kie model-aware result media normalization.
 * Keeps media URL extraction policy centralized for Kie status/recovery paths.
 */

import { asProviderRecord, asProviderString } from "./canonicalProviderPayload";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SUPPORTED_MODEL_IDS,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  isKnownKieModelId,
} from "./kieModelIds";

const supportedKieMediaModels = new Set<string>(KIE_SUPPORTED_MODEL_IDS);

const asUrlList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return asProviderString(item);
      const row = asProviderRecord(item);
      return (
        asProviderString(row.url) ||
        asProviderString(row.download_url) ||
        asProviderString(row.video_url) ||
        asProviderString(row.image_url) ||
        asProviderString(row.file_url)
      );
    })
    .filter((url): url is string => Boolean(url));
};

const dedupeUrls = (urls: string[]): string[] =>
  Array.from(new Set(urls.map((url) => url.trim()).filter((url) => Boolean(url))));

const parseResultJsonPayload = (value: unknown): Record<string, unknown> => {
  const text = asProviderString(value);
  if (!text) return {};
  try {
    return asProviderRecord(JSON.parse(text));
  } catch {
    return {};
  }
};

const collectModelSpecificCandidates = (modelId: string, payload: Record<string, unknown>) => {
  const data = asProviderRecord(payload.data);
  const result = asProviderRecord(payload.result);
  const output = asProviderRecord(payload.output);
  const resultJsonRoot = parseResultJsonPayload(payload.resultJson);
  const resultJsonData = parseResultJsonPayload(data.resultJson);
  const resultJsonResult = parseResultJsonPayload(result.resultJson);
  const resultJsonOutput = parseResultJsonPayload(output.resultJson);

  if (modelId === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    return [
      payload.videos,
      output.videos,
      data.videos,
      result.videos,
      payload.video_urls,
      output.video_urls,
      data.video_urls,
      result.video_urls,
      payload.result_urls,
      data.result_urls,
      result.result_urls,
      payload.video_url,
      output.video_url,
      data.video_url,
      result.video_url,
      payload.file_url,
      output.file_url,
      data.file_url,
      result.file_url,
      resultJsonRoot.resultUrls,
      resultJsonRoot.result_urls,
      resultJsonData.resultUrls,
      resultJsonData.result_urls,
      resultJsonResult.resultUrls,
      resultJsonResult.result_urls,
      resultJsonOutput.resultUrls,
      resultJsonOutput.result_urls,
    ];
  }

  if (modelId === KIE_KLING_30_MODEL_ID) {
    return [
      payload.videos,
      result.videos,
      output.videos,
      data.videos,
      payload.outputs,
      result.outputs,
      output.outputs,
      data.outputs,
      payload.video_urls,
      result.video_urls,
      output.video_urls,
      data.video_urls,
      payload.result_urls,
      result.result_urls,
      output.result_urls,
      data.result_urls,
      payload.video_url,
      result.video_url,
      output.video_url,
      data.video_url,
      payload.file_url,
      result.file_url,
      output.file_url,
      data.file_url,
      resultJsonRoot.resultUrls,
      resultJsonRoot.result_urls,
      resultJsonData.resultUrls,
      resultJsonData.result_urls,
      resultJsonResult.resultUrls,
      resultJsonResult.result_urls,
      resultJsonOutput.resultUrls,
      resultJsonOutput.result_urls,
    ];
  }

  return [];
};

const collectFallbackCandidates = (payload: Record<string, unknown>) => {
  const data = asProviderRecord(payload.data);
  const result = asProviderRecord(payload.result);
  const output = asProviderRecord(payload.output);
  const response = asProviderRecord(payload.response);

  return [
    payload.images,
    payload.videos,
    payload.outputs,
    payload.artifacts,
    data.images,
    data.videos,
    data.outputs,
    data.artifacts,
    output.images,
    output.videos,
    output.outputs,
    output.artifacts,
    result.images,
    result.videos,
    result.outputs,
    result.artifacts,
    response.images,
    response.videos,
    response.outputs,
    response.artifacts,
    payload.resultUrls,
    payload.result_urls,
    payload.image_urls,
    payload.video_urls,
    data.resultUrls,
    data.result_urls,
    data.image_urls,
    data.video_urls,
    result.resultUrls,
    result.result_urls,
    result.image_urls,
    result.video_urls,
    payload.url,
    payload.video,
    payload.image,
    payload.video_url,
    payload.image_url,
    payload.file_url,
    payload.media_url,
    payload.download_url,
  ];
};

/**
 * Returns true when Kie media extraction contract supports the model id.
 */
export const isSupportedKieResultMediaModel = (modelId: string): boolean => {
  return supportedKieMediaModels.has(modelId) && isKnownKieModelId(modelId);
};

/**
 * Extracts model-aware media URLs from Kie payloads.
 * Unsupported models fail closed to an empty result set.
 */
export const extractKieResultMediaUrls = ({
  modelId,
  payload,
}: {
  modelId: string | null | undefined;
  payload: unknown;
}): string[] => {
  if (!modelId || !isSupportedKieResultMediaModel(modelId)) return [];
  const root = asProviderRecord(payload);
  const modelCandidates = collectModelSpecificCandidates(modelId, root);

  const urls: string[] = [];
  for (const candidate of modelCandidates) {
    if (Array.isArray(candidate)) {
      urls.push(...asUrlList(candidate));
      continue;
    }
    const url = asProviderString(candidate);
    if (url) urls.push(url);
  }

  if (urls.length) return dedupeUrls(urls);

  for (const candidate of collectFallbackCandidates(root)) {
    if (Array.isArray(candidate)) {
      urls.push(...asUrlList(candidate));
      continue;
    }
    const url = asProviderString(candidate);
    if (url) urls.push(url);
  }

  return dedupeUrls(urls);
};
