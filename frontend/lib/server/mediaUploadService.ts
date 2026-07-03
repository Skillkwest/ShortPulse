/**
 * Server-authoritative Media Library upload service.
 * Validates destination/mime/signature, writes scoped storage objects, and persists media rows.
 */
import type { NextApiRequest } from "next";
import formidable from "formidable";
import fs from "fs";
import {
  MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
  isMediaStorageQuotaExceededError,
} from "../mediaStorageQuota";
import { admitImageBufferForProductUse, type ImageAdmissionMetadata } from "./imageAdmission";
import { resolveMediaPreviewStoragePath } from "../../features/media-library/logic/mediaPreviewStoragePath";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  areCompatibleMimeTypes,
  detectAudioMimeType,
  detectImageMimeType,
  detectVideoMimeType,
  normalizeSupportedMimeType,
} from "./uploadSignature";
import {
  upsertVideoPosterVariantFromBuffer,
  upsertVideoPreviewVariantFromBuffer,
} from "./videoPosterVariant";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  buildScopedMediaStoragePath,
  createSignedMediaUrl,
  DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
  type InsertedMediaRow,
  insertMediaFileRow,
  MEDIA_BUCKET,
  type MediaLibraryFileType,
  MAX_IMAGE_MEDIA_BYTES,
  maxBytesForMediaFileType,
  MAX_VIDEO_MEDIA_BYTES,
  removeScopedMediaStorageObject,
  resolveMediaFileTypeFromMimeType,
  resolveMediaStorageExtension,
  uploadMediaBufferToStoragePath,
} from "./mediaIngest";
import {
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  MediaAudioExtractionInputError,
  readStoredMediaBuffer,
} from "./mediaAudioExtraction";
import {
  getMediaComplianceAcceptanceStatusForUser,
  isMediaComplianceUnavailableError,
} from "./api/mediaComplianceAcceptance";
import {
  MotionReferenceVideoNormalizationError,
  normalizeMotionReferenceVideoForProvider,
} from "./motionReferenceVideoNormalization";
import {
  normalizeVoiceChangerSourceVideoForProcessing,
  VoiceChangerSourceVideoNormalizationError,
} from "./voiceChangerSourceVideoNormalization";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";

const PRIVATE_MEDIA_SOURCE = "private_upload";
const MAX_UPLOAD_BYTES = MAX_VIDEO_MEDIA_BYTES;
const MAX_VOICE_CHANGER_VIDEO_PROCESSING_BYTES = MAX_VOICE_CHANGER_SOURCE_BYTES;
const MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES = 100 * 1024 * 1024;
const MEDIA_DIRECT_UPLOAD_STAGING_ROOT = "upload-staging";
const MOTION_REFERENCE_VIDEO_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/videos/motion-control`;
const MOTION_REFERENCE_VIDEO_STORAGE_FOLDER = "videos/motion-control";
const REFERENCE_VIDEO_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/videos/reference`;
const REFERENCE_VIDEO_STORAGE_FOLDER = "videos/reference";

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

type VoiceChangerSourceKind = "audio" | "video";

export type MediaUploadDestinationTab = "uploaded_images" | "uploaded_videos" | "private";

export type MediaUploadResponseFile = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path: string;
  file_type: string;
  file_size: number | null;
  source: string | null;
  created_at: string;
  signedUrl: string;
};

export type SignedStorageUploadResponse = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
};

type ParsedUpload = {
  buffer: Buffer;
  declaredMimeType: string;
  size: number;
  filename: string;
  destinationTab: MediaUploadDestinationTab;
  tempFilePath?: string;
};

type ParseUploadOptions = {
  defaultDestinationTab?: MediaUploadDestinationTab;
};

const normalizeContentType = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return normalizeSupportedMimeType(header?.split(";")[0] ?? "");
};

const normalizeDeclaredMimeType = (value: string): string =>
  normalizeSupportedMimeType(value.split(";")[0] ?? "");

const readHeaderString = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.trim() ?? "";
};

const readFieldString = (value: string | string[] | undefined): string => {
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

const resolveBaseFileName = (fileName: string): string => {
  const trimmed = fileName.trim();
  if (!trimmed) return "upload";
  const lastSegment = trimmed.split(/[\\/]/).pop() ?? "upload";
  const dotIndex = lastSegment.lastIndexOf(".");
  const baseName = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
  const normalized = sanitizeFileName(baseName);
  return normalized || "upload";
};

const resolveDestinationTab = (value: string): MediaUploadDestinationTab | null => {
  if (value === "uploaded_images" || value === "uploaded_videos" || value === "private") {
    return value;
  }
  return null;
};

const parseMultipart = async (
  req: NextApiRequest,
  options?: ParseUploadOptions
): Promise<ParsedUpload> => {
  const form = formidable({
    maxFileSize: MAX_UPLOAD_BYTES,
    keepExtensions: true,
  });

  const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
    (resolve, reject) => {
      form.parse(req, (err, parsedFields, parsedFiles) => {
        if (err) {
          reject(err);
          return;
        }
        resolve([parsedFields, parsedFiles]);
      });
    }
  );

  const destinationTabRaw =
    readFieldString(fields.destinationTab as string | string[] | undefined) ||
    readFieldString(fields.destination_tab as string | string[] | undefined);
  const destinationTab = resolveDestinationTab(
    destinationTabRaw || options?.defaultDestinationTab || ""
  );
  if (!destinationTab) {
    throw new MediaUploadServiceError(
      400,
      "Invalid upload destination",
      "Unsupported destination tab"
    );
  }

  const fileInput = files.file;
  if (!fileInput) {
    throw new MediaUploadServiceError(400, "Upload failed", "No file uploaded");
  }
  const parsedFile = Array.isArray(fileInput) ? fileInput[0] : fileInput;
  const fileBuffer = fs.readFileSync(parsedFile.filepath);

  return {
    buffer: fileBuffer,
    declaredMimeType: normalizeContentType(parsedFile.mimetype ?? ""),
    size: parsedFile.size ?? fileBuffer.length,
    filename: parsedFile.originalFilename?.trim() || "upload",
    destinationTab,
    tempFilePath: parsedFile.filepath,
  };
};

