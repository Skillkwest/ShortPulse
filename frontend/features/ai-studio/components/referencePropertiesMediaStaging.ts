/**
 * Media-staging helpers for AI Studio reference properties interactions.
 * Keeps upload/copy decisions outside the UI-facing hook while preserving canonical upload utilities.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  createInternalMediaRef,
  INTERNAL_MEDIA_REF_BUCKET,
} from "../../../lib/media/internalMediaRefs";
import {
  registerInternalMediaRefForUrl,
  resolveInternalMediaRefForUrl,
} from "../logic/referenceInputInternalMediaRegistry";
import {
  uploadImageAssetToStorage,
  uploadImageBlobAssetToStorage,
  type ImageUploadResponse,
} from "../utils/imageUpload";
import {
  uploadReferenceVideoAssetToStorage,
  uploadReferenceVideoFileToStorage,
  type VideoUploadResult,
} from "../utils/videoUpload";
import { uploadAudioBlobToStorage, type AudioUploadResult } from "../utils/audioUpload";
import { readRememberedObjectUrlBlob } from "../utils/objectUrlBlobRegistry";
import {
  createUploadedAudioInternalMediaRef,
  createUploadedVideoInternalMediaRef,
} from "./referencePropertiesTypes";

type ServerCopiedMediaResponse = {
  storagePath?: unknown;
  fileSize?: unknown;
  delivery?: {
    previewUrl?: unknown;
    fullUrl?: unknown;
  } | null;
};

const isHttpImageSourceUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());
const isHttpMediaSourceUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const copyRemoteImageToStorage = async (sourceUrl: string): Promise<ImageUploadResponse> => {
  const response = await fetchWithAuth("/api/media/copy-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: "image",
      source: "upload",
      fileTypeHint: "image",
      metadata: {
        ai_studio_reference_provider_staging: true,
      },
    }),
    shortpulseLogScope: "generation",
  });
  const payload = (await response.json().catch(() => null)) as ServerCopiedMediaResponse | null;
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown } | null)?.error === "string"
        ? (payload as { error: string }).error
        : "Unable to copy remote reference image."
    );
  }
  const path = typeof payload?.storagePath === "string" ? payload.storagePath.trim() : "";
  const delivery = payload?.delivery ?? null;
  const url =
    typeof delivery?.previewUrl === "string" && delivery.previewUrl.trim()
      ? delivery.previewUrl.trim()
      : typeof delivery?.fullUrl === "string" && delivery.fullUrl.trim()
        ? delivery.fullUrl.trim()
        : "";
  if (!path || !url) {
    throw new Error("Remote reference image copy did not return durable media.");
  }
  return {
    url,
    path,
    size: typeof payload?.fileSize === "number" ? payload.fileSize : 0,
  };
};

const copyRemoteSeedanceMediaToStorage = async (
  sourceUrl: string,
  mediaKind: "video" | "audio"
): Promise<VideoUploadResult | AudioUploadResult> => {
  const response = await fetchWithAuth("/api/media/copy-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: mediaKind,
      source: "upload",
      fileTypeHint: mediaKind,
      metadata: {
        ai_studio_reference_provider_staging: true,
      },
    }),
    shortpulseLogScope: "generation",
  });
  const payload = (await response.json().catch(() => null)) as ServerCopiedMediaResponse | null;
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown } | null)?.error === "string"
        ? (payload as { error: string }).error
        : `Unable to copy remote reference ${mediaKind}.`
    );
  }
  const path = typeof payload?.storagePath === "string" ? payload.storagePath.trim() : "";
  const delivery = payload?.delivery ?? null;
  const url =
    typeof delivery?.fullUrl === "string" && delivery.fullUrl.trim()
      ? delivery.fullUrl.trim()
      : typeof delivery?.previewUrl === "string" && delivery.previewUrl.trim()
        ? delivery.previewUrl.trim()
        : "";
  if (!path || !url) {
    throw new Error(`Remote reference ${mediaKind} copy did not return durable media.`);
  }
  return {
    url,
    path,
    size: typeof payload?.fileSize === "number" ? payload.fileSize : 0,
  };
};

/**
 * Stages an image source through canonical image upload/copy utilities when provider access is required.
 */
