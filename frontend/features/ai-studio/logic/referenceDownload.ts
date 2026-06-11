/**
 * Download helpers for AI Studio reference assets.
 * Keeps storage/generation lookup and browser download behavior isolated from hooks.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  resolveGeneratedMediaFileRecordById,
  resolveGenerationIdForRequestId,
  resolveLatestPublishedGenerationMediaFile,
} from "./generatedMediaAuthority";
import type { StudioOutput } from "../types";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type GenerationOutputRow = {
  id?: unknown;
  media_file_id?: unknown;
  output_index?: unknown;
  result_url?: unknown;
};

type MediaFileRow = {
  storage_path?: unknown;
  filename?: unknown;
  preview_storage_path?: unknown;
};

type GenerationPublicationRow = {
  owned_media_file_id?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  preview_url?: unknown;
  full_url?: unknown;
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
const DATA_URL_MIME_TYPE_PATTERN = /^data:([^;,]+)[;,]/i;

const MIME_TYPE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
};

const FALLBACK_EXTENSION_BY_MODE: Partial<Record<StudioOutput["mode"], string>> = {
  image: ".png",
  video: ".mp4",
  audio: ".mp3",
};

export const REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE =
  "Unable to download media from provider URL.";
export const REFERENCE_MISSING_GENERATION_ID_ERROR_MESSAGE =
  "Generated media is missing durable generation tracking.";

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
    const parsed = new URL(url, "https://shortpulse.local");
    const pathnameParts = parsed.pathname.split("/").filter(Boolean);
    const candidate = pathnameParts[pathnameParts.length - 1];
    if (!candidate) return null;
    return sanitizeFilename(decodeURIComponent(candidate));
  } catch {
    return null;
  }
};

const hasFileExtension = (value: string): boolean => FILE_EXTENSION_PATTERN.test(value);

const normalizeMimeType = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized.length ? normalized : null;
};

const extractMimeTypeFromDataUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(DATA_URL_MIME_TYPE_PATTERN);
  return normalizeMimeType(match?.[1] ?? null);
};

const extensionFromMimeType = (value: string | null | undefined): string | null => {
  const mimeType = normalizeMimeType(value);
  if (!mimeType) return null;
  return MIME_TYPE_EXTENSION_BY_TYPE[mimeType] ?? null;
};

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

const toMediaFileRecord = (
  row: MediaFileRow | null | undefined
): ResolvedReferenceDownloadTarget["fileRecord"] => {
  const storagePath = asCanonicalStoragePath(asTrimmedString(row?.storage_path));
  if (!storagePath) return null;
  return {
    storagePath,
    filename: sanitizeFilename(asTrimmedString(row?.filename)),
  };
};

const resolveDirectDownloadUrlCandidates = (
  output: Pick<StudioOutput, "resultUrls" | "previewUrl" | "fullStoragePath" | "previewStoragePath">
): string[] => {
  const resultUrls = Array.isArray(output.resultUrls) ? output.resultUrls : [];
  const dedupedCandidates = new Set<string>();
  [
    ...resultUrls.map((value) => resolveDownloadUrlCandidate(value)),
    resolveDownloadUrlCandidate(output.previewUrl),
    resolveDownloadUrlCandidate(output.fullStoragePath),
    resolveDownloadUrlCandidate(output.previewStoragePath),
  ].forEach((candidate) => {
    if (!candidate) return;
    dedupedCandidates.add(candidate);
  });
  return [...dedupedCandidates];
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

const resolveMediaFileById = async (
  supabase: SupabaseClient,
  mediaFileId: string
): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  return await resolveGeneratedMediaFileRecordById({ supabase, mediaFileId });
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
  const row = (Array.isArray(data) ? data[0] : null) as {
    storage_path?: unknown;
    filename?: unknown;
  } | null;
  const storagePath = asCanonicalStoragePath(asTrimmedString(row?.storage_path));
  if (!storagePath) return null;
  return {
    storagePath,
    filename: sanitizeFilename(asTrimmedString(row?.filename)),
  };
};

const resolveLatestMediaFileByCanonicalGenerationOutputs = async (
  supabase: SupabaseClient,
  generationId: string
): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const { data, error } = await supabase
    .from("ai_generation_outputs")
    .select("media_file_id, output_index")
    .eq("generation_id", generationId)
    .order("output_index", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message || "Failed to resolve canonical generated media output.");
  }
  const mediaId =
    (Array.isArray(data) ? data : [])
      .map((row) => {
        const outputRow = row as GenerationOutputRow;
        return asTrimmedString(outputRow.media_file_id);
      })
      .find((value): value is string => Boolean(value)) ?? null;
  if (!mediaId) return null;
  return await resolveMediaFileById(supabase, mediaId);
};

const toPublicationFileRecord = async (
  supabase: SupabaseClient,
  row: GenerationPublicationRow | null | undefined
): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const storagePath =
    asCanonicalStoragePath(asTrimmedString(row?.full_storage_path)) ??
    asCanonicalStoragePath(asTrimmedString(row?.preview_storage_path));
  if (storagePath) {
    return {
      storagePath,
      filename: null,
    };
  }
  const mediaFileId = asTrimmedString(row?.owned_media_file_id);
  if (!mediaFileId) return null;
  return await resolveMediaFileById(supabase, mediaFileId);
};

const resolvePublishedGenerationMediaFileByUrlCandidates = async ({
  supabase,
  generationId,
  urlCandidates,
}: {
  supabase: SupabaseClient;
  generationId: string;
  urlCandidates: string[];
}): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const { data, error } = await supabase
    .from("generation_publications")
    .select("owned_media_file_id, preview_storage_path, full_storage_path, preview_url, full_url")
    .eq("generation_id", generationId)
    .eq("publication_state", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message || "Failed to resolve published generation media.");
  }
  const rows = (Array.isArray(data) ? data : []) as GenerationPublicationRow[];
  if (!rows.length) return null;
  const candidateSet = new Set(urlCandidates);
  for (const row of rows) {
    const previewUrl = asTrimmedString(row.preview_url);
    const fullUrl = asTrimmedString(row.full_url);
    if (!candidateSet.has(previewUrl ?? "") && !candidateSet.has(fullUrl ?? "")) continue;
    return await toPublicationFileRecord(supabase, row);
  }
  if (rows.length === 1) {
    return await toPublicationFileRecord(supabase, rows[0]);
  }
  return null;
};

const resolveCanonicalGeneratedFileRecordByUrlCandidates = async ({
  supabase,
  generationId,
  urlCandidates,
}: {
  supabase: SupabaseClient;
  generationId: string;
  urlCandidates: string[];
}): Promise<ResolvedReferenceDownloadTarget["fileRecord"]> => {
  const { data, error } = await supabase
    .from("ai_generation_outputs")
    .select("media_file_id, output_index, result_url")
    .eq("generation_id", generationId)
    .order("output_index", { ascending: true })
    .limit(50);
  if (error) {
    throw new Error(error.message || "Failed to resolve canonical generated media output.");
  }
  const rows = (Array.isArray(data) ? data : []) as GenerationOutputRow[];
  if (!rows.length) return null;
  const candidateSet = new Set(urlCandidates);
  for (const row of rows) {
    const resultUrl = asTrimmedString(row.result_url);
    if (!candidateSet.has(resultUrl ?? "")) continue;
    const mediaId = asTrimmedString(row.media_file_id);
    if (!mediaId) return null;
    return await resolveMediaFileById(supabase, mediaId);
  }
  if (rows.length === 1) {
    const mediaId = asTrimmedString(rows[0]?.media_file_id);
    if (!mediaId) return null;
    return await resolveMediaFileById(supabase, mediaId);
  }
  return null;
};

/**
 * Resolve the best available storage-backed download target for a reference output.
 */
