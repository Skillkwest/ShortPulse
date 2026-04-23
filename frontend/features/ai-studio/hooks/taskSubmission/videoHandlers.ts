/**
 * Video submission handlers for AI Studio task generation.
 */
import {
  type FalSubmitResponse,
  submitKieKlingImageToVideo,
  submitKieSeedance2FastVideo,
  submitKieSeedance2Video,
  submitKieSeedanceVideo,
  submitKieVeoImageToVideo,
} from "../../../../lib/falClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  getAiStudioKlingElementReferenceUrls,
  resolveAiStudioKlingElementToken,
  resolveKieKlingElementToken,
  resolveLegacyKieKlingElementToken,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import {
  buildKieKlingElementsPayload,
  resolveKieKlingAspect,
  buildKieKlingMultiPromptPayload,
  resolveKieKlingDuration,
  resolveKieKlingMode,
  resolveKlingResolution,
  resolveSeedanceI2VAspect,
  resolveSeedance2Duration,
  resolveSeedance2Resolution,
  resolveSeedanceI2VDuration,
  resolveSeedanceI2VResolution,
  resolveVeoResolution,
  resolveVeoTextAspect,
} from "./videoPayloads";

const FAL_KLING_IMAGE_MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";
const FAL_KLING_TEXT_MODEL_ID = "fal-ai/kling-video/v3/pro/text-to-video";
const FAL_KLING_DISABLED_MESSAGE = "Fal Kling 3.0 is disabled. Use Kie Kling 3.0 instead.";
const FAL_VEO_TEXT_MODEL_ID = "fal-ai/veo3.1";
const FAL_VEO_IMAGE_MODEL_ID = "fal-ai/veo3.1/image-to-video";
const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";
const FAL_VEO_DISABLED_MESSAGE = "Fal Veo 3.1 is disabled. Use Kie Veo 3.1 instead.";
const FAL_SEEDANCE_TEXT_MODEL_ID = "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";
const FAL_SEEDANCE_IMAGE_MODEL_ID = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
const FAL_NON_KIE_VIDEO_DISABLED_MESSAGE =
  "Fal-hosted video generation is disabled. Use Kie Veo 3.1, Kie Kling 3.0, or Kie Seedance 1.5 instead.";
const KIE_UPLOAD_ROUTE = "/api/kie/upload-url";
const KIE_HOSTED_MEDIA_HOST_SUFFIXES = [
  "kieai.redpandaai.co",
  "tempfile.aiquickdraw.com",
  "tempfileb.aiquickdraw.com",
] as const;

const isCharacterScopedMediaUrl = (value: string): boolean => {
  const normalized = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })().toLowerCase();
  return normalized.includes("/characters/") || normalized.includes("%2fcharacters%2f");
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasKlingElementMedia = (element: AiStudioKlingElement): boolean =>
  Boolean(element.videoUrl.trim() || getAiStudioKlingElementReferenceUrls(element).length);

const isKieHostedTemporaryMediaUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.trim().toLowerCase();
    return KIE_HOSTED_MEDIA_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
};

const uploadUrlToKieTemporaryFile = async ({
  url,
  mediaKind,
  cache,
}: {
  url: string;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return "";
  if (isKieHostedTemporaryMediaUrl(normalizedUrl)) return normalizedUrl;

  const cached = cache.get(normalizedUrl);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchWithAuth(KIE_UPLOAD_ROUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: normalizedUrl,
        uploadPath:
          mediaKind === "image"
            ? "shortpulse/kie-video/images"
            : mediaKind === "video"
              ? "shortpulse/kie-video/videos"
              : "shortpulse/kie-video/audio",
      }),
      shortpulseLogScope: "generation",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string;
      url?: string;
    };
    if (!response.ok) {
      const error =
        typeof payload.error === "string" && payload.error.trim().length
          ? payload.error
          : "Kie temporary upload failed";
      const details =
        typeof payload.details === "string" && payload.details.trim().length
          ? payload.details
          : null;
      throw new Error(details ? `${error}: ${details}` : error);
    }

    const uploadedUrl = payload.url?.trim();
    if (!uploadedUrl) {
      throw new Error("Kie temporary upload failed: missing uploaded URL.");
    }
    return uploadedUrl;
  })();

  cache.set(normalizedUrl, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(normalizedUrl);
    throw error;
  }
};

