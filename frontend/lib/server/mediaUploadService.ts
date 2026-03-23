/**
 * Server-authoritative Media Library upload service.
 * Validates destination/mime/signature, writes scoped storage objects, and persists media rows.
 */
import type { NextApiRequest } from "next";
import formidable from "formidable";
import fs from "fs";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { resolveMediaSigningStoragePaths } from "../mediaPreviewPath";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  areCompatibleMimeTypes,
  detectImageMimeType,
  detectVideoMimeType,
} from "./uploadSignature";

const MEDIA_BUCKET = "media_library";
const PRIVATE_MEDIA_SOURCE = "private_upload";
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_BYTES;

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
};

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

const readRawBody = async (req: NextApiRequest): Promise<Buffer> =>
  await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

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
      if (totalBytes > MAX_UPLOAD_BYTES) {
        settle(() => reject(new MediaUploadServiceError(413, "Upload failed: file too large")));
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

const destinationExpectsVideo = (destinationTab: MediaUploadDestinationTab): boolean =>
  VIDEO_DESTINATIONS.has(destinationTab);

const destinationMaxBytes = (destinationTab: MediaUploadDestinationTab): number =>
  destinationExpectsVideo(destinationTab) ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;

const resolveDetectedMimeType = (
  destinationTab: MediaUploadDestinationTab,
  buffer: Buffer
): string | null => {
  if (destinationExpectsVideo(destinationTab)) {
    return detectVideoMimeType(buffer);
  }
  return detectImageMimeType(buffer);
};

const isAllowedMimeType = (
  destinationTab: MediaUploadDestinationTab,
  mimeType: string
): boolean => {
  if (destinationExpectsVideo(destinationTab)) {
    return ALLOWED_VIDEO_MIME_TYPES.has(mimeType);
  }
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
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
    destinationExpectsVideo(destinationTab) &&
    declaredMimeType.startsWith("video/") &&
    detectedMimeType.startsWith("video/")
  ) {
    // Browser/file-input MIME metadata can vary between MP4 container aliases.
    const mp4AliasFamily = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
    if (mp4AliasFamily.has(declaredMimeType) && mp4AliasFamily.has(detectedMimeType)) return true;
  }
  return false;
};

const resolveUploadFolder = (destinationTab: MediaUploadDestinationTab): string => {
  if (destinationTab === "private") return "private/images";
  if (destinationTab === "uploaded_videos") return "videos";
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
}): string => {
  if (!detectedMimeType || !isAllowedMimeType(destinationTab, detectedMimeType)) {
    const expected = destinationExpectsVideo(destinationTab) ? "video" : "image";
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

  if (fileSize > destinationMaxBytes(destinationTab)) {
    throw new MediaUploadServiceError(413, "Upload failed: file too large");
  }

  return detectedMimeType;
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
};

type StorageUploadOptions = {
  req: NextApiRequest;
  userId: string;
  defaultDestinationTab?: MediaUploadDestinationTab;
  storageFolderOverride?: string;
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
  const mimeType = validateUpload({
    destinationTab: parsedUpload.destinationTab,
    declaredMimeType: parsedUpload.declaredMimeType,
    detectedMimeType,
    fileSize: parsedUpload.size,
  });

  const extension =
    EXTENSION_BY_MIME[mimeType] ??
    (destinationExpectsVideo(parsedUpload.destinationTab) ? "mp4" : "jpg");
  const fileBaseName = resolveBaseFileName(parsedUpload.filename);
  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileBaseName}.${extension}`;
  const storageFolder = storageFolderOverride ?? resolveUploadFolder(parsedUpload.destinationTab);
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/${storageFolder}/${storedFileName}`,
    userId,
    label: "Media upload storage path",
  });

  const supabaseAdmin = getSupabaseAdmin();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, parsedUpload.buffer, {
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
    size: parsedUpload.size,
    parsedUpload,
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
  const uploaded = await uploadStorageAssetForUser({
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

  try {
    const uploaded = await uploadStorageAssetForUser({
      req,
      userId,
    });
    parsedUpload = uploaded.parsedUpload;
    const storagePath = uploaded.storagePath;
    const imageDimensions = destinationExpectsVideo(parsedUpload.destinationTab)
      ? null
      : extractImageDimensionsFromBuffer(parsedUpload.buffer);
    const metadata = withCanonicalImageDimensions(null, imageDimensions);

    const supabaseAdmin = getSupabaseAdmin();

    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from("media_files")
      .insert({
        user_id: userId,
        filename: parsedUpload.filename,
        storage_path: storagePath,
        file_type: destinationExpectsVideo(parsedUpload.destinationTab) ? "video" : "image",
        file_size: parsedUpload.size,
        source: resolveUploadSource(parsedUpload.destinationTab),
        metadata,
      })
      .select(
        "id, user_id, filename, storage_path, file_type, file_size, source, created_at, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .single();

    if (insertError || !insertedRow) {
      throw new MediaUploadServiceError(
        500,
        "Failed to persist media record",
        insertError?.message ?? "Missing inserted media row"
      );
    }

    const normalizedRow = insertedRow as InsertedMediaRow;
    const previewStoragePath =
      resolveMediaSigningStoragePaths(normalizedRow, userId)[0] ?? normalizedRow.storage_path;
    let signedUrl = uploaded.signedUrl;
    if (previewStoragePath !== uploaded.storagePath) {
      const { data: signedPreview, error: signError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(previewStoragePath, 3600);
      if (signError || !signedPreview?.signedUrl) {
        throw new MediaUploadServiceError(
          500,
          "Failed to generate signed preview URL",
          signError?.message ?? "Missing signed preview URL"
        );
      }
      signedUrl = signedPreview.signedUrl;
    }
    if (!signedUrl) {
      throw new MediaUploadServiceError(500, "Failed to generate signed preview URL");
    }

    return {
      id: normalizedRow.id,
      filename: normalizedRow.filename,
      storage_path: normalizedRow.storage_path,
      preview_storage_path: previewStoragePath,
      file_type: normalizedRow.file_type,
      file_size: normalizedRow.file_size,
      source: normalizedRow.source,
      created_at: normalizedRow.created_at,
      signedUrl,
    };
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