const readRawBody = async (
  req: NextApiRequest,
  options?: {
    maxBytes?: number;
    tooLargeError?: MediaUploadServiceError;
  }
): Promise<Buffer> =>
  await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
    const tooLargeError =
      options?.tooLargeError ?? new MediaUploadServiceError(413, "Upload failed: file too large");

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      callback();
    };

    const onData = (chunk: Buffer | string) => {
      const chunkBuffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += chunkBuffer.length;
      if (totalBytes > maxBytes) {
        settle(() => reject(tooLargeError));
        req.destroy();
        return;
      }
      chunks.push(chunkBuffer);
    };

    const onEnd = () => {
      settle(() => resolve(Buffer.concat(chunks)));
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onAborted = () => {
      settle(() => reject(new MediaUploadServiceError(400, "Upload failed", "Upload was aborted")));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });

const parseRaw = async (
  req: NextApiRequest,
  options?: ParseUploadOptions
): Promise<ParsedUpload> => {
  const destinationTabRaw = readHeaderString(
    req.headers["x-shortpulse-upload-destination-tab"] as string | string[] | undefined
  );
  const destinationTab = resolveDestinationTab(
    destinationTabRaw || options?.defaultDestinationTab || ""
  );
  if (!destinationTab) {
    throw new MediaUploadServiceError(
      400,
      "Invalid upload destination",
      "Unsupported destination tab"
    );
  }

  const buffer = await readRawBody(req);
  if (!buffer.length) {
    throw new MediaUploadServiceError(400, "Upload failed", "No file uploaded");
  }

  return {
    buffer,
    declaredMimeType: normalizeContentType(req.headers["content-type"]),
    size: buffer.length,
    filename:
      readHeaderString(
        req.headers["x-shortpulse-upload-filename"] as string | string[] | undefined
      ) || "upload",
    destinationTab,
  };
};

const parseUpload = async (
  req: NextApiRequest,
  options?: ParseUploadOptions
): Promise<ParsedUpload> => {
  const contentType = normalizeContentType(req.headers["content-type"]);
  if (contentType.includes("multipart/form-data")) {
    return await parseMultipart(req, options);
  }
  if (!contentType) {
    throw new MediaUploadServiceError(400, "Upload failed", "Missing content type");
  }
  return await parseRaw(req, options);
};

const destinationPrefersVideo = (destinationTab: MediaUploadDestinationTab): boolean =>
  VIDEO_DESTINATIONS.has(destinationTab);

const destinationAllowsAudio = (destinationTab: MediaUploadDestinationTab): boolean =>
  destinationTab !== "private";

