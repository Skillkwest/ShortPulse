/**
 * Video submission handlers for AI Studio task generation.
 */
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { resolveInternalMediaRefStoragePath } from "../../../../lib/media/internalMediaRefs";
import { isCharacterScopedMediaUrl } from "../../../../lib/mediaStoragePath";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../../lib/model-runtime/falModelIds";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { normalizeDurationForModel } from "../../../../lib/model-runtime/modelDurationConstraints";
import type { VideoSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import {
  needsVideoUpload,
  prepareMotionReferenceVideoUrl,
  prepareVideoUrlForSubmission,
} from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  getAiStudioKlingElementReferenceUrls,
  isPromptTokenEligibleKlingElement,
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  resolveKieKlingElementToken,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { needsImageUpload, prepareImageUrlForSubmission } from "../../utils/imageUpload";
import {
  buildKieKlingElementsPayload,
  KIE_KLING_MAX_IMAGE_ELEMENT_URLS,
  resolveKieKlingAspect,
  resolveKieKlingDuration,
  resolveKieKlingMode,
  resolveKlingResolution,
  resolveLipSyncResolution,
  resolveSeedanceI2VAspect,
  resolveSeedance2Duration,
  resolveSeedance2Resolution,
  resolveVeoResolution,
  resolveVeoTextAspect,
} from "./videoPayloads";
import {
  composeHiddenShotModePrompt,
  isKlingSinglePromptOverComposedLimit,
  rewritePromptWithKieElementTokens,
} from "../../logic/klingShotModePromptComposition";
import { composeSeedanceHiddenShotModePrompt } from "../../logic/seedanceShotModePromptComposition";
import { resolveLipSyncAudioDurationGuardrail } from "../../logic/lipSyncDuration";
import {
  getDurableLipSyncAudioUrl,
  getLipSyncAudioStoragePath,
  isNonDurableLipSyncAudioUrl,
  isLipSyncAudioReadyForSubmit,
} from "../../logic/lipSyncAudioState";
import { resolveInternalMediaRefForUrl } from "../../logic/referenceInputInternalMediaRegistry";

const FAL_UPLOAD_ROUTE = "/api/fal/upload-url";
const KIE_UPLOAD_ROUTE = "/api/kie/upload-url";
const FAL_INPUT_STAGING_TIMEOUT_MS = 65_000;
const KIE_HOSTED_MEDIA_HOST_SUFFIXES = [
  "kieai.redpandaai.co",
  "tempfile.redpandaai.co",
  "tempfile.aiquickdraw.com",
  "tempfileb.aiquickdraw.com",
] as const;

const VALIDATION_FAILURE_CONTEXT = {
  telemetryMode: "validation",
  reasonCode: "USER_INPUT_VALIDATION",
} as const;

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

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
};

