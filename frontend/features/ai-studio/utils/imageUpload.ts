/**
 * Upload utility for local reference images used by generation submit routes.
 * Converts blob/data URLs into short-lived signed HTTPS URLs.
 */
import {
  fetchWithAuth,
  isAuthRequiredError,
  isAuthSessionTimeoutError,
} from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { maybeTranscodeLocalImageBlobForUpload } from "../../../lib/adaptive-media";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  FETCH_LOCAL_IMAGE_TIMEOUT_MS,
  PREPARE_REFERENCE_IMAGE_UPLOAD_TIMEOUT_MS,
  STAGE_REFERENCE_IMAGE_UPLOAD_TIMEOUT_MS,
  SIGNED_URL_REFRESH_TIMEOUT_MS,
  UPLOAD_REFERENCE_IMAGE_STORAGE_TIMEOUT_MS,
} from "./imageUploadTimeouts";
import { BUCKET } from "../../media-library/logic/mediaLibraryPageHelpers";
import { parseSupabaseSignedObjectRef, shouldRefreshSupabaseSignedUrl } from "./supabaseSignedUrl";
import { readRememberedObjectUrlBlob } from "./objectUrlBlobRegistry";

type ImageUploadResponse = {
  url: string;
  path: string;
  size: number;
};

type ImageUploadCacheEntry = {
  asset: ImageUploadResponse;
  expiresAt: number;
};

type PrepareReferenceImageUploadPayload = {
  target?: {
    storagePath?: unknown;
    uploadToken?: unknown;
    mimeType?: unknown;
    name?: unknown;
  };
  error?: unknown;
  details?: unknown;
} | null;

type StageReferenceImagePayload = {
  url?: unknown;
  path?: unknown;
  size?: unknown;
  mimeType?: unknown;
  name?: unknown;
  error?: unknown;
  details?: unknown;
} | null;

type PrepareImageSourceKind = "blob" | "data-url" | "supabase-signed" | "remote";

type PrepareImageStage =
  | "prepare_image_url"
  | "fetch_local_image"
  | "prepare_reference_upload"
  | "upload_reference_storage"
  | "stage_reference_upload"
  | "refresh_signed_url";

type PrepareImageStageStatus = "start" | "success" | "error";

export type PrepareImageStageEvent = {
  stage: PrepareImageStage;
  status: PrepareImageStageStatus;
  sourceKind: PrepareImageSourceKind;
  elapsedMs: number;
  timeoutMs?: number;
  detail?: string;
};

export type PrepareImageUrlOptions = {
  abortSignal?: AbortSignal;
  onStage?: (event: PrepareImageStageEvent) => void;
};

const SIGNED_URL_BUFFER_MS = 55 * 60 * 1000;
const SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;
const UPLOAD_IMAGE_AUTH_TIMEOUT_MS = 12_000;
const UPLOAD_TOO_LARGE_ERROR_MESSAGE =
  "Reference image is too large. ShortPulse accepts reference images up to 25 MB.";
const localImageUrlCache = new Map<string, ImageUploadCacheEntry>();

const isBlobUrl = (url: string): boolean => url.startsWith("blob:");
const isDataImageUrl = (url: string): boolean => /^data:image\//i.test(url);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
};

const shouldUploadForProviderAccess = (url: string): boolean => {
  if (isBlobUrl(url) || isDataImageUrl(url)) return true;
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) return true;
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) return true;
  if (isPrivateIpv4Address(hostname)) return true;
  return false;
};

/**
 * Returns true when the image URL is local and must be uploaded for provider access.
 */
export const needsImageUpload = (url: string | null): boolean => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  return shouldUploadForProviderAccess(normalized);
};

const emitStage = (
  options: PrepareImageUrlOptions | undefined,
  event: PrepareImageStageEvent
): void => {
  options?.onStage?.(event);
};

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Unknown error";
};

const isGenericNetworkFailure = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.trim().toLowerCase();
  return normalized === "failed to fetch" || normalized === "network request failed";
};

const normalizeImagePreparationError = ({
  stage,
  sourceKind,
  error,
}: {
  stage: PrepareImageStage;
  sourceKind: PrepareImageSourceKind;
  error: unknown;
}): Error => {
  if (stage === "fetch_local_image") {
    if (sourceKind === "blob" || sourceKind === "data-url") {
      return new Error(
        "Local reference image is no longer available. Please re-add it and try again."
      );
    }
    return new Error("Unable to read the local reference image. Please re-add it and try again.");
  }

  if (
    stage === "prepare_reference_upload" ||
    stage === "upload_reference_storage" ||
    stage === "stage_reference_upload"
  ) {
    if (isAuthSessionTimeoutError(error)) {
      return new Error("Session check timed out while uploading the reference image.");
    }
    if (isAuthRequiredError(error)) {
      return new Error("You must be signed in to upload reference images.");
    }
    if (isGenericNetworkFailure(error)) {
      return new Error("Network request failed while uploading the reference image.");
    }
  }

  if (stage === "refresh_signed_url" && isGenericNetworkFailure(error)) {
    return new Error("Unable to refresh the reference image URL. Please re-add the image.");
  }

  return error instanceof Error ? error : new Error(asErrorMessage(error));
};