const resolveDetectedMimeType = (
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

const isGenericDeclaredMimeType = (mimeType: string): boolean => {
  return mimeType === "application/octet-stream" || mimeType === "binary/octet-stream";
};

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
    // Browser/file-input MIME metadata can vary between MP4 container aliases.
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

const resolveUploadFolder = (
  destinationTab: MediaUploadDestinationTab,
  fileType: MediaLibraryFileType
): string => {
  if (destinationTab === "private") return "private/images";
  if (fileType === "video") return "videos";
  if (fileType === "audio") return "audio";
  return "images";
};

const resolveUploadSource = (destinationTab: MediaUploadDestinationTab): string =>
  destinationTab === "private" ? PRIVATE_MEDIA_SOURCE : "upload";

const resolveMediaDirectUploadStagingFolder = (destinationTab: MediaUploadDestinationTab): string =>
  `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/${destinationTab}`;

const REFERENCE_IMAGE_STAGING_FOLDER = `${MEDIA_DIRECT_UPLOAD_STAGING_ROOT}/images/reference`;
const REFERENCE_IMAGE_STORAGE_FOLDER = "images/reference";

const resolveVoiceChangerSourceStorageFolder = (kind: VoiceChangerSourceKind): string =>
  kind === "video" ? "voice-changer/source-video" : "voice-changer/source-audio";

const resolvePreparedVoiceChangerSourceMimeType = ({
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

const resolvePreparedMediaUploadMimeType = ({
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

const createSignedUploadTarget = async ({
  storagePath,
}: {
  storagePath: string;
}): Promise<{ path: string; token: string }> => {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.path || !data.token) {
    throw new Error(error?.message || "Unable to create signed upload target.");
  }
  if (data.path !== storagePath) {
    throw new Error("Signed upload target path did not match requested storage path.");
  }
  return {
    path: data.path,
    token: data.token,
  };
};

const validateUpload = ({
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

const enforceUploadSizeLimit = ({
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

/**
 * Typed service error returned by Media Library upload parsing/validation logic.
 */
export class MediaUploadServiceError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const assertMediaComplianceAcceptedForUpload = async (userId: string): Promise<void> => {
  try {
    const status = await getMediaComplianceAcceptanceStatusForUser(userId);
    if (status.accepted) return;
    throw new MediaUploadServiceError(
      403,
      "Media agreement acceptance is required.",
      "Accept the current media agreement before uploading or staging media."
    );
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      throw error;
    }
    if (isMediaComplianceUnavailableError(error)) {
      throw new MediaUploadServiceError(
        503,
        "Media agreement service is temporarily unavailable.",
        "Media agreement acceptance could not be verified."
      );
    }
    throw error;
  }
};

type UploadedStorageAsset = {
  storagePath: string;
  signedUrl: string;
  size: number;
  parsedUpload: ParsedUpload;
  fileType: MediaLibraryFileType;
  imageDimensions: { width: number; height: number } | null;
  admissionMetadata: ImageAdmissionMetadata | null;
};

type StorageUploadOptions = {
  req: NextApiRequest;
  userId: string;
  defaultDestinationTab?: MediaUploadDestinationTab;
  storageFolderOverride?: string;
  normalizeMotionReferenceVideo?: boolean;
};

type SignedStorageAssetResult = {
  storagePath: string;
  signedUrl: string;
  size: number;
};

const resolveExtensionFromFilename = (filename: string): string | null => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0) return null;
  const extension = filename
    .slice(dotIndex + 1)
    .trim()
    .toLowerCase();
  return extension || null;
};

const resolvePreparedVoiceChangerStoredFileName = ({
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

const resolvePreparedMediaUploadStoredFileName = ({
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

const uploadScopedStorageBuffer = async ({
  userId,
  storageFolder,
  filename,
  mimeType,
  buffer,
  cacheControl,
}: {
  userId: string;
  storageFolder: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  cacheControl?: string;
}): Promise<SignedStorageAssetResult> => {
  const extension =
    resolveMediaStorageExtension(
      mimeType,
      VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME[mimeType] ?? "bin"
    ) ?? "bin";
  const fileBaseName = resolveBaseFileName(filename);
  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder,
    storedFileName,
    label: "Media upload storage path",
  });

  try {
    await uploadMediaBufferToStoragePath({
      storagePath,
      buffer,
      mimeType,
      cacheControl,
    });
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Upload failed",
      error instanceof Error ? error.message : "Unknown upload error"
    );
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedMediaUrl(storagePath);
  } catch (error) {
    await removeScopedMediaStorageObject(storagePath);
    throw new MediaUploadServiceError(
      500,
      "Failed to generate signed preview URL",
      error instanceof Error ? error.message : "Missing signed preview URL"
    );
  }

  return {
    storagePath,
    signedUrl,
    size: buffer.length,
  };
};

const movePreparedUploadToDurableStorage = async ({
  userId,
  sourceStoragePath,
  parsedUpload,
  mimeType,
  fileType,
}: {
  userId: string;
  sourceStoragePath: string;
  parsedUpload: ParsedUpload;
  mimeType: string;
  fileType: Exclude<MediaLibraryFileType, "image">;
}): Promise<UploadedStorageAsset> => {
  const extension =
    resolveMediaStorageExtension(
      mimeType,
      VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME[mimeType] ?? "bin"
    ) ?? "bin";
  const fileBaseName = resolveBaseFileName(parsedUpload.filename);
  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: resolveUploadFolder(parsedUpload.destinationTab, fileType),
    storedFileName,
    label: "Durable prepared media upload storage path",
  });

  const { error: moveError } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .move(sourceStoragePath, storagePath);
  if (moveError) {
    throw new MediaUploadServiceError(
      500,
      "Upload failed",
      moveError.message || "Unable to move prepared upload into durable storage."
    );
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedMediaUrl(storagePath);
  } catch (error) {
    await removeScopedMediaStorageObject(storagePath);
    throw new MediaUploadServiceError(
      500,
      "Failed to generate signed preview URL",
      error instanceof Error ? error.message : "Missing signed preview URL"
    );
  }

  return {
    storagePath,
    signedUrl,
    size: parsedUpload.size,
    parsedUpload: {
      ...parsedUpload,
      declaredMimeType: mimeType,
    },
    fileType,
    imageDimensions: null,
    admissionMetadata: null,
  };
};

const resolveVoiceAudioSourceMimeType = ({
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

const resolveVoiceChangerSourceMimeType = ({
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

const uploadStorageAssetForUser = async ({
  req,
  userId,
  defaultDestinationTab,
  storageFolderOverride,
  normalizeMotionReferenceVideo = false,
  cacheControl,
}: StorageUploadOptions & { cacheControl?: string }): Promise<UploadedStorageAsset> => {
  const parsedUpload = await parseUpload(req, { defaultDestinationTab });
  return await uploadStorageAssetFromParsedUpload({
    parsedUpload,
    userId,
    storageFolderOverride,
    normalizeMotionReferenceVideo,
    cacheControl,
  });
};

const uploadStorageAssetFromParsedUpload = async ({
  parsedUpload,
  userId,
  storageFolderOverride,
  normalizeMotionReferenceVideo = false,
  cacheControl,
}: {
  parsedUpload: ParsedUpload;
  userId: string;
  storageFolderOverride?: string;
  normalizeMotionReferenceVideo?: boolean;
  cacheControl?: string;
}): Promise<UploadedStorageAsset> => {
  const detectedMimeType = resolveDetectedMimeType(
    parsedUpload.destinationTab,
    parsedUpload.buffer
  );
  const validatedUpload = validateUpload({
    destinationTab: parsedUpload.destinationTab,
    declaredMimeType: parsedUpload.declaredMimeType,
    detectedMimeType,
  });
  let uploadBuffer = parsedUpload.buffer;
  let uploadMimeType = validatedUpload.mimeType;
  let uploadSize = parsedUpload.size;
  let uploadFilename = parsedUpload.filename;
  let imageDimensions =
    validatedUpload.fileType === "image"
      ? extractImageDimensionsFromBuffer(parsedUpload.buffer)
      : null;
  let admissionMetadata: ImageAdmissionMetadata | null = null;

  if (validatedUpload.fileType === "image") {
    const admittedImage = await admitImageBufferForProductUse({
      buffer: parsedUpload.buffer,
      mimeType: validatedUpload.mimeType,
      maxBytes: MAX_IMAGE_MEDIA_BYTES,
    });
    admissionMetadata = admittedImage.metadata;
    if (admittedImage.status === "rejected") {
      throw new MediaUploadServiceError(
        413,
        "Upload failed: file too large",
        admittedImage.reason === "animated_over_cap" ? admittedImage.userMessage : undefined
      );
    }
    uploadBuffer = admittedImage.buffer;
    uploadMimeType = admittedImage.mimeType;
    uploadSize = admittedImage.buffer.length;
    if (admittedImage.status === "admitted") {
      imageDimensions =
        admittedImage.dimensions ?? extractImageDimensionsFromBuffer(admittedImage.buffer);
    }
  }

  if (normalizeMotionReferenceVideo) {
    if (validatedUpload.fileType !== "video") {
      throw new MediaUploadServiceError(
        400,
        "Invalid file type",
        "Motion reference source must be a playable video between 3 and 30 seconds."
      );
    }
    try {
      const normalizedVideo = await normalizeMotionReferenceVideoForProvider({
        buffer: uploadBuffer,
        filename: uploadFilename,
        mimeType: uploadMimeType,
      });
      uploadBuffer = normalizedVideo.buffer;
      uploadMimeType = normalizedVideo.mimeType;
      uploadFilename = normalizedVideo.filename;
      uploadSize = normalizedVideo.buffer.length;
    } catch (error) {
      if (error instanceof MotionReferenceVideoNormalizationError) {
        throw new MediaUploadServiceError(error.status, error.message, error.details);
      }
      throw error;
    }
  }

  enforceUploadSizeLimit({
    fileType: validatedUpload.fileType,
    fileSize: uploadSize,
  });

  const normalizedUpload: ParsedUpload =
    uploadBuffer === parsedUpload.buffer &&
    uploadMimeType === parsedUpload.declaredMimeType &&
    uploadSize === parsedUpload.size &&
    uploadFilename === parsedUpload.filename
      ? parsedUpload
      : {
          ...parsedUpload,
          buffer: uploadBuffer,
          declaredMimeType: uploadMimeType,
          size: uploadSize,
          filename: uploadFilename,
        };

  const storageFolder =
    storageFolderOverride ??
    resolveUploadFolder(parsedUpload.destinationTab, validatedUpload.fileType);
  const uploaded = await uploadScopedStorageBuffer({
    userId,
    storageFolder,
    filename: normalizedUpload.filename,
    mimeType: uploadMimeType,
    buffer: uploadBuffer,
    cacheControl,
  });
  const storedAdmissionMetadata = admissionMetadata
    ? {
        ...admissionMetadata,
        admitted_storage_path: uploaded.storagePath,
      }
    : null;

  return {
    storagePath: uploaded.storagePath,
    signedUrl: uploaded.signedUrl,
    size: uploaded.size,
    parsedUpload: normalizedUpload,
    fileType: validatedUpload.fileType,
    imageDimensions,
    admissionMetadata: storedAdmissionMetadata,
  };
};

export const prepareVoiceChangerSourceUploadForUser = async ({
  userId,
  kind,
  filename,
  declaredMimeType,
}: {
  userId: string;
  kind: VoiceChangerSourceKind;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  path: string;
  token: string;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const normalizedFilename =
    filename.trim() || `voice-changer-source.${kind === "video" ? "mp4" : "wav"}`;
  const normalizedMimeType = resolvePreparedVoiceChangerSourceMimeType({
    kind,
    declaredMimeType,
  });
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: resolveVoiceChangerSourceStorageFolder(kind),
    storedFileName: resolvePreparedVoiceChangerStoredFileName({
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
      kind,
    }),
    label: "Prepared voice changer source storage path",
  });

  try {
    const target = await createSignedUploadTarget({ storagePath });
    return {
      path: target.path,
      token: target.token,
      mimeType: normalizedMimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Unable to prepare voice changer upload",
      error instanceof Error ? error.message : "Unable to prepare voice changer upload."
    );
  }
};

export const prepareMediaUploadForUser = async ({
  userId,
  destinationTab,
  filename,
  declaredMimeType,
}: {
  userId: string;
  destinationTab: MediaUploadDestinationTab;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  path: string;
  token: string;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const normalizedFilename = filename.trim() || "upload";
  const normalizedMimeType = resolvePreparedMediaUploadMimeType({
    destinationTab,
    declaredMimeType,
  });
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: resolveMediaDirectUploadStagingFolder(destinationTab),
    storedFileName: resolvePreparedMediaUploadStoredFileName({
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
    }),
    label: "Prepared media upload storage path",
  });

  try {
    const target = await createSignedUploadTarget({ storagePath });
    return {
      path: target.path,
      token: target.token,
      mimeType: normalizedMimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Unable to prepare media upload",
      error instanceof Error ? error.message : "Unable to prepare media upload."
    );
  }
};

export const prepareReferenceImageUploadForUser = async ({
  userId,
  filename,
  declaredMimeType,
}: {
  userId: string;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  path: string;
  token: string;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const normalizedFilename = filename.trim() || "reference-image";
  const normalizedMimeType = resolvePreparedMediaUploadMimeType({
    destinationTab: "private",
    declaredMimeType,
  });
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: REFERENCE_IMAGE_STAGING_FOLDER,
    storedFileName: resolvePreparedMediaUploadStoredFileName({
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
    }),
    label: "Prepared reference image storage path",
  });

  try {
    const target = await createSignedUploadTarget({ storagePath });
    return {
      path: target.path,
      token: target.token,
      mimeType: normalizedMimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Unable to prepare reference image upload",
      error instanceof Error ? error.message : "Unable to prepare reference image upload."
    );
  }
};

export const prepareReferenceVideoUploadForUser = async ({
  userId,
  filename,
  declaredMimeType,
}: {
  userId: string;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  path: string;
  token: string;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const normalizedFilename = filename.trim() || "reference-video";
  const normalizedMimeType = resolvePreparedMediaUploadMimeType({
    destinationTab: "uploaded_videos",
    declaredMimeType,
  });
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: REFERENCE_VIDEO_STAGING_FOLDER,
    storedFileName: resolvePreparedMediaUploadStoredFileName({
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
    }),
    label: "Prepared reference video storage path",
  });

  try {
    const target = await createSignedUploadTarget({ storagePath });
    return {
      path: target.path,
      token: target.token,
      mimeType: normalizedMimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Unable to prepare reference video upload",
      error instanceof Error ? error.message : "Unable to prepare reference video upload."
    );
  }
};

export const prepareMotionReferenceVideoUploadForUser = async ({
  userId,
  filename,
  declaredMimeType,
}: {
  userId: string;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  path: string;
  token: string;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const normalizedFilename = filename.trim() || "motion-reference";
  const normalizedMimeType = resolvePreparedMediaUploadMimeType({
    destinationTab: "uploaded_videos",
    declaredMimeType,
  });
  const storagePath = buildScopedMediaStoragePath({
    userId,
    storageFolder: MOTION_REFERENCE_VIDEO_STAGING_FOLDER,
    storedFileName: resolvePreparedMediaUploadStoredFileName({
      filename: normalizedFilename,
      mimeType: normalizedMimeType,
    }),
    label: "Prepared motion reference video storage path",
  });

  try {
    const target = await createSignedUploadTarget({ storagePath });
    return {
      path: target.path,
      token: target.token,
      mimeType: normalizedMimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Unable to prepare motion reference video upload",
      error instanceof Error ? error.message : "Unable to prepare motion reference video upload."
    );
  }
};

export const finalizeVoiceChangerSourceUploadForUser = async ({
  userId,
  kind,
  storagePath,
  filename,
  declaredMimeType,
}: {
  userId: string;
  kind: VoiceChangerSourceKind;
  storagePath: string;
  filename: string;
  declaredMimeType: string;
}): Promise<{
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Voice changer source storage path",
  });
  const expectedFolderPrefix = `${userId}/${resolveVoiceChangerSourceStorageFolder(kind)}/`;
  if (!safeStoragePath.startsWith(expectedFolderPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Voice changer source storage path is outside the expected namespace."
    );
  }

  const normalizedFilename =
    filename.trim() ||
    safeStoragePath.split("/").filter(Boolean).pop() ||
    `voice-changer-source.${kind === "video" ? "mp4" : "wav"}`;
  const normalizedMimeType = declaredMimeType.trim();
  const maxBytes = kind === "video" ? MAX_UPLOAD_BYTES : MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES;

  try {
    const stored = await readStoredMediaBuffer({
      storagePath: safeStoragePath,
      maxBytes,
    });
    const mimeType =
      kind === "video"
        ? (() => {
            const detectedVideoMimeType = detectVideoMimeType(stored.buffer);
            if (detectedVideoMimeType && ALLOWED_VIDEO_MIME_TYPES.has(detectedVideoMimeType)) {
              return detectedVideoMimeType;
            }
            const detectedAudioMimeType = detectAudioMimeType(stored.buffer);
            if (
              detectedAudioMimeType === "audio/webm" &&
              (normalizedMimeType === "video/webm" ||
                resolveExtensionFromFilename(normalizedFilename) === "webm")
            ) {
              return detectedAudioMimeType;
            }
            return resolveVoiceChangerSourceMimeType({
              kind,
              declaredMimeType: normalizedMimeType,
              filename: normalizedFilename,
              buffer: stored.buffer,
            });
          })()
        : resolveVoiceChangerSourceMimeType({
            kind,
            declaredMimeType: normalizedMimeType,
            filename: normalizedFilename,
            buffer: stored.buffer,
          });

    if (kind === "video" && stored.size > MAX_VOICE_CHANGER_VIDEO_PROCESSING_BYTES) {
      const normalizedVideo = await normalizeVoiceChangerSourceVideoForProcessing({
        buffer: stored.buffer,
        filename: normalizedFilename,
        mimeType,
        maxBytes: MAX_VOICE_CHANGER_VIDEO_PROCESSING_BYTES,
      });
      const uploaded = await uploadScopedStorageBuffer({
        userId,
        storageFolder: resolveVoiceChangerSourceStorageFolder("video"),
        filename: normalizedVideo.filename,
        mimeType: normalizedVideo.mimeType,
        buffer: normalizedVideo.buffer,
      });
      await removeScopedMediaStorageObject(safeStoragePath);
      return {
        url: uploaded.signedUrl,
        path: uploaded.storagePath,
        size: uploaded.size,
        mimeType: normalizedVideo.mimeType,
        name: normalizedVideo.filename,
      };
    }

    const signedUrl = await createSignedMediaUrl(safeStoragePath);
    return {
      url: signedUrl,
      path: safeStoragePath,
      size: stored.size,
      mimeType,
      name: normalizedFilename,
    };
  } catch (error) {
    await removeScopedMediaStorageObject(safeStoragePath);
    if (error instanceof MediaUploadServiceError) {
      throw error;
    }
    if (error instanceof MediaAudioExtractionInputError) {
      throw new MediaUploadServiceError(error.statusCode, "Invalid request", error.message);
    }
    if (error instanceof VoiceChangerSourceVideoNormalizationError) {
      throw new MediaUploadServiceError(error.status, error.message, error.details);
    }
    throw new MediaUploadServiceError(
      500,
      "Unable to stage voice changer source",
      error instanceof Error ? error.message : "Unable to stage voice changer source."
    );
  }
};

export const uploadVoiceCloneSourceForUser = async ({
  req,
  userId,
}: {
  req: NextApiRequest;
  userId: string;
}): Promise<{
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const filename =
    readHeaderString(req.headers["x-shortpulse-upload-filename"]) || "voice-clone-source.wav";
  const buffer = await readRawBody(req, {
    maxBytes: MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES,
    tooLargeError: new MediaUploadServiceError(
      413,
      "Invalid request",
      "Voice clone source audio must be 100 MB or smaller."
    ),
  });
  if (!buffer.length) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Voice clone source upload is empty."
    );
  }

  const declaredMimeType = normalizeContentType(req.headers["content-type"]);
  const mimeType = resolveVoiceAudioSourceMimeType({
    declaredMimeType,
    filename,
    buffer,
    errorDetails: "Voice clone source file is not a supported audio format.",
  });
  const uploaded = await uploadScopedStorageBuffer({
    userId,
    storageFolder: "voice-clone/source-audio",
    filename,
    mimeType,
    buffer,
  });

  return {
    url: uploaded.signedUrl,
    path: uploaded.storagePath,
    size: uploaded.size,
    mimeType,
    name: filename,
  };
};

export const uploadSignedStorageAssetForUser = async ({
  req,
  userId,
  defaultDestinationTab,
  storageFolderOverride,
  normalizeMotionReferenceVideo = false,
}: {
  req: NextApiRequest;
  userId: string;
  defaultDestinationTab: MediaUploadDestinationTab;
  storageFolderOverride: string;
  normalizeMotionReferenceVideo?: boolean;
}): Promise<{
  url: string;
  path: string;
  size: number;
  mimeType: string;
}> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  let uploaded: UploadedStorageAsset | null = null;
  try {
    uploaded = await uploadStorageAssetForUser({
      req,
      userId,
      defaultDestinationTab,
      storageFolderOverride,
      normalizeMotionReferenceVideo,
    });

    return {
      url: uploaded.signedUrl,
      path: uploaded.storagePath,
      size: uploaded.size,
      mimeType: uploaded.parsedUpload.declaredMimeType,
    };
  } finally {
    if (uploaded?.parsedUpload.tempFilePath) {
      try {
        fs.unlinkSync(uploaded.parsedUpload.tempFilePath);
      } catch {
        // best-effort temp file cleanup
      }
    }
  }
};

