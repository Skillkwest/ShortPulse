/**
 * Audio upload utility for AI Studio local reference durability.
 * Stages blob/data audio through the canonical authenticated Media Library upload path.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

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

  const uploadResponse = await fetchWithAuth("/api/media/upload", {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "x-shortpulse-upload-filename": filename,
      "x-shortpulse-upload-destination-tab": "uploaded_videos",
    },
    body: blob,
  });

  const payload = (await uploadResponse.json().catch(() => null)) as {
    file?: {
      signedUrl?: unknown;
      storage_path?: unknown;
      file_size?: unknown;
      file_type?: unknown;
    };
    error?: unknown;
    details?: unknown;
  } | null;
  const file = payload?.file;
  const path = typeof file?.storage_path === "string" ? file.storage_path.trim() : "";
  const url = typeof file?.signedUrl === "string" ? file.signedUrl.trim() : "";
  const size = typeof file?.file_size === "number" ? file.file_size : blob.size;
  if (!uploadResponse.ok || !path || !url) {
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
    const response = await fetch(normalizedLocalAudioUrl);
    if (!response.ok) {
      throw new Error(`Unable to read local audio input (${response.status}).`);
    }
    const blob = await response.blob();
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
