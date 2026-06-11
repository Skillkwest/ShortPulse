/**
 * Server helpers for dashboard tutorial thumbnail storage.
 * Owns admin-only signed uploads, validation, and signed original delivery.
 */
import { randomUUID } from "crypto";
import type { getSupabaseAdmin } from "./supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export const DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET = "dashboard_tutorial_thumbnails";
export const DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PREFIX = "tutorial-thumbnails";
export const DASHBOARD_TUTORIAL_THUMBNAIL_MAX_BYTES = 50 * 1024 * 1024;
export const DASHBOARD_TUTORIAL_THUMBNAIL_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export const DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type DashboardTutorialThumbnailContentType =
  (typeof DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES)[number];

export type DashboardTutorialPreparedThumbnailUpload = {
  storagePath: string;
  uploadToken: string;
  mimeType: DashboardTutorialThumbnailContentType;
  mediaType: "image" | "video";
  maxBytes: number;
};

export type DashboardTutorialFinalizedThumbnailUpload = {
  storagePath: string;
  signedUrl: string;
  mimeType: DashboardTutorialThumbnailContentType;
  mediaType: "image" | "video";
  fileSizeBytes: number;
};

export class DashboardTutorialAssetError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MIME_TYPE_TO_EXTENSION: Record<DashboardTutorialThumbnailContentType, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const ALLOWED_MIME_TYPES = new Set<string>(DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES);
const STORAGE_SETUP_DETAILS =
  "Apply sql/migrations/154_add_dashboard_tutorial_thumbnail_uploads.sql in this environment.";

const asPositiveSafeInteger = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

const normalizeMimeType = (value: unknown): DashboardTutorialThumbnailContentType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_MIME_TYPES.has(normalized)
    ? (normalized as DashboardTutorialThumbnailContentType)
    : null;
};

const isMissingBucketStorageError = (error: unknown): boolean => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("bucket") &&
    (normalized.includes("not found") ||
      normalized.includes("does not exist") ||
      normalized.includes("not exist"))
  );
};

const createStorageSetupError = (): DashboardTutorialAssetError =>
  new DashboardTutorialAssetError(503, "Thumbnail storage is not ready.", STORAGE_SETUP_DETAILS);

const throwStorageOperationError = (error: unknown, fallback: string): never => {
  if (isMissingBucketStorageError(error)) {
    throw createStorageSetupError();
  }
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  throw new Error(message || fallback);
};

const resolveMediaType = (mimeType: DashboardTutorialThumbnailContentType): "image" | "video" =>
  mimeType.startsWith("video/") ? "video" : "image";

const startsWithBytes = (bytes: Uint8Array, signature: number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const readAscii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...Array.from(bytes.slice(start, end)));

const detectMimeType = (bytes: Uint8Array): DashboardTutorialThumbnailContentType | null => {
  if (bytes.length < 12) return null;

  if (readAscii(bytes, 0, 6) === "GIF87a" || readAscii(bytes, 0, 6) === "GIF89a") {
    return "image/gif";
  }
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return "video/webm";
  }
  if (readAscii(bytes, 4, 8) === "ftyp") {
    const brand = readAscii(bytes, 8, 12);
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }

  return null;
};

const isCompatibleDetectedMimeType = ({
  declaredMimeType,
  detectedMimeType,
}: {
  declaredMimeType: DashboardTutorialThumbnailContentType;
  detectedMimeType: DashboardTutorialThumbnailContentType;
}): boolean => {
  if (declaredMimeType === detectedMimeType) return true;
  return (
    (declaredMimeType === "video/mp4" && detectedMimeType === "video/quicktime") ||
    (declaredMimeType === "video/quicktime" && detectedMimeType === "video/mp4")
  );
};

export const isDashboardTutorialThumbnailStoragePath = (value: string): boolean => {
  if (!value || value.length > 500) return false;
  if (!value.startsWith(`${DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PREFIX}/`)) return false;
  if (
    value.startsWith("/") ||
    value.includes("//") ||
    value.includes("..") ||
    value.includes("\\")
  ) {
    return false;
  }
  return true;
};

export const normalizeDashboardTutorialThumbnailContentType = (
  value: unknown
): DashboardTutorialThumbnailContentType | null => normalizeMimeType(value);

export const resolveDashboardTutorialThumbnailMediaType = (
  mimeType: DashboardTutorialThumbnailContentType
): "image" | "video" => resolveMediaType(mimeType);