const persistUploadedMediaAsset = async ({
  userId,
  uploaded,
}: {
  userId: string;
  uploaded: UploadedStorageAsset;
}): Promise<MediaUploadResponseFile> => {
  const metadata = withCanonicalImageDimensions(
    uploaded.admissionMetadata ? { image_admission: uploaded.admissionMetadata } : null,
    uploaded.fileType === "image" ? uploaded.imageDimensions : null
  );
  const normalizedRow = await insertUploadedMediaRow({
    userId,
    parsedUpload: uploaded.parsedUpload,
    storagePath: uploaded.storagePath,
    fileType: uploaded.fileType,
    metadata,
  });
  const hydratedRow = await hydrateUploadedVideoVariants({
    userId,
    parsedUpload: uploaded.parsedUpload,
    row: normalizedRow,
  });
  const { previewStoragePath, signedUrl } = await resolveUploadedMediaPreviewUrl({
    row: hydratedRow,
    uploaded,
    userId,
  });

  return {
    id: hydratedRow.id,
    filename: hydratedRow.filename,
    storage_path: hydratedRow.storage_path,
    preview_storage_path: previewStoragePath,
    file_type: hydratedRow.file_type,
    file_size: hydratedRow.file_size,
    source: hydratedRow.source,
    created_at: hydratedRow.created_at,
    signedUrl,
  };
};

