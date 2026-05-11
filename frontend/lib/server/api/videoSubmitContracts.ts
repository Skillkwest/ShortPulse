/**
 * Canonical video submit contract helpers.
 * Provides canonical field validation, queue envelope validation, and
 * character-media isolation for video model submissions.
 */

import { getModelConfig } from "../../model-runtime/pricing";
import { isCharacterScopedMediaUrl } from "../../mediaStoragePath";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../model-runtime/providerModelIds";

type JsonObject = Record<string, unknown>;

export const VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME = "video_submit_payload";
export const VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION = 2;

export type VideoContractViolationCode =
  | "VIDEO_NON_CANONICAL_FIELD"
  | "VIDEO_CHARACTER_MEDIA_BLOCKED"
  | "VIDEO_QUEUE_PAYLOAD_INVALID";

export type VideoContractViolation = {
  ok: false;
  code: VideoContractViolationCode;
  error: string;
  detail?: unknown;
};

export type VideoContractSuccess = {
  ok: true;
  payload: JsonObject;
  envelopeVersion: number | null;
};

export type VideoContractResult = VideoContractSuccess | VideoContractViolation;

export type VideoQueueSubmitEnvelope = {
  __contract: typeof VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME;
  contract_version: typeof VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION;
  model_id: string;
  payload: JsonObject;
};

const GENERIC_VIDEO_ALIAS_MAP: Record<string, string> = {
  imageUrl: "image_url",
  imageUrls: "image_urls",
  aspectRatio: "aspect_ratio",
  durationSeconds: "duration_seconds",
  generateAudio: "generate_audio",
  cfgScale: "cfg_scale",
  callbackUrl: "callback_url",
};

const VIDEO_ALIAS_MAP_BY_MODEL_ID: Record<string, Record<string, string>> = {
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: {
    generationType: "generation_type",
    callBackUrl: "callback_url",
    modelVariant: "model",
    seeds: "seed",
    enableTranslation: "enable_translation",
  },
  [KIE_KLING_30_MODEL_ID]: {
    callBackUrl: "callback_url",
    inputUrl: "input_url",
    inputUrls: "input_urls",
    videoUrl: "video_url",
    videoUrls: "video_urls",
    characterOrientation: "character_orientation",
    backgroundSource: "background_source",
    cfgScale: "cfg_scale",
  },
  [KIE_SEEDANCE_15_PRO_MODEL_ID]: {
    callBackUrl: "callback_url",
    inputUrl: "input_url",
    inputUrls: "input_urls",
    fixedLens: "fixed_lens",
    generateAudio: "generate_audio",
    aspectRatio: "aspect_ratio",
  },
  [KIE_SEEDANCE_2_MODEL_ID]: {
    callBackUrl: "callback_url",
    firstFrameUrl: "first_frame_url",
    lastFrameUrl: "last_frame_url",
    referenceImageUrls: "reference_image_urls",
    referenceVideoUrls: "reference_video_urls",
    referenceAudioUrls: "reference_audio_urls",
    returnLastFrame: "return_last_frame",
    generateAudio: "generate_audio",
    aspectRatio: "aspect_ratio",
    webSearch: "web_search",
  },
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: {
    callBackUrl: "callback_url",
    firstFrameUrl: "first_frame_url",
    lastFrameUrl: "last_frame_url",
    referenceImageUrls: "reference_image_urls",
    referenceVideoUrls: "reference_video_urls",
    referenceAudioUrls: "reference_audio_urls",
    returnLastFrame: "return_last_frame",
    generateAudio: "generate_audio",
    aspectRatio: "aspect_ratio",
    webSearch: "web_search",
  },
};

const ALLOWED_CHARACTER_PREFIX_KEYS = new Set(["character_orientation"]);
const BLOCKED_FIELD_KEY_FRAGMENTS = [
  "storage_path",
  "media_file_id",
  "character_media_id",
  "reference_pack",
  "character_sheet",
  "profile_image",
];

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const cloneObject = (value: JsonObject): JsonObject => ({ ...value });

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const LONG_NUMBER_PATTERN = /\b\d{6,}\b/g;