export const resolveReferenceDownloadTarget = async ({
  output,
  supabase,
  projectId,
}: {
  output: Pick<
    StudioOutput,
    | "savedMediaIds"
    | "generationId"
    | "taskId"
    | "mediaSource"
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
  >;
  supabase: SupabaseClient;
  projectId?: string | null;
}): Promise<ResolvedReferenceDownloadTarget> => {
  const directUrlCandidates = resolveDirectDownloadUrlCandidates(output);
  const directUrl = directUrlCandidates[0] ?? null;
  const generationId =
    asTrimmedString(output.generationId) ??
    (await resolveGenerationIdForRequestId({
      supabase,
      requestId: asTrimmedString(output.taskId),
      projectId,
    }));
  const shouldPreferCanonicalGeneratedOutputs =
    output.mediaSource === "generated" && Boolean(generationId);

  if (shouldPreferCanonicalGeneratedOutputs && generationId) {
    let publicationFileRecord: ResolvedReferenceDownloadTarget["fileRecord"] = null;
    try {
      publicationFileRecord = directUrlCandidates.length
        ? await resolvePublishedGenerationMediaFileByUrlCandidates({
            supabase,
            generationId,
            urlCandidates: directUrlCandidates,
          })
        : await resolveLatestPublishedGenerationMediaFile({
            supabase,
            generationId,
          });
    } catch {
      publicationFileRecord = null;
    }
    if (publicationFileRecord) {
      return {
        fileRecord: publicationFileRecord,
        generationId,
        directUrl,
      };
    }

    let canonicalGeneratedFileRecord: ResolvedReferenceDownloadTarget["fileRecord"] = null;
    try {
      canonicalGeneratedFileRecord = directUrlCandidates.length
        ? await resolveCanonicalGeneratedFileRecordByUrlCandidates({
            supabase,
            generationId,
            urlCandidates: directUrlCandidates,
          })
        : await resolveLatestMediaFileByCanonicalGenerationOutputs(supabase, generationId);
    } catch {
      canonicalGeneratedFileRecord = null;
    }
    if (canonicalGeneratedFileRecord) {
      return {
        fileRecord: canonicalGeneratedFileRecord,
        generationId,
        directUrl,
      };
    }
  }

  const outputStorageFileRecord = resolveOutputStorageFileRecord(output);
  if (outputStorageFileRecord) {
    return {
      fileRecord: outputStorageFileRecord,
      generationId: null,
      directUrl,
    };
  }

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

  if (!generationId) {
    return {
      fileRecord: null,
      generationId: null,
      directUrl,
    };
  }

  if (!shouldPreferCanonicalGeneratedOutputs) {
    let publicationFileRecord: ResolvedReferenceDownloadTarget["fileRecord"] = null;
    try {
      publicationFileRecord = directUrlCandidates.length
        ? await resolvePublishedGenerationMediaFileByUrlCandidates({
            supabase,
            generationId,
            urlCandidates: directUrlCandidates,
          })
        : await resolveLatestPublishedGenerationMediaFile({
            supabase,
            generationId,
          });
    } catch {
      publicationFileRecord = null;
    }
    if (publicationFileRecord) {
      return {
        fileRecord: publicationFileRecord,
        generationId,
        directUrl,
      };
    }

    let canonicalGeneratedFileRecord: ResolvedReferenceDownloadTarget["fileRecord"] = null;
    try {
      canonicalGeneratedFileRecord = directUrlCandidates.length
        ? await resolveCanonicalGeneratedFileRecordByUrlCandidates({
            supabase,
            generationId,
            urlCandidates: directUrlCandidates,
          })
        : await resolveLatestMediaFileByCanonicalGenerationOutputs(supabase, generationId);
    } catch {
      canonicalGeneratedFileRecord = null;
    }
    if (canonicalGeneratedFileRecord) {
      return {
        fileRecord: canonicalGeneratedFileRecord,
        generationId,
        directUrl,
      };
    }
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
  storagePath,
  mimeType,
  mode,
}: {
  preferredFilename?: string | null;
  prompt?: string | null;
  outputId?: string | null;
  previewUrl?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  mode?: StudioOutput["mode"] | null;
}): string => {
  const preferred = sanitizeFilename(preferredFilename);
  const baseName =
    preferred ?? sanitizeFilename(prompt) ?? sanitizeFilename(outputId) ?? "reference";
  if (hasFileExtension(baseName)) return baseName;

  const extension =
    extractExtension(storagePath ?? undefined) ??
    extractExtension(extractFilenameFromUrl(previewUrl) ?? undefined) ??
    extractExtension(previewUrl ?? undefined) ??
    extensionFromMimeType(extractMimeTypeFromDataUrl(previewUrl)) ??
    extensionFromMimeType(mimeType) ??
    (mode ? (FALLBACK_EXTENSION_BY_MODE[mode] ?? null) : null);
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
