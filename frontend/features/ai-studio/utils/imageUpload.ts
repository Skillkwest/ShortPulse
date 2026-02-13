/**
 * Upload utility for local reference images used by generation submit routes.
 * Converts blob/data URLs into short-lived signed HTTPS URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type ImageUploadResponse = {
  url: string;
  path: string;
  size: number;
};

type ImageUrlCacheEntry = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_BUFFER_MS = 55 * 60 * 1000;
const localImageUrlCache = new Map<string, ImageUrlCacheEntry>();

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

/**
 * Uploads a local image URL to storage and returns a signed HTTPS URL.
 */
export const uploadImageToStorage = async (localUrl: string): Promise<string> => {
  const cacheable = isBlobUrl(localUrl);
  if (cacheable) {
    const cached = localImageUrlCache.get(localUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
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

  if (cacheable) {
    localImageUrlCache.set(localUrl, {
      url: data.url,
      expiresAt: Date.now() + SIGNED_URL_BUFFER_MS,
    });
  }
  return data.url;
};

/**
 * Prepares an image URL for provider submission.
 * Uploads local blob/data URLs; passes through remote HTTPS URLs.
 */
export const prepareImageUrlForSubmission = async (url: string | null): Promise<string | null> => {
  if (!url?.trim()) return null;
  if (!needsImageUpload(url)) return url;
  return uploadImageToStorage(url);
};