export const finalizePreparedMediaUploadForUser = async ({
  userId,
  destinationTab,
  storagePath,
  filename,
  declaredMimeType,
}: {
  userId: string;
  destinationTab: MediaUploadDestinationTab;
  storagePath: string;
  filename: string;
  declaredMimeType: string;
}): Promise<MediaUploadResponseFile> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Prepared media upload storage path",
  });
  const expectedFolderPrefix = `${userId}/${resolveMediaDirectUploadStagingFolder(destinationTab)}/`;
  if (!safeStoragePath.startsWith(expectedFolderPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Prepared media upload storage path is outside the expected namespace."
    );
  }

  let uploaded: UploadedStorageAsset | null = null;
  try {
    let stored;
    try {
      stored = await readStoredMediaBuffer({
        storagePath: safeStoragePath,
        maxBytes: MAX_UPLOAD_BYTES,
      });
    } catch (error) {
      if (error instanceof MediaAudioExtractionInputError && error.statusCode === 413) {
        throw new MediaUploadServiceError(413, "Upload failed: file too large");
      }
      throw error;
    }
    const parsedUpload: ParsedUpload = {
      buffer: stored.buffer,
      declaredMimeType:
        resolvePreparedMediaUploadMimeType({
          destinationTab,
          declaredMimeType: declaredMimeType || stored.contentType || "",
        }) || normalizeContentType(stored.contentType ?? undefined),
      size: stored.size,
      filename: filename.trim() || safeStoragePath.split("/").filter(Boolean).pop() || "upload",
      destinationTab,
    };
    const detectedMimeType = resolveDetectedMimeType(destinationTab, parsedUpload.buffer);
    const validatedUpload = validateUpload({
      destinationTab,
      declaredMimeType: parsedUpload.declaredMimeType,
      detectedMimeType,
    });
    if (validatedUpload.fileType === "image") {
      uploaded = await uploadStorageAssetFromParsedUpload({
        parsedUpload,
        userId,
        cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
      });
    } else {
      enforceUploadSizeLimit({
        fileType: validatedUpload.fileType,
        fileSize: parsedUpload.size,
      });
      uploaded = await movePreparedUploadToDurableStorage({
        userId,
        sourceStoragePath: safeStoragePath,
        parsedUpload,
        mimeType: validatedUpload.mimeType,
        fileType: validatedUpload.fileType,
      });
    }
    return await persistUploadedMediaAsset({
      userId,
      uploaded,
    });
  } finally {
    await removeScopedMediaStorageObject(safeStoragePath);
  }
};

