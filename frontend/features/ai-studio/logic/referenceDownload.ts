/**
 * Download helpers for AI Studio reference assets.
 * Keeps storage/generation lookup and browser download behavior isolated from hooks.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import type { StudioOutput } from "../types";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type MediaFileRow = {
  storage_path?: unknown;
  filename?: unknown;
};

type GenerationRow = {
  id?: unknown;
};

export type ResolvedReferenceDownloadTarget = {
  fileRecord: {
    storagePath: string;
    filename: string | null;
  } | null;
  generationId: string | null;
  directUrl: string | null;
};

const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g;
const FILE_EXTENSION_PATTERN = /\.([a-z0-9]{1,8})$/i;
const DEFAULT_PROVIDER_DOWNLOAD_TIMEOUT_MS = 10000;
const MIN_PROVIDER_DOWNLOAD_TIMEOUT_MS = 1000;
const MAX_PROVIDER_DOWNLOAD_TIMEOUT_MS = 60000;
const HTTP_LIKE_PATTERN = /^https?:\/\//i;
const DATA_LIKE_PATTERN = /^data:(image|video)\//i;
const BLOB_LIKE_PATTERN = /^blob:/i;
const ROOT_RELATIVE_PATTERN = /^\//;
const NEXT_IMAGE_PATH_PATTERN = /(?:^|\/)_next\/image(?:$|\?)/i;

export const REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE =
  "Unable to download media from provider URL.";

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const sanitizeFilename = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const safe = trimmed
    .replace(INVALID_FILENAME_CHARACTERS, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return safe.length ? safe : null;
};

const extractExtension = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(FILE_EXTENSION_PATTERN);
  if (!match?.[1]) return null;
  return `.${match[1].toLowerCase()}`;
};

const extractFilenameFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathnameParts = parsed.pathname.split("/").filter(Boolean);
    const candidate = pathnameParts[pathnameParts.length - 1];
    if (!candidate) return null;
    return sanitizeFilename(decodeURIComponent(candidate));
  } catch {
    return null;
  }
};

const hasFileExtension = (value: string): boolean => FILE_EXTENSION_PATTERN.test(value);

const isRenderableDownloadUrl = (value: string): boolean =>
  HTTP_LIKE_PATTERN.test(value) ||
  DATA_LIKE_PATTERN.test(value) ||
  BLOB_LIKE_PATTERN.test(value) ||
  ROOT_RELATIVE_PATTERN.test(value);

const toRenderableDownloadUrl = (value: unknown): string | null => {
  const trimmed = asTrimmedString(value);
  if (!trimmed || !isRenderableDownloadUrl(trimmed)) return null;
  return trimmed;
};

const resolveNextImageOptimizerSourceUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!NEXT_IMAGE_PATH_PATTERN.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, "https://shortpulse.local");
    const source = parsed.searchParams.get("url")?.trim() ?? "";
    if (!source) return null;
    return source;
  } catch {
    return null;
  }
};

const resolveDownloadUrlCandidate = (value: unknown): string | null => {
  const renderable = toRenderableDownloadUrl(value);
  if (!renderable) return null;
  const optimizerSource = resolveNextImageOptimizerSourceUrl(renderable);
  if (optimizerSource) {
    return toRenderableDownloadUrl(optimizerSource) ?? optimizerSource;
  }
  return renderable;
};

const clampProviderDownloadTimeoutMs = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_PROVIDER_DOWNLOAD_TIMEOUT_MS;
  const rounded = Math.trunc(value as number);
  if (rounded < MIN_PROVIDER_DOWNLOAD_TIMEOUT_MS) return MIN_PROVIDER_DOWNLOAD_TIMEOUT_MS;
  if (rounded > MAX_PROVIDER_DOWNLOAD_TIMEOUT_MS) return MAX_PROVIDER_DOWNLOAD_TIMEOUT_MS;
  return rounded;
};

const toMediaFileRecord = (row: MediaFileRow | null | undefined) => {
  const storagePath = asCanonicalStoragePath(asTrimmedString(row?.storage_path));
  if (!storagePath) return null;
  return {
    storagePath,
    filename: sanitizeFilename(asTrimmedString(row?.filename)),
  };
};

const resolveOutputStorageFileRecord = (
  output: Pick<StudioOutput, "previewStoragePath" | "fullStoragePath">
): ResolvedReferenceDownloadTarget["fileRecord"] => {
  const storagePath =
    asCanonicalStoragePath(asTrimmedString(output.fullStoragePath)) ??
    asCanonicalStoragePath(asTrimmedString(output.previewStoragePath));
  if (!storagePath) return null;
  return {
    storagePath,
    filename: null,
  };
};

const resolveDirectDownloadUrl = (
  output: Pick<StudioOutput, "resultUrls" | "previewUrl" | "fullStoragePath" | "previewStoragePath">
): string | null => {
  const resultUrls = Array.isArray(output.resultUrls) ? output.resultUrls : [];
  const candidates = [
    ...resultUrls.map((value) => resolveDownloadUrlCandidate(value)),
    resolveDownloadUrlCandidate(output.previewUrl),
    resolveDownloadUrlCandidate(output.fullStoragePath),
    resolveDownloadUrlCandidate(output.previewStoragePath),
  ];
  return candidates.find((value): value is string => Boolean(value)) ?? null;
};

const resolveLatestMediaFileBySavedIds = async (
  supabase: SupabaseClient,
  savedMediaIds: string[]
): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const ids = savedMediaIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return null;
  const { data, error } = await supabase
    .from("media_files")
    .select("storage_path, filename, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(error.message || "Failed to resolve media file for saved reference.");
  }
  const row = (Array.isArray(data) ? data[0] : null) as MediaFileRow | null;
  return toMediaFileRecord(row);
};

const resolveLatestMediaFileByGenerationId = async (
  supabase: SupabaseClient,
  generationId: string
): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const { data, error } = await supabase
    .from("media_files")
    .select("storage_path, filename, created_at")
    .eq("source_ref", generationId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(error.message || "Failed to resolve generated media file.");
  }
  const row = (Array.isArray(data) ? data[0] : null) as MediaFileRow | null;
  return toMediaFileRecord(row);
};

const resolveGenerationIdByTaskId = async (
  supabase: SupabaseClient,
  taskId: string
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("ai_generations")
    .select("id, created_at")
    .eq("request_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(error.message || "Failed to resolve generation for download.");
  }
  const row = (Array.isArray(data) ? data[0] : null) as GenerationRow | null;
  return asTrimmedString(row?.id);
};

/**
 * Resolve the best available storage-backed download target for a reference output.
 */