const runAbortableStep = async <T>({
  stage,
  timeoutMs,
  sourceKind,
  options,
  run,
}: {
  stage: PrepareImageStage;
  timeoutMs: number;
  sourceKind: PrepareImageSourceKind;
  options?: PrepareImageUrlOptions;
  run: (signal: AbortSignal) => Promise<T>;
}): Promise<T> => {
  const startedAt = Date.now();
  const stepAbortController = new AbortController();
  let abortedByParent = false;
  const parentSignal = options?.abortSignal;

  const detachParentAbort = (() => {
    if (!parentSignal) return () => undefined;
    const onParentAbort = () => {
      abortedByParent = true;
      stepAbortController.abort(parentSignal.reason);
    };
    if (parentSignal.aborted) {
      onParentAbort();
      return () => undefined;
    }
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
    return () => {
      parentSignal.removeEventListener("abort", onParentAbort);
    };
  })();

  emitStage(options, {
    stage,
    status: "start",
    sourceKind,
    elapsedMs: 0,
    timeoutMs,
  });

  let timedOut = false;
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      timedOut = true;
      stepAbortController.abort();
      reject(new Error(`${stage} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  const runPromise = run(stepAbortController.signal);

  try {
    const result = await Promise.race([runPromise, timeoutPromise]);
    emitStage(options, {
      stage,
      status: "success",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
    });
    return result;
  } catch (error) {
    const wasAborted = stepAbortController.signal.aborted;
    if ((timedOut || wasAborted) && !abortedByParent) {
      const timeoutError =
        error instanceof Error && error.message.includes("timed out after")
          ? error
          : new Error(`${stage} timed out after ${timeoutMs}ms.`);
      emitStage(options, {
        stage,
        status: "error",
        sourceKind,
        elapsedMs: Date.now() - startedAt,
        timeoutMs,
        detail: timeoutError.message,
      });
      throw timeoutError;
    }
    emitStage(options, {
      stage,
      status: "error",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      detail: asErrorMessage(error),
    });
    throw error;
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
    detachParentAbort();
  }
};

const inferExtension = (mimeType: string): string => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/avif":
      return "avif";
    default:
      return "jpg";
  }
};

const buildUploadFilename = (blob: Blob): string => {
  const extension = inferExtension(blob.type);
  return `reference-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
};

const readDataImageUrlBlob = (url: string): Blob | null => {
  const match = url.match(/^data:([^;,]+)((?:;[^,]*)?),(.*)$/is);
  if (!match) return null;
  const mimeType = match[1]?.trim().toLowerCase() || "image/jpeg";
  const metadata = match[2] ?? "";
  const body = match[3] ?? "";
  try {
    if (metadata.toLowerCase().includes(";base64")) {
      const binary = globalThis.atob(decodeURIComponent(body));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(body)], { type: mimeType });
  } catch {
    return null;
  }
};

const resolveUploadPipelineError = (
  payload: { error?: unknown; details?: unknown } | null,
  fallbackMessage: string
): string => {
  if (typeof payload?.details === "string" && payload.details.trim()) {
    return payload.details.trim();
  }
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallbackMessage;
};

const uploadPreparedImageBlobToStorage = async ({
  blob,
  sourceKind,
  options,
}: {
  blob: Blob;
  sourceKind: PrepareImageSourceKind;
  options?: PrepareImageUrlOptions;
}): Promise<ImageUploadResponse> => {
  const shouldTranscodeLocal = sourceKind === "blob" || sourceKind === "data-url";
  const normalizedBlob = normalizeUploadBlob(blob);
  const preparedBlob = shouldTranscodeLocal
    ? await maybeTranscodeLocalImageBlobForUpload(normalizedBlob)
    : normalizedBlob;
  const filename = buildUploadFilename(preparedBlob);
  const supabase = ensureSupabaseQueryClient();

  try {
    const prepareResponse = await runAbortableStep({
      stage: "prepare_reference_upload",
      timeoutMs: PREPARE_REFERENCE_IMAGE_UPLOAD_TIMEOUT_MS,
      sourceKind,
      options,
      run: async (signal) =>
        await fetchWithAuth("/api/media/prepare-reference-image-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceMimeType: preparedBlob.type,
            sourceName: filename,
          }),
          signal,
          shortpulseLogScope: "generation",
          shortpulseAuthTimeoutMs: UPLOAD_IMAGE_AUTH_TIMEOUT_MS,
          shortpulseRetryNetworkOnce: true,
        }),
    });
    const preparePayload = (await prepareResponse
      .json()
      .catch(() => null)) as PrepareReferenceImageUploadPayload | null;
    const storagePath =
      typeof preparePayload?.target?.storagePath === "string"
        ? preparePayload.target.storagePath.trim()
        : "";
    const uploadToken =
      typeof preparePayload?.target?.uploadToken === "string"
        ? preparePayload.target.uploadToken.trim()
        : "";
    const preparedMimeType =
      typeof preparePayload?.target?.mimeType === "string"
        ? preparePayload.target.mimeType.trim()
        : preparedBlob.type;
    const preparedName =
      typeof preparePayload?.target?.name === "string"
        ? preparePayload.target.name.trim()
        : filename;

    if (!prepareResponse.ok || !storagePath || !uploadToken) {
      if (prepareResponse.status === 413) {
        throw new Error(resolve413UploadErrorMessage(preparePayload));
      }
      const error = resolveUploadPipelineError(
        preparePayload,
        "Unable to prepare reference image upload."
      );
      throw new Error(error);
    }

    const uploadToSignedUrlResult = await runAbortableStep({
      stage: "upload_reference_storage",
      timeoutMs: UPLOAD_REFERENCE_IMAGE_STORAGE_TIMEOUT_MS,
      sourceKind,
      options,
      run: async () =>
        await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(storagePath, uploadToken, preparedBlob, {
            contentType: preparedMimeType,
            upsert: false,
          }),
    });
    if (uploadToSignedUrlResult.error) {
      throw new Error(
        uploadToSignedUrlResult.error.message || "Unable to upload the reference image."
      );
    }

    const finalizeResponse = await runAbortableStep({
      stage: "stage_reference_upload",
      timeoutMs: STAGE_REFERENCE_IMAGE_UPLOAD_TIMEOUT_MS,
      sourceKind,
      options,
      run: async (signal) =>
        await fetchWithAuth("/api/media/stage-reference-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceMimeType: preparedMimeType,
            sourceName: preparedName,
            sourceStoragePath: storagePath,
          }),
          signal,
          shortpulseLogScope: "generation",
          shortpulseAuthTimeoutMs: UPLOAD_IMAGE_AUTH_TIMEOUT_MS,
          shortpulseRetryNetworkOnce: true,
        }),
    });
    const stagePayload = (await finalizeResponse
      .json()
      .catch(() => null)) as StageReferenceImagePayload | null;

    if (!finalizeResponse.ok) {
      if (finalizeResponse.status === 413) {
        throw new Error(resolve413UploadErrorMessage(stagePayload));
      }
      const error = resolveUploadPipelineError(
        stagePayload,
        `Image upload failed (${finalizeResponse.status})`
      );
      throw new Error(error);
    }

    const url = typeof stagePayload?.url === "string" ? stagePayload.url.trim() : "";
    const path = typeof stagePayload?.path === "string" ? stagePayload.path.trim() : "";
    const size = typeof stagePayload?.size === "number" ? stagePayload.size : preparedBlob.size;

    if (!url) {
      throw new Error("Image upload failed: missing signed URL.");
    }
    if (!path) {
      throw new Error("Image upload failed: missing storage path.");
    }

    return {
      url,
      path,
      size,
    };
  } catch (error) {
    throw normalizeImagePreparationError({
      stage: "stage_reference_upload",
      sourceKind,
      error,
    });
  }
};

