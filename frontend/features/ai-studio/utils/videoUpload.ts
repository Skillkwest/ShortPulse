/**
 * Video upload utility for AI Studio video references.
 * Uploads blob URLs to Supabase storage and refreshes expiring Supabase signed URLs.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { resolveMotionReferenceVideoStoragePathFromUrl } from "../../../lib/motionReferenceVideoStorage";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { BUCKET } from "../../media-library/logic/mediaLibraryPageHelpers";
import { readRememberedObjectUrlBlob } from "./objectUrlBlobRegistry";
import { parseSupabaseSignedObjectRef, shouldRefreshSupabaseSignedUrl } from "./supabaseSignedUrl";

export type VideoUploadResult = {
  url: string;
  path: string;
  size: number;
  mimeType?: string;
  name?: string;
};

export type VideoUploadError = {
  message: string;
  code?: string;
};

const SUPABASE_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;
const MOTION_REFERENCE_UPLOAD_AUTH_TIMEOUT_MS = 12_000;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const MOTION_REFERENCE_PROVIDER_READY_VIDEO_EXTENSIONS = new Set(["mp4", "mov"]);
const MOTION_REFERENCE_NORMALIZABLE_VIDEO_EXTENSIONS = new Set(["m4v", "ogg", "ogv", "webm"]);
const MOTION_REFERENCE_NORMALIZABLE_VIDEO_MIME_TYPES = new Set([
  "video/ogg",
  "video/webm",
  "video/x-m4v",
]);

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

type PrepareMotionReferenceVideoUploadPayload = {
  target?: {
    storagePath?: unknown;
    uploadToken?: unknown;
    mimeType?: unknown;
    name?: unknown;
  };
  error?: unknown;
  details?: unknown;
} | null;

type StageMotionReferenceVideoPayload = {
  url?: unknown;
  path?: unknown;
  size?: unknown;
  mimeType?: unknown;
  name?: unknown;
  error?: unknown;
  details?: unknown;
} | null;

const normalizeVideoUploadMimeType = (mimeType: string): string =>
  (mimeType.split(";")[0] ?? "").trim().toLowerCase() || "video/mp4";

const readVideoUrlExtension = (url: string): string | null => {
  const normalizedUrl = url.trim().replace(/#video=1$/i, "");
  if (!normalizedUrl) return null;
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  try {
    const parsed = new URL(normalizedUrl, base);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    const extension = lastSegment.includes(".")
      ? lastSegment.split(".").pop()?.trim().toLowerCase()
      : "";
    return extension || null;
  } catch {
    const match = normalizedUrl.match(/\.([a-z0-9]+)(?:$|[?#])/i);
    return match?.[1]?.trim().toLowerCase() || null;
  }
};

const readExplicitVideoMimeHint = (url: string): string | null => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return null;
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  try {
    const parsed = new URL(normalizedUrl, base);
    for (const key of ["mimeType", "mime", "type", "contentType"]) {
      const value = parsed.searchParams.get(key)?.trim().toLowerCase();
      if (value?.startsWith("video/")) {
        return normalizeVideoUploadMimeType(value);
      }
    }
  } catch {
    return null;
  }
  return null;
};

const resolveVideoUploadPipelineError = (
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

const deleteUploadedMotionVideoResult = async ({
  storagePath,
  mode,
}: {
  storagePath: string;
  mode: "stale" | "retire";
}): Promise<void> => {
  const response = await fetchWithAuth("/api/upload-video", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: storagePath, mode }),
  });

  if (response.ok) return;
  const errorData = await response.json().catch(() => ({}));
  const errorMessage =
    typeof errorData?.error === "string" && errorData.error.trim().length
      ? errorData.error.trim()
      : "Motion video cleanup failed";
  const errorDetails =
    typeof errorData?.details === "string" && errorData.details.trim().length
      ? errorData.details.trim()
      : null;
  throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
};

const uploadVideoBlob = async ({
  blob,
  mimeType,
  filename,
}: {
  blob: Blob;
  mimeType: string;
  filename: string;
}): Promise<VideoUploadResult> => {
  const normalizedMimeType = normalizeVideoUploadMimeType(mimeType || blob.type);
  const prepareResponse = await fetchWithAuth("/api/media/prepare-motion-reference-video-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceMimeType: normalizedMimeType,
      sourceName: filename,
    }),
    shortpulseLogScope: "generation",
    shortpulseAuthTimeoutMs: MOTION_REFERENCE_UPLOAD_AUTH_TIMEOUT_MS,
    shortpulseRetryNetworkOnce: true,
  });
  const preparePayload = (await prepareResponse
    .json()
    .catch(() => null)) as PrepareMotionReferenceVideoUploadPayload;
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
      : normalizedMimeType;
  const preparedName =
    typeof preparePayload?.target?.name === "string" ? preparePayload.target.name.trim() : filename;

  if (!prepareResponse.ok || !storagePath || !uploadToken) {
    throw new Error(
      resolveVideoUploadPipelineError(
        preparePayload,
        "Unable to prepare motion reference video upload."
      )
    );
  }

  const supabase = ensureSupabaseQueryClient();
  const uploadToSignedUrlResult = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(storagePath, uploadToken, blob, {
      contentType: preparedMimeType,
      upsert: false,
    });
  if (uploadToSignedUrlResult.error) {
    throw new Error(
      uploadToSignedUrlResult.error.message || "Unable to upload the motion reference video."
    );
  }

  const finalizeResponse = await fetchWithAuth("/api/media/stage-motion-reference-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceMimeType: preparedMimeType,
      sourceName: preparedName,
      sourceStoragePath: storagePath,
    }),
    shortpulseLogScope: "generation",
    shortpulseAuthTimeoutMs: MOTION_REFERENCE_UPLOAD_AUTH_TIMEOUT_MS,
    shortpulseRetryNetworkOnce: true,
  });
  const result = (await finalizeResponse
    .json()
    .catch(() => null)) as StageMotionReferenceVideoPayload;

  if (!finalizeResponse.ok) {
    throw new Error(
      resolveVideoUploadPipelineError(result, `Video upload failed (${finalizeResponse.status})`)
    );
  }

  const url = typeof result?.url === "string" ? result.url.trim() : "";
  const path = typeof result?.path === "string" ? result.path.trim() : "";
  const size = typeof result?.size === "number" ? result.size : blob.size;
  const resultMimeType = typeof result?.mimeType === "string" ? result.mimeType.trim() : "";
  const resultName = typeof result?.name === "string" ? result.name.trim() : "";
  if (!url || !path) {
    throw new Error("Video upload failed: missing signed delivery metadata.");
  }
  return {
    url,
    path,
    size,
    ...(resultMimeType ? { mimeType: resultMimeType } : {}),
    ...(resultName ? { name: resultName } : {}),
  };
};

/**
 * Uploads a local video File to storage and returns signed delivery metadata.
 */
