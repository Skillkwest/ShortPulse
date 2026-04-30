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
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return asProviderRecord(value);
  }
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
  const dataResponse = asProviderRecord(data.response);
  const result = asProviderRecord(payload.result);
  const output = asProviderRecord(payload.output);
  const dataResult = asProviderRecord(data.result);
  const dataResponseResult = asProviderRecord(dataResponse.result);
  const resultData = asProviderRecord(result.data);
  const outputResult = asProviderRecord(output.result);
  const resultJsonRoot = parseResultJsonPayload(payload.resultJson);
  const resultJsonData = parseResultJsonPayload(data.resultJson);
  const resultJsonDataResponse = parseResultJsonPayload(dataResponse.resultJson);
  const resultJsonResult = parseResultJsonPayload(result.resultJson);
  const resultJsonOutput = parseResultJsonPayload(output.resultJson);
  const resultJsonDataResult = parseResultJsonPayload(dataResult.resultJson);
  const resultJsonDataResponseResult = parseResultJsonPayload(dataResponseResult.resultJson);
  const resultJsonResultData = parseResultJsonPayload(resultData.resultJson);
  const resultJsonOutputResult = parseResultJsonPayload(outputResult.resultJson);

  if (modelId === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    return [
      payload.videos,
      output.videos,
      data.videos,
      dataResponse.videos,
      result.videos,
      dataResult.videos,
      dataResponseResult.videos,
      resultData.videos,
      outputResult.videos,
      payload.video_urls,
      output.video_urls,
      data.video_urls,
      dataResponse.video_urls,
      result.video_urls,
      dataResult.video_urls,
      dataResponseResult.video_urls,
      resultData.video_urls,
      outputResult.video_urls,
      payload.result_urls,
      data.result_urls,
      dataResponse.result_urls,
      result.result_urls,
      dataResult.result_urls,
      dataResponseResult.result_urls,
      resultData.result_urls,
      outputResult.result_urls,
      payload.resultUrls,
      data.resultUrls,
      dataResponse.resultUrls,
      result.resultUrls,
      dataResult.resultUrls,
      dataResponseResult.resultUrls,
      resultData.resultUrls,
      outputResult.resultUrls,
      payload.video_url,
      output.video_url,
      data.video_url,
      dataResponse.video_url,
      result.video_url,
      dataResult.video_url,
      dataResponseResult.video_url,
      resultData.video_url,
      outputResult.video_url,
      payload.file_url,
      output.file_url,
      data.file_url,
      dataResponse.file_url,
      result.file_url,
      dataResult.file_url,
      dataResponseResult.file_url,
      resultData.file_url,
      outputResult.file_url,
      resultJsonRoot.resultUrls,
      resultJsonRoot.result_urls,
      resultJsonData.resultUrls,
      resultJsonData.result_urls,
      resultJsonDataResponse.resultUrls,
      resultJsonDataResponse.result_urls,
      resultJsonResult.resultUrls,
      resultJsonResult.result_urls,
      resultJsonOutput.resultUrls,
      resultJsonOutput.result_urls,
      resultJsonDataResult.resultUrls,
      resultJsonDataResult.result_urls,
      resultJsonDataResponseResult.resultUrls,
      resultJsonDataResponseResult.result_urls,
      resultJsonResultData.resultUrls,
      resultJsonResultData.result_urls,
      resultJsonOutputResult.resultUrls,
      resultJsonOutputResult.result_urls,
      payload.originUrls,
      data.originUrls,
      dataResponse.originUrls,
      result.originUrls,
      dataResult.originUrls,
      dataResponseResult.originUrls,
      resultData.originUrls,
      outputResult.originUrls,
      payload.origin_urls,
      data.origin_urls,
      dataResponse.origin_urls,
      result.origin_urls,
      dataResult.origin_urls,
      dataResponseResult.origin_urls,
      resultData.origin_urls,
      outputResult.origin_urls,
      payload.originUrl,
      output.originUrl,
      data.originUrl,
      dataResponse.originUrl,
      result.originUrl,
      dataResult.originUrl,
      dataResponseResult.originUrl,
      resultData.originUrl,
      outputResult.originUrl,
      payload.origin_url,
      output.origin_url,
      data.origin_url,
      dataResponse.origin_url,
      result.origin_url,
      dataResult.origin_url,
      dataResponseResult.origin_url,
      resultData.origin_url,
      outputResult.origin_url,
      resultJsonRoot.originUrls,
      resultJsonRoot.origin_urls,
      resultJsonData.originUrls,
      resultJsonData.origin_urls,
      resultJsonDataResponse.originUrls,
      resultJsonDataResponse.origin_urls,
      resultJsonResult.originUrls,
      resultJsonResult.origin_urls,
      resultJsonOutput.originUrls,
      resultJsonOutput.origin_urls,
      resultJsonDataResult.originUrls,
      resultJsonDataResult.origin_urls,
      resultJsonDataResponseResult.originUrls,
      resultJsonDataResponseResult.origin_urls,
      resultJsonResultData.originUrls,
      resultJsonResultData.origin_urls,
      resultJsonOutputResult.originUrls,
      resultJsonOutputResult.origin_urls,
    ];
  }

  if (modelId === KIE_KLING_30_MODEL_ID) {
    return [
      payload.videos,
      result.videos,
      output.videos,
      data.videos,
      dataResponse.videos,
      dataResult.videos,
      dataResponseResult.videos,
      resultData.videos,
      outputResult.videos,
      payload.outputs,
      result.outputs,
      output.outputs,
      data.outputs,
      dataResponse.outputs,
      dataResult.outputs,
      dataResponseResult.outputs,
      resultData.outputs,
      outputResult.outputs,
      payload.video_urls,
      result.video_urls,
      output.video_urls,
      data.video_urls,
      dataResponse.video_urls,
      dataResult.video_urls,
      dataResponseResult.video_urls,
      resultData.video_urls,
      outputResult.video_urls,
      payload.result_urls,
      result.result_urls,
      output.result_urls,
      data.result_urls,
      dataResponse.result_urls,
      dataResult.result_urls,
      dataResponseResult.result_urls,
      resultData.result_urls,
      outputResult.result_urls,
      payload.resultUrls,
      result.resultUrls,
      output.resultUrls,
      data.resultUrls,
      dataResponse.resultUrls,
      dataResult.resultUrls,
      dataResponseResult.resultUrls,
      resultData.resultUrls,
      outputResult.resultUrls,
      payload.video_url,
      result.video_url,
      output.video_url,
      data.video_url,
      dataResponse.video_url,
      dataResult.video_url,
      dataResponseResult.video_url,
      resultData.video_url,
      outputResult.video_url,
      payload.file_url,
      result.file_url,
      output.file_url,
      data.file_url,
      dataResponse.file_url,
      dataResult.file_url,
      dataResponseResult.file_url,
      resultData.file_url,
      outputResult.file_url,
      resultJsonRoot.resultUrls,
      resultJsonRoot.result_urls,
      resultJsonData.resultUrls,
      resultJsonData.result_urls,
      resultJsonDataResponse.resultUrls,
      resultJsonDataResponse.result_urls,
      resultJsonResult.resultUrls,
      resultJsonResult.result_urls,
      resultJsonOutput.resultUrls,
      resultJsonOutput.result_urls,
      resultJsonDataResult.resultUrls,
      resultJsonDataResult.result_urls,
      resultJsonDataResponseResult.resultUrls,
      resultJsonDataResponseResult.result_urls,
      resultJsonResultData.resultUrls,
      resultJsonResultData.result_urls,
      resultJsonOutputResult.resultUrls,
      resultJsonOutputResult.result_urls,
    ];
  }

  return [];
};