const resolve413UploadErrorMessage = (payload: unknown): string => {
  const error =
    typeof (payload as { error?: unknown })?.error === "string"
      ? (payload as { error: string }).error.trim() || null
      : null;
  const details =
    typeof (payload as { details?: unknown })?.details === "string"
      ? (payload as { details: string }).details.trim() || null
      : null;

  if (details) return details;
  if (error && error !== "Upload failed: file too large") return error;
  return UPLOAD_TOO_LARGE_ERROR_MESSAGE;
};

const normalizeUploadBlob = (blob: Blob): Blob => {
  if (blob.type && blob.type.startsWith("image/")) return blob;
  return new Blob([blob], { type: "image/jpeg" });
};

const resolveSourceKind = (url: string): PrepareImageSourceKind => {
  if (isBlobUrl(url)) return "blob";
  if (isDataImageUrl(url)) return "data-url";
  if (parseSupabaseSignedObjectRef(url)) return "supabase-signed";
  return "remote";
};

export const refreshSupabaseSignedUrlIfNeeded = async (
  url: string,
  options?: PrepareImageUrlOptions
): Promise<string> => {
  const objectRef = parseSupabaseSignedObjectRef(url);
  if (!objectRef) return url;
  if (
    !shouldRefreshSupabaseSignedUrl(
      objectRef.expiresAtSeconds,
      SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS
    )
  ) {
    return url;
  }

  const refreshedUrl = await runAbortableStep({
    stage: "refresh_signed_url",
    timeoutMs: SIGNED_URL_REFRESH_TIMEOUT_MS,
    sourceKind: "supabase-signed",
    options,
    run: async () =>
      await getSignedMediaUrl({
        bucket: objectRef.bucket,
        storagePath: objectRef.storagePath,
        forceRefresh: true,
      }),
  });
  if (refreshedUrl?.trim()) return refreshedUrl;
  throw new Error("Reference URL expired and could not be refreshed. Please reselect the image.");
};