const isLocalAudioUploadSourceUrl = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("blob:") || /^data:audio\//i.test(normalized)) return true;
  let parsed: URL;
  try {
    parsed = new URL(
      normalized,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) return true;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  return isPrivateIpv4Address(hostname);
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

const resolveFalUploadMimeType = (mediaKind: "image" | "audio", mimeType?: string): string =>
  mimeType?.trim() || (mediaKind === "image" ? "image/png" : "audio/mpeg");

const resolveFalUploadFilename = (mediaKind: "image" | "audio", mimeType?: string): string => {
  const extension = mimeType?.split("/")[1]?.trim() || (mediaKind === "image" ? "png" : "mp3");
  return `fal-${mediaKind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
};

const isAbortLikeError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  if (maybeError.name === "AbortError") return true;
  return (
    typeof maybeError.message === "string" &&
    /\babort(?:ed)?\b|signal is aborted|timed out|timeout/i.test(maybeError.message)
  );
};

const fetchFalUploadWithTimeout = async (init: Parameters<typeof fetchWithAuth>[1]) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FAL_INPUT_STAGING_TIMEOUT_MS);
  try {
    return await fetchWithAuth(FAL_UPLOAD_ROUTE, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error("Lip Sync media staging timed out before provider submit.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const uploadUrlToFalCdn = async ({
  url,
  mediaKind,
  cache,
}: {
  url: string;
  mediaKind: "image" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return "";

  const cacheKey = `fal-url:${mediaKind}:${normalizedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchFalUploadWithTimeout({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: normalizedUrl,
        mediaKind,
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
      throw new Error("Fal upload failed: missing uploaded URL.");
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

const uploadStoragePathToFalCdn = async ({
  storagePath,
  mediaKind,
  cache,
}: {
  storagePath: string;
  mediaKind: "image" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedStoragePath = storagePath.trim();
  if (!normalizedStoragePath) return "";
  const cacheKey = `fal-storage:${mediaKind}:${normalizedStoragePath}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchFalUploadWithTimeout({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storagePath: normalizedStoragePath,
        mediaKind,
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
      throw new Error("Fal upload failed: missing uploaded URL.");
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

const uploadBlobToFalCdn = async ({
  blob,
  mediaKind,
  cacheKey,
  cache,
}: {
  blob: Blob;
  mediaKind: "image" | "audio";
  cacheKey: string;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchFalUploadWithTimeout({
      method: "POST",
      headers: {
        "Content-Type": resolveFalUploadMimeType(mediaKind, blob.type),
        "x-shortpulse-upload-filename": resolveFalUploadFilename(mediaKind, blob.type),
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
      throw new Error("Fal upload failed: missing uploaded URL.");
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

const uploadSourceUrlToFalCdn = async ({
  sourceUrl,
  mediaKind,
  cache,
}: {
  sourceUrl: string;
  mediaKind: "image" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = sourceUrl.trim();
  if (!normalizedUrl) return "";
  const cacheKey = `fal-source:${mediaKind}:${normalizedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const sourceResponse = await fetch(normalizedUrl);
    if (!sourceResponse.ok) {
      throw new Error(`Unable to read local ${mediaKind} input (${sourceResponse.status}).`);
    }
    const blob = await sourceResponse.blob();
    return await uploadBlobToFalCdn({
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

const prepareFalInputUrl = async ({
  rawUrl,
  preparedUrl,
  storagePath,
  mediaKind,
  cache,
}: {
  rawUrl?: string | null;
  preparedUrl?: string | null;
  storagePath?: string | null;
  mediaKind: "image" | "audio";
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedStoragePath = storagePath?.trim() ?? "";
  if (normalizedStoragePath) {
    return await uploadStoragePathToFalCdn({
      storagePath: normalizedStoragePath,
      mediaKind,
      cache,
    });
  }

  const normalizedRawUrl = rawUrl?.trim() ?? "";
  const normalizedPreparedUrl = preparedUrl?.trim() ?? "";
  const browserUploadSourceUrl =
    normalizedRawUrl &&
    !normalizedPreparedUrl &&
    (mediaKind === "image"
      ? needsImageUpload(normalizedRawUrl)
      : isLocalAudioUploadSourceUrl(normalizedRawUrl))
      ? normalizedRawUrl
      : "";
  if (browserUploadSourceUrl) {
    return await uploadSourceUrlToFalCdn({
      sourceUrl: browserUploadSourceUrl,
      mediaKind,
      cache,
    });
  }

  const sourceUrl = normalizedPreparedUrl || normalizedRawUrl;
  if (!sourceUrl) return "";
  return await uploadUrlToFalCdn({
    url: sourceUrl,
    mediaKind,
    cache,
  });
};

const resolveLipSyncImageStoragePath = ({
  explicitRef,
  rawImageUrl,
  preparedImageUrl,
}: {
  explicitRef?: NonNullable<VideoSubmissionArgs["internalMediaRefs"]>[number] | null;
  rawImageUrl: string;
  preparedImageUrl: string;
}): string | null =>
  resolveInternalMediaRefStoragePath(explicitRef ?? null) ??
  resolveInternalMediaRefStoragePath(resolveInternalMediaRefForUrl(preparedImageUrl)) ??
  resolveInternalMediaRefStoragePath(resolveInternalMediaRefForUrl(rawImageUrl));

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
    .filter(Boolean)
    .slice(0, KIE_KLING_MAX_IMAGE_ELEMENT_URLS);

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
        : isLocalAudioUploadSourceUrl(normalizedRawUrl))
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

const rewritePromptWithSeedanceEntityContext = (
  prompt: string,
  klingElements: AiStudioKlingElement[]
): string => {
  const trimmedPrompt = prompt.trim();
  const entityContexts = klingElements.reduce<
    Array<{ label: string; description: string; tokenAliases: string[] }>
  >((accumulator, element, index) => {
    if (!isPromptTokenEligibleKlingElement(element)) return accumulator;
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
    prompt: composeSeedanceHiddenShotModePrompt({
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
  preparedImageInputs,
  requestedAudio,
  preparedKlingElements,
}: {
  cleanedPrompt: string;
  klingWorkflowMode: VideoSubmissionArgs["klingWorkflowMode"];
  preparedImageInputs: string[];
  requestedAudio: boolean;
  preparedKlingElements: AiStudioKlingElement[];
}): ResolvedKieKlingShotModePayload | { error: string } => {
  const normalizedMode =
    klingWorkflowMode === "multi" || klingWorkflowMode === "custom" ? "multi" : "single";

  const promptWithElementTokens = rewritePromptWithKieElementTokens(
    cleanedPrompt,
    preparedKlingElements
  );
  const hiddenPromptMode = normalizedMode === "multi" ? "multi" : "single";
  if (
    isKlingSinglePromptOverComposedLimit({
      prompt: promptWithElementTokens,
      mode: hiddenPromptMode,
    })
  ) {
    return { error: "Prompt exceeds Kling's 2,500 character limit." };
  }
  const composedPrompt = composeHiddenShotModePrompt({
    prompt: promptWithElementTokens,
    mode: hiddenPromptMode,
  });

  return {
    prompt: composedPrompt,
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

type VideoPollingProvider =
  | "fal-omnihuman-v15"
  | "kie-veo"
  | "kie-kling"
  | "kie-seedance-2"
  | "kie-seedance-2-fast";

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
  internalMediaRefs?: VideoSubmissionArgs["internalMediaRefs"];
  modelConfig: VideoSubmissionArgs["modelConfig"];
  notifyGenerationFailure: VideoSubmissionArgs["notifyGenerationFailure"];
  updateOutputById: VideoSubmissionArgs["updateOutputById"];
  videoReferenceMode: VideoSubmissionArgs["videoReferenceMode"];
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  lipSyncAudio: VideoSubmissionArgs["lipSyncAudio"];
  lipSyncTurboMode: VideoSubmissionArgs["lipSyncTurboMode"];
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
    key: "fal-omnihuman-v15",
    matches: (modelId) => modelId === FAL_OMNIHUMAN_V15_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      requestedResolution,
      preparedImageInputs,
      rawImageInputs,
      internalMediaRefs,
      notifyGenerationFailure,
      videoReferenceMode,
      lipSyncAudio,
      lipSyncTurboMode,
      shortpulseSubmitPayload,
    }) => {
      if (videoReferenceMode !== "lip-sync") {
        notifyGenerationFailure(
          id,
          "Lip Sync is not ready for this video mode.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }

      const rawImageUrl = (rawImageInputs[0] ?? preparedImageInputs[0] ?? "").trim();
      const preparedImageUrl = (preparedImageInputs[0] ?? rawImageUrl).trim();
      const rawAudioUrl = getDurableLipSyncAudioUrl(lipSyncAudio) ?? "";
      const imageStoragePath = resolveLipSyncImageStoragePath({
        explicitRef: internalMediaRefs?.[0] ?? null,
        rawImageUrl,
        preparedImageUrl,
      });
      const audioStoragePath = getLipSyncAudioStoragePath(lipSyncAudio);

      if (!preparedImageUrl || !rawImageUrl) {
        notifyGenerationFailure(
          id,
          "Add a character image before generating in Lip Sync.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      if (!rawAudioUrl && !audioStoragePath) {
        const message =
          lipSyncAudio.status === "uploading"
            ? "Voice audio is still uploading. Wait for it to finish before generating Lip Sync."
            : lipSyncAudio.status === "failed"
              ? (lipSyncAudio.error ??
                "Voice audio upload failed. Re-add the audio file and try again.")
              : lipSyncAudio.url && isNonDurableLipSyncAudioUrl(lipSyncAudio.url)
                ? "Local voice audio is no longer available. Re-add the audio file and try again."
                : lipSyncAudio.url
                  ? "Voice audio is not ready. Re-add it and wait for upload before generating Lip Sync."
                  : "Add voice audio before generating in Lip Sync.";
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      if (!isLipSyncAudioReadyForSubmit(lipSyncAudio)) {
        notifyGenerationFailure(
          id,
          "Voice audio is not ready. Re-add it and wait for upload before generating Lip Sync.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      const resolution = resolveLipSyncResolution(requestedResolution);
      const durationGuardrail = resolveLipSyncAudioDurationGuardrail({
        durationMs: lipSyncAudio.durationMs,
        resolution,
      });
      if (durationGuardrail) {
        notifyGenerationFailure(id, durationGuardrail, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }

      const falUploadCache = new Map<string, Promise<string>>();
      let imageUrl = "";
      try {
        imageUrl = await prepareFalInputUrl({
          rawUrl: rawImageUrl,
          preparedUrl: preparedImageUrl,
          storagePath: imageStoragePath,
          mediaKind: "image",
          cache: falUploadCache,
        });
      } catch (error) {
        const message =
          needsImageUpload(rawImageUrl) &&
          error instanceof Error &&
          error.message.toLowerCase().includes("unable to read local image input")
            ? "Local character image is no longer available. Re-add the image and try again."
            : `Character image preparation failed: ${
                error instanceof Error ? error.message : "Please re-add the image and try again."
              }`;
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      let audioUrl = "";
      try {
        audioUrl = await prepareFalInputUrl({
          rawUrl: rawAudioUrl,
          preparedUrl: rawAudioUrl,
          storagePath: audioStoragePath,
          mediaKind: "audio",
          cache: falUploadCache,
        });
      } catch (error) {
        const message =
          isLocalAudioUploadSourceUrl(rawAudioUrl) &&
          error instanceof Error &&
          error.message.toLowerCase().includes("unable to read local audio input")
            ? "Local voice audio is no longer available. Re-add the audio file and try again."
            : `Voice audio preparation failed: ${
                error instanceof Error
                  ? error.message
                  : "Please re-add the audio file and try again."
              }`;
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      const prompt = cleanedPrompt.trim();
      const response = await submitQueuedGenerationByModelId(finalModel, {
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution,
        ...(prompt ? { prompt } : {}),
        ...(lipSyncTurboMode ? { turbo_mode: true } : {}),
        ...shortpulseSubmitPayload,
      });

      return {
        handled: true,
        response,
        pollingProvider: "fal-omnihuman-v15",
      };
    },
  },
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
      rawImageInputs,
      modelConfig,
      notifyGenerationFailure,
      videoReferenceMode,
      videoReferenceImageUrl,
      motionReferenceVideoUrl,
      klingCfgScale,
      klingWorkflowMode,
      klingElements,
      shortpulseSubmitPayload,
    }) => {
      if (videoReferenceMode === "motion") {
        if (!videoReferenceImageUrl) {
          notifyGenerationFailure(
            id,
            "Motion Control requires a character image",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }
        if (!motionReferenceVideoUrl) {
          notifyGenerationFailure(
            id,
            "Motion Control requires a motion reference video",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }

        const preparedCharacterImageUrl = preparedImageInputs[0];
        if (!preparedCharacterImageUrl) {
          notifyGenerationFailure(id, "Failed to prepare character image");
          return { handled: true };
        }

        if (needsVideoUpload(motionReferenceVideoUrl)) {
          notifyGenerationFailure(
            id,
            "Motion clip is not ready yet. Re-add it and wait for upload before generating.",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }

        let characterImageUrl = preparedCharacterImageUrl;
        let motionVideoUrlFinal = motionReferenceVideoUrl;
        try {
          const kieUploadCache = new Map<string, Promise<string>>();
          characterImageUrl = await prepareKieInputUrl({
            rawUrl: rawImageInputs[0] ?? videoReferenceImageUrl,
            preparedUrl: preparedCharacterImageUrl,
            mediaKind: "image",
            cache: kieUploadCache,
          });
          if (!characterImageUrl) {
            throw new Error("Character image is missing.");
          }
          const preparedMotionVideoUrl =
            await prepareMotionReferenceVideoUrl(motionReferenceVideoUrl);
          if (!preparedMotionVideoUrl) {
            throw new Error("Motion reference video is missing.");
          }
          motionVideoUrlFinal = await uploadUrlToKieTemporaryFile({
            url: preparedMotionVideoUrl,
            mediaKind: "video",
            cache: kieUploadCache,
          });
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
            previewUrl: preparedCharacterImageUrl,
          },
        };
      }

      if (!preparedImageInputs.length) {
        notifyGenerationFailure(
          id,
          "Kling 3.0 requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      const kieUploadCache = new Map<string, Promise<string>>();
      let elementsPayload: ReturnType<typeof buildKieKlingElementsPayload>;
      let preparedKlingElements: AiStudioKlingElement[] = klingElements;
      try {
        preparedKlingElements = await Promise.all(
          klingElements.filter(isPromptTokenEligibleKlingElement).map(
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
        preparedImageInputs,
        requestedAudio,
        preparedKlingElements,
      });
      if ("error" in resolvedShotModePayload) {
        notifyGenerationFailure(
          id,
          resolvedShotModePayload.error,
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      let klingImageUrls: string[];
      try {
        klingImageUrls = await Promise.all(
          resolvedShotModePayload.imageUrls.map(
            async (preparedUrl, index) =>
              await prepareKieInputUrl({
                rawUrl: rawImageInputs[index],
                preparedUrl,
                mediaKind: "image",
                cache: kieUploadCache,
              })
          )
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kling image reference preparation failed";
        notifyGenerationFailure(id, `Kling image reference preparation failed: ${message}`);
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: resolvedShotModePayload.prompt,
        image_url: klingImageUrls[0],
        image_urls: klingImageUrls,
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
  internalMediaRefs,
  modelConfig,
  notifyGenerationFailure,
  updateOutputById,
  generationReplay,
  workflowReload,
  characterContext,
  styleContext,
  shortpulseContext,
  startPollingWithGeneration,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  lipSyncAudio,
  lipSyncTurboMode,
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
    ...(workflowReload ? { workflow_reload: workflowReload } : {}),
    ...(characterContext ? { character_context: characterContext } : {}),
    ...(styleContext ? { style_context: styleContext } : {}),
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };
  const candidateMediaUrls = [
    ...preparedImageInputs,
    videoReferenceImageUrl ?? "",
    motionReferenceVideoUrl ?? "",
    lipSyncAudio.url ?? "",
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
    internalMediaRefs,
    modelConfig,
    notifyGenerationFailure,
    updateOutputById,
    videoReferenceMode,
    videoReferenceImageUrl,
    motionReferenceVideoUrl,
    lipSyncAudio,
    lipSyncTurboMode,
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