export const uploadVideoFileToStorage = async (file: File): Promise<VideoUploadResult> => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const fallbackExtension = file.type.split("/")[1] || "mp4";
  const filenameBase = file.name.trim().replace(/\.[^/.]+$/, "") || "motion-reference";
  const extension = file.name.split(".").pop()?.trim() || fallbackExtension;
  const filename = `${filenameBase}-${timestamp}-${randomString}.${extension}`;

  try {
    return await uploadVideoBlob({
      blob: file,
      mimeType: file.type || "video/mp4",
      filename,
    });
  } catch (error) {
    console.error("Video file upload error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload video. Please try again."
    );
  }
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
    const rememberedBlob = normalizedLocalVideoUrl.startsWith("blob:")
      ? readRememberedObjectUrlBlob(normalizedLocalVideoUrl)
      : null;
    const blob =
      rememberedBlob ??
      (await (async () => {
        const response = await fetch(normalizedLocalVideoUrl);
        if (!response.ok) {
          throw new Error(`Unable to read local video input (${response.status}).`);
        }
        return response.blob();
      })());

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = blob.type.split("/")[1] || "mp4";
    const filename = `motion-reference-${timestamp}-${randomString}.${extension}`;
    return await uploadVideoBlob({
      blob,
      mimeType: blob.type || "video/mp4",
      filename,
    });
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
 * Returns true when a Motion Control URL is fetchable but still needs provider-facing MP4/MOV normalization.
 */
export const needsMotionReferenceVideoProviderNormalization = (url: string | null): boolean => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  const extension = readVideoUrlExtension(normalized);
  if (extension && MOTION_REFERENCE_NORMALIZABLE_VIDEO_EXTENSIONS.has(extension)) {
    return true;
  }
  if (extension && !MOTION_REFERENCE_PROVIDER_READY_VIDEO_EXTENSIONS.has(extension)) {
    return false;
  }
  const mimeHint = readExplicitVideoMimeHint(normalized);
  return Boolean(mimeHint && MOTION_REFERENCE_NORMALIZABLE_VIDEO_MIME_TYPES.has(mimeHint));
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

/**
 * Prepares a Motion Control source video URL so the slot only retains provider-ready media.
 */
export const prepareMotionReferenceVideoUrl = async (
  url: string | null
): Promise<string | null> => {
  const normalizedUrl = url?.trim();
  if (!normalizedUrl) return null;

  if (
    needsVideoUpload(normalizedUrl) ||
    needsMotionReferenceVideoProviderNormalization(normalizedUrl)
  ) {
    return uploadVideoToStorage(normalizedUrl);
  }

  return refreshSupabaseSignedUrlIfNeeded(normalizedUrl);
};

/**
 * Best-effort cleanup for stale motion-control uploads that never became authoritative.
 */
export const deleteUploadedMotionVideoByPath = async (storagePath: string): Promise<void> => {
  const normalizedStoragePath = storagePath.trim();
  if (!normalizedStoragePath) return;
  try {
    await deleteUploadedMotionVideoResult({
      storagePath: normalizedStoragePath,
      mode: "stale",
    });
  } catch (error) {
    console.warn("Failed to cleanup stale motion video upload:", error);
  }
};

export const retireCommittedMotionVideoByUrl = async (videoUrl: string | null): Promise<void> => {
  const storagePath = resolveMotionReferenceVideoStoragePathFromUrl(videoUrl);
  if (!storagePath) return;
  try {
    await deleteUploadedMotionVideoResult({
      storagePath,
      mode: "retire",
    });
  } catch (error) {
    console.warn("Failed to retire committed motion video upload:", error);
  }
};
