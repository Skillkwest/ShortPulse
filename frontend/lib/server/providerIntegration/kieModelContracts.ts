/**
 * Kie model-contract boundary for submit payload validation/normalization.
 * Keeps model-specific request-shape handling isolated from transport dispatch.
 */

import type { SubmitPayload } from "../falIntegration/contracts";
import { getModelCatalogEntry } from "../../model-runtime/modelCatalog";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  isKnownKieModelId,
  type SupportedKieModelId,
} from "./kieModelIds";

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
    const normalized = Math.trunc(value);
    return normalized > 0 ? normalized : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) return null;
    const durationMatch = normalized.match(/^(\d+)s?$/);
    if (!durationMatch) return null;
    const parsed = Number.parseInt(durationMatch[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized.length) return null;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
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

const normalizeAspectRatio = ({
  payload,
  allowedValues,
  defaultValue,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  allowedValues: readonly string[];
  defaultValue: string;
  modelLabel: string;
}): string => {
  const resolved = asNonEmptyString(payload.aspect_ratio) ?? asNonEmptyString(payload.aspect);
  if (!resolved) return defaultValue;
  if (!allowedValues.includes(resolved)) {
    throw new Error(
      `${modelLabel} submit uses unsupported aspect ratio: ${resolved}. Allowed: ${allowedValues.join(", ")}`
    );
  }
  return resolved;
};

const normalizeOptionalDuration = ({
  payload,
  allowedValues,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  allowedValues: readonly number[];
  modelLabel: string;
}): number | null => {
  const resolved =
    asPositiveInteger(payload.duration_seconds) ?? asPositiveInteger(payload.duration);
  if (resolved === null) return null;
  if (!allowedValues.includes(resolved)) {
    throw new Error(
      `${modelLabel} submit uses unsupported duration: ${resolved}. Allowed: ${allowedValues.join(", ")}`
    );
  }
  return resolved;
};

const normalizeOptionalResolution = ({
  payload,
  allowedValues,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  allowedValues: readonly string[];
  modelLabel: string;
}): string | null => {
  const resolved = asNonEmptyString(payload.resolution);
  if (!resolved) return null;
  if (!allowedValues.includes(resolved)) {
    throw new Error(
      `${modelLabel} submit uses unsupported resolution: ${resolved}. Allowed: ${allowedValues.join(", ")}`
    );
  }
  return resolved;
};

const normalizeOptionalBooleanField = ({
  payload,
  field,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  field: string;
  modelLabel: string;
}): boolean | null => {
  if (payload[field] === undefined) return null;
  if (typeof payload[field] !== "boolean") {
    throw new Error(`${modelLabel} submit field "${field}" must be boolean when provided.`);
  }
  return payload[field] as boolean;
};

const normalizeOptionalNumberField = ({
  payload,
  field,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  field: string;
  modelLabel: string;
}): number | null => {
  if (payload[field] === undefined) return null;
  const resolved = asFiniteNumber(payload[field]);
  if (resolved === null) {
    throw new Error(`${modelLabel} submit field "${field}" must be numeric when provided.`);
  }
  return resolved;
};

type KieCatalogContract = {
  defaultAspect: string;
  allowedAspects: string[];
  allowedDurations: number[];
  allowedResolutions: string[] | null;
};

const readRequiredKieCatalogContract = ({
  modelId,
  modelLabel,
}: {
  modelId: SupportedKieModelId;
  modelLabel: string;
}): KieCatalogContract => {
  const entry = getModelCatalogEntry(modelId);
  if (!entry || entry.provider !== "kie") {
    throw new Error(`${modelLabel} model catalog contract is missing.`);
  }
  if (!entry.allowedAspects?.length) {
    throw new Error(`${modelLabel} model catalog contract is missing allowed aspects.`);
  }
  if (!entry.allowedDurations?.length) {
    throw new Error(`${modelLabel} model catalog contract is missing allowed durations.`);
  }
  return {
    defaultAspect: entry.defaultAspect,
    allowedAspects: entry.allowedAspects,
    allowedDurations: entry.allowedDurations,
    allowedResolutions: entry.allowedResolutions ?? null,
  };
};

const normalizeCommonKieVideoFields = ({
  payload,
  modelLabel,
  allowedAspects,
  defaultAspect,
  allowedDurations,
}: {
  payload: Record<string, unknown>;
  modelLabel: string;
  allowedAspects: readonly string[];
  defaultAspect: string;
  allowedDurations: readonly number[];
}): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...payload };
  const aspectRatio = normalizeAspectRatio({
    payload,
    allowedValues: allowedAspects,
    defaultValue: defaultAspect,
    modelLabel,
  });
  const durationSeconds = normalizeOptionalDuration({
    payload,
    allowedValues: allowedDurations,
    modelLabel,
  });
  const generateAudio = normalizeOptionalBooleanField({
    payload,
    field: "generate_audio",
    modelLabel,
  });

  normalized.aspect_ratio = aspectRatio;
  delete normalized.aspect;
  if (durationSeconds !== null) {
    normalized.duration_seconds = durationSeconds;
    normalized.duration = durationSeconds;
  }
  if (generateAudio !== null) {
    normalized.generate_audio = generateAudio;
  }

  return normalized;
};

const normalizeKieVeoI2vPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const prompt = asNonEmptyString(payload.prompt);
  if (!prompt) {
    throw new Error("Kie VEO 3.1 Fast I2V submit requires a prompt.");
  }
  const contract = readRequiredKieCatalogContract({
    modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
    modelLabel: "Kie VEO 3.1 Fast I2V",
  });
  if (!contract.allowedResolutions?.length) {
    throw new Error("Kie VEO 3.1 Fast I2V model catalog contract is missing allowed resolutions.");
  }
  const normalized = normalizeCommonKieVideoFields({
    payload,
    modelLabel: "Kie VEO 3.1 Fast I2V",
    allowedAspects: contract.allowedAspects,
    defaultAspect: contract.defaultAspect,
    allowedDurations: contract.allowedDurations,
  });
  const imageUrl = readFirstImageUrl(payload);
  if (!imageUrl) {
    throw new Error("Kie VEO 3.1 Fast I2V submit requires an image URL.");
  }
  const resolution = normalizeOptionalResolution({
    payload,
    allowedValues: contract.allowedResolutions,
    modelLabel: "Kie VEO 3.1 Fast I2V",
  });
  normalized.prompt = prompt;
  normalized.image_url = imageUrl;
  if (resolution) normalized.resolution = resolution;
  return normalized;
};

const normalizeKieKlingPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const contract = readRequiredKieCatalogContract({
    modelId: KIE_KLING_30_MODEL_ID,
    modelLabel: "Kie Kling 3.0",
  });
  const normalized = normalizeCommonKieVideoFields({
    payload,
    modelLabel: "Kie Kling 3.0",
    allowedAspects: contract.allowedAspects,
    defaultAspect: contract.defaultAspect,
    allowedDurations: contract.allowedDurations,
  });
  const prompt = asNonEmptyString(payload.prompt);
  if (!prompt) {
    throw new Error("Kie Kling 3.0 submit requires a prompt.");
  }
  const cfgScale = normalizeOptionalNumberField({
    payload,
    field: "cfg_scale",
    modelLabel: "Kie Kling 3.0",
  });
  normalized.prompt = prompt;
  if (cfgScale !== null) {
    normalized.cfg_scale = cfgScale;
  }
  return normalized;
};

/**
 * Returns true when the model id is supported by current Kie submit contracts.
 */
export const isSupportedKieModelId = (modelId: string): boolean => {
  return isKnownKieModelId(modelId);
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
