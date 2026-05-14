/**
 * Kie model-contract boundary for submit payload validation/normalization.
 * Keeps model-specific request-shape handling isolated from transport dispatch.
 */

import type { SubmitPayload } from "../falIntegration/contracts";
import { getModelCatalogEntry } from "../../model-runtime/modelCatalog";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
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

const readImageUrlList = (payload: Record<string, unknown>): string[] => {
  const urls: string[] = [];
  const directCandidates = [
    payload.image_url,
    payload.imageUrl,
    payload.input_image_url,
    payload.inputImageUrl,
  ];
  for (const candidate of directCandidates) {
    const normalized = asNonEmptyString(candidate);
    if (normalized) urls.push(normalized);
  }

  const listCandidates = [payload.image_urls, payload.imageUrls];
  for (const candidateList of listCandidates) {
    if (!Array.isArray(candidateList)) continue;
    for (const candidate of candidateList) {
      const normalized = asNonEmptyString(candidate);
      if (normalized) urls.push(normalized);
    }
  }
  return Array.from(new Set(urls));
};

const readStringUrlList = ({
  payload,
  directFields,
  listFields,
}: {
  payload: Record<string, unknown>;
  directFields: string[];
  listFields: string[];
}): string[] => {
  const urls: string[] = [];
  for (const field of directFields) {
    const normalized = asNonEmptyString(payload[field]);
    if (normalized) urls.push(normalized);
  }
  for (const field of listFields) {
    const candidateList = payload[field];
    if (!Array.isArray(candidateList)) continue;
    for (const candidate of candidateList) {
      const normalized = asNonEmptyString(candidate);
      if (normalized) urls.push(normalized);
    }
  }
  return Array.from(new Set(urls));
};

const readKlingMotionInputUrlFieldList = (payload: Record<string, unknown>): string[] => {
  return readStringUrlList({
    payload,
    directFields: ["input_url", "inputUrl"],
    listFields: ["input_urls", "inputUrls"],
  });
};

const readKlingMotionVideoUrlList = (payload: Record<string, unknown>): string[] => {
  return readStringUrlList({
    payload,
    directFields: ["video_url", "videoUrl"],
    listFields: ["video_urls", "videoUrls"],
  });
};

const readKieKlingMultiPromptList = (
  payload: Record<string, unknown>
): { prompt: string; duration: number }[] => {
  const candidateList = payload.multi_prompt;
  if (!Array.isArray(candidateList)) return [];
  return candidateList.reduce<{ prompt: string; duration: number }[]>((accumulator, candidate) => {
    const record = asRecord(candidate);
    const prompt = asNonEmptyString(record.prompt);
    const duration = asPositiveInteger(record.duration);
    if (!prompt || !duration) return accumulator;
    accumulator.push({ prompt, duration });
    return accumulator;
  }, []);
};

const readKieKlingElementList = (
  payload: Record<string, unknown>
): {
  name: string;
  description: string;
  element_input_urls?: string[];
  element_input_video_urls?: string[];
}[] => {
  const candidateList = payload.kling_elements;
  if (!Array.isArray(candidateList)) return [];
  return candidateList.reduce<
    {
      name: string;
      description: string;
      element_input_urls?: string[];
      element_input_video_urls?: string[];
    }[]
  >((accumulator, candidate, index) => {
    const record = asRecord(candidate);
    const imageUrls = readStringUrlList({
      payload: record,
      directFields: [],
      listFields: ["element_input_urls"],
    });
    const videoUrls = readStringUrlList({
      payload: record,
      directFields: [],
      listFields: ["element_input_video_urls"],
    });
    if (!imageUrls.length && !videoUrls.length) return accumulator;
    accumulator.push({
      name: asNonEmptyString(record.name) ?? `Element${String(index + 1).padStart(2, "0")}`,
      description:
        asNonEmptyString(record.description) ??
        `Reference media for Element${String(index + 1).padStart(2, "0")}`,
      ...(imageUrls.length ? { element_input_urls: imageUrls } : {}),
      ...(videoUrls.length ? { element_input_video_urls: videoUrls } : {}),
    });
    return accumulator;
  }, []);
};

