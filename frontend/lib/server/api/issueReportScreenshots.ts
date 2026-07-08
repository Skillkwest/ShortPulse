/**
 * Server helpers for customer issue-report screenshot evidence.
 * Owns private storage path validation, signed uploads, object verification, and admin signing.
 */
import { randomUUID } from "crypto";
import {
  ISSUE_REPORT_SCREENSHOT_BUCKET,
  ISSUE_REPORT_SCREENSHOT_FILENAME_MAX_LENGTH,
  ISSUE_REPORT_SCREENSHOT_MAX_BYTES,
  ISSUE_REPORT_SCREENSHOT_MAX_COUNT,
  ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_AGE_MS,
  ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_LIMIT,
  ISSUE_REPORT_SCREENSHOT_SIGNED_URL_TTL_SECONDS,
  isIssueReportScreenshotMimeType,
  type IssueReportScreenshotMimeType,
} from "../../issueReports";
import { extractImageDimensionsFromBuffer } from "../imageDimensions";
import { detectImageMimeType } from "../uploadSignature";
import type { getSupabaseAdmin } from "./supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type IssueReportScreenshotStorageObject = {
  name?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  last_accessed_at?: unknown;
};

export type PreparedIssueReportScreenshotUpload = {
  storagePath: string;
  uploadToken: string;
  mimeType: IssueReportScreenshotMimeType;
  maxBytes: number;
};

export type IssueReportScreenshotSubmission = {
  storagePath: string;
  sourceName: string;
  sourceMimeType: string;
  sourceSize: number;
};

export type VerifiedIssueReportScreenshot = {
  storagePath: string;
  originalFilename: string;
  contentType: IssueReportScreenshotMimeType;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
};

export type AdminIssueReportScreenshotPayload = {
  id: string;
  storage_path: string;
  signed_url: string | null;
  unavailable_reason: string | null;
  original_filename: string;
  content_type: IssueReportScreenshotMimeType;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  display_order: number;
  created_at: string;
};

export class IssueReportScreenshotError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MIME_TYPE_TO_EXTENSION: Record<IssueReportScreenshotMimeType, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const STORAGE_SETUP_DETAILS =
  "Apply sql/migrations/212_add_issue_report_screenshots.sql in this environment.";

const asPositiveSafeInteger = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
  return numeric;
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

const throwStorageOperationError = (error: unknown, fallback: string): never => {
  if (isMissingBucketStorageError(error)) {
    throw new IssueReportScreenshotError(
      503,
      "Issue screenshot storage is not ready.",
      STORAGE_SETUP_DETAILS
    );
  }
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  throw new Error(message || fallback);
};

const normalizeMimeType = (value: unknown): IssueReportScreenshotMimeType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isIssueReportScreenshotMimeType(normalized) ? normalized : null;
};

const sanitizeFilename = (value: unknown): string => {
  if (typeof value !== "string") return "screenshot";
  const normalized = value.trim().replace(/[\\/]/g, "-").replace(/\s+/g, " ");
  return normalized.slice(0, ISSUE_REPORT_SCREENSHOT_FILENAME_MAX_LENGTH) || "screenshot";
};

const validateDeclaredUpload = ({
  sourceMimeType,
  sourceSize,
}: {
  sourceMimeType: unknown;
  sourceSize: unknown;
}): IssueReportScreenshotMimeType => {
  const mimeType = normalizeMimeType(sourceMimeType);
  if (!mimeType) {
    throw new IssueReportScreenshotError(
      400,
      "Unsupported screenshot file type.",
      "Use PNG, JPEG, WebP, or GIF."
    );
  }

  const size = asPositiveSafeInteger(sourceSize);
  if (!size) {
    throw new IssueReportScreenshotError(400, "Screenshot file size is required.");
  }
  if (size > ISSUE_REPORT_SCREENSHOT_MAX_BYTES) {
    throw new IssueReportScreenshotError(413, "Screenshot file is too large.");
  }

  return mimeType;
};