const uploadUrlsToKieTemporaryFiles = async ({
  urls,
  mediaKind,
  cache,
}: {
  urls: string[];
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string[]> =>
  (
    await Promise.all(
      urls.map(async (url) =>
        uploadUrlToKieTemporaryFile({
          url,
          mediaKind,
          cache,
        })
      )
    )
  ).filter(Boolean);

const prepareKlingElementForSubmission = async (
  element: AiStudioKlingElement
): Promise<AiStudioKlingElement> => {
  const frontalImageUrl = element.frontalImageUrl.trim();
  const referenceUrls = element.referenceImageUrls
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const [preparedFrontalImageUrl, preparedReferenceUrls, preparedVideoUrl] = await Promise.all([
    prepareImageUrlForSubmission(frontalImageUrl || null),
    Promise.all(referenceUrls.map((url) => prepareImageUrlForSubmission(url))),
    prepareVideoUrlForSubmission(element.videoUrl || null),
  ]);

  return {
    ...element,
    frontalImageUrl: preparedFrontalImageUrl ?? "",
    referenceImageUrls: preparedReferenceUrls.filter(Boolean).join(", "),
    videoUrl: preparedVideoUrl ?? "",
  };
};

const prepareKieHostedKlingElementForSubmission = async ({
  element,
  cache,
}: {
  element: AiStudioKlingElement;
  cache: Map<string, Promise<string>>;
}): Promise<AiStudioKlingElement> => {
  const prepared = await prepareKlingElementForSubmission(element);
  const preparedImageUrls = getAiStudioKlingElementReferenceUrls(prepared);

  const [klingHostedImageUrls, klingHostedVideoUrl] = await Promise.all([
    Promise.all(
      preparedImageUrls.map(
        async (url) =>
          await uploadUrlToKieTemporaryFile({
            url,
            mediaKind: "image",
            cache,
          })
      )
    ),
    prepared.videoUrl.trim()
      ? uploadUrlToKieTemporaryFile({
          url: prepared.videoUrl,
          mediaKind: "video",
          cache,
        })
      : Promise.resolve(""),
  ]);

  return {
    ...prepared,
    frontalImageUrl: klingHostedImageUrls[0] ?? "",
    referenceImageUrls: klingHostedImageUrls.slice(1).join(", "),
    videoUrl: klingHostedVideoUrl,
  };
};

const rewritePromptWithKieElementTokens = (
  prompt: string,
  klingElements: AiStudioKlingElement[]
): string => {
  const trimmedPrompt = prompt.trim();
  const availableTokenPairs = klingElements.reduce<
    Array<{ canonicalToken: string; legacyTokens: string[] }>
  >((accumulator, element, index) => {
    if (!hasKlingElementMedia(element)) return accumulator;
    const canonicalToken = resolveKieKlingElementToken(element, index, klingElements).trim();
    const legacyTokens = Array.from(
      new Set(
        [
          resolveAiStudioKlingElementToken(element, index, klingElements).trim(),
          resolveLegacyKieKlingElementToken(element, index, klingElements).trim(),
        ].filter(Boolean)
      )
    ).filter((token) => token.toLowerCase() !== canonicalToken.toLowerCase());
    if (!canonicalToken) return accumulator;
    if (accumulator.some((pair) => pair.canonicalToken === canonicalToken)) return accumulator;
    accumulator.push({ canonicalToken, legacyTokens });
    return accumulator;
  }, []);

  if (!availableTokenPairs.length) return trimmedPrompt;

  let rewrittenPrompt = trimmedPrompt;
  for (const { canonicalToken, legacyTokens } of availableTokenPairs) {
    for (const legacyToken of legacyTokens) {
      const legacyTokenPattern = new RegExp(
        `(^|\\s)@${escapeRegExp(legacyToken)}(?=$|[\\s,.;:!?])`,
        "g"
      );
      rewrittenPrompt = rewrittenPrompt.replace(legacyTokenPattern, `$1@${canonicalToken}`);
    }
  }

  const missingTokens = availableTokenPairs
    .map((pair) => pair.canonicalToken)
    .filter((token) => {
      const tokenPattern = new RegExp(`(^|\\s)@${escapeRegExp(token)}(?=$|[\\s,.;:!?])`);
      return !tokenPattern.test(rewrittenPrompt);
    });

  if (!missingTokens.length) return rewrittenPrompt;
  const suffix = missingTokens.map((token) => `@${token}`).join(" ");
  return rewrittenPrompt ? `${rewrittenPrompt} ${suffix}` : suffix;
};

const rewritePromptWithSeedanceEntityContext = (
  prompt: string,
  klingElements: AiStudioKlingElement[]
): string => {
  const trimmedPrompt = prompt.trim();
  const entityContexts = klingElements.reduce<
    Array<{ label: string; description: string; tokenAliases: string[] }>
  >((accumulator, element, index) => {
    if (!hasKlingElementMedia(element)) return accumulator;
    const label =
      element.name?.trim() || element.alias?.trim() || `Linked subject ${String(index + 1)}`;
    const description = element.description?.trim() ?? "";
    const tokenAliases = Array.from(
      new Set(
        [
          resolveKieKlingElementToken(element, index, klingElements).trim(),
          resolveAiStudioKlingElementToken(element, index, klingElements).trim(),
          resolveLegacyKieKlingElementToken(element, index, klingElements).trim(),
        ].filter(Boolean)
      )
    );
    accumulator.push({ label, description, tokenAliases });
    return accumulator;
  }, []);

  if (!entityContexts.length) return trimmedPrompt;

  let rewrittenPrompt = trimmedPrompt;
  entityContexts.forEach(({ label, tokenAliases }) => {
    tokenAliases.forEach((tokenAlias) => {
      const tokenPattern = new RegExp(`(^|\\s)@${escapeRegExp(tokenAlias)}(?=$|[\\s,.;:!?])`, "g");
      rewrittenPrompt = rewrittenPrompt.replace(tokenPattern, `$1${label}`);
    });
  });

  const entityContextLine = entityContexts
    .map(({ label, description }) => (description ? `${label}: ${description}` : label))
    .join("; ");

  if (!entityContextLine) return rewrittenPrompt;
  if (!rewrittenPrompt) return `Linked reference subjects: ${entityContextLine}.`;
  return `${rewrittenPrompt}\n\nLinked reference subjects: ${entityContextLine}.`;
};

const buildSeedancePromptPayload = ({
  cleanedPrompt,
  klingWorkflowMode,
  klingMultiPrompts,
  preparedKlingElements,
}: {
  cleanedPrompt: string;
  klingWorkflowMode: VideoSubmissionArgs["klingWorkflowMode"];
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"];
  preparedKlingElements: AiStudioKlingElement[];
}): { prompt: string } | { error: string } => {
  const normalizedMode = klingWorkflowMode === "custom" ? "custom" : "single";
  const basePrompt = rewritePromptWithSeedanceEntityContext(cleanedPrompt, preparedKlingElements);

  if (normalizedMode !== "custom") {
    return { prompt: basePrompt };
  }

  const activeShots = klingMultiPrompts
    .map((shot, index) => {
      const prompt = rewritePromptWithSeedanceEntityContext(shot.prompt, preparedKlingElements);
      if (!prompt.trim()) return null;
      return `Shot ${index + 1} (${Math.max(1, Math.round(shot.duration))}s): ${prompt}`;
    })
    .filter((shot): shot is string => Boolean(shot));

  if (!activeShots.length) {
    return { error: "Custom Seedance shot mode requires at least one shot prompt." };
  }

  return {
    prompt: [basePrompt, "Storyboard:", activeShots.join("\n")].filter(Boolean).join("\n\n"),
  };
};

const collectSeedanceLinkedEntityReferences = (klingElements: AiStudioKlingElement[]) =>
  klingElements.reduce<{ imageUrls: string[]; videoUrls: string[] }>(
    (accumulator, element) => {
      accumulator.imageUrls.push(...getAiStudioKlingElementReferenceUrls(element));
      const videoUrl = element.videoUrl.trim();
      if (videoUrl) accumulator.videoUrls.push(videoUrl);
      return accumulator;
    },
    { imageUrls: [], videoUrls: [] }
  );

type ResolvedKieKlingShotModePayload = {
  prompt: string;
  imageUrls: string[];
  multiShots: boolean;
  multiPrompt:
    | Array<{
        prompt: string;
        duration: number;
      }>
    | undefined;
  generateAudio: boolean;
  sound: boolean;
};

const resolveKieKlingShotModePayload = ({
  cleanedPrompt,
  klingWorkflowMode,
  klingMultiPrompts,
  preparedImageInputs,
  requestedAudio,
  preparedKlingElements,
}: {
  cleanedPrompt: string;
  klingWorkflowMode: VideoSubmissionArgs["klingWorkflowMode"];
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"];
  preparedImageInputs: string[];
  requestedAudio: boolean;
  preparedKlingElements: AiStudioKlingElement[];
}): ResolvedKieKlingShotModePayload | { error: string } => {
  const normalizedMode =
    klingWorkflowMode === "multi" || klingWorkflowMode === "custom" ? klingWorkflowMode : "single";

  if (normalizedMode === "custom") {
    const customShots = buildKieKlingMultiPromptPayload(klingMultiPrompts)?.map((shot) => ({
      ...shot,
      prompt: rewritePromptWithKieElementTokens(shot.prompt, preparedKlingElements),
    }));

    if (!customShots?.length) {
      return { error: "Custom Kling mode requires at least one shot prompt." };
    }

    return {
      prompt: customShots[0].prompt,
      imageUrls: preparedImageInputs.length ? [preparedImageInputs[0]] : [],
      multiShots: true,
      multiPrompt: customShots,
      generateAudio: true,
      sound: true,
    };
  }

  return {
    prompt: rewritePromptWithKieElementTokens(cleanedPrompt, preparedKlingElements),
    imageUrls:
      preparedImageInputs.length >= 2
        ? preparedImageInputs.slice(0, 2)
        : preparedImageInputs.slice(0, 1),
    multiShots: false,
    multiPrompt: undefined,
    generateAudio: requestedAudio,
    sound: requestedAudio,
  };
};

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  patch,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider:
    | "fal-kling"
    | "fal-kling-3"
    | "fal-seedance"
    | "fal-seedance-i2v"
    | "fal-veo"
    | "fal-veo-i2v"
    | "kie-veo"
    | "kie-kling"
    | "kie-seedance"
    | "kie-seedance-2"
    | "kie-seedance-2-fast";
  patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
  startPollingWithGeneration: VideoSubmissionArgs["startPollingWithGeneration"];
}) => {
  if ("status" in response && response.status === "queued") {
    startPollingWithGeneration(undefined, pollingProvider, patch, response);
    return;
  }
  const requestId =
    "request_id" in response && typeof response.request_id === "string"
      ? response.request_id
      : undefined;
  startPollingWithGeneration(requestId, pollingProvider, patch, response);
};

