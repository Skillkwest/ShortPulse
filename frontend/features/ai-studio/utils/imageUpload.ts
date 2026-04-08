/**
 * Upload utility for local reference images used by generation submit routes.
 * Converts blob/data URLs into short-lived signed HTTPS URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { maybeTranscodeLocalImageBlobForUpload } from "../../../lib/adaptive-media";

type ImageUploadResponse = {
  url: string;
  path: string;
  size: number;
};

type ImageUploadCacheEntry = {
  asset: ImageUploadResponse;
  expiresAt: number;
};

type PrepareImageSourceKind = "blob" | "data-url" | "supabase-signed" | "remote";

type PrepareImageStage =
  | "prepare_image_url"
  | "fetch_local_image"
  | "upload_image_route"
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
const FETCH_LOCAL_IMAGE_TIMEOUT_MS = 12_000;
const UPLOAD_IMAGE_ROUTE_TIMEOUT_MS = 45_000;
const SIGNED_URL_REFRESH_TIMEOUT_MS = 10_000;
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

  const timeoutHandle = globalThis.setTimeout(() => {
    stepAbortController.abort();
  }, timeoutMs);

  try {
    const result = await run(stepAbortController.signal);
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
    if (wasAborted && !abortedByParent) {
      const timeoutError = new Error(`${stage} timed out after ${timeoutMs}ms.`);
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
    globalThis.clearTimeout(timeoutHandle);
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

const normalizeUploadBlob = (blob: Blob): Blob => {
  if (blob.type && blob.type.startsWith("image/")) return blob;
  return new Blob([blob], { type: "image/jpeg" });
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available");
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const rawPayload = decodeBase64Url(segments[1] ?? "");
    const parsed = JSON.parse(rawPayload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

type SupabaseSignedObjectRef = {
  bucket: string;
  storagePath: string;
  expiresAtSeconds: number | null;
};

const parseSupabaseSignedObjectRef = (url: string): SupabaseSignedObjectRef | null => {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    const bucket = decodeURIComponent(match[1] ?? "").trim();
    const pathFromPathname = decodeURIComponent(match[2] ?? "").trim();
    if (!bucket || !pathFromPathname) return null;

    const token = parsedUrl.searchParams.get("token");
    const payload = token ? decodeJwtPayload(token) : null;
    const payloadUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    const payloadExp = typeof payload?.exp === "number" ? payload.exp : null;

    let storagePath = pathFromPathname;
    if (payloadUrl) {
      const normalized = payloadUrl.replace(/^\/+/, "");
      if (normalized.startsWith(`${bucket}/`)) {
        storagePath = normalized.slice(bucket.length + 1);
      }
    }
    if (!storagePath) return null;
    return {
      bucket,
      storagePath,
      expiresAtSeconds: payloadExp,
    };
  } catch {
    return null;
  }
};

const resolveSourceKind = (url: string): PrepareImageSourceKind => {
  if (isBlobUrl(url)) return "blob";
  if (isDataImageUrl(url)) return "data-url";
  if (parseSupabaseSignedObjectRef(url)) return "supabase-signed";
  return "remote";
};

const shouldRefreshSupabaseSignedUrl = (expiresAtSeconds: number | null): boolean => {
  if (expiresAtSeconds == null) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAtSeconds - nowSeconds <= SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS;
};

export const refreshSupabaseSignedUrlIfNeeded = async (
  url: string,
  options?: PrepareImageUrlOptions
): Promise<string> => {
  const objectRef = parseSupabaseSignedObjectRef(url);
  if (!objectRef) return url;
  if (!shouldRefreshSupabaseSignedUrl(objectRef.expiresAtSeconds)) return url;

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

  const response = await runAbortableStep({
    stage: "fetch_local_image",
    timeoutMs: FETCH_LOCAL_IMAGE_TIMEOUT_MS,
    sourceKind,
    options,
    run: async (signal) => await fetch(localUrl, { signal }),
  });
  if (!response.ok) {
    throw new Error(`Unable to read local image input (${response.status}).`);
  }
  const fetchedBlob = await response.blob();
  const normalizedBlob = normalizeUploadBlob(fetchedBlob);
  const shouldTranscodeLocal = needsImageUpload(localUrl);
  const blob = shouldTranscodeLocal
    ? await maybeTranscodeLocalImageBlobForUpload(normalizedBlob)
    : normalizedBlob;
  const extension = inferExtension(blob.type);
  const filename = `reference-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const uploadResponse = await runAbortableStep({
    stage: "upload_image_route",
    timeoutMs: UPLOAD_IMAGE_ROUTE_TIMEOUT_MS,
    sourceKind,
    options,
    run: async (signal) =>
      await fetchWithAuth("/api/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": blob.type,
          "x-shortpulse-upload-filename": filename,
        },
        body: blob,
        signal,
        shortpulseLogScope: "generation",
        shortpulseAuthTimeoutMs: UPLOAD_IMAGE_AUTH_TIMEOUT_MS,
      }),
  });

  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => ({}));
    if (uploadResponse.status === 413) {
      throw new Error(UPLOAD_TOO_LARGE_ERROR_MESSAGE);
    }
    const error =
      typeof payload?.error === "string" && payload.error.trim().length
        ? payload.error
        : `Image upload failed (${uploadResponse.status})`;
    const details =
      typeof payload?.details === "string" && payload.details.trim().length
        ? payload.details
        : null;
    throw new Error(details ? `${error}: ${details}` : error);
  }

  const data = (await uploadResponse.json()) as ImageUploadResponse;
  if (!data?.url) {
    throw new Error("Image upload failed: missing signed URL.");
  }
  if (!data?.path) {
    throw new Error("Image upload failed: missing storage path.");
  }

  if (cacheable) {
    localImageUrlCache.set(localUrl, {
      asset: data,
      expiresAt: Date.now() + SIGNED_URL_BUFFER_MS,
    });
  }
  return data;
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
