/**
 * Voice changer source staging helpers.
 * Moves local intake onto authenticated server staging, signs stored paths, and extracts audio from trusted video sources.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { BUCKET } from "../../media-library/logic/mediaLibraryPageHelpers";

const VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS = 8000;
const VOICE_CHANGER_MEDIA_METADATA_TIMEOUT_MS = 8000;
const SIGN_VOICE_CHANGER_SOURCE_TIMEOUT_MS = 10_000;
const PREPARE_VOICE_CHANGER_SOURCE_UPLOAD_TIMEOUT_MS = 20_000;
const UPLOAD_VOICE_CHANGER_SOURCE_STORAGE_TIMEOUT_MS = 180_000;
const FINALIZE_VOICE_CHANGER_SOURCE_UPLOAD_TIMEOUT_MS = 60_000;
const STAGE_VOICE_CLONE_SOURCE_TIMEOUT_MS = 180_000;
const STAGE_VOICE_CHANGER_VIDEO_REFERENCE_TIMEOUT_MS = 180_000;
const EXTRACT_VOICE_CHANGER_AUDIO_TIMEOUT_MS = 180_000;
const GENERIC_UPLOAD_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

type VoiceChangerSourceStage =
  | "sign_voice_source"
  | "prepare_voice_source_upload"
  | "upload_voice_source_storage"
  | "finalize_voice_source_upload"
  | "stage_voice_video_reference"
  | "stage_voice_clone_source"
  | "extract_voice_video_audio";

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
  "video/mov": "video/quicktime",
  "video/x-quicktime": "video/quicktime",
};

const normalizeSupportedMimeType = (value: string | null | undefined): string => {
  const normalized = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  return MIME_ALIAS_TO_CANONICAL[normalized] ?? normalized;
};

const inferMimeTypeFromFilename = (
  filename: string,
  fallback: "audio" | "video"
): string | null => {
  const normalized = filename.trim().toLowerCase();
  if (!normalized) return null;
  if (/\.mp3(?:$|[?#])/i.test(normalized)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.mp4(?:$|[?#])/i.test(normalized)) return "video/mp4";
  if (/\.mov(?:$|[?#])/i.test(normalized)) return "video/quicktime";
  if (/\.m4v(?:$|[?#])/i.test(normalized)) return "video/x-m4v";
  if (/\.webm(?:$|[?#])/i.test(normalized))
    return fallback === "audio" ? "audio/webm" : "video/webm";
  return null;
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

const inferExtensionFromMimeType = (mimeType: string, fallback: "audio" | "video"): string => {
  const normalized = normalizeSupportedMimeType(mimeType);
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/wav") return "wav";
  if (normalized === "audio/aac") return "aac";
  if (normalized === "audio/flac") return "flac";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/webm") return "webm";
  if (normalized === "video/mp4") return "mp4";
  if (normalized === "video/quicktime") return "mov";
  if (normalized === "video/x-m4v") return "m4v";
  if (normalized === "video/webm") return "webm";
  return fallback === "audio" ? "wav" : "mp4";
};

const resolveUploadSourceMimeType = (file: File, fallback: "audio" | "video"): string => {
  const normalizedFileMimeType = normalizeSupportedMimeType(file.type);
  if (!GENERIC_UPLOAD_MIME_TYPES.has(normalizedFileMimeType)) {
    return normalizedFileMimeType;
  }
  return (
    inferMimeTypeFromFilename(file.name, fallback) ??
    (fallback === "audio" ? "audio/wav" : "video/mp4")
  );
};

const resolveVoiceChangerSourceTimeoutLabel = (stage: VoiceChangerSourceStage): string => {
  switch (stage) {
    case "sign_voice_source":
      return "voice source signing";
    case "prepare_voice_source_upload":
      return "voice source upload preparation";
    case "upload_voice_source_storage":
      return "voice source storage upload";
    case "finalize_voice_source_upload":
      return "voice source upload finalization";
    case "stage_voice_video_reference":
      return "voice video reference staging";
    case "stage_voice_clone_source":
      return "voice clone source staging";
    case "extract_voice_video_audio":
      return "voice sample extraction";
  }
};

const runAbortableVoiceChangerSourceStep = async <T>({
  stage,
  timeoutMs,
  run,
}: {
  stage: VoiceChangerSourceStage;
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
        `${resolveVoiceChangerSourceTimeoutLabel(
          stage
        )} timed out. Please retry with a smaller or local source file.`
      );
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

const parseSupabaseSignedObjectRef = (
  url: string
): { bucket: string; storagePath: string } | null => {
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

    let storagePath = pathFromPathname;
    if (payloadUrl) {
      const normalized = payloadUrl.replace(/^\/+/, "");
      if (normalized.startsWith(`${bucket}/`)) {
        storagePath = normalized.slice(bucket.length + 1);
      }
    }

    if (!storagePath) return null;
    return { bucket, storagePath };
  } catch {
    return null;
  }
};

export const resolveVoiceChangerSourceStoragePath = (
  sourceUrl: string | null | undefined
): string | null => {
  if (typeof sourceUrl !== "string") return null;
  const normalized = sourceUrl.trim();
  if (!normalized) return null;
  const parsedSignedRef = parseSupabaseSignedObjectRef(normalized);
  if (parsedSignedRef && parsedSignedRef.bucket === BUCKET) {
    return parsedSignedRef.storagePath;
  }
  return null;
};

export const signVoiceSourceStoragePath = async (storagePath: string): Promise<string> => {
  const signedUrl = await runAbortableVoiceChangerSourceStep({
    stage: "sign_voice_source",
    timeoutMs: SIGN_VOICE_CHANGER_SOURCE_TIMEOUT_MS,
    run: async () =>
      await getSignedMediaUrl({
        bucket: BUCKET,
        storagePath,
        forceRefresh: true,
      }),
  });
  if (!signedUrl?.trim()) {
    throw new Error("Unable to sign the stored voice source.");
  }
  return signedUrl;
};

export const signVoiceChangerStoragePath = signVoiceSourceStoragePath;

type StagedVoiceSourcePayload = {
  source?: {
    storagePath?: unknown;
    previewUrl?: unknown;
    mimeType?: unknown;
    name?: unknown;
    size?: unknown;
  };
  error?: unknown;
  details?: unknown;
} | null;

const uploadStagedVoiceSourceFile = async ({
  file,
  kind,
  filenameFallbackPrefix,
  stageError,
}: {
  file: File;
  kind: "audio" | "video";
  filenameFallbackPrefix: string;
  stageError: string;
}): Promise<{
  storagePath: string;
  signedUrl: string | null;
  mimeType: string;
  name: string;
  size: number;
}> => {
  const mimeType = resolveUploadSourceMimeType(file, kind);
  const filename =
    file.name.trim() || `${filenameFallbackPrefix}.${inferExtensionFromMimeType(mimeType, kind)}`;
  const prepareResponse = await runAbortableVoiceChangerSourceStep({
    stage: "prepare_voice_source_upload",
    timeoutMs: PREPARE_VOICE_CHANGER_SOURCE_UPLOAD_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/prepare-voice-changer-source-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceKind: kind,
          sourceMimeType: mimeType,
          sourceName: filename,
        }),
        signal,
        shortpulseLogScope: "generation",
        shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
      }),
  });
  const preparePayload = (await prepareResponse.json().catch(() => null)) as {
    target?: {
      storagePath?: unknown;
      uploadToken?: unknown;
      mimeType?: unknown;
      name?: unknown;
    };
    error?: unknown;
    details?: unknown;
  } | null;
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
      : mimeType;
  const preparedName =
    typeof preparePayload?.target?.name === "string" ? preparePayload.target.name.trim() : filename;

  if (!prepareResponse.ok || !storagePath || !uploadToken) {
    const error =
      typeof preparePayload?.details === "string" && preparePayload.details.trim()
        ? preparePayload.details.trim()
        : typeof preparePayload?.error === "string" && preparePayload.error.trim()
          ? preparePayload.error.trim()
          : stageError;
    throw new Error(error);
  }

  const supabase = ensureSupabaseQueryClient();
  const uploadResult = await runAbortableVoiceChangerSourceStep({
    stage: "upload_voice_source_storage",
    timeoutMs: UPLOAD_VOICE_CHANGER_SOURCE_STORAGE_TIMEOUT_MS,
    run: async () =>
      await supabase.storage.from(BUCKET).uploadToSignedUrl(storagePath, uploadToken, file, {
        contentType: preparedMimeType,
        upsert: false,
      }),
  });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || stageError);
  }

  const finalizeResponse = await runAbortableVoiceChangerSourceStep({
    stage: "finalize_voice_source_upload",
    timeoutMs: FINALIZE_VOICE_CHANGER_SOURCE_UPLOAD_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/stage-voice-changer-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceKind: kind,
          sourceMimeType: preparedMimeType,
          sourceName: preparedName,
          sourceStoragePath: storagePath,
        }),
        signal,
        shortpulseLogScope: "generation",
        shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
      }),
  });
  const payload = (await finalizeResponse.json().catch(() => null)) as StagedVoiceSourcePayload;
  const previewUrl =
    typeof payload?.source?.previewUrl === "string" ? payload.source.previewUrl.trim() : "";
  const resolvedMimeType =
    typeof payload?.source?.mimeType === "string" ? payload.source.mimeType.trim() : "";
  const resolvedName = typeof payload?.source?.name === "string" ? payload.source.name.trim() : "";
  const resolvedSize = typeof payload?.source?.size === "number" ? payload.source.size : NaN;
  if (!finalizeResponse.ok || !previewUrl || !resolvedMimeType || !resolvedName) {
    const error =
      typeof payload?.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : stageError;
    throw new Error(error);
  }

  return {
    storagePath,
    signedUrl: previewUrl,
    mimeType: resolvedMimeType,
    name: resolvedName,
    size: Number.isFinite(resolvedSize) ? resolvedSize : file.size,
  };
};

export const uploadVoiceChangerSourceFile = async ({
  file,
  kind,
}: {
  file: File;
  kind: "audio" | "video";
}) =>
  uploadStagedVoiceSourceFile({
    file,
    kind,
    filenameFallbackPrefix: "voice-changer-source",
    stageError: "Unable to stage the voice changer source.",
  });

export const stageVoiceChangerVideoReferenceSource = async ({
  sourceName,
  sourceMimeType,
  sourceStoragePath,
  sourceUrl,
}: {
  sourceName: string;
  sourceMimeType: string | null;
  sourceStoragePath: string | null;
  sourceUrl: string | null;
}): Promise<{
  storagePath: string;
  signedUrl: string;
  mimeType: string;
  name: string;
  size: number;
}> => {
  const response = await runAbortableVoiceChangerSourceStep({
    stage: "stage_voice_video_reference",
    timeoutMs: STAGE_VOICE_CHANGER_VIDEO_REFERENCE_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/stage-voice-changer-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKind: "video",
          sourceMimeType: sourceMimeType ?? "video/mp4",
          sourceName,
          sourceStoragePath,
          sourceUrl,
        }),
        signal,
        shortpulseLogScope: "generation",
        shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
      }),
  });
  const payload = (await response.json().catch(() => null)) as StagedVoiceSourcePayload;
  const source = payload?.source;
  const storagePath = typeof source?.storagePath === "string" ? source.storagePath.trim() : "";
  const signedUrl = typeof source?.previewUrl === "string" ? source.previewUrl.trim() : "";
  const mimeType = typeof source?.mimeType === "string" ? source.mimeType.trim() : "";
  const name = typeof source?.name === "string" ? source.name.trim() : "";
  const size = typeof source?.size === "number" ? source.size : NaN;
  if (!response.ok || !storagePath || !signedUrl || !mimeType || !name) {
    const error =
      typeof payload?.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "Unable to stage the Voice Changer video reference.";
    throw new Error(error);
  }
  return {
    storagePath,
    signedUrl,
    mimeType,
    name,
    size: Number.isFinite(size) ? size : 0,
  };
};

export const uploadVoiceCloneSourceFile = async ({ file }: { file: File }) =>
  (async () => {
    const mimeType = resolveUploadSourceMimeType(file, "audio");
    const filename =
      file.name.trim() || `voice-clone-source.${inferExtensionFromMimeType(mimeType, "audio")}`;
    const response = await runAbortableVoiceChangerSourceStep({
      stage: "stage_voice_clone_source",
      timeoutMs: STAGE_VOICE_CLONE_SOURCE_TIMEOUT_MS,
      run: async (signal) =>
        await fetchWithAuth("/api/media/stage-voice-clone-source", {
          method: "POST",
          headers: {
            "Content-Type": mimeType,
            "x-shortpulse-upload-filename": filename,
          },
          body: file,
          signal,
          shortpulseLogScope: "generation",
          shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
        }),
    });

    const payload = (await response.json().catch(() => null)) as StagedVoiceSourcePayload;
    const previewUrl =
      typeof payload?.source?.previewUrl === "string" ? payload.source.previewUrl.trim() : "";
    const storagePath =
      typeof payload?.source?.storagePath === "string" ? payload.source.storagePath.trim() : "";
    const resolvedMimeType =
      typeof payload?.source?.mimeType === "string" ? payload.source.mimeType.trim() : "";
    const resolvedName =
      typeof payload?.source?.name === "string" ? payload.source.name.trim() : "";
    const resolvedSize = typeof payload?.source?.size === "number" ? payload.source.size : NaN;

    if (!response.ok || !previewUrl || !storagePath || !resolvedMimeType || !resolvedName) {
      const error =
        typeof payload?.details === "string" && payload.details.trim()
          ? payload.details.trim()
          : typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Unable to stage the voice clone source.";
      throw new Error(error);
    }

    return {
      storagePath,
      signedUrl: previewUrl,
      mimeType: resolvedMimeType,
      name: resolvedName,
      size: Number.isFinite(resolvedSize) ? resolvedSize : file.size,
    };
  })();

type ExtractAudioResponse = {
  audio?: {
    name?: unknown;
    mimeType?: unknown;
    previewUrl?: unknown;
    storagePath?: unknown;
    size?: unknown;
  };
  error?: unknown;
  details?: unknown;
};

export const extractVoiceChangerVideoSource = async ({
  sourceName,
  sourceOrigin,
  sourceMimeType,
  sourceStoragePath,
  sourceUrl,
}: {
  sourceName: string;
  sourceOrigin: "local" | "reference-grid" | "url";
  sourceMimeType: string | null;
  sourceStoragePath: string | null;
  sourceUrl: string | null;
}): Promise<{
  storagePath: string;
  signedUrl: string;
  mimeType: "audio/wav";
  name: string;
  size: number;
}> => {
  const response = await runAbortableVoiceChangerSourceStep({
    stage: "extract_voice_video_audio",
    timeoutMs: EXTRACT_VOICE_CHANGER_AUDIO_TIMEOUT_MS,
    run: async (signal) =>
      await fetchWithAuth("/api/media/extract-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceName,
          sourceOrigin,
          sourceMimeType,
          sourceStoragePath,
          sourceUrl,
        }),
        signal,
        shortpulseLogScope: "generation",
        shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
      }),
  });

  const payload = (await response.json().catch(() => null)) as ExtractAudioResponse | null;
  const audio = payload?.audio;
  const storagePath = typeof audio?.storagePath === "string" ? audio.storagePath.trim() : "";
  const signedUrl = typeof audio?.previewUrl === "string" ? audio.previewUrl.trim() : "";
  const name = typeof audio?.name === "string" ? audio.name.trim() : "";
  const mimeType = typeof audio?.mimeType === "string" ? audio.mimeType.trim() : "";
  const size = typeof audio?.size === "number" ? audio.size : NaN;

  if (!response.ok || !storagePath || !signedUrl || !name || mimeType !== "audio/wav") {
    const error =
      typeof payload?.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "Unable to extract audio from the selected video.";
    throw new Error(error);
  }

  return {
    storagePath,
    signedUrl,
    mimeType: "audio/wav",
    name,
    size: Number.isFinite(size) ? size : 0,
  };
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b > 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || 1;
};

const toAspectToken = (width: number, height: number): string | null => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const divisor = gcd(width, height);
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
};

const cleanupVoiceChangerMetadataProbe = (media: HTMLMediaElement) => {
  try {
    media.pause();
  } catch {
    // Detached media cleanup can throw in browser/test environments.
  }
  media.removeAttribute("src");
  try {
    media.load();
  } catch {
    // Some browser/test environments throw when resetting detached media.
  }
};

export const resolveVoiceChangerMediaDurationMs = async (
  sourceUrl: string | null | undefined,
  kind: "audio" | "video"
): Promise<number | null> => {
  const normalized = typeof sourceUrl === "string" ? sourceUrl.trim() : "";
  if (!normalized || typeof document === "undefined") return null;

  const media = document.createElement(kind);
  media.preload = "metadata";
  media.crossOrigin = "anonymous";
  if (kind === "video") {
    media.muted = true;
    (media as HTMLVideoElement).playsInline = true;
  }

  return await new Promise<number | null>((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const finalize = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener("error", handleFailure);
      cleanupVoiceChangerMetadataProbe(media);
      resolve(value);
    };

    const handleFailure = () => finalize(null);
    const handleLoadedMetadata = () => {
      const durationSeconds = Number(media.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        finalize(null);
        return;
      }
      finalize(Math.max(1, Math.round(durationSeconds * 1000)));
    };

    media.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    media.addEventListener("error", handleFailure, { once: true });
    timeoutId = globalThis.setTimeout(handleFailure, VOICE_CHANGER_MEDIA_METADATA_TIMEOUT_MS);
    media.src = normalized;
    try {
      media.load();
    } catch {
      finalize(null);
    }
  });
};

export const resolveVoiceChangerVideoAspect = async (
  sourceUrl: string | null | undefined
): Promise<string | null> => {
  const normalized = typeof sourceUrl === "string" ? sourceUrl.trim() : "";
  if (!normalized || typeof document === "undefined") return null;

  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleFailure);
      cleanupVoiceChangerMetadataProbe(video);
      resolve(value);
    };

    const handleFailure = () => finalize(null);
    const handleLoadedMetadata = () =>
      finalize(toAspectToken(video.videoWidth || 0, video.videoHeight || 0));

    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleFailure, { once: true });
    timeoutId = globalThis.setTimeout(handleFailure, VOICE_CHANGER_MEDIA_METADATA_TIMEOUT_MS);
    video.src = normalized;
    try {
      video.load();
    } catch {
      finalize(null);
    }
  });
};
