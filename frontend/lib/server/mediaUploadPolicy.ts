/**
 * Pure upload policy helpers for server-authoritative Media Library uploads.
 */
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  type MediaLibraryFileType,
  MAX_VIDEO_MEDIA_BYTES,
  maxBytesForMediaFileType,
  resolveMediaFileTypeFromMimeType,
  resolveMediaStorageExtension,
} from "./mediaIngest";
import {
  areCompatibleMimeTypes,
  detectAudioMimeType,
  detectImageMimeType,
  detectVideoMimeType,
  normalizeSupportedMimeType,
} from "./uploadSignature";

export const PRIVATE_MEDIA_SOURCE = "private_upload";
export const MAX_UPLOAD_BYTES = MAX_VIDEO_MEDIA_BYTES;
export const MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES = 100 * 1024 * 1024;
export const MEDIA_DIRECT_UPLOAD_STAGING_ROOT = "upload-staging";
export const MOTION_REFERENCE_VIDEO_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/videos/motion-control`;
export const MOTION_REFERENCE_VIDEO_STORAGE_FOLDER = "videos/motion-control";
export const REFERENCE_VIDEO_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/videos/reference`;
export const REFERENCE_VIDEO_STORAGE_FOLDER = "videos/reference";
export const REFERENCE_IMAGE_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/images/reference`;
export const REFERENCE_IMAGE_STORAGE_FOLDER = "images/reference";

const VIDEO_DESTINATIONS = new Set<MediaUploadDestinationTab>(["uploaded_videos"]);

const ALLOWED_VOICE_CHANGER_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

const VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
};

const VOICE_CHANGER_AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};

export type VoiceChangerSourceKind = "audio" | "video";

export type MediaUploadDestinationTab = "uploaded_images" | "uploaded_videos" | "private";
export type MediaUploadServiceErrorDiagnostics = Record<string, unknown>;

/**
 * Typed service error returned by Media Library upload parsing/validation logic.
 */
export class MediaUploadServiceError extends Error {
  readonly status: number;
  readonly details?: string;
  readonly diagnostics?: MediaUploadServiceErrorDiagnostics;

  constructor(
    status: number,
    message: string,
    details?: string,
    diagnostics?: MediaUploadServiceErrorDiagnostics
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.diagnostics = diagnostics;
  }
}

export const normalizeContentType = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return normalizeSupportedMimeType(header?.split(";")[0] ?? "");
};

export const normalizeDeclaredMimeType = (value: string): string =>
  normalizeSupportedMimeType(value.split(";")[0] ?? "");

export const readHeaderString = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.trim() ?? "";
};

export const readFieldString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
};

const sanitizeFileName = (name: string): string =>
  name
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .replace(/_+/g, "_")
    .slice(0, 120);

export const resolveBaseFileName = (fileName: string): string => {
  const trimmed = fileName.trim();
  if (!trimmed) return "upload";
  const lastSegment = trimmed.split(/[\\/]/).pop() ?? "upload";
  const dotIndex = lastSegment.lastIndexOf(".");
  const baseName = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
  const normalized = sanitizeFileName(baseName);
  return normalized || "upload";
};

export const resolveDestinationTab = (value: string): MediaUploadDestinationTab | null => {
  if (value === "uploaded_images" || value === "uploaded_videos" || value === "private") {
    return value;
  }
  return null;
};

const destinationPrefersVideo = (destinationTab: MediaUploadDestinationTab): boolean =>
  VIDEO_DESTINATIONS.has(destinationTab);

const destinationAllowsAudio = (destinationTab: MediaUploadDestinationTab): boolean =>
  destinationTab !== "private";

export const resolveDetectedMimeType = (
  destinationTab: MediaUploadDestinationTab,
  buffer: Buffer
): string | null => {
  if (destinationPrefersVideo(destinationTab)) {
    return (
      detectVideoMimeType(buffer) ??
      (destinationAllowsAudio(destinationTab) ? detectAudioMimeType(buffer) : null)
    );
  }
  return (
    detectImageMimeType(buffer) ??
    (destinationAllowsAudio(destinationTab) ? detectAudioMimeType(buffer) : null)
  );
};

const isAllowedMimeType = (
  destinationTab: MediaUploadDestinationTab,
  mimeType: string
): boolean => {
  if (destinationPrefersVideo(destinationTab)) {
    return ALLOWED_VIDEO_MIME_TYPES.has(mimeType) || ALLOWED_AUDIO_MIME_TYPES.has(mimeType);
  }
  if (destinationTab === "private") {
    return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
  }
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType) || ALLOWED_AUDIO_MIME_TYPES.has(mimeType);
};

export const isGenericDeclaredMimeType = (mimeType: string): boolean =>
  mimeType === "application/octet-stream" || mimeType === "binary/octet-stream";

const isCompatibleDeclaredMimeType = ({
  destinationTab,
  declaredMimeType,
  detectedMimeType,
}: {
  destinationTab: MediaUploadDestinationTab;
  declaredMimeType: string;
  detectedMimeType: string;
}): boolean => {
  if (areCompatibleMimeTypes(declaredMimeType, detectedMimeType)) return true;
  if (
    destinationPrefersVideo(destinationTab) &&
    declaredMimeType.startsWith("video/") &&
    detectedMimeType.startsWith("video/")
  ) {
    const mp4AliasFamily = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
    if (mp4AliasFamily.has(declaredMimeType) && mp4AliasFamily.has(detectedMimeType)) return true;
  }
  if (
    destinationPrefersVideo(destinationTab) &&
    declaredMimeType === "video/webm" &&
    detectedMimeType === "audio/webm"
  ) {
    return true;
  }
  return false;
};

export const resolveUploadFolder = (
  destinationTab: MediaUploadDestinationTab,
  fileType: MediaLibraryFileType
): string => {
  if (destinationTab === "private") return "private/images";
  if (fileType === "video") return "videos";
  if (fileType === "audio") return "audio";
  return "images";
};

export const resolveUploadSource = (destinationTab: MediaUploadDestinationTab): string =>
  destinationTab === "private" ? PRIVATE_MEDIA_SOURCE : "upload";

export const resolveMediaDirectUploadStagingFolder = (
  destinationTab: MediaUploadDestinationTab
): string => `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/${destinationTab}`;

export const resolveVoiceChangerSourceStorageFolder = (kind: VoiceChangerSourceKind): string =>
  kind === "video" ? "voice-changer/source-video" : "voice-changer/source-audio";

export const resolveUploadedStorageExtension = (mimeType: string): string =>
  resolveMediaStorageExtension(
    mimeType,
    VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME[mimeType] ?? "bin"
  ) ?? "bin";

export const resolveExtensionFromFilename = (filename: string): string | null => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0) return null;
  const extension = filename
    .slice(dotIndex + 1)
    .trim()
    .toLowerCase();
  return extension || null;
};

export const resolvePreparedVoiceChangerStoredFileName = ({
  filename,
  mimeType,
  kind,
}: {
  filename: string;
  mimeType: string;
  kind: VoiceChangerSourceKind;
}): string => {
  const extension =
    resolveExtensionFromFilename(filename) ||
    resolveMediaStorageExtension(
      mimeType,
      kind === "video" ? "mp4" : (VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME[mimeType] ?? "wav")
    ) ||
    (kind === "video" ? "mp4" : "wav");
  const fileBaseName = resolveBaseFileName(filename);
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
};

export const resolvePreparedMediaUploadStoredFileName = ({
  filename,
  mimeType,
}: {
  filename: string;
  mimeType: string;
}): string => {
  const extension = resolveMediaStorageExtension(mimeType, "bin") || "bin";
  const fileBaseName = resolveBaseFileName(filename);
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
};

export const resolvePreparedVoiceChangerSourceMimeType = ({
  kind,
  declaredMimeType,
}: {
  kind: VoiceChangerSourceKind;
  declaredMimeType: string;
}): string => {
  const normalizedMimeType = normalizeSupportedMimeType(declaredMimeType);
  if (!normalizedMimeType) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Voice changer source mime type is required."
    );
  }
  if (kind === "video") {
    if (!ALLOWED_VIDEO_MIME_TYPES.has(normalizedMimeType)) {
      throw new MediaUploadServiceError(
        400,
        "Invalid request",
        "Voice changer source file is not a supported video format."
      );
    }
    return normalizedMimeType;
  }
  if (!ALLOWED_VOICE_CHANGER_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Voice changer source file is not a supported audio format."
    );
  }
  return normalizedMimeType;
};

export const resolvePreparedMediaUploadMimeType = ({
  destinationTab,
  declaredMimeType,
}: {
  destinationTab: MediaUploadDestinationTab;
  declaredMimeType: string;
}): string => {
  const normalizedMimeType = normalizeDeclaredMimeType(declaredMimeType);
  if (!normalizedMimeType) {
    throw new MediaUploadServiceError(400, "Invalid request", "Upload file mime type is required.");
  }
  if (!isAllowedMimeType(destinationTab, normalizedMimeType)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Upload file is not a supported format for the requested destination."
    );
  }
  return normalizedMimeType;
};

export const validateUpload = ({
  destinationTab,
  declaredMimeType,
  detectedMimeType,
}: {
  destinationTab: MediaUploadDestinationTab;
  declaredMimeType: string;
  detectedMimeType: string | null;
}): { mimeType: string; fileType: MediaLibraryFileType } => {
  if (!detectedMimeType || !isAllowedMimeType(destinationTab, detectedMimeType)) {
    const expected = destinationPrefersVideo(destinationTab)
      ? "video"
      : destinationTab === "private"
        ? "image"
        : "image or audio";
    throw new MediaUploadServiceError(
      400,
      "Invalid file type",
      `File content is not a supported ${expected} format (detected: ${detectedMimeType ?? "unknown"}).`
    );
  }

  if (declaredMimeType && !isGenericDeclaredMimeType(declaredMimeType)) {
    if (!isAllowedMimeType(destinationTab, declaredMimeType)) {
      throw new MediaUploadServiceError(
        400,
        "Invalid file type",
        `Content type does not match file content (declared: ${declaredMimeType}, detected: ${detectedMimeType}).`
      );
    }
    if (
      !isCompatibleDeclaredMimeType({
        destinationTab,
        declaredMimeType,
        detectedMimeType,
      })
    ) {
      throw new MediaUploadServiceError(
        400,
        "Invalid file type",
        `Content type does not match file content (declared: ${declaredMimeType}, detected: ${detectedMimeType}).`
      );
    }
  }

  const fileType = resolveMediaFileTypeFromMimeType(detectedMimeType);
  if (!fileType) {
    throw new MediaUploadServiceError(400, "Invalid file type", "Unsupported uploaded file type.");
  }

  return {
    mimeType: detectedMimeType,
    fileType,
  };
};

export const enforceUploadSizeLimit = ({
  fileType,
  fileSize,
}: {
  fileType: MediaLibraryFileType;
  fileSize: number;
}): void => {
  if (fileSize > maxBytesForMediaFileType(fileType)) {
    throw new MediaUploadServiceError(413, "Upload failed: file too large");
  }
};

export const resolveVoiceAudioSourceMimeType = ({
  declaredMimeType,
  filename,
  buffer,
  errorDetails,
}: {
  declaredMimeType: string;
  filename: string;
  buffer: Buffer;
  errorDetails: string;
}): string => {
  const detectedMimeType = detectAudioMimeType(buffer);
  if (!detectedMimeType || !ALLOWED_VOICE_CHANGER_AUDIO_MIME_TYPES.has(detectedMimeType)) {
    throw new MediaUploadServiceError(400, "Invalid file type", errorDetails);
  }

  const filenameExtension = resolveExtensionFromFilename(filename);
  const filenameMimeType = filenameExtension
    ? (VOICE_CHANGER_AUDIO_MIME_BY_EXTENSION[filenameExtension] ?? null)
    : null;
  if (
    filenameMimeType &&
    filenameMimeType !== detectedMimeType &&
    !areCompatibleMimeTypes(filenameMimeType, detectedMimeType)
  ) {
    throw new MediaUploadServiceError(400, "Invalid file type", errorDetails);
  }
  if (
    declaredMimeType &&
    !isGenericDeclaredMimeType(declaredMimeType) &&
    !areCompatibleMimeTypes(declaredMimeType, detectedMimeType)
  ) {
    throw new MediaUploadServiceError(400, "Invalid file type", errorDetails);
  }

  return detectedMimeType;
};

export const resolveVoiceChangerSourceMimeType = ({
  kind,
  declaredMimeType,
  filename,
  buffer,
}: {
  kind: VoiceChangerSourceKind;
  declaredMimeType: string;
  filename: string;
  buffer: Buffer;
}): string => {
  const filenameExtension = resolveExtensionFromFilename(filename);
  if (kind === "video") {
    const detectedMimeType = detectVideoMimeType(buffer);
    const candidateMimeType =
      detectedMimeType && ALLOWED_VIDEO_MIME_TYPES.has(detectedMimeType)
        ? detectedMimeType
        : declaredMimeType && ALLOWED_VIDEO_MIME_TYPES.has(declaredMimeType)
          ? declaredMimeType
          : filenameExtension && VIDEO_MIME_BY_EXTENSION[filenameExtension]
            ? VIDEO_MIME_BY_EXTENSION[filenameExtension]
            : null;
    if (!candidateMimeType || !ALLOWED_VIDEO_MIME_TYPES.has(candidateMimeType)) {
      throw new MediaUploadServiceError(
        400,
        "Invalid file type",
        "Voice changer source file is not a supported video format."
      );
    }
    return candidateMimeType;
  }

  return resolveVoiceAudioSourceMimeType({
    declaredMimeType,
    filename,
    buffer,
    errorDetails: "Voice changer source file is not a supported audio format.",
  });
};

export const resolveFinalizedVoiceChangerSourceMimeType = ({
  kind,
  declaredMimeType,
  filename,
  buffer,
}: {
  kind: VoiceChangerSourceKind;
  declaredMimeType: string;
  filename: string;
  buffer: Buffer;
}): string => {
  if (kind !== "video") {
    return resolveVoiceChangerSourceMimeType({
      kind,
      declaredMimeType,
      filename,
      buffer,
    });
  }

  const detectedVideoMimeType = detectVideoMimeType(buffer);
  if (detectedVideoMimeType && ALLOWED_VIDEO_MIME_TYPES.has(detectedVideoMimeType)) {
    return detectedVideoMimeType;
  }
  const detectedAudioMimeType = detectAudioMimeType(buffer);
  if (
    detectedAudioMimeType === "audio/webm" &&
    (declaredMimeType === "video/webm" || resolveExtensionFromFilename(filename) === "webm")
  ) {
    return detectedAudioMimeType;
  }
  return resolveVoiceChangerSourceMimeType({
    kind,
    declaredMimeType,
    filename,
    buffer,
  });
};
