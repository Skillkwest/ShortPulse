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
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { resolveMediaPreviewStoragePath } from "../../features/media-library/logic/mediaPreviewStoragePath";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  areCompatibleMimeTypes,
  detectAudioMimeType,
  detectImageMimeType,
  detectVideoMimeType,
} from "./uploadSignature";
import {
  upsertVideoPosterVariantFromBuffer,
  upsertVideoPreviewVariantFromBuffer,
} from "./videoPosterVariant";

const MEDIA_BUCKET = "media_library";
const PRIVATE_MEDIA_SOURCE = "private_upload";
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_BYTES;
const MAX_VOICE_CHANGER_VIDEO_STAGE_BYTES = 40 * 1024 * 1024;
const MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES = 100 * 1024 * 1024;

const VIDEO_DESTINATIONS = new Set<MediaUploadDestinationTab>(["uploaded_videos"]);

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
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

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
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
type MediaLibraryFileType = "image" | "video" | "audio";

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

type InsertedMediaRow = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  file_size: number | null;
  source: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

const normalizeContentType = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(";")[0]?.trim().toLowerCase() ?? "";
};

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

const maxBytesForFileType = (fileType: MediaLibraryFileType): number => {
  if (fileType === "video") return MAX_VIDEO_UPLOAD_BYTES;
  if (fileType === "audio") return MAX_AUDIO_UPLOAD_BYTES;
  return MAX_IMAGE_UPLOAD_BYTES;
};

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