export const finalizeReferenceImageUploadForUser = async ({
  userId,
  storagePath,
  filename,
  declaredMimeType,
}: {
  userId: string;
  storagePath: string;
  filename: string;
  declaredMimeType: string;
}): Promise<SignedStorageUploadResponse> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Prepared reference image storage path",
  });
  const expectedFolderPrefix = `${userId}/${REFERENCE_IMAGE_STAGING_FOLDER}/`;
  if (!safeStoragePath.startsWith(expectedFolderPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Prepared reference image storage path is outside the expected namespace."
    );
  }

  let uploaded: UploadedStorageAsset | null = null;
  try {
    let stored;
    try {
      stored = await readStoredMediaBuffer({
        storagePath: safeStoragePath,
        maxBytes: MAX_UPLOAD_BYTES,
      });
    } catch (error) {
      if (error instanceof MediaAudioExtractionInputError && error.statusCode === 413) {
        throw new MediaUploadServiceError(413, "Upload failed: file too large");
      }
      throw error;
    }
    const parsedUpload: ParsedUpload = {
      buffer: stored.buffer,
      declaredMimeType:
        resolvePreparedMediaUploadMimeType({
          destinationTab: "private",
          declaredMimeType: declaredMimeType || stored.contentType || "",
        }) || normalizeContentType(stored.contentType ?? undefined),
      size: stored.size,
      filename: filename.trim() || safeStoragePath.split("/").filter(Boolean).pop() || "upload",
      destinationTab: "private",
    };
    uploaded = await uploadStorageAssetFromParsedUpload({
      parsedUpload,
      userId,
      storageFolderOverride: REFERENCE_IMAGE_STORAGE_FOLDER,
    });
    return {
      url: uploaded.signedUrl,
      path: uploaded.storagePath,
      size: uploaded.size,
      mimeType: uploaded.parsedUpload.declaredMimeType,
      name: uploaded.parsedUpload.filename,
    };
  } finally {
    await removeScopedMediaStorageObject(safeStoragePath);
  }
};

