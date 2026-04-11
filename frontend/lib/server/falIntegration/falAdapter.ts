/**
 * Fal payload adapter helpers for status/result normalization.
 * Keeps provider payload parsing consistent across route handlers.
 */

type JsonObject = Record<string, unknown>;

export const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const extractUrlArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return asString(item);
      const record = toRecord(item);
      return (
        asString(record.url) ||
        asString(record.download_url) ||
        asString(record.video_url) ||
        asString(record.image_url) ||
        asString(record.file_url)
      );
    })
    .filter((url): url is string => Boolean(url));
};

export const normalizeStatus = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toLowerCase() : null;
};

export const findContentPolicyMessage = (payload: JsonObject): string | null => {
  const detail = payload.detail;
  if (!Array.isArray(detail)) return null;
  const violation = detail.find((item) => {
    const row = toRecord(item);
    return row.type === "content_policy_violation";
  });
  const message = asString(toRecord(violation).msg);
  return message ?? null;
};

export const hasMediaPayload = (payload: JsonObject): boolean => {
  return extractMediaPayloadUrls(payload).length > 0;
};

export const extractMediaPayloadUrls = (payload: JsonObject): string[] => {
  const data = toRecord(payload.data);
  const output = toRecord(payload.output);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const rootPayload = toRecord(payload.payload);
  const candidates = [
    payload,
    rootPayload,
    data,
    output,
    result,
    response,
    toRecord(data.result),
    toRecord(result.data),
    toRecord(response.result),
    toRecord(rootPayload.result),
  ].filter((item) => Object.keys(item).length > 0);

  const urls: string[] = [];
  for (const candidate of candidates) {
    urls.push(...extractUrlArray(candidate.images));
    urls.push(...extractUrlArray(candidate.videos));
    urls.push(...extractUrlArray(candidate.outputs));
    urls.push(...extractUrlArray(candidate.artifacts));
    const resultUrlCandidates =
      candidate.resultUrls ??
      candidate.result_urls ??
      candidate.image_urls ??
      candidate.video_urls ??
      toRecord(candidate.info).result_urls;
    urls.push(...extractUrlArray(resultUrlCandidates));
    const mediaUrl =
      asString(candidate.url) ||
      asString(candidate.video) ||
      asString(candidate.image) ||
      asString(toRecord(candidate.video).url) ||
      asString(toRecord(candidate.image).url) ||
      asString(candidate.video_url) ||
      asString(candidate.image_url) ||
      asString(toRecord(toRecord(candidate.assets).video).url) ||
      asString(toRecord(toRecord(candidate.assets).image).url) ||
      asString(toRecord(toRecord(candidate.assets).video).download_url) ||
      asString(toRecord(toRecord(candidate.assets).image).download_url) ||
      asString(candidate.file_url) ||
      asString(candidate.media_url) ||
      asString(candidate.download_url);
    if (mediaUrl) urls.push(mediaUrl);
  }
  return Array.from(new Set(urls.map((url) => url.trim()).filter((url) => Boolean(url))));
};

export const extractResponseUrl = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const output = toRecord(payload.output);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const rootPayload = toRecord(payload.payload);
  const candidates = [
    payload,
    rootPayload,
    data,
    output,
    result,
    response,
    toRecord(data.result),
    toRecord(result.data),
    toRecord(response.result),
    toRecord(rootPayload.result),
  ];
  for (const candidate of candidates) {
    const responseUrl =
      asString(candidate.response_url) ||
      asString(candidate.responseUrl) ||
      asString(toRecord(candidate.response).url);
    if (responseUrl) return responseUrl;
  }
  return null;
};