const collectCommonCandidates = (payload: Record<string, unknown>) => {
  const data = asProviderRecord(payload.data);
  const dataResponse = asProviderRecord(data.response);
  const result = asProviderRecord(payload.result);
  const output = asProviderRecord(payload.output);
  const response = asProviderRecord(payload.response);
  const dataResult = asProviderRecord(data.result);
  const dataResponseResult = asProviderRecord(dataResponse.result);
  const dataOutput = asProviderRecord(data.output);
  const resultData = asProviderRecord(result.data);
  const resultOutput = asProviderRecord(result.output);
  const responseResult = asProviderRecord(response.result);
  const responseData = asProviderRecord(response.data);
  const outputResult = asProviderRecord(output.result);
  const rootPayload = asProviderRecord(payload.payload);
  const rootPayloadResult = asProviderRecord(rootPayload.result);
  const rootResultJson = parseResultJsonPayload(payload.resultJson);
  const dataResultJson = parseResultJsonPayload(data.resultJson);
  const dataResponseResultJson = parseResultJsonPayload(dataResponse.resultJson);
  const resultResultJson = parseResultJsonPayload(result.resultJson);
  const outputResultJson = parseResultJsonPayload(output.resultJson);
  const dataResultResultJson = parseResultJsonPayload(dataResult.resultJson);
  const resultDataResultJson = parseResultJsonPayload(resultData.resultJson);
  const outputResultResultJson = parseResultJsonPayload(outputResult.resultJson);

  return [
    payload,
    rootPayload,
    data,
    dataResponse,
    result,
    output,
    response,
    dataResult,
    dataResponseResult,
    dataOutput,
    resultData,
    resultOutput,
    responseResult,
    responseData,
    outputResult,
    rootPayloadResult,
    rootResultJson,
    dataResultJson,
    dataResponseResultJson,
    resultResultJson,
    outputResultJson,
    dataResultResultJson,
    resultDataResultJson,
    outputResultResultJson,
    payload.images,
    payload.videos,
    payload.outputs,
    payload.artifacts,
    data.images,
    data.videos,
    dataResponse.videos,
    data.outputs,
    dataResponse.outputs,
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
    dataResponse.resultUrls,
    dataResponse.result_urls,
    dataResponse.image_urls,
    dataResponse.video_urls,
    dataResponseResult.resultUrls,
    dataResponseResult.result_urls,
    dataResponseResult.image_urls,
    dataResponseResult.video_urls,
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
    dataResponse.video_url,
    dataResponse.image_url,
    dataResponse.file_url,
    dataResponse.media_url,
    dataResponse.download_url,
    dataResponseResult.video_url,
    dataResponseResult.image_url,
    dataResponseResult.file_url,
    dataResponseResult.media_url,
    dataResponseResult.download_url,
    rootResultJson.resultUrls,
    rootResultJson.result_urls,
    dataResultJson.resultUrls,
    dataResultJson.result_urls,
    dataResponseResultJson.resultUrls,
    dataResponseResultJson.result_urls,
    resultResultJson.resultUrls,
    resultResultJson.result_urls,
    outputResultJson.resultUrls,
    outputResultJson.result_urls,
    dataResultResultJson.resultUrls,
    dataResultResultJson.result_urls,
    resultDataResultJson.resultUrls,
    resultDataResultJson.result_urls,
    outputResultResultJson.resultUrls,
    outputResultResultJson.result_urls,
    dataResponseResultJson.resultUrls,
    dataResponseResultJson.result_urls,
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

  for (const candidate of collectCommonCandidates(root)) {
    if (Array.isArray(candidate)) {
      urls.push(...asUrlList(candidate));
      continue;
    }
    const url = asProviderString(candidate);
    if (url) urls.push(url);
  }

  return dedupeUrls(urls);
};