const normalizeOptionalStringField = ({
  payload,
  fields,
}: {
  payload: Record<string, unknown>;
  fields: string[];
}): string | null => {
  for (const field of fields) {
    const value = asNonEmptyString(payload[field]);
    if (value) return value;
  }
  return null;
};

const asHttpUrlString = (value: unknown): string | null => {
  const text = asNonEmptyString(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeOptionalSeed = ({
  payload,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  modelLabel: string;
}): number | null => {
  if (payload.seeds === undefined && payload.seed === undefined) return null;
  const resolved = asPositiveInteger(payload.seeds ?? payload.seed);
  if (resolved === null || resolved < 10000 || resolved > 99999) {
    throw new Error(
      `${modelLabel} submit field "seeds" must be an integer between 10000 and 99999.`
    );
  }
  return resolved;
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
  const camelResolved = asNonEmptyString(payload.aspectRatio);
  const candidate = resolved ?? camelResolved;
  if (!candidate) return defaultValue;
  if (!allowedValues.includes(candidate)) {
    throw new Error(
      `${modelLabel} submit uses unsupported aspect ratio: ${candidate}. Allowed: ${allowedValues.join(", ")}`
    );
  }
  return candidate;
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

const normalizeOptionalBooleanFields = ({
  payload,
  fields,
  modelLabel,
}: {
  payload: Record<string, unknown>;
  fields: string[];
  modelLabel: string;
}): boolean | null => {
  for (const field of fields) {
    if (payload[field] === undefined) continue;
    return normalizeOptionalBooleanField({
      payload,
      field,
      modelLabel,
    });
  }
  return null;
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
  defaultResolution: string | null;
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
    defaultResolution: entry.defaultResolution ?? null,
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
  const normalized: Record<string, unknown> = {};
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
  const imageUrls = readImageUrlList(payload);
  const generationType =
    normalizeOptionalStringField({
      payload,
      fields: ["generationType", "generation_type"],
    }) ?? (imageUrls.length > 0 ? "FIRST_AND_LAST_FRAMES_2_VIDEO" : "TEXT_2_VIDEO");
  if (
    generationType !== "TEXT_2_VIDEO" &&
    generationType !== "FIRST_AND_LAST_FRAMES_2_VIDEO" &&
    generationType !== "REFERENCE_2_VIDEO"
  ) {
    throw new Error(
      `Kie VEO 3.1 Fast I2V submit uses unsupported generationType: ${generationType}. Allowed: TEXT_2_VIDEO, FIRST_AND_LAST_FRAMES_2_VIDEO, REFERENCE_2_VIDEO`
    );
  }
  if (generationType === "TEXT_2_VIDEO" && imageUrls.length > 0) {
    throw new Error("Kie VEO 3.1 Fast I2V TEXT_2_VIDEO does not accept image URLs.");
  }
  if (generationType !== "TEXT_2_VIDEO" && !imageUrls.length) {
    throw new Error("Kie VEO 3.1 Fast I2V submit requires an image URL.");
  }
  if (generationType === "FIRST_AND_LAST_FRAMES_2_VIDEO" && imageUrls.length > 2) {
    throw new Error("Kie VEO 3.1 Fast I2V FIRST_AND_LAST_FRAMES_2_VIDEO supports 1-2 image URLs.");
  }
  if (generationType === "REFERENCE_2_VIDEO") {
    if (imageUrls.length < 1 || imageUrls.length > 3) {
      throw new Error("Kie VEO 3.1 Fast I2V REFERENCE_2_VIDEO supports 1-3 image URLs.");
    }
    if (normalized.aspect_ratio !== "16:9") {
      throw new Error("Kie VEO 3.1 Fast I2V REFERENCE_2_VIDEO requires aspect_ratio=16:9.");
    }
  }
  const resolution = normalizeOptionalResolution({
    payload,
    allowedValues: contract.allowedResolutions,
    modelLabel: "Kie VEO 3.1 Fast I2V",
  });
  const modelVariant =
    normalizeOptionalStringField({
      payload,
      fields: ["model", "model_variant", "modelVariant"],
    }) ?? "veo3_fast";
  if (modelVariant !== "veo3" && modelVariant !== "veo3_fast") {
    throw new Error(
      `Kie VEO 3.1 Fast I2V submit uses unsupported model value: ${modelVariant}. Allowed: veo3, veo3_fast`
    );
  }
  const callbackUrl = asHttpUrlString(
    normalizeOptionalStringField({
      payload,
      fields: ["callBackUrl", "callbackUrl", "callback_url"],
    })
  );
  if (
    normalizeOptionalStringField({
      payload,
      fields: ["callBackUrl", "callbackUrl", "callback_url"],
    }) &&
    !callbackUrl
  ) {
    throw new Error("Kie VEO 3.1 Fast I2V submit field callBackUrl must be a valid http(s) URL.");
  }
  const watermark = normalizeOptionalStringField({
    payload,
    fields: ["watermark"],
  });
  const enableTranslation = normalizeOptionalBooleanFields({
    payload,
    fields: ["enable_translation", "enableTranslation"],
    modelLabel: "Kie VEO 3.1 Fast I2V",
  });
  const seeds = normalizeOptionalSeed({
    payload,
    modelLabel: "Kie VEO 3.1 Fast I2V",
  });
  normalized.prompt = prompt;
  normalized.model = modelVariant;
  normalized.imageUrls = imageUrls;
  normalized.image_url = imageUrls[0];
  normalized.generationType = generationType;
  if (resolution) normalized.resolution = resolution;
  if (callbackUrl) normalized.callBackUrl = callbackUrl;
  if (watermark) normalized.watermark = watermark;
  if (enableTranslation !== null) normalized.enableTranslation = enableTranslation;
  if (seeds !== null) normalized.seeds = seeds;
  return normalized;
};

const normalizeKieKlingPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const inputPayload = asRecord(payload.input);
  const source = Object.keys(inputPayload).length ? inputPayload : payload;
  const contract = readRequiredKieCatalogContract({
    modelId: KIE_KLING_30_MODEL_ID,
    modelLabel: "Kie Kling 3.0",
  });
  const normalized = normalizeCommonKieVideoFields({
    payload: source,
    modelLabel: "Kie Kling 3.0",
    allowedAspects: contract.allowedAspects,
    defaultAspect: contract.defaultAspect,
    allowedDurations: contract.allowedDurations,
  });
  const prompt = asNonEmptyString(source.prompt);
  if (!prompt) {
    throw new Error("Kie Kling 3.0 submit requires a prompt.");
  }
  const modelAlias =
    asNonEmptyString(payload.model) ?? asNonEmptyString(source.model) ?? "kling-3.0/video";
  const inputUrlsFromMotionFields = readKlingMotionInputUrlFieldList(source);
  const inputUrls = inputUrlsFromMotionFields.length
    ? inputUrlsFromMotionFields
    : readImageUrlList(source);
  const videoUrls = readKlingMotionVideoUrlList(source);
  const motionControlRequested =
    modelAlias.toLowerCase().includes("motion-control") ||
    videoUrls.length > 0 ||
    inputUrlsFromMotionFields.length > 0 ||
    asNonEmptyString(source.character_orientation) !== null ||
    asNonEmptyString(source.characterOrientation) !== null ||
    asNonEmptyString(source.background_source) !== null ||
    asNonEmptyString(source.backgroundSource) !== null;

  if (motionControlRequested) {
    if (!contract.allowedResolutions?.length) {
      throw new Error("Kie Kling 3.0 model catalog contract is missing allowed resolutions.");
    }
    if (!inputUrls.length) {
      throw new Error("Kie Kling 3.0 motion-control submit requires one input URL.");
    }
    if (!videoUrls.length) {
      throw new Error("Kie Kling 3.0 motion-control submit requires one motion video URL.");
    }
    if (inputUrls.length !== 1) {
      throw new Error("Kie Kling 3.0 motion-control submit accepts exactly one input URL.");
    }
    if (videoUrls.length !== 1) {
      throw new Error("Kie Kling 3.0 motion-control submit accepts exactly one motion video URL.");
    }
    const requestedResolution = normalizeOptionalResolution({
      payload: source,
      allowedValues: contract.allowedResolutions,
      modelLabel: "Kie Kling 3.0 motion-control",
    });
    const modeAlias = asNonEmptyString(source.mode);
    const modeResolution =
      modeAlias ?? requestedResolution ?? contract.defaultResolution ?? "1080p";
    if (!contract.allowedResolutions.includes(modeResolution)) {
      throw new Error(
        `Kie Kling 3.0 motion-control submit uses unsupported mode: ${modeResolution}. Allowed: ${contract.allowedResolutions.join(", ")}`
      );
    }
    const characterOrientation =
      asNonEmptyString(source.character_orientation) ??
      asNonEmptyString(source.characterOrientation) ??
      "image";
    const backgroundSource =
      asNonEmptyString(source.background_source) ??
      asNonEmptyString(source.backgroundSource) ??
      "input_video";
    const generateAudio =
      source.generate_audio === undefined
        ? null
        : normalizeOptionalBooleanField({
            payload: source,
            field: "generate_audio",
            modelLabel: "Kie Kling 3.0 motion-control",
          });
    const callbackValue = normalizeOptionalStringField({
      payload,
      fields: ["callBackUrl", "callbackUrl", "callback_url"],
    });
    const callbackUrl = callbackValue ? asHttpUrlString(callbackValue) : null;
    if (callbackValue && !callbackUrl) {
      throw new Error(
        "Kie Kling 3.0 motion-control submit field callBackUrl must be a valid http(s) URL."
      );
    }
    return {
      model: "kling-3.0/motion-control",
      ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
      input: {
        prompt,
        input_urls: [inputUrls[0]],
        video_urls: [videoUrls[0]],
        mode: modeResolution,
        ...(generateAudio !== null ? { generate_audio: generateAudio } : {}),
        character_orientation: characterOrientation,
        background_source: backgroundSource,
      },
    };
  }

  const imageUrls = readImageUrlList(source);
  if (!imageUrls.length) {
    throw new Error("Kie Kling 3.0 submit requires at least one image URL.");
  }
  const cfgScale = normalizeOptionalNumberField({
    payload: source,
    field: "cfg_scale",
    modelLabel: "Kie Kling 3.0",
  });
  const mode =
    normalizeOptionalStringField({
      payload: source,
      fields: ["mode"],
    }) ?? "std";
  if (mode !== "std" && mode !== "pro") {
    throw new Error(`Kie Kling 3.0 submit uses unsupported mode: ${mode}. Allowed: std, pro`);
  }
  const multiShotsRaw = source.multi_shots;
  const multiShots =
    multiShotsRaw === undefined
      ? false
      : normalizeOptionalBooleanField({
          payload: source,
          field: "multi_shots",
          modelLabel: "Kie Kling 3.0",
        });
  const sound = (() => {
    if (source.sound !== undefined) {
      return normalizeOptionalBooleanField({
        payload: source,
        field: "sound",
        modelLabel: "Kie Kling 3.0",
      });
    }
    if (source.generate_audio !== undefined) {
      return normalizeOptionalBooleanField({
        payload: source,
        field: "generate_audio",
        modelLabel: "Kie Kling 3.0",
      });
    }
    return true;
  })();
  if (multiShots === true && sound !== true) {
    throw new Error("Kie Kling 3.0 multi_shots=true requires sound=true.");
  }
  const callbackValue = normalizeOptionalStringField({
    payload,
    fields: ["callBackUrl", "callbackUrl", "callback_url"],
  });
  const callbackUrl = callbackValue ? asHttpUrlString(callbackValue) : null;
  if (callbackValue && !callbackUrl) {
    throw new Error("Kie Kling 3.0 submit field callBackUrl must be a valid http(s) URL.");
  }
  const durationValue =
    asPositiveInteger(source.duration) ??
    asPositiveInteger(source.duration_seconds) ??
    contract.allowedDurations[0];
  if (!durationValue || !contract.allowedDurations.includes(durationValue)) {
    throw new Error(
      `Kie Kling 3.0 submit uses unsupported duration: ${durationValue}. Allowed: ${contract.allowedDurations.join(", ")}`
    );
  }
  const input: Record<string, unknown> = {
    mode,
    image_urls: imageUrls,
    prompt,
    duration: String(durationValue),
    aspect_ratio: normalized.aspect_ratio,
    multi_shots: Boolean(multiShots),
    sound: sound ?? true,
  };
  if (cfgScale !== null) {
    input.cfg_scale = cfgScale;
  }
  const multiPrompt = readKieKlingMultiPromptList(source);
  if (multiPrompt.length) {
    input.multi_prompt = multiPrompt;
    input.multi_shots = true;
    input.image_urls = [imageUrls[0]];
    input.sound = true;
  }
  const klingElements = readKieKlingElementList(source);
  if (klingElements.length) {
    input.kling_elements = klingElements;
  }
  return {
    model: "kling-3.0/video",
    ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
    input,
  };
};

const normalizeKieSeedance2Payload = ({
  payload,
  modelId,
  providerModelName,
  providerModelLabel,
}: {
  payload: Record<string, unknown>;
  modelId: SupportedKieModelId;
  providerModelName: "bytedance/seedance-2" | "bytedance/seedance-2-fast";
  providerModelLabel: "Kie Seedance 2.0" | "Kie Seedance 2.0 Fast";
}): Record<string, unknown> => {
  const inputPayload = asRecord(payload.input);
  const source = Object.keys(inputPayload).length ? inputPayload : payload;
  const contract = readRequiredKieCatalogContract({
    modelId,
    modelLabel: providerModelLabel,
  });
  const normalized = normalizeCommonKieVideoFields({
    payload: source,
    modelLabel: providerModelLabel,
    allowedAspects: contract.allowedAspects,
    defaultAspect: contract.defaultAspect,
    allowedDurations: contract.allowedDurations,
  });
  const prompt = asNonEmptyString(source.prompt);
  if (!prompt) {
    throw new Error(`${providerModelLabel} submit requires a prompt.`);
  }
  if (!contract.allowedResolutions?.length) {
    throw new Error(`${providerModelLabel} model catalog contract is missing allowed resolutions.`);
  }
  const firstFrameUrl = normalizeOptionalStringField({
    payload: source,
    fields: ["first_frame_url", "firstFrameUrl"],
  });
  const lastFrameUrl = normalizeOptionalStringField({
    payload: source,
    fields: ["last_frame_url", "lastFrameUrl"],
  });
  const referenceImageUrls = readStringUrlList({
    payload: source,
    directFields: [],
    listFields: ["reference_image_urls", "referenceImageUrls"],
  });
  const referenceVideoUrls = readStringUrlList({
    payload: source,
    directFields: [],
    listFields: ["reference_video_urls", "referenceVideoUrls"],
  });
  const referenceAudioUrls = readStringUrlList({
    payload: source,
    directFields: [],
    listFields: ["reference_audio_urls", "referenceAudioUrls"],
  });
  const hasFrameMode = Boolean(firstFrameUrl || lastFrameUrl);
  const hasMultimodalReferences = Boolean(
    referenceImageUrls.length || referenceVideoUrls.length || referenceAudioUrls.length
  );
  if (lastFrameUrl && !firstFrameUrl) {
    throw new Error(`${providerModelLabel} last-frame mode requires a first_frame_url.`);
  }
  if (hasFrameMode && hasMultimodalReferences) {
    throw new Error(
      `${providerModelLabel} submit cannot mix frame URLs with multimodal reference URLs.`
    );
  }
  const resolution =
    normalizeOptionalResolution({
      payload: source,
      allowedValues: contract.allowedResolutions,
      modelLabel: providerModelLabel,
    }) ??
    contract.defaultResolution ??
    "1080p";
  const durationValue =
    asPositiveInteger(source.duration) ??
    asPositiveInteger(source.duration_seconds) ??
    contract.allowedDurations[0];
  if (!durationValue || !contract.allowedDurations.includes(durationValue)) {
    throw new Error(
      `${providerModelLabel} submit uses unsupported duration: ${durationValue}. Allowed: ${contract.allowedDurations.join(", ")}`
    );
  }
  const generateAudio =
    source.generate_audio === undefined
      ? null
      : normalizeOptionalBooleanField({
          payload: source,
          field: "generate_audio",
          modelLabel: providerModelLabel,
        });
  const returnLastFrame =
    source.return_last_frame === undefined
      ? null
      : normalizeOptionalBooleanField({
          payload: source,
          field: "return_last_frame",
          modelLabel: providerModelLabel,
        });
  const webSearch =
    source.web_search === undefined
      ? normalizeOptionalBooleanFields({
          payload: source,
          fields: ["webSearch"],
          modelLabel: providerModelLabel,
        })
      : normalizeOptionalBooleanField({
          payload: source,
          field: "web_search",
          modelLabel: providerModelLabel,
        });
  const callbackValue = normalizeOptionalStringField({
    payload,
    fields: ["callBackUrl", "callbackUrl", "callback_url"],
  });
  const callbackUrl = callbackValue ? asHttpUrlString(callbackValue) : null;
  if (callbackValue && !callbackUrl) {
    throw new Error(`${providerModelLabel} submit field callBackUrl must be a valid http(s) URL.`);
  }
  return {
    model: providerModelName,
    ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
    input: {
      prompt,
      ...(firstFrameUrl ? { first_frame_url: firstFrameUrl } : {}),
      ...(lastFrameUrl ? { last_frame_url: lastFrameUrl } : {}),
      ...(referenceImageUrls.length ? { reference_image_urls: referenceImageUrls } : {}),
      ...(referenceVideoUrls.length ? { reference_video_urls: referenceVideoUrls } : {}),
      ...(referenceAudioUrls.length ? { reference_audio_urls: referenceAudioUrls } : {}),
      aspect_ratio: normalized.aspect_ratio,
      resolution,
      duration: String(durationValue),
      ...(generateAudio !== null ? { generate_audio: generateAudio } : {}),
      ...(returnLastFrame !== null ? { return_last_frame: returnLastFrame } : {}),
      ...(webSearch !== null ? { web_search: webSearch } : {}),
    },
  };
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
  if (modelId === KIE_SEEDANCE_2_MODEL_ID) {
    return normalizeKieSeedance2Payload({
      payload: source,
      modelId,
      providerModelName: "bytedance/seedance-2",
      providerModelLabel: "Kie Seedance 2.0",
    });
  }
  if (modelId === KIE_SEEDANCE_2_FAST_MODEL_ID) {
    return normalizeKieSeedance2Payload({
      payload: source,
      modelId,
      providerModelName: "bytedance/seedance-2-fast",
      providerModelLabel: "Kie Seedance 2.0 Fast",
    });
  }
  throw new Error(`Unsupported Kie model contract: ${modelId}`);
};
