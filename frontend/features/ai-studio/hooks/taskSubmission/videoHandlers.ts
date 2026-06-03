/**
 * Video submission handlers for AI Studio task generation.
 */
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { isCharacterScopedMediaUrl } from "../../../../lib/mediaStoragePath";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { normalizeDurationForModel } from "../../../../lib/model-runtime/modelDurationConstraints";
import type { VideoSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  getAiStudioKlingElementReferenceUrls,
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  resolveKieKlingElementToken,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { needsImageUpload, prepareImageUrlForSubmission } from "../../utils/imageUpload";
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
  resolveVeoResolution,
  resolveVeoTextAspect,
} from "./videoPayloads";

const KIE_UPLOAD_ROUTE = "/api/kie/upload-url";
const KIE_HOSTED_MEDIA_HOST_SUFFIXES = [
  "kieai.redpandaai.co",
  "tempfile.redpandaai.co",
  "tempfile.aiquickdraw.com",
  "tempfileb.aiquickdraw.com",
] as const;

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

const resolveKieUploadPath = (mediaKind: "image" | "video" | "audio"): string =>
  mediaKind === "image"
    ? "shortpulse/kie-video/images"
    : mediaKind === "video"
      ? "shortpulse/kie-video/videos"
      : "shortpulse/kie-video/audio";

const resolveKieUploadMimeType = (
  mediaKind: "image" | "video" | "audio",
  mimeType?: string
): string =>
  mimeType?.trim() ||
  (mediaKind === "image" ? "image/png" : mediaKind === "video" ? "video/mp4" : "audio/mpeg");

const resolveKieUploadFilename = (
  mediaKind: "image" | "video" | "audio",
  mimeType?: string
): string => {
  const extension =
    mimeType?.split("/")[1]?.trim() ||
    (mediaKind === "image" ? "png" : mediaKind === "video" ? "mp4" : "mp3");
  return `kie-${mediaKind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
};

type KieUploadRoutePayload = {
  error?: string;
  details?: string;
  url?: string;
};

type KieUploadRouteResponseBodyFormat = "json" | "html" | "text" | "empty" | "unavailable";

const readKieUploadRoutePayload = async (
  response: Response
): Promise<{
  payload: KieUploadRoutePayload;
  bodyFormat: KieUploadRouteResponseBodyFormat;
}> => {
  if (typeof response.text === "function") {
    const rawText = await response.text().catch(() => null);
    if (typeof rawText === "string") {
      const trimmed = rawText.trim();
      if (!trimmed) {
        return {
          payload: {},
          bodyFormat: "empty",
        };
      }
      try {
        return {
          payload: JSON.parse(trimmed) as KieUploadRoutePayload,
          bodyFormat: "json",
        };
      } catch {
        return {
          payload: {},
          bodyFormat: trimmed.startsWith("<") ? "html" : "text",
        };
      }
    }
  }

  if (typeof response.json === "function") {
    const payload = (await response.json().catch(() => ({}))) as KieUploadRoutePayload;
    return {
      payload,
      bodyFormat: "json",
    };
  }

  return {
    payload: {},
    bodyFormat: "unavailable",
  };
};

const resolveKieUploadFailureMessage = ({
  response,
  payload,
  bodyFormat,
}: {
  response: Response;
  payload: KieUploadRoutePayload;
  bodyFormat: KieUploadRouteResponseBodyFormat;
}): string => {
  const error =
    typeof payload.error === "string" && payload.error.trim().length
      ? payload.error.trim()
      : `Temporary upload failed (${response.status})`;
  const details =
    typeof payload.details === "string" && payload.details.trim().length
      ? payload.details.trim()
      : bodyFormat === "html"
        ? "Upload route returned an HTML error response."
        : bodyFormat === "text"
          ? "Upload route returned a plain-text error response."
          : bodyFormat === "empty"
            ? "Upload route returned an empty error response."
            : bodyFormat === "unavailable"
              ? "Upload route returned an unreadable error response."
              : null;
  return details ? `${error}: ${details}` : error;
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

    const { payload, bodyFormat } = await readKieUploadRoutePayload(response);
    if (!response.ok) {
      throw new Error(
        resolveKieUploadFailureMessage({
          response,
          payload,
          bodyFormat,
        })
      );
    }

    const uploadedUrl = payload.url?.trim();
    if (!uploadedUrl) {
      throw new Error("Temporary upload failed: missing uploaded URL.");
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

const uploadBlobToKieTemporaryFile = async ({
  blob,
  mediaKind,
  cacheKey,
  cache,
}: {
  blob: Blob;
  mediaKind: "image" | "video" | "audio";
  cacheKey: string;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchWithAuth(KIE_UPLOAD_ROUTE, {
      method: "POST",
      headers: {
        "Content-Type": resolveKieUploadMimeType(mediaKind, blob.type),
        "x-shortpulse-upload-path": resolveKieUploadPath(mediaKind),
        "x-shortpulse-upload-filename": resolveKieUploadFilename(mediaKind, blob.type),
      },
      body: blob,
      shortpulseLogScope: "generation",
    });

    const { payload, bodyFormat } = await readKieUploadRoutePayload(response);
    if (!response.ok) {
      throw new Error(
        resolveKieUploadFailureMessage({
          response,
          payload,
          bodyFormat,
        })
      );
    }

    const uploadedUrl = payload.url?.trim();
    if (!uploadedUrl) {
      throw new Error("Temporary upload failed: missing uploaded URL.");
    }
    return uploadedUrl;
  })();

  cache.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
};

const uploadSourceUrlToKieTemporaryFile = async ({
  sourceUrl,
  mediaKind,
  cache,
}: {
  sourceUrl: string;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = sourceUrl.trim();
  if (!normalizedUrl) return "";
  const cacheKey = `source:${mediaKind}:${normalizedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const sourceResponse = await fetch(normalizedUrl);
    if (!sourceResponse.ok) {
      throw new Error(`Unable to read local ${mediaKind} input (${sourceResponse.status}).`);
    }
    const blob = await sourceResponse.blob();
    return await uploadBlobToKieTemporaryFile({
      blob,
      mediaKind,
      cacheKey: `${cacheKey}:blob`,
      cache,
    });
  })();

  cache.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(cacheKey);
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

