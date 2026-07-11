/**
 * Audio upload utility for AI Studio local reference durability.
 * Stages blob/data audio through the canonical authenticated Media Library upload path.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";

export type AudioUploadResult = {
  url: string;
  path: string;
  size: number;
  mimeType?: string;
};

type AudioBlobUploadOptions = {
  sourceName?: string | null;
  mimeType?: string | null;
};

type PrepareMediaUploadPayload = {
  target?: {
    intentId?: unknown;
    bucketId?: unknown;
    storagePath?: unknown;
    uploadToken?: unknown;
    mimeType?: unknown;
    name?: unknown;
  };
  error?: unknown;
  details?: unknown;
} | null;

type FinalizeMediaUploadPayload = {
  file?: {
    signedUrl?: unknown;
    storage_path?: unknown;
    file_size?: unknown;
    file_type?: unknown;
  };
  error?: unknown;
  details?: unknown;
} | null;

type AudioUploadStage =
  | "fetch_local_audio"
  | "prepare_audio_upload"
  | "upload_audio_storage"
  | "finalize_audio_upload";

const AUDIO_UPLOAD_AUTH_TIMEOUT_MS = 12_000;
const FETCH_LOCAL_AUDIO_TIMEOUT_MS = 30_000;
const PREPARE_AUDIO_UPLOAD_TIMEOUT_MS = 20_000;
const UPLOAD_AUDIO_STORAGE_TIMEOUT_MS = 180_000;
const FINALIZE_AUDIO_UPLOAD_TIMEOUT_MS = 60_000;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const GENERIC_UPLOAD_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const MIME_ALIAS_TO_CANONICAL: Record<string, string> = {
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/vnd.wave": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-aac": "audio/aac",
  "audio/x-flac": "audio/flac",
  "audio/x-m4a": "audio/mp4",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-mpeg-3": "audio/mpeg",
  "audio/x-ogg": "audio/ogg",
  "audio/x-pn-wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "application/ogg": "audio/ogg",
};

const normalizeSupportedMimeType = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  return MIME_ALIAS_TO_CANONICAL[normalized] ?? normalized;
};

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
  if (url.startsWith("blob:") || /^data:audio\//i.test(url)) return true;
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

const inferExtension = (mimeType: string): string => {
  switch (normalizeSupportedMimeType(mimeType)) {
    case "audio/aac":
      return "aac";
    case "audio/flac":
      return "flac";
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
      return "wav";
    case "audio/webm":
      return "webm";
    default:
      return "wav";
  }
};

const inferMimeTypeFromFilename = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/\.mp3(?:$|[?#])/i.test(normalized)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "audio/webm";
  return null;
};

const resolveAudioUploadTimeoutLabel = (stage: AudioUploadStage): string => {
  switch (stage) {
    case "fetch_local_audio":
      return "audio reference read";
    case "prepare_audio_upload":
      return "audio upload preparation";
    case "upload_audio_storage":
      return "audio storage upload";
    case "finalize_audio_upload":
      return "audio upload finalization";
  }
};

const runAbortableAudioStep = async <T>({
  stage,
  timeoutMs,
  run,
}: {
  stage: AudioUploadStage;
  timeoutMs: number;
  run: (signal: AbortSignal) => Promise<T>;
}): Promise<T> => {
  const abortController = new AbortController();
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  let timedOut = false;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      timedOut = true;
      abortController.abort();
      reject(new Error(`${stage} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(abortController.signal), timeoutPromise]);
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `${resolveAudioUploadTimeoutLabel(stage)} timed out. Please retry with a smaller or local audio file.`
      );
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

/**
 * Reads a local/blob/data audio URL for upload through the bounded browser audio pipeline.
 */
export const readAudioUrlBlobForUpload = async (normalizedLocalAudioUrl: string): Promise<Blob> =>
  await runAbortableAudioStep({
    stage: "fetch_local_audio",
    timeoutMs: FETCH_LOCAL_AUDIO_TIMEOUT_MS,
    run: async (signal) => {
      const response = await fetch(normalizedLocalAudioUrl, { signal });
      if (!response.ok) {
        throw new Error(`Unable to read local audio input (${response.status}).`);
      }
      return await response.blob();
    },
  });