export const isIssueReportScreenshotStoragePath = (
  value: unknown,
  userId?: string | null
): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized !== value || !normalized.startsWith("issue-reports/")) return false;
  if (normalized.includes("..") || normalized.includes("//") || normalized.includes("\\")) {
    return false;
  }
  const parts = normalized.split("/");
  if (parts.length !== 3) return false;
  if (userId && parts[1] !== userId) return false;
  return /^[0-9a-f-]{36}$/i.test(parts[1]) && /^[0-9a-f-]{36}\.(gif|jpg|png|webp)$/i.test(parts[2]);
};

/**
 * Creates one signed Supabase upload target for a report screenshot.
 */
export const prepareIssueReportScreenshotUpload = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    userId: string;
    sourceMimeType: unknown;
    sourceSize: unknown;
  }
): Promise<PreparedIssueReportScreenshotUpload> => {
  const mimeType = validateDeclaredUpload({
    sourceMimeType: args.sourceMimeType,
    sourceSize: args.sourceSize,
  });
  const extension = MIME_TYPE_TO_EXTENSION[mimeType];
  const storagePath = `issue-reports/${args.userId}/${randomUUID()}.${extension}`;
  const { data, error } = await supabaseAdmin.storage
    .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data || !data.path || !data.token) {
    throwStorageOperationError(error, "Unable to prepare screenshot upload.");
  }
  const target = data as NonNullable<typeof data>;
  if (target.path !== storagePath) {
    throwStorageOperationError(
      { message: "Signed upload target path did not match requested storage path." },
      "Unable to prepare screenshot upload."
    );
  }

  return {
    storagePath: target.path,
    uploadToken: target.token,
    mimeType,
    maxBytes: ISSUE_REPORT_SCREENSHOT_MAX_BYTES,
  };
};

/**
 * Validates one submitted screenshot descriptor before object verification.
 */
export const normalizeIssueReportScreenshotSubmissions = (
  value: unknown
): IssueReportScreenshotSubmission[] => {
  if (typeof value === "undefined" || value === null) return [];
  if (!Array.isArray(value)) {
    throw new IssueReportScreenshotError(400, "Issue report screenshots must be an array.");
  }
  if (value.length > ISSUE_REPORT_SCREENSHOT_MAX_COUNT) {
    throw new IssueReportScreenshotError(
      400,
      `Issue reports can include up to ${ISSUE_REPORT_SCREENSHOT_MAX_COUNT} screenshots.`
    );
  }

  const seenPaths = new Set<string>();
  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const storagePath = typeof record?.storagePath === "string" ? record.storagePath.trim() : "";
    const sourceName = sanitizeFilename(record?.sourceName);
    const sourceMimeType = typeof record?.sourceMimeType === "string" ? record.sourceMimeType : "";
    const sourceSize = asPositiveSafeInteger(record?.sourceSize);

    if (!storagePath || seenPaths.has(storagePath)) {
      throw new IssueReportScreenshotError(400, "Invalid screenshot upload reference.");
    }
    if (!sourceSize) {
      throw new IssueReportScreenshotError(400, "Screenshot file size is required.");
    }
    validateDeclaredUpload({ sourceMimeType, sourceSize });
    seenPaths.add(storagePath);

    return {
      storagePath,
      sourceName,
      sourceMimeType,
      sourceSize,
    };
  });
};

/**
 * Downloads and verifies a prepared screenshot object before it can attach to a report.
 */
