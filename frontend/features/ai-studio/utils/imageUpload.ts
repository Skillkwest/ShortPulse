/**
 * Upload utility for local reference images used by generation submit routes.
 * Converts blob/data URLs into short-lived signed HTTPS URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";

type ImageUploadResponse = {
  url: string;
  path: string;
  size: number;
};

type ImageUploadCacheEntry = {
  asset: ImageUploadResponse;
  expiresAt: number;
};

const SIGNED_URL_BUFFER_MS = 55 * 60 * 1000;
const SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;
const localImageUrlCache = new Map<string, ImageUploadCacheEntry>();

const isBlobUrl = (url: string): boolean => url.startsWith("blob:");
const isDataImageUrl = (url: string): boolean => /^data:image\//i.test(url);

/**
 * Returns true when the image URL is local and must be uploaded for provider access.
 */
export const needsImageUpload = (url: string | null): boolean => {
  if (!url) return false;
  return isBlobUrl(url) || isDataImageUrl(url);
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

const shouldRefreshSupabaseSignedUrl = (expiresAtSeconds: number | null): boolean => {
  if (expiresAtSeconds == null) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAtSeconds - nowSeconds <= SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS;
};

export const refreshSupabaseSignedUrlIfNeeded = async (url: string): Promise<string> => {
  const objectRef = parseSupabaseSignedObjectRef(url);
  if (!objectRef) return url;
  if (!shouldRefreshSupabaseSignedUrl(objectRef.expiresAtSeconds)) return url;

  const refreshedUrl = await getSignedMediaUrl({
    bucket: objectRef.bucket,
    storagePath: objectRef.storagePath,
    forceRefresh: true,
  });
  if (refreshedUrl?.trim()) return refreshedUrl;
  throw new Error("Reference URL expired and could not be refreshed. Please reselect the image.");
};

/**
 * Uploads a local image URL to storage and returns signed delivery metadata.
 */
export const uploadImageAssetToStorage = async (localUrl: string): Promise<ImageUploadResponse> => {
  const cacheable = isBlobUrl(localUrl);
  if (cacheable) {
    const cached = localImageUrlCache.get(localUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.asset;
    if (cached) {
      localImageUrlCache.delete(localUrl);
    }
  }

  const response = await fetch(localUrl);
  const fetchedBlob = await response.blob();
  const blob = normalizeUploadBlob(fetchedBlob);
  const extension = inferExtension(blob.type);
  const filename = `reference-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const uploadResponse = await fetchWithAuth("/api/upload-image", {
    method: "POST",
    headers: {
      "Content-Type": blob.type,
      "x-shortpulse-upload-filename": filename,
    },
    body: blob,
    shortpulseLogScope: "generation",
  });

  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => ({}));
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
export const uploadImageToStorage = async (localUrl: string): Promise<string> => {
  const uploaded = await uploadImageAssetToStorage(localUrl);
  return uploaded.url;
};

/**
 * Prepares an image URL for provider submission.
 * Uploads local blob/data URLs and refreshes expiring Supabase signed URLs.
 */
export const prepareImageUrlForSubmission = async (url: string | null): Promise<string | null> => {
  const normalizedUrl = url?.trim();
  if (!normalizedUrl) return null;
  if (needsImageUpload(normalizedUrl)) {
    return uploadImageToStorage(normalizedUrl);
  }
  return refreshSupabaseSignedUrlIfNeeded(normalizedUrl);
};