const resolveFileTypeFromMimeType = (mimeType: string): MediaLibraryFileType | null => {
  if (ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) return "audio";
  if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return "image";
  return null;
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

const validateUpload = ({
  destinationTab,
  declaredMimeType,
  detectedMimeType,
  fileSize,
}: {
  destinationTab: MediaUploadDestinationTab;
  declaredMimeType: string;
  detectedMimeType: string | null;
  fileSize: number;
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

  const fileType = resolveFileTypeFromMimeType(detectedMimeType);
  if (!fileType) {
    throw new MediaUploadServiceError(400, "Invalid file type", "Unsupported uploaded file type.");
  }

  if (fileSize > maxBytesForFileType(fileType)) {
    throw new MediaUploadServiceError(413, "Upload failed: file too large");
  }

  return {
    mimeType: detectedMimeType,
    fileType,
  };
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

type UploadedStorageAsset = {
  storagePath: string;
  signedUrl: string;
  size: number;
  parsedUpload: ParsedUpload;
  fileType: MediaLibraryFileType;
};

type StorageUploadOptions = {
  req: NextApiRequest;
  userId: string;
  defaultDestinationTab?: MediaUploadDestinationTab;
  storageFolderOverride?: string;
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

const uploadScopedStorageBuffer = async ({
  userId,
  storageFolder,
  filename,
  mimeType,
  buffer,
}: {
  userId: string;
  storageFolder: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<SignedStorageAssetResult> => {
  const extension =
    EXTENSION_BY_MIME[mimeType] ?? VOICE_CHANGER_AUDIO_EXTENSION_BY_MIME[mimeType] ?? "bin";
  const fileBaseName = resolveBaseFileName(filename);
  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/${storageFolder}/${storedFileName}`,
    userId,
    label: "Media upload storage path",
  });

  const supabaseAdmin = getSupabaseAdmin();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new MediaUploadServiceError(500, "Upload failed", uploadError.message);
  }

  const { data: signedAsset, error: signError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signError || !signedAsset?.signedUrl) {
    throw new MediaUploadServiceError(
      500,
      "Failed to generate signed preview URL",
      signError?.message ?? "Missing signed preview URL"
    );
  }

  return {
    storagePath,
    signedUrl: signedAsset.signedUrl,
    size: buffer.length,
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
}: StorageUploadOptions): Promise<UploadedStorageAsset> => {
  const parsedUpload = await parseUpload(req, { defaultDestinationTab });
  const detectedMimeType = resolveDetectedMimeType(
    parsedUpload.destinationTab,
    parsedUpload.buffer
  );
  const validatedUpload = validateUpload({
    destinationTab: parsedUpload.destinationTab,
    declaredMimeType: parsedUpload.declaredMimeType,
    detectedMimeType,
    fileSize: parsedUpload.size,
  });

  const storageFolder =
    storageFolderOverride ??
    resolveUploadFolder(parsedUpload.destinationTab, validatedUpload.fileType);
  const uploaded = await uploadScopedStorageBuffer({
    userId,
    storageFolder,
    filename: parsedUpload.filename,
    mimeType: validatedUpload.mimeType,
    buffer: parsedUpload.buffer,
  });

  return {
    storagePath: uploaded.storagePath,
    signedUrl: uploaded.signedUrl,
    size: parsedUpload.size,
    parsedUpload,
    fileType: validatedUpload.fileType,
  };
};

export const uploadVoiceChangerSourceForUser = async ({
  req,
  userId,
  kind,
}: {
  req: NextApiRequest;
  userId: string;
  kind: VoiceChangerSourceKind;
}): Promise<{
  url: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
}> => {
  const maxBytes =
    kind === "video" ? MAX_VOICE_CHANGER_VIDEO_STAGE_BYTES : MAX_VOICE_CHANGER_AUDIO_STAGE_BYTES;
  const tooLargeError =
    kind === "video"
      ? new MediaUploadServiceError(
          413,
          "Invalid request",
          "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again."
        )
      : new MediaUploadServiceError(
          413,
          "Invalid request",
          "Voice changer source audio must be 100 MB or smaller."
        );
  const filename =
    readHeaderString(req.headers["x-shortpulse-upload-filename"]) ||
    `voice-changer-source.${kind === "video" ? "mp4" : "wav"}`;
  const buffer = await readRawBody(req, { maxBytes, tooLargeError });
  if (!buffer.length) {
    throw new MediaUploadServiceError(
      400,
      "Invalid request",
      "Voice changer source upload is empty."
    );
  }

  const declaredMimeType = normalizeContentType(req.headers["content-type"]);
  const mimeType = resolveVoiceChangerSourceMimeType({
    kind,
    declaredMimeType,
    filename,
    buffer,
  });
  const uploaded = await uploadScopedStorageBuffer({
    userId,
    storageFolder: kind === "video" ? "voice-changer/source-video" : "voice-changer/source-audio",
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
}: {
  req: NextApiRequest;
  userId: string;
  defaultDestinationTab: MediaUploadDestinationTab;
  storageFolderOverride: string;
}): Promise<{
  url: string;
  path: string;
  size: number;
}> => {
  let uploaded: UploadedStorageAsset | null = null;
  try {
    uploaded = await uploadStorageAssetForUser({
      req,
      userId,
      defaultDestinationTab,
      storageFolderOverride,
    });

    return {
      url: uploaded.signedUrl,
      path: uploaded.storagePath,
      size: uploaded.size,
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

const removeUploadedStorageObject = async (storagePath: string): Promise<void> => {
  try {
    await getSupabaseAdmin().storage.from(MEDIA_BUCKET).remove([storagePath]);
  } catch {
    // best-effort orphan cleanup
  }
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
  const { data: insertedRow, error: insertError } = await getSupabaseAdmin()
    .from("media_files")
    .insert({
      user_id: userId,
      filename: parsedUpload.filename,
      storage_path: storagePath,
      file_type: fileType,
      file_size: parsedUpload.size,
      source: resolveUploadSource(parsedUpload.destinationTab),
      metadata,
    })
    .select(
      "id, user_id, filename, storage_path, file_type, file_size, source, created_at, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
    )
    .single();

  if (insertError || !insertedRow) {
    await removeUploadedStorageObject(storagePath);
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

  const { data: signedPreview, error: signError } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(previewStoragePath, 3600);
  if (signError || !signedPreview?.signedUrl) {
    throw new MediaUploadServiceError(
      500,
      "Failed to generate signed preview URL",
      signError?.message ?? "Missing signed preview URL"
    );
  }

  return {
    previewStoragePath,
    signedUrl: signedPreview.signedUrl,
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
  let parsedUpload: ParsedUpload | null = null;
  let storagePathForCleanup: string | null = null;

  try {
    const uploaded = await uploadStorageAssetForUser({
      req,
      userId,
    });
    parsedUpload = uploaded.parsedUpload;
    const storagePath = uploaded.storagePath;
    storagePathForCleanup = storagePath;
    const imageDimensions =
      uploaded.fileType === "image" ? extractImageDimensionsFromBuffer(parsedUpload.buffer) : null;
    const metadata = withCanonicalImageDimensions(null, imageDimensions);
    const normalizedRow = await insertUploadedMediaRow({
      userId,
      parsedUpload,
      storagePath,
      fileType: uploaded.fileType,
      metadata,
    });
    const hydratedRow = await hydrateUploadedVideoVariants({
      userId,
      parsedUpload,
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
