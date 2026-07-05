import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { StudioMode } from "../types";
import type { MediaUploadDestinationTab } from "./mediaLibraryPanelApi";

export type MediaLibraryFileType = "image" | "video" | "audio";

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
};

const URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};

const sanitizeFilename = (value: string) => value.replace(/[^\w.-]+/g, "_");

const clampPrompt = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const extensionFromUrl = (url: string) => {
  const resolveFromPathLike = (value: string) => {
    const sanitized = value.split("?")[0]?.split("#")[0] ?? value;
    const base = sanitized.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  };
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return resolveFromPathLike(url);
  }
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const resolveFileType = (
  contentType: string | null,
  fallbackMode: StudioMode,
  fileTypeHint?: MediaLibraryFileType
) => {
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("audio/")) return "audio";
  if (contentType?.startsWith("image/")) return "image";
  if (fileTypeHint) return fileTypeHint;
  if (fallbackMode === "audio") return "audio";
  return fallbackMode === "video" ? "video" : "image";
};

export const resolveExtension = (contentType: string | null, url: string) => {
  if (contentType && CONTENT_TYPE_EXTENSION[contentType]) {
    return CONTENT_TYPE_EXTENSION[contentType];
  }
  return extensionFromUrl(url) || "bin";
};

export const resolveVideoPreviewVariantCandidatePath = ({
  fileType,
  previewStoragePath,
  fullStoragePath,
}: {
  fileType: MediaLibraryFileType;
  previewStoragePath: string | null | undefined;
  fullStoragePath: string | null | undefined;
}): string | null => {
  if (fileType !== "video") return null;
  const canonicalPreviewPath = asCanonicalStoragePath(previewStoragePath ?? null);
  if (!canonicalPreviewPath) return null;
  const canonicalFullPath = asCanonicalStoragePath(fullStoragePath ?? null);
  if (canonicalFullPath && canonicalPreviewPath === canonicalFullPath) {
    return null;
  }
  return canonicalPreviewPath;
};

export const inferVideoPreviewVariantMimeType = (storagePath: string): string | null => {
  const extension = extensionFromUrl(storagePath);
  return VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION[extension] ?? null;
};

export const buildFilename = (
  promptText: string | null | undefined,
  extension: string,
  index: number
) => {
  const base = sanitizeFilename(clampPrompt(promptText));
  return `${base}-${index + 1}.${extension}`;
};

const isBrowserFetchBlockedError = (error: unknown): boolean => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (/fetch failed \(\d{3}\)/i.test(message)) return false;
  return (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("fetch failed") ||
    message.includes("cors") ||
    message.includes("cross-origin") ||
    message.includes("securityerror") ||
    message.includes("operation is insecure") ||
    message.includes("resource has been blocked")
  );
};

type ServerCopyDecisionInput = {
  generationId?: string | null;
  mode: StudioMode;
  source: "upload" | "ai_studio";
  url: string;
};

export const shouldUseServerCopyFallback = ({
  input,
  error,
}: {
  input: ServerCopyDecisionInput;
  error: unknown;
}): boolean => {
  if (!URL_PROTOCOL_PATTERN.test(input.url)) return false;
  if (isBrowserFetchBlockedError(error)) return true;
  return input.source === "ai_studio" && Boolean(input.generationId);
};

export const shouldPreferServerCopyForAiStudioVideo = (input: ServerCopyDecisionInput): boolean =>
  input.mode === "video" &&
  input.source === "ai_studio" &&
  Boolean(input.generationId) &&
  URL_PROTOCOL_PATTERN.test(input.url);

export const resolveUploadDestinationTabForFileType = (
  fileType: MediaLibraryFileType
): MediaUploadDestinationTab => (fileType === "video" ? "uploaded_videos" : "uploaded_images");
