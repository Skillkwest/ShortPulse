/**
 * Voice changer source staging helpers.
 * Moves local intake onto authenticated server staging, signs stored paths, and extracts audio from trusted video sources.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { BUCKET } from "../../media-library/logic/mediaLibraryPageHelpers";

const VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS = 8000;

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
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav";
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

export const signVoiceChangerStoragePath = async (storagePath: string): Promise<string> => {
  const signedUrl = await getSignedMediaUrl({
    bucket: BUCKET,
    storagePath,
    forceRefresh: true,
  });
  if (!signedUrl?.trim()) {
    throw new Error("Unable to sign the stored voice changer source.");
  }
  return signedUrl;
};

export const uploadVoiceChangerSourceFile = async ({
  file,
  kind,
}: {
  file: File;
  kind: "audio" | "video";
}): Promise<{
  storagePath: string;
  signedUrl: string | null;
  mimeType: string;
  name: string;
  size: number;
}> => {
  const mimeType = file.type.trim() || (kind === "audio" ? "audio/wav" : "video/mp4");
  const response = await fetchWithAuth(
    kind === "video" ? "/api/upload-video" : "/api/media/stage-voice-changer-source",
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "x-shortpulse-upload-filename":
          file.name.trim() || `voice-changer-source.${inferExtensionFromMimeType(mimeType, kind)}`,
        ...(kind === "audio" ? { "x-shortpulse-voice-changer-kind": kind } : {}),
      },
      body: file,
      shortpulseLogScope: "generation",
      shortpulseAuthTimeoutMs: VOICE_CHANGER_SOURCE_AUTH_TIMEOUT_MS,
    }
  );
  const payload = (await response.json().catch(() => null)) as {
    source?: {
      storagePath?: unknown;
      previewUrl?: unknown;
      mimeType?: unknown;
      name?: unknown;
      size?: unknown;
    };
    url?: unknown;
    path?: unknown;
    size?: unknown;
    error?: unknown;
    details?: unknown;
  } | null;

  const storagePath =
    kind === "video"
      ? typeof payload?.path === "string"
        ? payload.path.trim()
        : ""
      : typeof payload?.source?.storagePath === "string"
        ? payload.source.storagePath.trim()
        : "";
  const previewUrl =
    kind === "video"
      ? typeof payload?.url === "string"
        ? payload.url.trim()
        : ""
      : typeof payload?.source?.previewUrl === "string"
        ? payload.source.previewUrl.trim()
        : "";
  const resolvedMimeType =
    kind === "video"
      ? mimeType
      : typeof payload?.source?.mimeType === "string"
        ? payload.source.mimeType.trim()
        : "";
  const name =
    kind === "video"
      ? file.name.trim()
      : typeof payload?.source?.name === "string"
        ? payload.source.name.trim()
        : "";
  const size =
    kind === "video"
      ? typeof payload?.size === "number"
        ? payload.size
        : NaN
      : typeof payload?.source?.size === "number"
        ? payload.source.size
        : NaN;
  if (!response.ok || !storagePath || !previewUrl || !resolvedMimeType || !name) {
    const error =
      typeof payload?.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "Unable to stage the voice changer source.";
    throw new Error(error);
  }

  return {
    storagePath,
    signedUrl: previewUrl,
    mimeType: resolvedMimeType,
    name,
    size: Number.isFinite(size) ? size : file.size,
  };
};

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
  const response = await fetchWithAuth("/api/media/extract-audio", {
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
    shortpulseLogScope: "generation",
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
    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleFailure);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const handleFailure = () => finalize(null);
    const handleLoadedMetadata = () =>
      finalize(toAspectToken(video.videoWidth || 0, video.videoHeight || 0));

    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleFailure, { once: true });
    video.src = normalized;
  });
};
