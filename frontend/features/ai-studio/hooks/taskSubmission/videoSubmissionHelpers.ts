/**
 * Shared staging and prompt helpers for AI Studio video submission adapters.
 */
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { resolveInternalMediaRefStoragePath } from "../../../../lib/media/internalMediaRefs";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import { readRememberedObjectUrlBlob } from "../../utils/objectUrlBlobRegistry";
import type { VideoSubmissionArgs } from "./types";
import {
  getAiStudioKlingElementReferenceUrls,
  getKieKlingSubmittableSlotElements,
  isPromptTokenEligibleKlingElement,
  resolveKieKlingElementsValidationMessage,
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  resolveKieKlingElementToken,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { needsImageUpload, prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { buildKieKlingElementsPayload, KIE_KLING_MAX_IMAGE_ELEMENT_URLS } from "./videoPayloads";
import {
  composeHiddenShotModePrompt,
  isKlingSinglePromptOverComposedLimit,
  rewritePromptWithKieElementTokens,
} from "../../logic/klingShotModePromptComposition";
import { composeSeedanceHiddenShotModePrompt } from "../../logic/seedanceShotModePromptComposition";
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
const KIE_KLING_REUSABLE_TEMP_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);
const KIE_SEEDANCE_REUSABLE_TEMP_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export const VALIDATION_FAILURE_CONTEXT = {
  telemetryMode: "validation",
  reasonCode: "USER_INPUT_VALIDATION",
} as const;

const DATA_URL_PATTERN = /^data:([^;,]+)?((?:;[^,]*)?),(.*)$/i;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const readDataUrlBlob = (value: string, mediaKind: "image" | "video" | "audio"): Blob | null => {
  const match = value.match(DATA_URL_PATTERN);
  if (!match) return null;
  const mimeType = (match[1] || "").trim().toLowerCase();
  if (!mimeType.startsWith(`${mediaKind}/`)) return null;
  const metadata = match[2] || "";
  const payload = match[3] || "";
  if (metadata.toLowerCase().includes(";base64")) {
    const binary = globalThis.atob(payload.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mimeType });
};

export const hasKlingElementMedia = (element: AiStudioKlingElement): boolean =>
  Boolean(
    element.videoUrl.trim() ||
    element.audioUrl?.trim() ||
    getAiStudioKlingElementReferenceUrls(element).length
  );

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

const readUrlPathExtension = (value: string): string | null => {
  try {
    const lastSegment = new URL(value).pathname.split("/").filter(Boolean).pop() ?? "";
    if (!lastSegment.includes(".")) return null;
    const extension = lastSegment.split(".").pop()?.trim().toLowerCase() ?? "";
    return extension.length ? extension : null;
  } catch {
    return null;
  }
};

const canReuseKieHostedTemporaryMediaUrl = ({
  url,
  mediaKind,
  admissionProfile,
}: {
  url: string;
  mediaKind: "image" | "video" | "audio";
  admissionProfile: KieUploadAdmissionProfile | null;
}): boolean => {
  if (!admissionProfile) return true;
  if (mediaKind !== "image") return false;
  const extension = readUrlPathExtension(url);
  if (!extension) return false;
  if (admissionProfile === "kie_seedance_reference_image") {
    return KIE_SEEDANCE_REUSABLE_TEMP_IMAGE_EXTENSIONS.has(extension);
  }
  return KIE_KLING_REUSABLE_TEMP_IMAGE_EXTENSIONS.has(extension);
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

export const isLocalAudioUploadSourceUrl = (value: string): boolean => {
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
type KieUploadAdmissionProfile =
  | "kie_motion_control_character_image"
  | "kie_kling_reference_image"
  | "kie_seedance_reference_image";
export const KIE_KLING_REFERENCE_IMAGE_ADMISSION_PROFILE: KieUploadAdmissionProfile =
  "kie_kling_reference_image";
export const KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE: KieUploadAdmissionProfile =
  "kie_seedance_reference_image";

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

export const uploadUrlToKieTemporaryFile = async ({
  url,
  mediaKind,
  cache,
  admissionProfile = null,
}: {
  url: string;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<string> => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return "";
  if (
    isKieHostedTemporaryMediaUrl(normalizedUrl) &&
    canReuseKieHostedTemporaryMediaUrl({ url: normalizedUrl, mediaKind, admissionProfile })
  ) {
    return normalizedUrl;
  }

  const internalRef = resolveInternalMediaRefForUrl(normalizedUrl);
  if (internalRef?.bucket === "media_library") {
    const storagePath = resolveInternalMediaRefStoragePath(internalRef);
    if (storagePath) {
      return await uploadStoragePathToKieTemporaryFile({
        storagePath,
        mediaKind,
        cache,
        admissionProfile,
      });
    }
  }

  const cacheKey = admissionProfile ? `${admissionProfile}:${normalizedUrl}` : normalizedUrl;
  const cached = cache.get(cacheKey);
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
        ...(admissionProfile ? { admissionProfile } : {}),
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

  cache.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
};

const uploadStoragePathToKieTemporaryFile = async ({
  storagePath,
  mediaKind,
  cache,
  admissionProfile = null,
}: {
  storagePath: string;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<string> => {
  const normalizedStoragePath = storagePath.trim();
  if (!normalizedStoragePath) return "";
  const cacheKey = `storage:${mediaKind}:${admissionProfile ?? "none"}:${normalizedStoragePath}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const response = await fetchWithAuth(KIE_UPLOAD_ROUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storagePath: normalizedStoragePath,
        mediaKind,
        uploadPath: resolveKieUploadPath(mediaKind),
        ...(admissionProfile ? { admissionProfile } : {}),
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

  cache.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
};

const uploadBlobToKieTemporaryFile = async ({
  blob,
  mediaKind,
  cacheKey,
  cache,
  admissionProfile = null,
}: {
  blob: Blob;
  mediaKind: "image" | "video" | "audio";
  cacheKey: string;
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
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
        ...(admissionProfile ? { "x-shortpulse-admission-profile": admissionProfile } : {}),
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
  admissionProfile = null,
}: {
  sourceUrl: string;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<string> => {
  const normalizedUrl = sourceUrl.trim();
  if (!normalizedUrl) return "";
  const cacheKey = `source:${mediaKind}:${admissionProfile ?? "none"}:${normalizedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const rememberedBlob = normalizedUrl.startsWith("blob:")
      ? readRememberedObjectUrlBlob(normalizedUrl)
      : null;
    if (rememberedBlob) {
      return await uploadBlobToKieTemporaryFile({
        blob: rememberedBlob,
        mediaKind,
        cacheKey: `${cacheKey}:blob`,
        cache,
        admissionProfile,
      });
    }
    const dataUrlBlob = normalizedUrl.startsWith("data:")
      ? readDataUrlBlob(normalizedUrl, mediaKind)
      : null;
    if (dataUrlBlob) {
      return await uploadBlobToKieTemporaryFile({
        blob: dataUrlBlob,
        mediaKind,
        cacheKey: `${cacheKey}:data-url`,
        cache,
        admissionProfile,
      });
    }
    if (normalizedUrl.startsWith("blob:")) {
      throw new Error(`Local ${mediaKind} input is no longer available. Re-add it and try again.`);
    }
    if (isHttpUrl(normalizedUrl)) {
      return await uploadUrlToKieTemporaryFile({
        url: normalizedUrl,
        mediaKind,
        cache,
        admissionProfile,
      });
    }
    throw new Error(`Unsupported local ${mediaKind} input URL.`);
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
  compatibilityTarget = null,
  cache,
}: {
  url: string;
  mediaKind: "image" | "audio";
  compatibilityTarget?: string | null;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return "";

  const cacheKey = `fal-url:${mediaKind}:${compatibilityTarget ?? "default"}:${normalizedUrl}`;
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
        ...(compatibilityTarget ? { compatibilityTarget } : {}),
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
  compatibilityTarget = null,
  cache,
}: {
  storagePath: string;
  mediaKind: "image" | "audio";
  compatibilityTarget?: string | null;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedStoragePath = storagePath.trim();
  if (!normalizedStoragePath) return "";
  const cacheKey = `fal-storage:${mediaKind}:${compatibilityTarget ?? "default"}:${normalizedStoragePath}`;
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
        ...(compatibilityTarget ? { compatibilityTarget } : {}),
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
  compatibilityTarget = null,
  cache,
}: {
  blob: Blob;
  mediaKind: "image" | "audio";
  cacheKey: string;
  compatibilityTarget?: string | null;
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
        ...(compatibilityTarget
          ? { "x-shortpulse-fal-compatibility-target": compatibilityTarget }
          : {}),
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
  compatibilityTarget = null,
  cache,
}: {
  sourceUrl: string;
  mediaKind: "image" | "audio";
  compatibilityTarget?: string | null;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedUrl = sourceUrl.trim();
  if (!normalizedUrl) return "";
  const cacheKey = `fal-source:${mediaKind}:${compatibilityTarget ?? "default"}:${normalizedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return await cached;

  const uploadPromise = (async () => {
    const rememberedBlob = normalizedUrl.startsWith("blob:")
      ? readRememberedObjectUrlBlob(normalizedUrl)
      : null;
    if (rememberedBlob) {
      return await uploadBlobToFalCdn({
        blob: rememberedBlob,
        mediaKind,
        cacheKey: `${cacheKey}:blob`,
        compatibilityTarget,
        cache,
      });
    }
    const dataUrlBlob = normalizedUrl.startsWith("data:")
      ? readDataUrlBlob(normalizedUrl, mediaKind)
      : null;
    if (dataUrlBlob) {
      return await uploadBlobToFalCdn({
        blob: dataUrlBlob,
        mediaKind,
        cacheKey: `${cacheKey}:data-url`,
        compatibilityTarget,
        cache,
      });
    }
    if (normalizedUrl.startsWith("blob:")) {
      throw new Error(`Local ${mediaKind} input is no longer available. Re-add it and try again.`);
    }
    if (isHttpUrl(normalizedUrl)) {
      return await uploadUrlToFalCdn({
        url: normalizedUrl,
        mediaKind,
        compatibilityTarget,
        cache,
      });
    }
    throw new Error(`Unsupported local ${mediaKind} input URL.`);
  })();

  cache.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
};

export const prepareFalInputUrl = async ({
  rawUrl,
  preparedUrl,
  storagePath,
  mediaKind,
  compatibilityTarget = null,
  cache,
}: {
  rawUrl?: string | null;
  preparedUrl?: string | null;
  storagePath?: string | null;
  mediaKind: "image" | "audio";
  compatibilityTarget?: string | null;
  cache: Map<string, Promise<string>>;
}): Promise<string> => {
  const normalizedStoragePath = storagePath?.trim() ?? "";
  if (normalizedStoragePath) {
    return await uploadStoragePathToFalCdn({
      storagePath: normalizedStoragePath,
      mediaKind,
      compatibilityTarget,
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
      compatibilityTarget,
      cache,
    });
  }

  const sourceUrl = normalizedPreparedUrl || normalizedRawUrl;
  if (!sourceUrl) return "";
  return await uploadUrlToFalCdn({
    url: sourceUrl,
    mediaKind,
    compatibilityTarget,
    cache,
  });
};

export const resolveLipSyncImageStoragePath = ({
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

export const uploadUrlsToKieTemporaryFiles = async ({
  urls,
  mediaKind,
  cache,
  admissionProfile = null,
}: {
  urls: string[];
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<string[]> =>
  (
    await Promise.all(
      urls.map(async (url) =>
        uploadUrlToKieTemporaryFile({
          url,
          mediaKind,
          cache,
          admissionProfile,
        })
      )
    )
  ).filter(Boolean);

export const prepareKieHostedKlingElementForSubmission = async ({
  element,
  cache,
  imageAdmissionProfile = null,
}: {
  element: AiStudioKlingElement;
  cache: Map<string, Promise<string>>;
  imageAdmissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<AiStudioKlingElement> => {
  const rawImageUrls = getAiStudioKlingElementReferenceUrls(element)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, KIE_KLING_MAX_IMAGE_ELEMENT_URLS);

  const [klingHostedImageUrls, klingHostedVideoUrl, klingHostedAudioUrl] = await Promise.all([
    Promise.all(
      rawImageUrls.map(async (url) => {
        if (needsImageUpload(url)) {
          return await uploadSourceUrlToKieTemporaryFile({
            sourceUrl: url,
            mediaKind: "image",
            cache,
            admissionProfile: imageAdmissionProfile,
          });
        }
        const preparedUrl = await prepareImageUrlForSubmission(url);
        return preparedUrl
          ? await uploadUrlToKieTemporaryFile({
              url: preparedUrl,
              mediaKind: "image",
              cache,
              admissionProfile: imageAdmissionProfile,
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
    element.audioUrl?.trim()
      ? prepareKieInputUrl({
          rawUrl: element.audioUrl,
          preparedUrl: element.audioUrl,
          mediaKind: "audio",
          cache,
        })
      : Promise.resolve(""),
  ]);

  return {
    ...element,
    frontalImageUrl: klingHostedImageUrls[0] ?? "",
    referenceImageUrls: klingHostedImageUrls.slice(1).join(", "),
    videoUrl: klingHostedVideoUrl,
    audioUrl: klingHostedAudioUrl,
  };
};

export const prepareKieKlingElementsForSubmission = async ({
  klingElements,
  cache,
  imageAdmissionProfile = null,
}: {
  klingElements: AiStudioKlingElement[];
  cache: Map<string, Promise<string>>;
  imageAdmissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<
  | {
      preparedKlingElements: AiStudioKlingElement[];
      elementsPayload: ReturnType<typeof buildKieKlingElementsPayload>;
    }
  | { error: string }
> => {
  const klingElementValidationMessage = resolveKieKlingElementsValidationMessage(klingElements);
  if (klingElementValidationMessage) {
    return { error: klingElementValidationMessage };
  }

  const preparedKlingElements = await Promise.all(
    getKieKlingSubmittableSlotElements(klingElements).map(
      async (element) =>
        await prepareKieHostedKlingElementForSubmission({
          element,
          cache,
          imageAdmissionProfile,
        })
    )
  );
  return {
    preparedKlingElements,
    elementsPayload: buildKieKlingElementsPayload(preparedKlingElements),
  };
};

export const prepareKieInputUrl = async ({
  rawUrl,
  preparedUrl,
  mediaKind,
  cache,
  admissionProfile = null,
}: {
  rawUrl?: string | null;
  preparedUrl?: string | null;
  mediaKind: "image" | "video" | "audio";
  cache: Map<string, Promise<string>>;
  admissionProfile?: KieUploadAdmissionProfile | null;
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
      admissionProfile,
    });
  }

  const sourceUrl = normalizedPreparedUrl || normalizedRawUrl;
  if (!sourceUrl) return "";
  return await uploadUrlToKieTemporaryFile({
    url: sourceUrl,
    mediaKind,
    cache,
    admissionProfile,
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

export const buildSeedancePromptPayload = ({
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

export const resolveKieKlingShotModePayload = ({
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