export const verifyIssueReportScreenshotUpload = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    userId: string;
    submission: IssueReportScreenshotSubmission;
  }
): Promise<VerifiedIssueReportScreenshot> => {
  if (!isIssueReportScreenshotStoragePath(args.submission.storagePath, args.userId)) {
    throw new IssueReportScreenshotError(400, "Invalid screenshot upload reference.");
  }
  const declaredMimeType = validateDeclaredUpload({
    sourceMimeType: args.submission.sourceMimeType,
    sourceSize: args.submission.sourceSize,
  });
  const { data: downloaded, error: downloadError } = await supabaseAdmin.storage
    .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
    .download(args.submission.storagePath);

  if (downloadError || !downloaded) {
    throwStorageOperationError(downloadError, "Unable to verify screenshot upload.");
  }

  const uploadedObject = downloaded as NonNullable<typeof downloaded>;
  const objectSize = uploadedObject.size;
  if (objectSize <= 0) {
    throw new IssueReportScreenshotError(400, "Screenshot upload is empty.");
  }
  if (objectSize > ISSUE_REPORT_SCREENSHOT_MAX_BYTES) {
    throw new IssueReportScreenshotError(413, "Screenshot file is too large.");
  }
  if (objectSize !== args.submission.sourceSize) {
    throw new IssueReportScreenshotError(400, "Screenshot upload size did not match.");
  }

  const bytes = Buffer.from(await uploadedObject.arrayBuffer());
  const detectedMimeType = detectImageMimeType(bytes);
  if (detectedMimeType !== declaredMimeType || !isIssueReportScreenshotMimeType(detectedMimeType)) {
    throw new IssueReportScreenshotError(
      400,
      "Screenshot file content does not match its file type."
    );
  }

  const dimensions = extractImageDimensionsFromBuffer(bytes);

  return {
    storagePath: args.submission.storagePath,
    originalFilename: args.submission.sourceName,
    contentType: detectedMimeType,
    fileSizeBytes: objectSize,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
};

/**
 * Removes uploaded screenshot objects after a failed final report submission.
 */
export const cleanupIssueReportScreenshotUploads = async (
  supabaseAdmin: SupabaseAdminClient,
  storagePaths: string[],
  userId?: string | null
): Promise<void> => {
  const paths = storagePaths.filter((path) => isIssueReportScreenshotStoragePath(path, userId));
  if (!paths.length) return;
  await supabaseAdmin.storage.from(ISSUE_REPORT_SCREENSHOT_BUCKET).remove(paths);
};

const parseStorageTimestamp = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Removes old prepared screenshot objects that were uploaded but never attached to a report.
 */
export const cleanupStaleIssueReportScreenshotUploadsForUser = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    userId: string;
    nowMs?: number;
    minAgeMs?: number;
    limit?: number;
  }
): Promise<{ scanned: number; removed: number }> => {
  const nowMs = Number.isFinite(args.nowMs) ? Number(args.nowMs) : Date.now();
  const minAgeMs = Number.isFinite(args.minAgeMs)
    ? Math.max(0, Number(args.minAgeMs))
    : ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_AGE_MS;
  const limit = Number.isFinite(args.limit)
    ? Math.max(1, Math.trunc(Number(args.limit)))
    : ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_LIMIT;
  const folder = `issue-reports/${args.userId}`;
  const { data, error } = await supabaseAdmin.storage
    .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
    .list(folder, {
      limit,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (error) {
    throwStorageOperationError(error, "Unable to list issue screenshot uploads.");
  }

  const cutoffMs = nowMs - minAgeMs;
  const candidatePaths = (Array.isArray(data) ? (data as IssueReportScreenshotStorageObject[]) : [])
    .map((object) => {
      const name = typeof object.name === "string" ? object.name.trim() : "";
      if (!name) return null;
      const storagePath = `${folder}/${name}`;
      if (!isIssueReportScreenshotStoragePath(storagePath, args.userId)) return null;
      const timestampMs =
        parseStorageTimestamp(object.created_at) ??
        parseStorageTimestamp(object.updated_at) ??
        parseStorageTimestamp(object.last_accessed_at);
      if (timestampMs === null || timestampMs > cutoffMs) return null;
      return storagePath;
    })
    .filter((path): path is string => Boolean(path));

  if (!candidatePaths.length) {
    return { scanned: Array.isArray(data) ? data.length : 0, removed: 0 };
  }

  const { data: referencedRows, error: referencedError } = await supabaseAdmin
    .from("user_issue_report_screenshots")
    .select("storage_path")
    .in("storage_path", candidatePaths);

  if (referencedError) {
    throw referencedError;
  }

  const referencedPaths = new Set(
    (Array.isArray(referencedRows) ? referencedRows : [])
      .map((row) =>
        row && typeof row === "object" && "storage_path" in row
          ? String((row as { storage_path?: unknown }).storage_path ?? "")
          : ""
      )
      .filter(Boolean)
  );
  const stalePaths = candidatePaths.filter((path) => !referencedPaths.has(path));
  if (!stalePaths.length) {
    return { scanned: Array.isArray(data) ? data.length : 0, removed: 0 };
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
    .remove(stalePaths);
  if (removeError) {
    throwStorageOperationError(removeError, "Unable to remove stale issue screenshot uploads.");
  }

  return { scanned: Array.isArray(data) ? data.length : 0, removed: stalePaths.length };
};

/**
 * Creates a signed admin-display URL for one private screenshot object.
 */
export const signIssueReportScreenshotUrl = async (
  supabaseAdmin: SupabaseAdminClient,
  storagePath: string
): Promise<string> => {
  if (!isIssueReportScreenshotStoragePath(storagePath)) {
    throw new IssueReportScreenshotError(400, "Invalid screenshot storage path.");
  }
  const { data, error } = await supabaseAdmin.storage
    .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
    .createSignedUrl(storagePath, ISSUE_REPORT_SCREENSHOT_SIGNED_URL_TTL_SECONDS);

  const signedUrl = typeof data?.signedUrl === "string" ? data.signedUrl : null;
  if (error) {
    throwStorageOperationError(error, "Unable to sign screenshot URL.");
  }
  if (!signedUrl) {
    throw new IssueReportScreenshotError(500, "Unable to sign screenshot URL.");
  }

  return signedUrl;
};

type ScreenshotRow = {
  id?: unknown;
  report_id?: unknown;
  storage_path?: unknown;
  original_filename?: unknown;
  content_type?: unknown;
  file_size_bytes?: unknown;
  width?: unknown;
  height?: unknown;
  display_order?: unknown;
  created_at?: unknown;
};

type ScreenshotSignErrorContext = {
  error: unknown;
  reportId: string;
  screenshotId: string;
  storagePath: string;
};

type LoadIssueReportScreenshotsOptions = {
  onSignError?: (context: ScreenshotSignErrorContext) => Promise<void> | void;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

/**
 * Loads signed screenshot payloads for admin report API responses.
 */
export const loadIssueReportScreenshotsByReportId = async (
  supabaseAdmin: SupabaseAdminClient,
  reportIds: string[],
  options: LoadIssueReportScreenshotsOptions = {}
): Promise<Map<string, AdminIssueReportScreenshotPayload[]>> => {
  const ids = Array.from(new Set(reportIds.filter(Boolean)));
  const screenshotsByReportId = new Map<string, AdminIssueReportScreenshotPayload[]>();
  if (!ids.length) return screenshotsByReportId;

  const { data, error } = await supabaseAdmin
    .from("user_issue_report_screenshots")
    .select(
      "id, report_id, storage_path, original_filename, content_type, file_size_bytes, width, height, display_order, created_at"
    )
    .in("report_id", ids)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? (data as ScreenshotRow[]) : [];
  await Promise.all(
    rows.map(async (row) => {
      const reportId = typeof row.report_id === "string" ? row.report_id : "";
      const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
      const contentType = normalizeMimeType(row.content_type);
      if (!reportId || !storagePath || !contentType) return;
      const screenshotId = String(row.id ?? "");
      let signedUrl: string | null = null;
      let unavailableReason: string | null = null;
      try {
        signedUrl = await signIssueReportScreenshotUrl(supabaseAdmin, storagePath);
      } catch (error) {
        unavailableReason = "Screenshot file is unavailable.";
        await options.onSignError?.({
          error,
          reportId,
          screenshotId,
          storagePath,
        });
      }
      const payload: AdminIssueReportScreenshotPayload = {
        id: screenshotId,
        storage_path: storagePath,
        signed_url: signedUrl,
        unavailable_reason: unavailableReason,
        original_filename: String(row.original_filename ?? "screenshot"),
        content_type: contentType,
        file_size_bytes: Number(row.file_size_bytes ?? 0),
        width: toNumberOrNull(row.width),
        height: toNumberOrNull(row.height),
        display_order: Number(row.display_order ?? 0),
        created_at: String(row.created_at ?? ""),
      };
      const existing = screenshotsByReportId.get(reportId) ?? [];
      existing.push(payload);
      screenshotsByReportId.set(reportId, existing);
    })
  );

  return screenshotsByReportId;
};