export const resolveReferenceDownloadTarget = async ({
  output,
  supabase,
}: {
  output: Pick<
    StudioOutput,
    | "savedMediaIds"
    | "generationId"
    | "taskId"
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
  >;
  supabase: SupabaseClient;
}): Promise<ResolvedReferenceDownloadTarget> => {
  const directUrl = resolveDirectDownloadUrl(output);
  const savedFileRecord = await resolveLatestMediaFileBySavedIds(
    supabase,
    output.savedMediaIds ?? []
  );
  if (savedFileRecord) {
    return {
      fileRecord: savedFileRecord,
      generationId: null,
      directUrl,
    };
  }

  const outputStorageFileRecord = resolveOutputStorageFileRecord(output);
  if (outputStorageFileRecord) {
    return {
      fileRecord: outputStorageFileRecord,
      generationId: null,
      directUrl,
    };
  }

  let generationId = asTrimmedString(output.generationId);
  const taskId = asTrimmedString(output.taskId);
  if (!generationId && taskId) {
    generationId = await resolveGenerationIdByTaskId(supabase, taskId);
  }
  if (!generationId) {
    return {
      fileRecord: null,
      generationId: null,
      directUrl,
    };
  }

  const generatedFileRecord = await resolveLatestMediaFileByGenerationId(supabase, generationId);
  return {
    fileRecord: generatedFileRecord,
    generationId,
    directUrl,
  };
};

/**
 * Resolve a stable filename for browser downloads.
 */
export const resolveReferenceDownloadFilename = ({
  preferredFilename,
  prompt,
  outputId,
  previewUrl,
}: {
  preferredFilename?: string | null;
  prompt?: string | null;
  outputId?: string | null;
  previewUrl?: string | null;
}): string => {
  const preferred = sanitizeFilename(preferredFilename);
  if (preferred) return preferred;

  const baseName = sanitizeFilename(prompt) ?? sanitizeFilename(outputId) ?? "reference";
  if (hasFileExtension(baseName)) return baseName;

  const extension =
    extractExtension(extractFilenameFromUrl(previewUrl) ?? undefined) ??
    extractExtension(previewUrl ?? undefined);
  return extension ? `${baseName}${extension}` : baseName;
};

/**
 * Fetches provider-hosted generated media with explicit timeout + abort semantics.
 */
export const downloadReferenceProviderBlob = async ({
  url,
  timeoutMs,
  fetchImpl,
}: {
  url: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<Blob> => {
  const resolvedFetch = fetchImpl ?? fetch;
  if (typeof resolvedFetch !== "function") {
    throw new Error(REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), clampProviderDownloadTimeoutMs(timeoutMs));

  try {
    const response = await resolvedFetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE);
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error(REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE);
    }
    return blob;
  } catch {
    throw new Error(REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Trigger a browser download from a Blob.
 */
export const downloadBlobToFile = (blob: Blob, filename: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const shouldAttachNode = link instanceof Node;
  link.href = objectUrl;
  link.download = sanitizeFilename(filename) ?? "reference";
  if (shouldAttachNode) {
    document.body.appendChild(link);
  }
  link.click();
  if (shouldAttachNode) {
    link.remove();
  }
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
};

/**
 * Trigger a browser download from a renderable URL.
 */
export const downloadUrlToFile = (url: string, filename: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const resolvedUrl = resolveDownloadUrlCandidate(url);
  if (!resolvedUrl) return false;
  const link = document.createElement("a");
  const shouldAttachNode = link instanceof Node;
  link.href = resolvedUrl;
  link.download = sanitizeFilename(filename) ?? "reference";
  link.rel = "noopener noreferrer";
  if (shouldAttachNode) {
    document.body.appendChild(link);
  }
  link.click();
  if (shouldAttachNode) {
    link.remove();
  }
  return true;
};