export const uploadAudioBlobToStorage = async (
  blob: Blob,
  options: AudioBlobUploadOptions = {}
): Promise<AudioUploadResult> => {
  const inferredMimeTypeFromSource = inferMimeTypeFromFilename(options.sourceName ?? "") ?? "";
  const normalizedBlobMimeType = normalizeSupportedMimeType(options.mimeType ?? blob.type);
  const mimeType = GENERIC_UPLOAD_MIME_TYPES.has(normalizedBlobMimeType)
    ? inferredMimeTypeFromSource || "audio/wav"
    : normalizedBlobMimeType;
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const filename = `reference-audio-${timestamp}-${randomString}.${inferExtension(mimeType)}`;

  const prepareResponse = await runAbortableAudioStep({
    stage: "prepare_audio_upload",
    timeoutMs: PREPARE_AUDIO_UPLOAD_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/prepare-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destinationTab: "uploaded_videos",
          sourceMimeType: mimeType,
          sourceName: filename,
        }),
        signal,
        shortpulseAuthTimeoutMs: AUDIO_UPLOAD_AUTH_TIMEOUT_MS,
        shortpulseRetryNetworkOnce: true,
      }),
  });
  const preparePayload = (await prepareResponse
    .json()
    .catch(() => null)) as PrepareMediaUploadPayload;
  const storagePath =
    typeof preparePayload?.target?.storagePath === "string"
      ? preparePayload.target.storagePath.trim()
      : "";
  const intentId =
    typeof preparePayload?.target?.intentId === "string"
      ? preparePayload.target.intentId.trim()
      : "";
  const bucketId =
    typeof preparePayload?.target?.bucketId === "string"
      ? preparePayload.target.bucketId.trim()
      : "";
  const uploadToken =
    typeof preparePayload?.target?.uploadToken === "string"
      ? preparePayload.target.uploadToken.trim()
      : "";
  const preparedMimeType =
    typeof preparePayload?.target?.mimeType === "string"
      ? preparePayload.target.mimeType.trim()
      : mimeType;
  const preparedName =
    typeof preparePayload?.target?.name === "string" ? preparePayload.target.name.trim() : filename;

  if (
    !prepareResponse.ok ||
    !intentId ||
    bucketId !== "media_upload_staging" ||
    !storagePath ||
    !uploadToken
  ) {
    const errorMessage =
      typeof preparePayload?.details === "string" && preparePayload.details.trim().length
        ? preparePayload.details.trim()
        : typeof preparePayload?.error === "string" && preparePayload.error.trim().length
          ? preparePayload.error.trim()
          : "Audio upload failed";
    throw new Error(errorMessage);
  }

  const supabase = ensureSupabaseQueryClient();
  const uploadToSignedUrlResult = await runAbortableAudioStep({
    stage: "upload_audio_storage",
    timeoutMs: UPLOAD_AUDIO_STORAGE_TIMEOUT_MS,
    run: async () =>
      await supabase.storage.from(bucketId).uploadToSignedUrl(storagePath, uploadToken, blob, {
        contentType: preparedMimeType,
        upsert: false,
      }),
  });
  if (uploadToSignedUrlResult.error) {
    throw new Error(uploadToSignedUrlResult.error.message || "Audio upload failed");
  }

  const finalizeResponse = await runAbortableAudioStep({
    stage: "finalize_audio_upload",
    timeoutMs: FINALIZE_AUDIO_UPLOAD_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/finalize-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intentId,
          destinationTab: "uploaded_videos",
          sourceMimeType: preparedMimeType,
          sourceName: preparedName,
          sourceStoragePath: storagePath,
        }),
        signal,
        shortpulseAuthTimeoutMs: AUDIO_UPLOAD_AUTH_TIMEOUT_MS,
        shortpulseRetryNetworkOnce: true,
      }),
  });

  const payload = (await finalizeResponse.json().catch(() => null)) as FinalizeMediaUploadPayload;
  const file = payload?.file;
  const path = typeof file?.storage_path === "string" ? file.storage_path.trim() : "";
  const url = typeof file?.signedUrl === "string" ? file.signedUrl.trim() : "";
  const size = typeof file?.file_size === "number" ? file.file_size : blob.size;
  if (!finalizeResponse.ok || !path || !url) {
    const errorMessage =
      typeof payload?.details === "string" && payload.details.trim().length
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim().length
          ? payload.error.trim()
          : "Audio upload failed";
    throw new Error(errorMessage);
  }

  return {
    url,
    path,
    size: Number.isFinite(size) ? size : blob.size,
    mimeType,
  };
};

export const uploadAudioAssetToStorage = async (
  localAudioUrl: string
): Promise<AudioUploadResult> => {
  const normalizedLocalAudioUrl = localAudioUrl.replace(/#audio=1$/i, "");
  const isLocalMemoryUrl = shouldUploadForProviderAccess(normalizedLocalAudioUrl);
  try {
    const blob = await readAudioUrlBlobForUpload(normalizedLocalAudioUrl);
    return await uploadAudioBlobToStorage(blob, { sourceName: normalizedLocalAudioUrl });
  } catch (error) {
    console.error("Audio upload error:", error);
    if (
      isLocalMemoryUrl &&
      error instanceof TypeError &&
      error.message.toLowerCase().includes("failed to fetch")
    ) {
      throw new Error(
        "Local audio reference is no longer available. Re-add the audio file and try again."
      );
    }
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload audio. Please try again."
    );
  }
};
