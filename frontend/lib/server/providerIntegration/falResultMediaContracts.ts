/**
 * Fal model-aware result media normalization.
 * Keeps Fal result extraction strict where provider payloads echo input URLs.
 */

import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../model-runtime/falModelIds";
import { asProviderRecord, asProviderString } from "./canonicalProviderPayload";

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
        asProviderString(row.file_url)
      );
    })
    .filter((url): url is string => Boolean(url));
};

const dedupeUrls = (urls: string[]): string[] =>
  Array.from(new Set(urls.map((url) => url.trim()).filter((url) => Boolean(url))));

const collectOmniHumanCandidates = (payload: Record<string, unknown>): unknown[] => {
  const rootPayload = asProviderRecord(payload.payload);
  const data = asProviderRecord(payload.data);
  const output = asProviderRecord(payload.output);
  const result = asProviderRecord(payload.result);
  const response = asProviderRecord(payload.response);
  const dataResult = asProviderRecord(data.result);
  const outputResult = asProviderRecord(output.result);
  const resultData = asProviderRecord(result.data);
  const responseResult = asProviderRecord(response.result);
  const rootResult = asProviderRecord(rootPayload.result);

  return [
    payload.video,
    rootPayload.video,
    data.video,
    output.video,
    result.video,
    response.video,
    dataResult.video,
    outputResult.video,
    resultData.video,
    responseResult.video,
    rootResult.video,
    payload.videos,
    rootPayload.videos,
    data.videos,
    output.videos,
    result.videos,
    response.videos,
    dataResult.videos,
    outputResult.videos,
    resultData.videos,
    responseResult.videos,
    rootResult.videos,
    payload.video_url,
    rootPayload.video_url,
    data.video_url,
    output.video_url,
    result.video_url,
    response.video_url,
    dataResult.video_url,
    outputResult.video_url,
    resultData.video_url,
    responseResult.video_url,
    rootResult.video_url,
    payload.video_urls,
    rootPayload.video_urls,
    data.video_urls,
    output.video_urls,
    result.video_urls,
    response.video_urls,
    dataResult.video_urls,
    outputResult.video_urls,
    resultData.video_urls,
    responseResult.video_urls,
    rootResult.video_urls,
  ];
};

const extractOmniHumanResultMediaUrls = (payload: Record<string, unknown>): string[] => {
  const urls = collectOmniHumanCandidates(payload).flatMap((candidate) => {
    const direct = asProviderString(candidate);
    if (direct) return [direct];
    const list = asUrlList(candidate);
    if (list.length > 0) return list;
    const row = asProviderRecord(candidate);
    const rowUrl =
      asProviderString(row.url) ||
      asProviderString(row.download_url) ||
      asProviderString(row.video_url) ||
      asProviderString(row.file_url);
    return rowUrl ? [rowUrl] : [];
  });
  return dedupeUrls(urls);
};

/**
 * Returns true when a Fal model has an explicit result-media contract.
 */
export const hasFalResultMediaContract = (modelId: string | null | undefined): boolean =>
  modelId === FAL_OMNIHUMAN_V15_MODEL_ID;

/**
 * Reads generated media URLs for Fal models with model-specific payload contracts.
 */
export const extractFalResultMediaUrls = ({
  modelId,
  payload,
}: {
  modelId?: string | null;
  payload: Record<string, unknown>;
}): string[] | null => {
  if (modelId === FAL_OMNIHUMAN_V15_MODEL_ID) {
    return extractOmniHumanResultMediaUrls(payload);
  }
  return null;
};