export const stageProviderImageSelection = async ({
  imageFile,
  imageUrl,
  imageBlob,
}: {
  imageFile?: File | null;
  imageUrl?: string | null;
  imageBlob?: Blob | null;
}): Promise<ImageUploadResponse | null> => {
  if (imageFile) {
    return await uploadImageBlobAssetToStorage(imageFile);
  }
  if (imageBlob) {
    return await uploadImageBlobAssetToStorage(imageBlob);
  }
  const normalizedUrl = imageUrl?.trim() ?? "";
  if (!normalizedUrl) return null;
  if (isHttpImageSourceUrl(normalizedUrl)) {
    return await copyRemoteImageToStorage(normalizedUrl);
  }
  return await uploadImageAssetToStorage(normalizedUrl);
};

/**
 * Stages a Seedance video reference and registers storage authority for the returned URL.
 */
export const stageSeedanceVideoSelection = async ({
  videoFile,
  videoUrl,
  storagePath,
}: {
  videoFile?: File | null;
  videoUrl?: string | null;
  storagePath?: string | null;
}): Promise<{ url: string; name?: string | null } | null> => {
  if (videoFile) {
    const uploaded = await uploadReferenceVideoFileToStorage(videoFile);
    registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
    return { url: uploaded.url, name: uploaded.name ?? videoFile.name };
  }
  const normalizedUrl = videoUrl?.trim() ?? "";
  if (!normalizedUrl) return null;
  const normalizedStoragePath = storagePath?.trim() ?? "";
  const existingInternalRef = resolveInternalMediaRefForUrl(normalizedUrl);
  if (normalizedStoragePath) {
    registerInternalMediaRefForUrl(
      normalizedUrl,
      createInternalMediaRef({
        bucket: INTERNAL_MEDIA_REF_BUCKET,
        storagePath: normalizedStoragePath,
      })
    );
    return { url: normalizedUrl };
  }
  if (existingInternalRef?.storagePath) {
    return { url: normalizedUrl };
  }
  if (normalizedUrl.startsWith("blob:") || /^data:video\//i.test(normalizedUrl)) {
    const uploaded = await uploadReferenceVideoAssetToStorage(normalizedUrl);
    registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
    return { url: uploaded.url, name: uploaded.name ?? null };
  }
  if (isHttpMediaSourceUrl(normalizedUrl)) {
    const uploaded = await copyRemoteSeedanceMediaToStorage(normalizedUrl, "video");
    registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
    return { url: uploaded.url, name: "name" in uploaded ? (uploaded.name ?? null) : null };
  }
  return { url: normalizedUrl };
};

/**
 * Stages a Seedance audio reference and registers storage authority for the returned URL.
 */
export const stageSeedanceAudioSelection = async ({
  audioFile,
  audioUrl,
  storagePath,
  name,
}: {
  audioFile?: File | null;
  audioUrl?: string | null;
  storagePath?: string | null;
  name?: string | null;
}): Promise<{ url: string; name?: string | null } | null> => {
  if (audioFile) {
    const uploaded = await uploadAudioBlobToStorage(audioFile, {
      sourceName: audioFile.name,
      mimeType: audioFile.type,
    });
    registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
    return { url: uploaded.url, name: audioFile.name };
  }
  const normalizedUrl = audioUrl?.trim() ?? "";
  if (!normalizedUrl) return null;
  const normalizedStoragePath = storagePath?.trim() ?? "";
  const existingInternalRef = resolveInternalMediaRefForUrl(normalizedUrl);
  if (normalizedStoragePath) {
    registerInternalMediaRefForUrl(
      normalizedUrl,
      createInternalMediaRef({
        bucket: INTERNAL_MEDIA_REF_BUCKET,
        storagePath: normalizedStoragePath,
      })
    );
    return { url: normalizedUrl, name };
  }
  if (existingInternalRef?.storagePath) {
    return { url: normalizedUrl, name };
  }
  if (normalizedUrl.startsWith("blob:") || /^data:audio\//i.test(normalizedUrl)) {
    const rememberedBlob = normalizedUrl.startsWith("blob:")
      ? readRememberedObjectUrlBlob(normalizedUrl)
      : null;
    const sourceBlob =
      rememberedBlob ?? (await fetch(normalizedUrl).then((response) => response.blob()));
    if (!sourceBlob) return null;
    const uploaded = await uploadAudioBlobToStorage(sourceBlob, {
      sourceName: name,
      mimeType: sourceBlob.type,
    });
    registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
    return { url: uploaded.url, name };
  }
  if (isHttpMediaSourceUrl(normalizedUrl)) {
    const uploaded = await copyRemoteSeedanceMediaToStorage(normalizedUrl, "audio");
    registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
    return { url: uploaded.url, name };
  }
  return { url: normalizedUrl, name };
};