const prepareKieHostedKlingElementForSubmission = async ({
  element,
  cache,
}: {
  element: AiStudioKlingElement;
  cache: Map<string, Promise<string>>;
}): Promise<AiStudioKlingElement> => {
  const rawImageUrls = getAiStudioKlingElementReferenceUrls(element)
    .map((value) => value.trim())
    .filter(Boolean);

  const [klingHostedImageUrls, klingHostedVideoUrl] = await Promise.all([
    Promise.all(
      rawImageUrls.map(async (url) => {
        if (needsImageUpload(url)) {
          return await uploadSourceUrlToKieTemporaryFile({
            sourceUrl: url,
            mediaKind: "image",
            cache,
          });
        }
        const preparedUrl = await prepareImageUrlForSubmission(url);
        return preparedUrl
          ? await uploadUrlToKieTemporaryFile({
              url: preparedUrl,
              mediaKind: "image",
              cache,
            })
          : "";
      })
    ),
    element.videoUrl.trim()
      ? needsVideoUpload(element.videoUrl)
        ? uploadSourceUrlToKieTemporaryFile({
            sourceUrl: element.videoUrl,
            mediaKind: "video",
            cache,
          })
        : prepareVideoUrlForSubmission(element.videoUrl).then((preparedUrl) =>
            preparedUrl
              ? uploadUrlToKieTemporaryFile({
                  url: preparedUrl,
                  mediaKind: "video",
                  cache,
                })
              : ""
          )
      : Promise.resolve(""),
  ]);

  return {
    ...element,
    frontalImageUrl: klingHostedImageUrls[0] ?? "",
    referenceImageUrls: klingHostedImageUrls.slice(1).join(", "),
    videoUrl: klingHostedVideoUrl,
  };
};