const redactIdentifierSegments = (value: string): string =>
  value.replace(UUID_PATTERN, "<id>").replace(LONG_NUMBER_PATTERN, "<num>");

const truncateText = (value: string, max = 220): string =>
  value.length <= max ? value : `${value.slice(0, max - 3)}...`;

const redactSensitiveQueryParams = (url: URL): string => {
  const keys = new Set<string>();
  url.searchParams.forEach((_value, key) => {
    keys.add(key);
  });
  if (!keys.size) return "";
  return `?${Array.from(keys)
    .map((key) => `${key}=<redacted>`)
    .join("&")}`;
};

const redactPotentialSensitiveString = (value: string): string => {
  const decoded = decodeSafe(value);
  try {
    const parsed = new URL(decoded);
    return truncateText(
      `${parsed.origin}${redactIdentifierSegments(parsed.pathname)}${redactSensitiveQueryParams(
        parsed
      )}`
    );
  } catch {
    return truncateText(redactIdentifierSegments(decoded).replace(/\?.*$/, "?<redacted>"));
  }
};

const isAllowedCharacterScopedVideoPath = (keyPath: string[]): boolean => {
  if (keyPath.length < 3) return false;
  const [rootKey, , leafKey] = keyPath;
  return (
    rootKey === "kling_elements" &&
    (leafKey === "element_input_urls" || leafKey === "element_input_video_urls")
  );
};