const validateDeclaredUpload = ({
  sourceMimeType,
  sourceSize,
}: {
  sourceMimeType: unknown;
  sourceSize: unknown;
}): DashboardTutorialThumbnailContentType => {
  const mimeType = normalizeMimeType(sourceMimeType);
  if (!mimeType) {
    throw new DashboardTutorialAssetError(
      400,
      "Unsupported thumbnail file type.",
      "Use GIF, PNG, JPEG, WebP, MP4, MOV, or WebM."
    );
  }

  const size = asPositiveSafeInteger(sourceSize);
  if (!size) {
    throw new DashboardTutorialAssetError(400, "Thumbnail file size is required.");
  }
  if (size > DASHBOARD_TUTORIAL_THUMBNAIL_MAX_BYTES) {
    throw new DashboardTutorialAssetError(413, "Thumbnail file is too large.");
  }

  return mimeType;
};

/**
 * Creates one signed Supabase upload target for an admin thumbnail file.
 */
export const prepareDashboardTutorialThumbnailUpload = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    sourceMimeType: unknown;
    sourceSize: unknown;
  }
): Promise<DashboardTutorialPreparedThumbnailUpload> => {
  const mimeType = validateDeclaredUpload({
    sourceMimeType: args.sourceMimeType,
    sourceSize: args.sourceSize,
  });
  const extension = MIME_TYPE_TO_EXTENSION[mimeType];
  const storagePath = `${DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PREFIX}/${randomUUID()}.${extension}`;
  const { data, error } = await supabaseAdmin.storage
    .from(DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data || !data.path || !data.token) {
    throwStorageOperationError(error, "Unable to prepare thumbnail upload.");
  }
  const signedUploadTarget = data as NonNullable<typeof data>;

  return {
    storagePath: signedUploadTarget.path,
    uploadToken: signedUploadTarget.token,
    mimeType,
    mediaType: resolveMediaType(mimeType),
    maxBytes: DASHBOARD_TUTORIAL_THUMBNAIL_MAX_BYTES,
  };
};

/**
 * Verifies one prepared thumbnail object and returns its signed original URL.
 */
export const finalizeDashboardTutorialThumbnailUpload = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    storagePath: unknown;
    sourceMimeType: unknown;
    sourceSize: unknown;
  }
): Promise<DashboardTutorialFinalizedThumbnailUpload> => {
  const storagePath = typeof args.storagePath === "string" ? args.storagePath.trim() : "";
  if (!isDashboardTutorialThumbnailStoragePath(storagePath)) {
    throw new DashboardTutorialAssetError(400, "Invalid thumbnail storage path.");
  }

  const declaredMimeType = validateDeclaredUpload({
    sourceMimeType: args.sourceMimeType,
    sourceSize: args.sourceSize,
  });
  const { data: downloaded, error: downloadError } = await supabaseAdmin.storage
    .from(DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET)
    .download(storagePath);

  if (downloadError || !downloaded) {
    throwStorageOperationError(downloadError, "Unable to verify thumbnail upload.");
  }
  const uploadedObject = downloaded as NonNullable<typeof downloaded>;

  const objectSize = uploadedObject.size;
  if (objectSize <= 0) {
    throw new DashboardTutorialAssetError(400, "Thumbnail upload is empty.");
  }
  if (objectSize > DASHBOARD_TUTORIAL_THUMBNAIL_MAX_BYTES) {
    throw new DashboardTutorialAssetError(413, "Thumbnail file is too large.");
  }

  const bytes = new Uint8Array(await uploadedObject.arrayBuffer());
  const detectedMimeType = detectMimeType(bytes);
  if (!detectedMimeType || !isCompatibleDetectedMimeType({ declaredMimeType, detectedMimeType })) {
    throw new DashboardTutorialAssetError(
      400,
      "Thumbnail file content does not match its file type."
    );
  }

  const signedUrl = await signDashboardTutorialThumbnailUrl(supabaseAdmin, storagePath);
  return {
    storagePath,
    signedUrl,
    mimeType: detectedMimeType,
    mediaType: resolveMediaType(detectedMimeType),
    fileSizeBytes: objectSize,
  };
};

/**
 * Creates a signed original URL for one stored tutorial thumbnail.
 */
export const signDashboardTutorialThumbnailUrl = async (
  supabaseAdmin: SupabaseAdminClient,
  storagePath: string
): Promise<string> => {
  if (!isDashboardTutorialThumbnailStoragePath(storagePath)) {
    throw new DashboardTutorialAssetError(400, "Invalid thumbnail storage path.");
  }
  const { data, error } = await supabaseAdmin.storage
    .from(DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET)
    .createSignedUrl(storagePath, DASHBOARD_TUTORIAL_THUMBNAIL_SIGNED_URL_TTL_SECONDS);

  if (error || !data || !data.signedUrl) {
    throwStorageOperationError(error, "Unable to sign thumbnail URL.");
  }
  const signedUrlData = data as NonNullable<typeof data>;

  return signedUrlData.signedUrl;
};