/**
 * Handles video model submissions. Returns true when a matching model is handled.
 */
export const handleVideoModelSubmission = async ({
  id,
  finalModel,
  cleanedPrompt,
  aspect,
  requestedDurationSeconds,
  requestedResolution,
  requestedAudio,
  preparedImageInputs,
  modelConfig,
  notifyGenerationFailure,
  updateOutputById,
  startPollingWithGeneration,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  videoCameraFixed,
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  seedance2ReturnLastFrame = false,
  seedance2WebSearch = false,
  klingCfgScale,
  klingWorkflowMode,
  klingMultiPrompts,
  klingElements,
}: VideoSubmissionArgs): Promise<boolean> => {
  const candidateMediaUrls = [
    ...preparedImageInputs,
    videoReferenceImageUrl ?? "",
    motionReferenceVideoUrl ?? "",
    ...seedance2ReferenceImageUrls,
    ...seedance2ReferenceVideoUrls,
    ...seedance2ReferenceAudioUrls,
    ...klingElements.map((element) => element.videoUrl.trim()),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  if (candidateMediaUrls.some((value) => isCharacterScopedMediaUrl(value))) {
    notifyGenerationFailure(
      id,
      "Character media references are blocked for video models. Use non-character media assets."
    );
    return true;
  }

  if (finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    const resolvedGenerationType =
      preparedImageInputs.length === 0 ? "TEXT_2_VIDEO" : "FIRST_AND_LAST_FRAMES_2_VIDEO";
    const keyframeImageUrlsRaw =
      preparedImageInputs.length >= 2
        ? preparedImageInputs.slice(0, 2)
        : preparedImageInputs.slice(0, 1);
    const kieUploadCache = new Map<string, Promise<string>>();
    const keyframeImageUrls = await uploadUrlsToKieTemporaryFiles({
      urls: keyframeImageUrlsRaw,
      mediaKind: "image",
      cache: kieUploadCache,
    });
    const aspectRatio = resolveVeoTextAspect(aspect, modelConfig);
    const duration = requestedDurationSeconds <= 5 ? 5 : 8;
    const resolution = resolveVeoResolution(requestedResolution);
    const response = await submitKieVeoImageToVideo({
      prompt: cleanedPrompt,
      image_url: keyframeImageUrls[0],
      image_urls: keyframeImageUrls,
      generation_type: resolvedGenerationType,
      aspect_ratio: aspectRatio,
      duration,
      resolution,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-veo",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === FAL_KLING_IMAGE_MODEL_ID || finalModel === FAL_KLING_TEXT_MODEL_ID) {
    notifyGenerationFailure(id, FAL_KLING_DISABLED_MESSAGE);
    return true;
  }

  if (
    finalModel === FAL_VEO_TEXT_MODEL_ID ||
    finalModel === FAL_VEO_IMAGE_MODEL_ID ||
    finalModel === FAL_VEO_FIRST_LAST_MODEL_ID
  ) {
    notifyGenerationFailure(id, FAL_VEO_DISABLED_MESSAGE);
    return true;
  }

  if (finalModel === FAL_SEEDANCE_TEXT_MODEL_ID || finalModel === FAL_SEEDANCE_IMAGE_MODEL_ID) {
    notifyGenerationFailure(id, FAL_NON_KIE_VIDEO_DISABLED_MESSAGE);
    return true;
  }

  if (finalModel === KIE_SEEDANCE_15_PRO_MODEL_ID) {
    const inputUrlsRaw =
      preparedImageInputs.length >= 2
        ? preparedImageInputs.slice(0, 2)
        : preparedImageInputs.slice(0, 1);
    const kieUploadCache = new Map<string, Promise<string>>();
    const inputUrls = await uploadUrlsToKieTemporaryFiles({
      urls: inputUrlsRaw,
      mediaKind: "image",
      cache: kieUploadCache,
    });
    const response = await submitKieSeedanceVideo({
      prompt: cleanedPrompt,
      input_urls: inputUrls,
      aspect_ratio: resolveSeedanceI2VAspect(aspect, modelConfig),
      duration: resolveSeedanceI2VDuration(requestedDurationSeconds),
      resolution: resolveSeedanceI2VResolution(requestedResolution),
      fixed_lens: videoCameraFixed,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-seedance",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === KIE_SEEDANCE_2_MODEL_ID || finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID) {
    const hasPreparedFirstFrame = preparedImageInputs.length >= 1;
    const hasPreparedLastFrame = preparedImageInputs.length >= 2;
    let preparedSeedanceLinkedElements: AiStudioKlingElement[] = [];
    try {
      const seedanceElementsWithMedia = klingElements.filter((element) =>
        hasKlingElementMedia(element)
      );
      if (seedanceElementsWithMedia.length) {
        const seedanceUploadCache = new Map<string, Promise<string>>();
        preparedSeedanceLinkedElements = await Promise.all(
          seedanceElementsWithMedia.map(
            async (element) =>
              await prepareKieHostedKlingElementForSubmission({
                element,
                cache: seedanceUploadCache,
              })
          )
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Seedance linked asset preparation failed";
      notifyGenerationFailure(id, `Seedance linked asset preparation failed: ${message}`);
      return true;
    }
    const linkedEntityReferences = collectSeedanceLinkedEntityReferences(
      preparedSeedanceLinkedElements
    );
    const hasLinkedEntityReferences = Boolean(
      linkedEntityReferences.imageUrls.length || linkedEntityReferences.videoUrls.length
    );
    const hasMultimodalReferences = Boolean(
      seedance2ReferenceImageUrls.length ||
      seedance2ReferenceVideoUrls.length ||
      seedance2ReferenceAudioUrls.length ||
      linkedEntityReferences.imageUrls.length ||
      linkedEntityReferences.videoUrls.length
    );
    const hasFrameMode = Boolean(hasPreparedFirstFrame || hasPreparedLastFrame);
    if (hasLinkedEntityReferences && hasFrameMode) {
      notifyGenerationFailure(
        id,
        "Seedance 2.0 linked assets cannot be combined with first/last frame mode."
      );
      return true;
    }
    const effectiveInputMode =
      (seedance2InputMode === "multimodal" || hasLinkedEntityReferences) && hasMultimodalReferences
        ? "multimodal"
        : hasPreparedLastFrame
          ? "first-last"
          : hasPreparedFirstFrame
            ? "first-frame"
            : "text";
    const promptPayload = buildSeedancePromptPayload({
      cleanedPrompt,
      klingWorkflowMode,
      klingMultiPrompts,
      preparedKlingElements: preparedSeedanceLinkedElements,
    });
    if ("error" in promptPayload) {
      notifyGenerationFailure(id, promptPayload.error);
      return true;
    }
    const submitSeedance2 =
      finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID
        ? submitKieSeedance2FastVideo
        : submitKieSeedance2Video;
    const pollingProvider =
      finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID ? "kie-seedance-2-fast" : "kie-seedance-2";
    const kieUploadCache = new Map<string, Promise<string>>();
    const [
      firstFrameUrl,
      lastFrameUrl,
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
    ] = await Promise.all([
      effectiveInputMode === "first-frame" || effectiveInputMode === "first-last"
        ? uploadUrlToKieTemporaryFile({
            url: preparedImageInputs[0] ?? "",
            mediaKind: "image",
            cache: kieUploadCache,
          })
        : Promise.resolve(""),
      effectiveInputMode === "first-last"
        ? uploadUrlToKieTemporaryFile({
            url: preparedImageInputs[1] ?? "",
            mediaKind: "image",
            cache: kieUploadCache,
          })
        : Promise.resolve(""),
      effectiveInputMode === "multimodal"
        ? uploadUrlsToKieTemporaryFiles({
            urls: Array.from(
              new Set([...seedance2ReferenceImageUrls, ...linkedEntityReferences.imageUrls])
            ),
            mediaKind: "image",
            cache: kieUploadCache,
          })
        : Promise.resolve([]),
      effectiveInputMode === "multimodal"
        ? uploadUrlsToKieTemporaryFiles({
            urls: Array.from(
              new Set([...seedance2ReferenceVideoUrls, ...linkedEntityReferences.videoUrls])
            ),
            mediaKind: "video",
            cache: kieUploadCache,
          })
        : Promise.resolve([]),
      effectiveInputMode === "multimodal"
        ? uploadUrlsToKieTemporaryFiles({
            urls: seedance2ReferenceAudioUrls,
            mediaKind: "audio",
            cache: kieUploadCache,
          })
        : Promise.resolve([]),
    ]);

    const response = await submitSeedance2({
      prompt: promptPayload.prompt,
      ...(effectiveInputMode === "first-frame" || effectiveInputMode === "first-last"
        ? { first_frame_url: firstFrameUrl }
        : {}),
      ...(effectiveInputMode === "first-last" ? { last_frame_url: lastFrameUrl } : {}),
      ...(effectiveInputMode === "multimodal" && referenceImageUrls.length
        ? { reference_image_urls: referenceImageUrls }
        : {}),
      ...(effectiveInputMode === "multimodal" && referenceVideoUrls.length
        ? { reference_video_urls: referenceVideoUrls }
        : {}),
      ...(effectiveInputMode === "multimodal" && referenceAudioUrls.length
        ? { reference_audio_urls: referenceAudioUrls }
        : {}),
      aspect_ratio: resolveSeedanceI2VAspect(aspect, modelConfig),
      duration: resolveSeedance2Duration(requestedDurationSeconds),
      resolution: resolveSeedance2Resolution(requestedResolution),
      generate_audio: requestedAudio,
      return_last_frame: seedance2ReturnLastFrame,
      web_search: seedance2WebSearch,
    });
    handoffSubmitResponse({
      response,
      pollingProvider,
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === KIE_KLING_30_MODEL_ID) {
    if (videoReferenceMode === "motion") {
      if (!videoReferenceImageUrl) {
        notifyGenerationFailure(id, "Motion Control requires a character image");
        return true;
      }
      if (!motionReferenceVideoUrl) {
        notifyGenerationFailure(id, "Motion Control requires a motion reference video");
        return true;
      }

      const characterImageUrl = preparedImageInputs[0];
      if (!characterImageUrl) {
        notifyGenerationFailure(id, "Failed to prepare character image");
        return true;
      }

      let motionVideoUrlFinal = motionReferenceVideoUrl;
      const requiresUpload = needsVideoUpload(motionReferenceVideoUrl);
      try {
        if (requiresUpload) {
          updateOutputById(id, (item) => ({
            ...item,
            timestamp: "Uploading video...",
          }));
        }

        const preparedMotionVideoUrl = await prepareVideoUrlForSubmission(motionReferenceVideoUrl);
        if (!preparedMotionVideoUrl) {
          throw new Error("Motion reference video is missing.");
        }
        motionVideoUrlFinal = preparedMotionVideoUrl;

        if (requiresUpload) {
          updateOutputById(id, (item) => ({
            ...item,
            timestamp: "Video uploaded",
          }));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Motion reference preparation failed";
        const prefix = requiresUpload
          ? "Video upload failed"
          : "Motion reference preparation failed";
        notifyGenerationFailure(id, `${prefix}: ${message}`);
        return true;
      }

      const motionResolution = resolveKlingResolution(requestedResolution);
      const finalPrompt = cleanedPrompt || "Transfer motion from reference video to character";
      const response = await submitKieKlingImageToVideo({
        prompt: finalPrompt,
        image_url: characterImageUrl,
        image_urls: [characterImageUrl],
        input_urls: [characterImageUrl],
        video_url: motionVideoUrlFinal,
        video_urls: [motionVideoUrlFinal],
        resolution: motionResolution,
        mode: motionResolution,
        generate_audio: requestedAudio,
        character_orientation: "image",
        background_source: "input_video",
      });
      handoffSubmitResponse({
        response,
        pollingProvider: "kie-kling",
        patch: {
          previewUrl: characterImageUrl,
        },
        startPollingWithGeneration,
      });
      return true;
    }

    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Kie Kling 3.0 requires at least one reference image.");
      return true;
    }
    let elementsPayload: ReturnType<typeof buildKieKlingElementsPayload>;
    let preparedKlingElements: AiStudioKlingElement[] = klingElements;
    try {
      const kieUploadCache = new Map<string, Promise<string>>();
      preparedKlingElements = await Promise.all(
        klingElements.map(
          async (element) =>
            await prepareKieHostedKlingElementForSubmission({
              element,
              cache: kieUploadCache,
            })
        )
      );
      elementsPayload = buildKieKlingElementsPayload(preparedKlingElements);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kling element reference preparation failed";
      notifyGenerationFailure(id, `Kling element reference preparation failed: ${message}`);
      return true;
    }
    const aspectRatio = resolveKieKlingAspect(aspect, modelConfig);
    const duration = resolveKieKlingDuration(requestedDurationSeconds);
    const resolvedShotModePayload = resolveKieKlingShotModePayload({
      cleanedPrompt,
      klingWorkflowMode,
      klingMultiPrompts,
      preparedImageInputs,
      requestedAudio,
      preparedKlingElements,
    });
    if ("error" in resolvedShotModePayload) {
      notifyGenerationFailure(id, resolvedShotModePayload.error);
      return true;
    }
    const response = await submitKieKlingImageToVideo({
      prompt: resolvedShotModePayload.prompt,
      image_url: preparedImageInputs[0],
      image_urls: resolvedShotModePayload.imageUrls,
      aspect_ratio: aspectRatio,
      duration,
      resolution: resolveKlingResolution(requestedResolution),
      mode: resolveKieKlingMode(requestedResolution),
      cfg_scale: klingCfgScale,
      generate_audio: resolvedShotModePayload.generateAudio,
      sound: resolvedShotModePayload.sound,
      multi_shots: resolvedShotModePayload.multiShots,
      multi_prompt: resolvedShotModePayload.multiPrompt,
      kling_elements: elementsPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-kling",
      startPollingWithGeneration,
    });
    return true;
  }

  return false;
};
