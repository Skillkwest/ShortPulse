/**
 * Shared server-side media ingest authority.
 * Owns canonical media mime/size rules, storage writes, and media row inserts.
 */
import { IMAGE_ADMISSION_MAX_BYTES } from "../imageAdmissionPolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { detectAudioMimeType, detectImageMimeType, detectVideoMimeType } from "./uploadSignature";

export const MEDIA_BUCKET = "media_library";

export type MediaLibraryFileType = "image" | "video" | "audio";

export type InsertedMediaRow = {
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

export const MAX_IMAGE_MEDIA_BYTES = IMAGE_ADMISSION_MAX_BYTES;
export const MAX_VIDEO_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_MEDIA_BYTES = 100 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
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

export const MEDIA_EXTENSION_BY_MIME: Record<string, string> = {
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

export const INSERTED_MEDIA_FILE_ROW_SELECT =
  "id, user_id, filename, storage_path, file_type, file_size, source, created_at, metadata, thumb_variant_path, poster_variant_path, preview_variant_path";

export const maxBytesForMediaFileType = (fileType: MediaLibraryFileType): number => {
  if (fileType === "video") return MAX_VIDEO_MEDIA_BYTES;
  if (fileType === "audio") return MAX_AUDIO_MEDIA_BYTES;
  return MAX_IMAGE_MEDIA_BYTES;
};

export const resolveMediaFileTypeFromMimeType = (mimeType: string): MediaLibraryFileType | null => {
  if (ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) return "audio";
  if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return "image";
  return null;
};

export const resolveMediaStorageExtension = (mimeType: string, fallback = "bin"): string =>
  MEDIA_EXTENSION_BY_MIME[mimeType] ?? fallback;

export const buildScopedMediaStoragePath = ({
  userId,
  storageFolder,
  storedFileName,
  label,
}: {
  userId: string;
  storageFolder: string;
  storedFileName: string;
  label: string;
}): string =>
  assertUserScopedMediaStoragePath({
    path: `${userId}/${storageFolder}/${storedFileName}`,
    userId,
    label,
  });

export const uploadMediaBufferToStoragePath = async ({
  storagePath,
  buffer,
  mimeType,
  upsert = false,
}: {
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
  upsert?: boolean;
}): Promise<void> => {
  const { error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert,
    });

  if (error) {
    throw error;
  }
};

export const createSignedMediaUrl = async (
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> => {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Missing signed media URL.");
  }

  return data.signedUrl;
};

export const removeScopedMediaStorageObject = async (storagePath: string): Promise<void> => {
  try {
    await getSupabaseAdmin().storage.from(MEDIA_BUCKET).remove([storagePath]);
  } catch {
    // best-effort orphan cleanup
  }
};

export const insertMediaFileRow = async ({
  userId,
  filename,
  storagePath,
  fileType,
  fileSize,
  source,
  metadata,
  sourceRef = null,
  promptId = null,
}: {
  userId: string;
  filename: string;
  storagePath: string;
  fileType: MediaLibraryFileType;
  fileSize: number;
  source: string;
  metadata: Record<string, unknown> | null;
  sourceRef?: string | null;
  promptId?: string | null;
}): Promise<{ data: InsertedMediaRow | null; error: { code?: string; message?: string } | null }> =>
  await getSupabaseAdmin()
    .from("media_files")
    .insert({
      user_id: userId,
      filename,
      storage_path: storagePath,
      file_type: fileType,
      file_size: fileSize,
      source,
      source_ref: sourceRef,
      prompt_id: promptId,
      metadata,
    })
    .select(INSERTED_MEDIA_FILE_ROW_SELECT)
    .single();

export const resolveDetectedMediaMimeType = ({
  contentType,
  buffer,
  fileType,
}: {
  contentType: string | null;
  buffer: Buffer;
  fileType: MediaLibraryFileType;
}): string => {
  if (fileType === "image") {
    const detected = detectImageMimeType(buffer);
    if (detected && ALLOWED_IMAGE_MIME_TYPES.has(detected)) return detected;
    if (contentType && ALLOWED_IMAGE_MIME_TYPES.has(contentType)) return contentType;
    throw new Error("Fetched URL did not return a supported image.");
  }

  if (fileType === "audio") {
    const detected = detectAudioMimeType(buffer);
    if (detected && ALLOWED_AUDIO_MIME_TYPES.has(detected)) return detected;
    if (contentType && ALLOWED_AUDIO_MIME_TYPES.has(contentType)) return contentType;
    throw new Error("Fetched URL did not return a supported audio file.");
  }

  const detected = detectVideoMimeType(buffer);
  if (detected && ALLOWED_VIDEO_MIME_TYPES.has(detected)) return detected;
  if (contentType && ALLOWED_VIDEO_MIME_TYPES.has(contentType)) return contentType;
  throw new Error("Fetched URL did not return a supported video.");
};
