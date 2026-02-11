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

const localImageUrlCache = new Map<string, string>();

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

/**
 * Uploads a local image URL to storage and returns a signed HTTPS URL.
 */
export const uploadImageToStorage = async (localUrl: string): Promise<string> => {
  const cacheable = isBlobUrl(localUrl);
  if (cacheable) {
    const cached = localImageUrlCache.get(localUrl);
    if (cached) return cached;
  }

  const response = await fetch(localUrl);
  const blob = await response.blob();
  const extension = inferExtension(blob.type);
  const filename = `reference-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const formData = new FormData();
  formData.append("file", blob, filename);

  const uploadResponse = await fetchWithAuth("/api/upload-image", {
    method: "POST",
    body: formData,
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
    localImageUrlCache.set(localUrl, data.url);
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