export const finalizeReferenceVideoUploadForUser = async ({
  userId,
  storagePath,
  filename,
  declaredMimeType,
}: {
  userId: string;
  storagePath: string;
  filename: string;
  declaredMimeType: string;
}): Promise<SignedStorageUploadResponse> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Prepared reference video storage path",
  });
  const expectedFolderPrefix = `${userId}/${REFERENCE_VIDEO_STAGING_FOLDER}/`;
  if (!safeStoragePath.startsWith(expectedFolderPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Prepared reference video storage path is outside the expected namespace."
    );
  }

  let uploaded: UploadedStorageAsset | null = null;
  try {
    let stored;
    try {
      stored = await readStoredMediaBuffer({
        storagePath: safeStoragePath,
        maxBytes: MAX_UPLOAD_BYTES,
      });
    } catch (error) {
      if (error instanceof MediaAudioExtractionInputError && error.statusCode === 413) {
        throw new MediaUploadServiceError(413, "Upload failed: file too large");
      }
      throw error;
    }
    const parsedUpload: ParsedUpload = {
      buffer: stored.buffer,
      declaredMimeType:
        resolvePreparedMediaUploadMimeType({
          destinationTab: "uploaded_videos",
          declaredMimeType: declaredMimeType || stored.contentType || "",
        }) || normalizeContentType(stored.contentType ?? undefined),
      size: stored.size,
      filename: filename.trim() || safeStoragePath.split("/").filter(Boolean).pop() || "upload",
      destinationTab: "uploaded_videos",
    };
    uploaded = await uploadStorageAssetFromParsedUpload({
      parsedUpload,
      userId,
      storageFolderOverride: REFERENCE_VIDEO_STORAGE_FOLDER,
    });
    return {
      url: uploaded.signedUrl,
      path: uploaded.storagePath,
      size: uploaded.size,
      mimeType: uploaded.parsedUpload.declaredMimeType,
      name: uploaded.parsedUpload.filename,
    };
  } finally {
    await removeScopedMediaStorageObject(safeStoragePath);
  }
};

export const finalizeMotionReferenceVideoUploadForUser = async ({
  userId,
  storagePath,
  filename,
  declaredMimeType,
}: {
  userId: string;
  storagePath: string;
  filename: string;
  declaredMimeType: string;
}): Promise<SignedStorageUploadResponse> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Prepared motion reference video storage path",
  });
  const expectedFolderPrefix = `${userId}/${MOTION_REFERENCE_VIDEO_STAGING_FOLDER}/`;
  if (!safeStoragePath.startsWith(expectedFolderPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Prepared motion reference video storage path is outside the expected namespace."
    );
  }

  let uploaded: UploadedStorageAsset | null = null;
  try {
    let stored;
    try {
      stored = await readStoredMediaBuffer({
        storagePath: safeStoragePath,
        maxBytes: MAX_UPLOAD_BYTES,
      });
    } catch (error) {
      if (error instanceof MediaAudioExtractionInputError && error.statusCode === 413) {
        throw new MediaUploadServiceError(413, "Upload failed: file too large");
      }
      throw error;
    }
    const parsedUpload: ParsedUpload = {
      buffer: stored.buffer,
      declaredMimeType:
        resolvePreparedMediaUploadMimeType({
          destinationTab: "uploaded_videos",
          declaredMimeType: declaredMimeType || stored.contentType || "",
        }) || normalizeContentType(stored.contentType ?? undefined),
      size: stored.size,
      filename:
        filename.trim() || safeStoragePath.split("/").filter(Boolean).pop() || "motion-reference",
      destinationTab: "uploaded_videos",
    };
    uploaded = await uploadStorageAssetFromParsedUpload({
      parsedUpload,
      userId,
      storageFolderOverride: MOTION_REFERENCE_VIDEO_STORAGE_FOLDER,
      normalizeMotionReferenceVideo: true,
    });
    return {
      url: uploaded.signedUrl,
      path: uploaded.storagePath,
      size: uploaded.size,
      mimeType: uploaded.parsedUpload.declaredMimeType,
      name: uploaded.parsedUpload.filename,
    };
  } finally {
    await removeScopedMediaStorageObject(safeStoragePath);
  }
};

