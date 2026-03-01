/**
 * Kie model-contract boundary for submit payload validation/normalization.
 * Keeps model-specific request-shape handling isolated from transport dispatch.
 */

import type { SubmitPayload } from "../falIntegration/contracts";

const KIE_VEO_31_FAST_I2V_MODEL_ID = "kie-ai/veo-3.1-fast-i2v";
const KIE_KLING_30_MODEL_ID = "kie-ai/kling-3.0";

const supportedKieModelIds = new Set([KIE_VEO_31_FAST_I2V_MODEL_ID, KIE_KLING_30_MODEL_ID]);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asPositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const readFirstImageUrl = (payload: Record<string, unknown>): string | null => {
  const direct =
    asNonEmptyString(payload.image_url) ??
    asNonEmptyString(payload.imageUrl) ??
    asNonEmptyString(payload.input_image_url) ??
    asNonEmptyString(payload.inputImageUrl);
  if (direct) return direct;

  const imageUrls = payload.image_urls;
  if (!Array.isArray(imageUrls)) return null;
  for (const candidate of imageUrls) {
    const normalized = asNonEmptyString(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const normalizeCommonKieVideoFields = (
  payload: Record<string, unknown>
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...payload };
  const aspectRatio = asNonEmptyString(payload.aspect_ratio) ?? asNonEmptyString(payload.aspect);
  const durationSeconds =
    asPositiveInteger(payload.duration_seconds) ?? asPositiveInteger(payload.duration);
  const resolution = asNonEmptyString(payload.resolution);

  if (aspectRatio) normalized.aspect_ratio = aspectRatio;
  if (durationSeconds !== null) normalized.duration_seconds = durationSeconds;
  if (resolution) normalized.resolution = resolution;

  return normalized;
};

const normalizeKieVeoI2vPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const normalized = normalizeCommonKieVideoFields(payload);
  const imageUrl = readFirstImageUrl(payload);
  if (!imageUrl) {
    throw new Error("Kie VEO 3.1 Fast I2V submit requires an image URL.");
  }
  normalized.image_url = imageUrl;
  return normalized;
};

const normalizeKieKlingPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const normalized = normalizeCommonKieVideoFields(payload);
  const prompt = asNonEmptyString(payload.prompt);
  if (!prompt) {
    throw new Error("Kie Kling 3.0 submit requires a prompt.");
  }
  normalized.prompt = prompt;
  return normalized;
};

/**
 * Returns true when the model id is supported by current Kie submit contracts.
 */
export const isSupportedKieModelId = (modelId: string): boolean => {
  return supportedKieModelIds.has(modelId);
};

/**
 * Fail-closed guard for unsupported Kie model ids.
 */
export const assertSupportedKieModelId = (modelId: string): void => {
  if (!isSupportedKieModelId(modelId)) {
    throw new Error(`Unsupported Kie model contract: ${modelId}`);
  }
};

/**
 * Validates and normalizes Kie submit payload per model contract.
 */
export const normalizeKieSubmitPayloadForModel = ({
  modelId,
  payload,
}: {
  modelId: string;
  payload: SubmitPayload;
}): Record<string, unknown> => {
  assertSupportedKieModelId(modelId);
  const source = asRecord(payload);
  if (modelId === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    return normalizeKieVeoI2vPayload(source);
  }
  if (modelId === KIE_KLING_30_MODEL_ID) {
    return normalizeKieKlingPayload(source);
  }
  throw new Error(`Unsupported Kie model contract: ${modelId}`);
};