/**
 * Uploads a local image URL to storage and returns signed delivery metadata.
 */
export const uploadImageAssetToStorage = async (
  localUrl: string,
  options?: PrepareImageUrlOptions
): Promise<ImageUploadResponse> => {
  const cacheable = isBlobUrl(localUrl);
  const sourceKind = resolveSourceKind(localUrl);
  if (cacheable) {
    const cached = localImageUrlCache.get(localUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.asset;
    if (cached) {
      localImageUrlCache.delete(localUrl);
    }
  }

  let fetchedBlob: Blob;
  const rememberedBlob = isBlobUrl(localUrl) ? readRememberedObjectUrlBlob(localUrl) : null;
  const dataUrlBlob = isDataImageUrl(localUrl) ? readDataImageUrlBlob(localUrl) : null;
  if (rememberedBlob) {
    const startedAt = Date.now();
    emitStage(options, {
      stage: "fetch_local_image",
      status: "start",
      sourceKind,
      elapsedMs: 0,
      timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
    });
    fetchedBlob = rememberedBlob;
    emitStage(options, {
      stage: "fetch_local_image",
      status: "success",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
      timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
    });
  } else if (dataUrlBlob) {
    const startedAt = Date.now();
    emitStage(options, {
      stage: "fetch_local_image",
      status: "start",
      sourceKind,
      elapsedMs: 0,
      timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
    });
    fetchedBlob = dataUrlBlob;
    emitStage(options, {
      stage: "fetch_local_image",
      status: "success",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
      timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
    });
  } else {
    let response: Response;
    try {
      response = await runAbortableStep({
        stage: "fetch_local_image",
        timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
        sourceKind,
        options,
        run: async (signal) => await fetch(localUrl, { signal }),
      });
    } catch (error) {
      throw normalizeImagePreparationError({
        stage: "fetch_local_image",
        sourceKind,
        error,
      });
    }
    if (!response.ok) {
      throw new Error(`Unable to read local image input (${response.status}).`);
    }
    fetchedBlob = await response.blob();
  }
  const data = await uploadPreparedImageBlobToStorage({
    blob: fetchedBlob,
    sourceKind,
    options,
  });

  if (cacheable) {
    localImageUrlCache.set(localUrl, {
      asset: data,
      expiresAt: Date.now() + SIGNED_URL_BUFFER_MS,
    });
  }
  return data;
};

/**
 * Uploads an in-memory image blob to storage without round-tripping through a fragile object URL.
 */
export const uploadImageBlobToStorage = async (
  blob: Blob,
  options?: PrepareImageUrlOptions
): Promise<string> => {
  const uploaded = await uploadPreparedImageBlobToStorage({
    blob,
    sourceKind: "blob",
    options,
  });
  return uploaded.url;
};

/**
 * Uploads a local image URL to storage and returns a signed HTTPS URL.
 */
export const uploadImageToStorage = async (
  localUrl: string,
  options?: PrepareImageUrlOptions
): Promise<string> => {
  const uploaded = await uploadImageAssetToStorage(localUrl, options);
  return uploaded.url;
};

/**
 * Prepares an image URL for provider submission.
 * Uploads local blob/data URLs and refreshes expiring Supabase signed URLs.
 */
export const prepareImageUrlForSubmission = async (
  url: string | null,
  options?: PrepareImageUrlOptions
): Promise<string | null> => {
  const normalizedUrl = url?.trim();
  if (!normalizedUrl) return null;
  const sourceKind = resolveSourceKind(normalizedUrl);
  emitStage(options, {
    stage: "prepare_image_url",
    status: "start",
    sourceKind,
    elapsedMs: 0,
  });
  const startedAt = Date.now();
  try {
    const prepared = needsImageUpload(normalizedUrl)
      ? await uploadImageToStorage(normalizedUrl, options)
      : await refreshSupabaseSignedUrlIfNeeded(normalizedUrl, options);
    emitStage(options, {
      stage: "prepare_image_url",
      status: "success",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
    });
    return prepared;
  } catch (error) {
    emitStage(options, {
      stage: "prepare_image_url",
      status: "error",
      sourceKind,
      elapsedMs: Date.now() - startedAt,
      detail: asErrorMessage(error),
    });
    throw error;
  }
};