export const deleteSignedStorageAssetForUser = async ({
  userId,
  storagePath,
  storageFolderOverride,
}: {
  userId: string;
  storagePath: string;
  storageFolderOverride: string;
}): Promise<void> => {
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Uploaded asset storage path",
  });
  const expectedPrefix = `${userId}/${storageFolderOverride}/`;
  if (!safeStoragePath.startsWith(expectedPrefix)) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Uploaded asset storage path is outside the expected namespace."
    );
  }
  await removeScopedMediaStorageObject(safeStoragePath);
};

const insertUploadedMediaRow = async ({
  userId,
  parsedUpload,
  storagePath,
  fileType,
  metadata,
}: {
  userId: string;
  parsedUpload: ParsedUpload;
  storagePath: string;
  fileType: MediaLibraryFileType;
  metadata: Record<string, unknown> | null;
}): Promise<InsertedMediaRow> => {
  const { data: insertedRow, error: insertError } = await insertMediaFileRow({
    userId,
    filename: parsedUpload.filename,
    storagePath,
    fileType,
    fileSize: parsedUpload.size,
    source: resolveUploadSource(parsedUpload.destinationTab),
    metadata,
  });

  if (insertError || !insertedRow) {
    await removeScopedMediaStorageObject(storagePath);
    if (isMediaStorageQuotaExceededError(insertError)) {
      throw new MediaUploadServiceError(
        409,
        MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
        "Delete media, upgrade your plan, or add recurring storage before uploading more files."
      );
    }
    throw new MediaUploadServiceError(
      500,
      "Failed to persist media record",
      insertError?.message ?? "Missing inserted media row"
    );
  }

  return insertedRow as InsertedMediaRow;
};

const hydrateUploadedVideoVariants = async ({
  userId,
  parsedUpload,
  row,
}: {
  userId: string;
  parsedUpload: ParsedUpload;
  row: InsertedMediaRow;
}): Promise<InsertedMediaRow> => {
  if (row.file_type !== "video") return row;

  const nextRow: InsertedMediaRow = { ...row };
  const supabaseAdmin = getSupabaseAdmin();
  const previewVariantPath =
    row.preview_variant_path ??
    (await upsertVideoPreviewVariantFromBuffer({
      supabaseAdmin,
      userId,
      mediaFileId: row.id,
      videoBuffer: parsedUpload.buffer,
      videoMimeType: parsedUpload.declaredMimeType,
      filename: parsedUpload.filename,
      metadata: {
        generated_by: "media_upload_service",
        upload_source: row.source,
      },
    }).catch(() => null));
  if (previewVariantPath) {
    nextRow.preview_variant_path = previewVariantPath;
  }

  const posterVariantPath =
    row.poster_variant_path ??
    (await upsertVideoPosterVariantFromBuffer({
      supabaseAdmin,
      userId,
      mediaFileId: row.id,
      videoBuffer: parsedUpload.buffer,
      videoMimeType: parsedUpload.declaredMimeType,
      filename: parsedUpload.filename,
      metadata: {
        generated_by: "media_upload_service",
        upload_source: row.source,
      },
    }).catch(() => null));
  if (posterVariantPath) {
    nextRow.poster_variant_path = posterVariantPath;
  }

  return nextRow;
};

const resolveUploadedMediaPreviewUrl = async ({
  row,
  uploaded,
  userId,
}: {
  row: InsertedMediaRow;
  uploaded: UploadedStorageAsset;
  userId: string;
}): Promise<{ previewStoragePath: string; signedUrl: string }> => {
  const previewStoragePath = resolveMediaPreviewStoragePath(row, userId);
  if (previewStoragePath === uploaded.storagePath) {
    if (!uploaded.signedUrl) {
      throw new MediaUploadServiceError(500, "Failed to generate signed preview URL");
    }
    return {
      previewStoragePath,
      signedUrl: uploaded.signedUrl,
    };
  }

  let signedUrl: string;
  try {
    signedUrl = await createSignedMediaUrl(previewStoragePath);
  } catch (error) {
    throw new MediaUploadServiceError(
      500,
      "Failed to generate signed preview URL",
      error instanceof Error ? error.message : "Missing signed preview URL"
    );
  }

  return {
    previewStoragePath,
    signedUrl,
  };
};

/**
 * Parses, validates, uploads, and persists a Media Library upload for a user.
 */
export const uploadMediaForUser = async ({
  req,
  userId,
}: {
  req: NextApiRequest;
  userId: string;
}): Promise<MediaUploadResponseFile> => {
  await assertMediaComplianceAcceptedForUpload(userId);
  let parsedUpload: ParsedUpload | null = null;
  let storagePathForCleanup: string | null = null;

  try {
    const uploaded = await uploadStorageAssetForUser({
      req,
      userId,
      cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
    });
    parsedUpload = uploaded.parsedUpload;
    storagePathForCleanup = uploaded.storagePath;
    return await persistUploadedMediaAsset({
      userId,
      uploaded,
    });
  } catch (error) {
    if (storagePathForCleanup && isMediaStorageQuotaExceededError(error)) {
      throw new MediaUploadServiceError(
        409,
        MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
        "Delete media, upgrade your plan, or add recurring storage before uploading more files."
      );
    }
    throw error;
  } finally {
    if (parsedUpload?.tempFilePath) {
      try {
        fs.unlinkSync(parsedUpload.tempFilePath);
      } catch {
        // best-effort temp file cleanup
      }
    }
  }
};