const detectCharacterMediaLeak = (
  value: unknown,
  keyPath: string[] = []
): { keyPath: string; value: string; reason: string } | null => {
  if (typeof value === "string") {
    const keyPathText = keyPath.join(".");
    if (isCharacterScopedMediaUrl(value) && !isAllowedCharacterScopedVideoPath(keyPath)) {
      return {
        keyPath: keyPathText,
        value: redactPotentialSensitiveString(value),
        reason: "character_url_segment",
      };
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = detectCharacterMediaLeak(value[index], [...keyPath, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  const objectValue = asObject(value);
  if (!objectValue) return null;

  for (const [rawKey, nestedValue] of Object.entries(objectValue)) {
    const key = rawKey.trim().toLowerCase();
    if (
      key.startsWith("character_") &&
      !ALLOWED_CHARACTER_PREFIX_KEYS.has(key) &&
      key !== "character"
    ) {
      return {
        keyPath: [...keyPath, rawKey].join("."),
        value: key,
        reason: "blocked_character_field",
      };
    }
    if (BLOCKED_FIELD_KEY_FRAGMENTS.some((fragment) => key.includes(fragment))) {
      return {
        keyPath: [...keyPath, rawKey].join("."),
        value: key,
        reason: "blocked_character_metadata_field",
      };
    }
    const nested = detectCharacterMediaLeak(nestedValue, [...keyPath, rawKey]);
    if (nested) return nested;
  }

  return null;
};

export const isVideoGenerationModelId = (modelId: string): boolean => {
  const config = getModelConfig(modelId);
  return config?.mediaType === "video" || config?.mediaType === "image-to-video";
};

const readAliasMapForModel = (modelId: string): Record<string, string> => ({
  ...GENERIC_VIDEO_ALIAS_MAP,
  ...(VIDEO_ALIAS_MAP_BY_MODEL_ID[modelId] ?? {}),
});

const validateCanonicalPayload = ({
  payload,
  modelId,
}: {
  payload: JsonObject;
  modelId: string;
}): VideoContractResult => {
  const aliasMap = readAliasMapForModel(modelId);
  const nextPayload = cloneObject(payload);

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (!Object.prototype.hasOwnProperty.call(nextPayload, alias)) continue;
    return {
      ok: false,
      code: "VIDEO_NON_CANONICAL_FIELD",
      error: `Non-canonical video payload field provided: ${alias}. Use ${canonical}.`,
      detail: {
        field: alias,
        canonical,
      },
    };
  }

  const leak = detectCharacterMediaLeak(nextPayload);
  if (leak) {
    return {
      ok: false,
      code: "VIDEO_CHARACTER_MEDIA_BLOCKED",
      error: "Character media fields/paths are not allowed in video model payloads.",
      detail: leak,
    };
  }

  return {
    ok: true,
    payload: nextPayload,
    envelopeVersion: null,
  };
};

export const wrapQueueSubmitPayloadEnvelope = ({
  modelId,
  payload,
}: {
  modelId: string;
  payload: JsonObject;
}): VideoQueueSubmitEnvelope => ({
  __contract: VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME,
  contract_version: VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION,
  model_id: modelId,
  payload: cloneObject(payload),
});

const unwrapQueueSubmitPayloadEnvelope = ({
  modelId,
  payload,
}: {
  modelId: string;
  payload: JsonObject;
}): VideoContractResult => {
  const envelope = asObject(payload);
  if (!envelope) {
    return {
      ok: false,
      code: "VIDEO_QUEUE_PAYLOAD_INVALID",
      error: "Queue submit payload is malformed.",
    };
  }
  if (envelope.__contract !== VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME) {
    return {
      ok: false,
      code: "VIDEO_QUEUE_PAYLOAD_INVALID",
      error: "Queue submit payload is missing the required video payload envelope.",
    };
  }

  const envelopeModelId =
    typeof envelope.model_id === "string" && envelope.model_id.trim().length
      ? envelope.model_id.trim()
      : null;
  if (envelopeModelId && envelopeModelId !== modelId) {
    return {
      ok: false,
      code: "VIDEO_QUEUE_PAYLOAD_INVALID",
      error: "Queue submit payload envelope model mismatch.",
      detail: {
        queue_model_id: modelId,
        envelope_model_id: envelopeModelId,
      },
    };
  }

  const version =
    typeof envelope.contract_version === "number"
      ? Math.trunc(envelope.contract_version)
      : Number.NaN;
  if (version !== VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION) {
    return {
      ok: false,
      code: "VIDEO_QUEUE_PAYLOAD_INVALID",
      error: `Unsupported queue submit payload contract version: ${String(
        envelope.contract_version ?? "unknown"
      )}.`,
      detail: {
        supported_version: VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION,
      },
    };
  }

  const normalizedPayload = asObject(envelope.payload);
  if (!normalizedPayload) {
    return {
      ok: false,
      code: "VIDEO_QUEUE_PAYLOAD_INVALID",
      error: "Queue submit payload envelope is missing a valid payload object.",
    };
  }

  return {
    ok: true,
    payload: cloneObject(normalizedPayload),
    envelopeVersion: version,
  };
};

/**
 * Normalizes ingress payload for video models.
 * Non-video model ids pass through unchanged.
 */
export const normalizeVideoSubmitIngressPayload = ({
  modelId,
  payload,
}: {
  modelId: string;
  payload: JsonObject;
}): VideoContractResult => {
  if (!isVideoGenerationModelId(modelId)) {
    return {
      ok: true,
      payload: cloneObject(payload),
      envelopeVersion: null,
    };
  }
  return validateCanonicalPayload({ payload, modelId });
};

/**
 * Normalizes queue-dispatch payloads.
 * Supports only wrapped contract v2 envelopes.
 */
export const normalizeVideoQueueDispatchPayload = ({
  modelId,
  payload,
}: {
  modelId: string;
  payload: JsonObject;
}): VideoContractResult => {
  if (!isVideoGenerationModelId(modelId)) {
    return {
      ok: true,
      payload: cloneObject(payload),
      envelopeVersion: null,
    };
  }

  const unwrapped = unwrapQueueSubmitPayloadEnvelope({ modelId, payload });
  if (!unwrapped.ok) return unwrapped;

  const normalized = validateCanonicalPayload({ payload: unwrapped.payload, modelId });
  if (!normalized.ok) return normalized;

  return {
    ...normalized,
    envelopeVersion: unwrapped.envelopeVersion,
  };
};
