/**
 * Video upload utility for Motion Control
 * Uploads blob URLs to Supabase storage and refreshes expiring Supabase signed URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";

export type VideoUploadResult = {
  url: string;
  path: string;
  size: number;
};

export type VideoUploadError = {
  message: string;
  code?: string;
};

const SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;

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

const refreshSupabaseSignedUrlIfNeeded = async (url: string): Promise<string> => {
  const objectRef = parseSupabaseSignedObjectRef(url);
  if (!objectRef) return url;
  if (!shouldRefreshSupabaseSignedUrl(objectRef.expiresAtSeconds)) return url;

  const refreshedUrl = await getSignedMediaUrl({
    bucket: objectRef.bucket,
    storagePath: objectRef.storagePath,
    forceRefresh: true,
  });
  if (refreshedUrl?.trim()) return refreshedUrl;
  throw new Error(
    "Motion reference video URL expired and could not be refreshed. Please reselect the video."
  );
};

/**
 * Uploads a video blob to storage and returns the public URL
 * @param videoBlobUrl - The blob URL from createObjectURL or file input
 * @returns Promise with the public URL
 */
export const uploadVideoToStorage = async (videoBlobUrl: string): Promise<string> => {
  try {
    // Convert blob URL to actual File object
    const response = await fetch(videoBlobUrl);
    const blob = await response.blob();

    // Generate a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = blob.type.split("/")[1] || "mp4";
    const filename = `motion-reference-${timestamp}-${randomString}.${extension}`;

    // Create FormData
    const formData = new FormData();
    formData.append("file", blob, filename);

    // Upload to your API endpoint
    const uploadResponse = await fetchWithAuth("/api/upload-video", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Video upload failed");
    }

    const result: VideoUploadResult = await uploadResponse.json();
    return result.url;
  } catch (error) {
    console.error("Video upload error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload video. Please try again."
    );
  }
};

/**
 * Checks if a URL is a blob URL that needs uploading
 */
export const needsVideoUpload = (url: string | null): boolean => {
  return Boolean(url && url.startsWith("blob:"));
};

/**
 * Prepares a video URL for submission
 * - If it's a blob URL, uploads it and returns the public URL
 * - Otherwise returns the URL as-is
 */
export const prepareVideoUrl = async (url: string | null): Promise<string | null> => {
  const normalizedUrl = url?.trim();
  if (!normalizedUrl) return null;

  if (needsVideoUpload(normalizedUrl)) {
    return uploadVideoToStorage(normalizedUrl);
  }

  return refreshSupabaseSignedUrlIfNeeded(normalizedUrl);
};

/**
 * Alias for pre-submit URL preparation to match naming used by image references.
 */
export const prepareVideoUrlForSubmission = prepareVideoUrl;
