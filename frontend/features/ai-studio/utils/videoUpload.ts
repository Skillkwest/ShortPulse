/**
 * Video upload utility for AI Studio video references.
 * Uploads blob URLs to Supabase storage and refreshes expiring Supabase signed URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { parseSupabaseSignedObjectRef, shouldRefreshSupabaseSignedUrl } from "./supabaseSignedUrl";

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
  if (url.startsWith("blob:") || /^data:video\//i.test(url)) return true;
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

const refreshSupabaseSignedUrlIfNeeded = async (url: string): Promise<string> => {
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

  const refreshedUrl = await getSignedMediaUrl({
    bucket: objectRef.bucket,
    storagePath: objectRef.storagePath,
    forceRefresh: true,
  });
  if (refreshedUrl?.trim()) return refreshedUrl;
  throw new Error(
    "Reference video URL expired and could not be refreshed. Please reselect the video."
  );
};

/**
 * Uploads a local video URL to storage and returns signed delivery metadata.
 */
export const uploadVideoAssetToStorage = async (
  localVideoUrl: string
): Promise<VideoUploadResult> => {
  const normalizedLocalVideoUrl = localVideoUrl.replace(/#video=1$/i, "");
  const isLocalMemoryUrl = shouldUploadForProviderAccess(normalizedLocalVideoUrl);
  try {
    const response = await fetch(normalizedLocalVideoUrl);
    if (!response.ok) {
      throw new Error(`Unable to read local video input (${response.status}).`);
    }
    const blob = await response.blob();

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = blob.type.split("/")[1] || "mp4";
    const filename = `motion-reference-${timestamp}-${randomString}.${extension}`;

    const uploadResponse = await fetchWithAuth("/api/upload-video", {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "video/mp4",
        "x-shortpulse-upload-filename": filename,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      const errorMessage =
        typeof errorData?.error === "string" && errorData.error.trim().length
          ? errorData.error.trim()
          : "Video upload failed";
      const errorDetails =
        typeof errorData?.details === "string" && errorData.details.trim().length
          ? errorData.details.trim()
          : null;
      throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
    }

    const result: VideoUploadResult = await uploadResponse.json();
    if (!result?.url || !result?.path) {
      throw new Error("Video upload failed: missing signed delivery metadata.");
    }
    return result;
  } catch (error) {
    console.error("Video upload error:", error);
    if (
      isLocalMemoryUrl &&
      error instanceof TypeError &&
      error.message.toLowerCase().includes("failed to fetch")
    ) {
      throw new Error(
        "Local motion reference video is no longer available. Re-add the motion video and try again."
      );
    }
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload video. Please try again."
    );
  }
};

/**
 * Uploads a local video URL to storage and returns the signed URL.
 */
export const uploadVideoToStorage = async (localVideoUrl: string): Promise<string> => {
  const uploaded = await uploadVideoAssetToStorage(localVideoUrl);
  return uploaded.url;
};

/**
 * Checks if a URL is a blob URL that needs uploading
 */
export const needsVideoUpload = (url: string | null): boolean => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  return shouldUploadForProviderAccess(normalized.replace(/#video=1$/i, ""));
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