const prepareKieInputUrl = async ({
  rawUrl,
  preparedUrl,
  mediaKind,
  cache,
}: {
  rawUrl?: string | null;
  preparedUrl?: string | null;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedRawUrl = rawUrl?.trim() ?? "";
  const normalizedPreparedUrl = preparedUrl?.trim() ?? "";
  const browserUploadSourceUrl =
    normalizedRawUrl &&
    (mediaKind === "image"
      ? needsImageUpload(normalizedRawUrl)
      : mediaKind === "video"
        ? needsVideoUpload(normalizedRawUrl)
        : false)
      ? normalizedRawUrl
      : "";
  if (browserUploadSourceUrl) {
    return await uploadSourceUrlToKieTemporaryFile({
      sourceUrl: browserUploadSourceUrl,
      mediaKind,
      cache,
    });
  }

  const sourceUrl = normalizedPreparedUrl || normalizedRawUrl;
  if (!sourceUrl) return "";
  return await uploadUrlToKieTemporaryFile({
    url: sourceUrl,
    mediaKind,
    cache,
  });
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
    const legacyTokens = resolveAiStudioKlingElementLegacyTokens(
      element,
      index,
      klingElements
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
    const label = resolveAiStudioKlingElementDisplayLabel(element, index, klingElements);
    const description = element.description?.trim() ?? "";
    const tokenAliases = Array.from(
      new Set(
        [
          resolveKieKlingElementToken(element, index, klingElements).trim(),
          ...resolveAiStudioKlingElementLegacyTokens(element, index, klingElements),
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

type HiddenShotModePromptCompositionMode = "single" | "multi";

const composeHiddenShotModePrompt = ({
  prompt,
  mode,
}: {
  prompt: string;
  mode: HiddenShotModePromptCompositionMode;
}): string => {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return trimmedPrompt;

  const hiddenInstruction =
    mode === "multi"
      ? "Create this as a multi-shot sequence with multiple distinct shots or scene beats. Use cuts or shot changes as needed to cover the described action while preserving continuity."
      : "Create this as one continuous uninterrupted shot only. Do not introduce cuts, shot changes, montage beats, or separate camera setups. If multiple actions are described, stage them inside the same continuous shot.";

  return `${hiddenInstruction}\n\n${trimmedPrompt}`;
};

const buildSeedancePromptPayload = ({
  cleanedPrompt,
  klingWorkflowMode,
  preparedKlingElements,
}: {
  cleanedPrompt: string;
  klingWorkflowMode: VideoSubmissionArgs["klingWorkflowMode"];
  preparedKlingElements: AiStudioKlingElement[];
}): { prompt: string } | { error: string } => {
  return {
    prompt: composeHiddenShotModePrompt({
      prompt: rewritePromptWithSeedanceEntityContext(cleanedPrompt, preparedKlingElements),
      mode: klingWorkflowMode === "multi" || klingWorkflowMode === "custom" ? "multi" : "single",
    }),
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
    prompt: composeHiddenShotModePrompt({
      prompt: rewritePromptWithKieElementTokens(cleanedPrompt, preparedKlingElements),
      mode: normalizedMode === "multi" ? "multi" : "single",
    }),
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
  pollingProvider: VideoPollingProvider;
  patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
  startPollingWithGeneration: VideoSubmissionArgs["startPollingWithGeneration"];
}) => {
  const requestId = typeof response.request_id === "string" ? response.request_id : undefined;
  startPollingWithGeneration(requestId, pollingProvider, patch, response);
};

type VideoPollingProvider = "kie-veo" | "kie-kling" | "kie-seedance-2" | "kie-seedance-2-fast";

type VideoHandlerContext = {
  id: string;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedDurationSeconds: number;
  requestedResolution?: string;
  requestedAudio: boolean;
  preparedImageInputs: string[];
  rawImageInputs: string[];
  modelConfig: VideoSubmissionArgs["modelConfig"];
  notifyGenerationFailure: VideoSubmissionArgs["notifyGenerationFailure"];
  updateOutputById: VideoSubmissionArgs["updateOutputById"];
  videoReferenceMode: VideoSubmissionArgs["videoReferenceMode"];
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  videoCameraFixed: boolean;
  seedance2InputMode?: VideoSubmissionArgs["seedance2InputMode"];
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingCfgScale: number;
  klingWorkflowMode?: VideoSubmissionArgs["klingWorkflowMode"];
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"];
  klingElements: AiStudioKlingElement[];
  shortpulseSubmitPayload: Record<string, unknown>;
};

type VideoSubmissionAdapterResult =
  | { handled: false }
  | {
      handled: true;
      response?: FalSubmitResponse;
      pollingProvider?: VideoPollingProvider;
      patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
    };

type VideoSubmissionAdapter = {
  key: VideoSubmissionAdapterKey;
  matches: (modelId: string) => boolean;
  submit: (context: VideoHandlerContext) => Promise<VideoSubmissionAdapterResult>;
};

const videoSubmissionAdapters: VideoSubmissionAdapter[] = [
  {
    key: "kie-veo-31-fast-i2v",
    matches: (modelId) => modelId === KIE_VEO_31_FAST_I2V_MODEL_ID,
    submit: async ({
      finalModel,
      cleanedPrompt,
      aspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      rawImageInputs,
      modelConfig,
      shortpulseSubmitPayload,
    }) => {
      const resolvedGenerationType =
        preparedImageInputs.length === 0 ? "TEXT_2_VIDEO" : "FIRST_AND_LAST_FRAMES_2_VIDEO";
      const keyframeImageUrlsRaw =
        preparedImageInputs.length >= 2
          ? preparedImageInputs.slice(0, 2)
          : preparedImageInputs.slice(0, 1);
      const kieUploadCache = new Map<string, Promise<string>>();
      const keyframeImageUrls = await uploadUrlsToKieTemporaryFiles({
        urls: await Promise.all(
          keyframeImageUrlsRaw.map(
            async (preparedUrl, index) =>
              await prepareKieInputUrl({
                rawUrl: rawImageInputs[index],
                preparedUrl,
                mediaKind: "image",
                cache: kieUploadCache,
              })
          )
        ),
        mediaKind: "image",
        cache: kieUploadCache,
      });
      const aspectRatio = resolveVeoTextAspect(aspect, modelConfig);
      const duration =
        normalizeDurationForModel(requestedDurationSeconds, finalModel) ??
        modelConfig?.defaultDurationSeconds ??
        6;
      const resolution = resolveVeoResolution(requestedResolution);
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: cleanedPrompt,
        image_url: keyframeImageUrls[0],
        image_urls: keyframeImageUrls,
        generation_type: resolvedGenerationType,
        aspect_ratio: aspectRatio,
        duration,
        resolution,
        generate_audio: requestedAudio,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "kie-veo",
      };
    },
  },
  {
    key: "kie-seedance-2",
    matches: (modelId) =>
      modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      aspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      rawImageInputs,
      modelConfig,
      notifyGenerationFailure,
      klingWorkflowMode,
      seedance2InputMode = "text",
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingElements,
      shortpulseSubmitPayload,
    }) => {
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
        return { handled: true };
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
        return { handled: true };
      }
      const effectiveInputMode =
        (seedance2InputMode === "multimodal" || hasLinkedEntityReferences) &&
        hasMultimodalReferences
          ? "multimodal"
          : hasPreparedLastFrame
            ? "first-last"
            : hasPreparedFirstFrame
              ? "first-frame"
              : "text";
      const promptPayload = buildSeedancePromptPayload({
        cleanedPrompt,
        klingWorkflowMode,
        preparedKlingElements: preparedSeedanceLinkedElements,
      });
      if ("error" in promptPayload) {
        notifyGenerationFailure(id, promptPayload.error);
        return { handled: true };
      }
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
          ? prepareKieInputUrl({
              rawUrl: rawImageInputs[0],
              preparedUrl: preparedImageInputs[0] ?? "",
              mediaKind: "image",
              cache: kieUploadCache,
            })
          : Promise.resolve(""),
        effectiveInputMode === "first-last"
          ? prepareKieInputUrl({
              rawUrl: rawImageInputs[1],
              preparedUrl: preparedImageInputs[1] ?? "",
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

      const response = await submitQueuedGenerationByModelId(finalModel, {
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
        resolution: resolveSeedance2Resolution(requestedResolution, modelConfig),
        generate_audio: requestedAudio,
        return_last_frame: seedance2ReturnLastFrame,
        web_search: seedance2WebSearch,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider,
      };
    },
  },
  {
    key: "kie-kling-3",
    matches: (modelId) => modelId === KIE_KLING_30_MODEL_ID,
    submit: async ({
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
      videoReferenceMode,
      videoReferenceImageUrl,
      motionReferenceVideoUrl,
      klingCfgScale,
      klingWorkflowMode,
      klingMultiPrompts,
      klingElements,
      shortpulseSubmitPayload,
    }) => {
      if (videoReferenceMode === "motion") {
        if (!videoReferenceImageUrl) {
          notifyGenerationFailure(id, "Motion Control requires a character image");
          return { handled: true };
        }
        if (!motionReferenceVideoUrl) {
          notifyGenerationFailure(id, "Motion Control requires a motion reference video");
          return { handled: true };
        }

        const characterImageUrl = preparedImageInputs[0];
        if (!characterImageUrl) {
          notifyGenerationFailure(id, "Failed to prepare character image");
          return { handled: true };
        }

        let motionVideoUrlFinal = motionReferenceVideoUrl;
        if (needsVideoUpload(motionReferenceVideoUrl)) {
          notifyGenerationFailure(
            id,
            "Motion clip is not ready yet. Re-add it and wait for upload before generating."
          );
          return { handled: true };
        }
        try {
          const preparedMotionVideoUrl =
            await prepareVideoUrlForSubmission(motionReferenceVideoUrl);
          if (!preparedMotionVideoUrl) {
            throw new Error("Motion reference video is missing.");
          }
          motionVideoUrlFinal = preparedMotionVideoUrl;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Motion reference preparation failed";
          notifyGenerationFailure(id, `Motion reference preparation failed: ${message}`);
          return { handled: true };
        }

        const motionResolution = resolveKlingResolution(requestedResolution);
        const finalPrompt = cleanedPrompt || "Transfer motion from reference video to character";
        const response = await submitQueuedGenerationByModelId(finalModel, {
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
          ...shortpulseSubmitPayload,
        });
        return {
          handled: true,
          response,
          pollingProvider: "kie-kling",
          patch: {
            previewUrl: characterImageUrl,
          },
        };
      }

      if (!preparedImageInputs.length) {
        notifyGenerationFailure(id, "Kling 3.0 requires at least one reference image.");
        return { handled: true };
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
        return { handled: true };
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
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(finalModel, {
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
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "kie-kling",
      };
    },
  },
];

export const listVideoSubmissionAdapterKeys = (): VideoSubmissionAdapterKey[] =>
  videoSubmissionAdapters.map(({ key }) => key);

export const resolveVideoSubmissionAdapterKey = (
  modelId: string
): VideoSubmissionAdapterKey | null =>
  videoSubmissionAdapters.find(({ matches }) => matches(modelId))?.key ?? null;

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
  rawImageInputs = preparedImageInputs,
  modelConfig,
  notifyGenerationFailure,
  updateOutputById,
  generationReplay,
  characterContext,
  styleContext,
  shortpulseContext,
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
  const shortpulseSubmitPayload = {
    ...(generationReplay ? { generation_replay: generationReplay } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };
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
  const adapter = videoSubmissionAdapters.find(({ matches }) => matches(finalModel));
  if (!adapter) return false;
  const result = await adapter.submit({
    id,
    finalModel,
    cleanedPrompt,
    aspect,
    requestedDurationSeconds,
    requestedResolution,
    requestedAudio,
    preparedImageInputs,
    rawImageInputs,
    modelConfig,
    notifyGenerationFailure,
    updateOutputById,
    videoReferenceMode,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    videoCameraFixed,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
    klingCfgScale,
    klingWorkflowMode,
    klingMultiPrompts,
    klingElements,
    shortpulseSubmitPayload,
  });
  if (result.handled && result.response && result.pollingProvider) {
    handoffSubmitResponse({
      response: result.response,
      pollingProvider: result.pollingProvider,
      patch: result.patch,
      startPollingWithGeneration,
    });
  }
  return result.handled;
};
