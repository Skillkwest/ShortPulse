/**
 * Media library persistence helpers for AI Studio.
 * Handles Supabase inserts/updates for generations, prompts, and audit events.
 */
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import {
  MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
  isMediaStorageQuotaExceededError,
} from "../../../lib/mediaStorageQuota";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  resolveImageDimensionsFromMetadata,
  withCanonicalImageDimensions,
  type ImageDimensions,
} from "../../../lib/mediaDimensionMetadata";
import {
  resolveGenerationIdForRequestId as resolveGenerationIdForRequestIdFromAuthority,
  resolvePublishedGenerationMediaByIndex,
} from "./generatedMediaAuthority";
import type { StudioMode } from "../types";

type MediaLibraryFileType = "image" | "video" | "audio";

const BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;
const AI_STUDIO_EXISTING_ROW_RETRY_ATTEMPTS = 5;
const AI_STUDIO_EXISTING_ROW_RETRY_DELAY_MS = 120;
const SERVER_COPY_ROUTE = "/api/media/copy-from-url";
export const GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR =
  "Generated media is missing durable generation tracking.";

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

const sanitizeFilename = (value: string) => value.replace(/[^\w.-]+/g, "_");
const URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};

const clampPrompt = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const resolveFileType = (
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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveExtension = (contentType: string | null, url: string) => {
  if (contentType && CONTENT_TYPE_EXTENSION[contentType]) {
    return CONTENT_TYPE_EXTENSION[contentType];
  }
  return extensionFromUrl(url) || "bin";
};

const resolveVideoPreviewVariantCandidatePath = ({
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

const inferVideoPreviewVariantMimeType = (storagePath: string): string | null => {
  const extension = extensionFromUrl(storagePath);
  return VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION[extension] ?? null;
};

const buildFilename = (promptText: string | null | undefined, extension: string, index: number) => {
  const base = sanitizeFilename(clampPrompt(promptText));
  return `${base}-${index + 1}.${extension}`;
};

const resolveSupabaseContext = async () => {
  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) {
    throw new Error("Not signed in");
  }
  return { supabase, userId };
};

const fetchBlobWithTimeout = async (url: string) => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
      }
      const blob = await response.blob();
      const headerType = response.headers.get("content-type");
      const contentType = headerType || blob.type || null;
      return { blob, contentType };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isAbortLike =
        message.includes("aborted") ||
        message.includes("aborterror") ||
        message.includes("timed out");
      if (attempt < FETCH_RETRY_ATTEMPTS && isAbortLike) {
        continue;
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch media.");
};

const sleep = async (ms: number): Promise<void> =>
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, Math.max(0, Math.trunc(ms)));
  });

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

const shouldUseServerCopyFallback = ({
  input,
  error,
}: {
  input: SaveMediaUrlInput;
  error: unknown;
}): boolean => {
  if (!URL_PROTOCOL_PATTERN.test(input.url)) return false;
  if (isBrowserFetchBlockedError(error)) return true;
  return input.source === "ai_studio" && Boolean(input.generationId);
};

const shouldPreferServerCopyForAiStudioVideo = (input: SaveMediaUrlInput): boolean =>
  input.mode === "video" &&
  input.source === "ai_studio" &&
  Boolean(input.generationId) &&
  URL_PROTOCOL_PATTERN.test(input.url) &&
  !input.previewStoragePathHint;

const logProjectAssociationWarning = ({
  projectId,
  entityType,
  entityIds,
  error,
}: {
  projectId: string;
  entityType: "media" | "prompt";
  entityIds: string[];
  error: unknown;
}) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? error)
        : String(error);
  console.warn(`[media/save] project ${entityType} association failed for ${projectId}`, {
    entityIds,
    message,
  });
};

const readImageDimensionsFromBlob = async (blob: Blob): Promise<ImageDimensions | null> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const width = Math.max(1, Math.round(bitmap.width));
      const height = Math.max(1, Math.round(bitmap.height));
      bitmap.close();
      if (width > 0 && height > 0) {
        return { width, height };
      }
    } catch {
      // fallback to HTMLImageElement path below
    }
  }
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return null;
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<ImageDimensions | null>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const width = Math.max(1, Math.round(image.naturalWidth || image.width || 0));
        const height = Math.max(1, Math.round(image.naturalHeight || image.height || 0));
        if (width > 0 && height > 0) {
          resolve({ width, height });
          return;
        }
        resolve(null);
      };
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export type PromptRecordInput = {
  promptText: string;
  mode: StudioMode;
  modelId?: string | null;
  title?: string | null;
  source?: "manual" | "ai_studio" | "agent";
  projectId?: string | null;
};

export type MediaEventInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export type SaveMediaUrlInput = {
  url: string;
  promptText?: string | null;
  mode: StudioMode;
  source: "upload" | "ai_studio";
  fileTypeHint?: MediaLibraryFileType;
  provider?: string | null;
  modelId?: string | null;
  generationId?: string | null;
  promptId?: string | null;
  index: number;
  previewStoragePathHint?: string | null;
  fullStoragePathHint?: string | null;
  previewUrlHint?: string | null;
  fullUrlHint?: string | null;
  posterUrlHint?: string | null;
  metadata?: Record<string, unknown>;
  projectId?: string | null;
};

export type SaveMediaUrlResult = {
  mediaFileId: string | null;
  storagePath: string;
  fileType: MediaLibraryFileType;
  fileSize: number;
  delivery: {
    previewStoragePath: string | null;
    previewPosterStoragePath: string | null;
    fullStoragePath: string | null;
    previewUrl: string | null;
    previewPosterUrl: string | null;
    fullUrl: string | null;
  };
};

export const resolveGenerationIdForRequestId = async (
  requestId: string | null | undefined,
  projectId?: string | null
): Promise<string | null> => {
  const { supabase, userId } = await resolveSupabaseContext();
  return await resolveGenerationIdForRequestIdFromAuthority({
    supabase,
    requestId,
    userId,
    projectId,
  });
};

const normalizeProjectId = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const associateMediaFilesWithProject = async ({
  projectId,
  mediaFileIds,
}: {
  projectId: string;
  mediaFileIds: string[];
}): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedMediaFileIds = Array.from(
    new Set(
      mediaFileIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
  if (!normalizedProjectId || normalizedMediaFileIds.length === 0) return;
  const { supabase, userId } = await resolveSupabaseContext();
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("project_media_items").upsert(
    normalizedMediaFileIds.map((mediaFileId) => ({
      project_id: normalizedProjectId,
      media_file_id: mediaFileId,
      user_id: userId,
      updated_at: nowIso,
    })),
    {
      onConflict: "project_id,media_file_id",
    }
  );
  if (error) {
    throw error;
  }
};

export const associatePromptWithProject = async ({
  projectId,
  promptId,
}: {
  projectId: string;
  promptId: string;
}): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedPromptId = typeof promptId === "string" ? promptId.trim() : "";
  if (!normalizedProjectId || !normalizedPromptId) return;
  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase.from("project_prompt_items").upsert(
    {
      project_id: normalizedProjectId,
      prompt_id: normalizedPromptId,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "project_id,prompt_id",
    }
  );
  if (error) {
    throw error;
  }
};

export const associateGenerationWithProject = async ({
  projectId,
  generationId,
}: {
  projectId: string;
  generationId: string;
}): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedGenerationId = typeof generationId === "string" ? generationId.trim() : "";
  if (!normalizedProjectId || !normalizedGenerationId) return;
  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase.from("project_generation_items").upsert(
    {
      project_id: normalizedProjectId,
      generation_id: normalizedGenerationId,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "project_id,generation_id",
    }
  );
  if (error) {
    throw error;
  }
};

const parseServerCopyResult = (value: unknown): SaveMediaUrlResult | null => {
  const row = asRecord(value);
  const deliveryRecord = asRecord(row.delivery);
  const storagePath = asOptionalString(row.storagePath);
  if (!storagePath) return null;
  const fileTypeRaw = asOptionalString(row.fileType)?.toLowerCase();
  if (fileTypeRaw !== "image" && fileTypeRaw !== "video" && fileTypeRaw !== "audio") return null;
  return {
    mediaFileId: asOptionalString(row.mediaFileId),
    storagePath,
    fileType: fileTypeRaw as MediaLibraryFileType,
    fileSize: Number.isFinite(Number(row.fileSize)) ? Number(row.fileSize) : 0,
    delivery: {
      previewStoragePath: asOptionalString(deliveryRecord.previewStoragePath),
      previewPosterStoragePath: asOptionalString(deliveryRecord.previewPosterStoragePath),
      fullStoragePath: asOptionalString(deliveryRecord.fullStoragePath),
      previewUrl: asOptionalString(deliveryRecord.previewUrl),
      previewPosterUrl: asOptionalString(deliveryRecord.previewPosterUrl),
      fullUrl: asOptionalString(deliveryRecord.fullUrl),
    },
  };
};

const saveMediaUrlToLibraryViaServerCopy = async (
  input: SaveMediaUrlInput
): Promise<SaveMediaUrlResult> => {
  const response = await fetchWithAuth(SERVER_COPY_ROUTE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    shortpulseLogScope: "generation",
    shortpulseSkipErrorLogging: true,
    shortpulseRetryNetworkOnce: true,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const payloadRecord = asRecord(payload);
    const message =
      asOptionalString(payloadRecord.error) ??
      asOptionalString(payloadRecord.details) ??
      `Unable to save media (${response.status}).`;
    throw new Error(message);
  }
  const parsed = parseServerCopyResult(payload);
  if (!parsed) {
    throw new Error("Server copy did not return a valid media payload.");
  }
  if (!parsed.mediaFileId) {
    throw new Error("Server copy did not return a persisted media id.");
  }
  const projectId = normalizeProjectId(input.projectId);
  if (projectId) {
    try {
      await associateMediaFilesWithProject({
        projectId,
        mediaFileIds: [parsed.mediaFileId],
      });
    } catch (error) {
      logProjectAssociationWarning({
        projectId,
        entityType: "media",
        entityIds: [parsed.mediaFileId],
        error,
      });
    }
  }
  return parsed;
};

const isDuplicateInsertError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  if (maybeError.code === "23505") return true;
  return (
    typeof maybeError.message === "string" && maybeError.message.toLowerCase().includes("duplicate")
  );
};

const readExistingAiStudioMediaRowByOutputIndex = async ({
  supabase,
  userId,
  generationId,
  index,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  generationId: string;
  index: number;
}): Promise<{
  id: string;
  storagePath: string | null;
  fileType: MediaLibraryFileType;
  posterVariantPath: string | null;
  previewVariantPath: string | null;
} | null> => {
  const publicationMediaRow = await resolvePublishedGenerationMediaByIndex({
    supabase,
    generationId,
    imageIndex: index,
  });
  if (publicationMediaRow) {
    return {
      id: publicationMediaRow.mediaFileId,
      storagePath: publicationMediaRow.storagePath,
      fileType: publicationMediaRow.fileType,
      posterVariantPath: publicationMediaRow.posterVariantPath,
      previewVariantPath: publicationMediaRow.previewVariantPath,
    };
  }

  const { data: canonicalOutput, error: canonicalOutputError } = await supabase
    .from("ai_generation_outputs")
    .select("media_file_id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .eq("output_index", index)
    .limit(1)
    .maybeSingle();
  if (!canonicalOutputError) {
    const mediaFileId = asOptionalString(asRecord(canonicalOutput).media_file_id);
    if (mediaFileId) {
      const { data: canonicalMediaRow, error: canonicalMediaError } = await supabase
        .from("media_files")
        .select("id, storage_path, file_type, poster_variant_path, preview_variant_path")
        .eq("user_id", userId)
        .eq("id", mediaFileId)
        .limit(1)
        .maybeSingle();
      if (!canonicalMediaError && canonicalMediaRow) {
        const id = asOptionalString(canonicalMediaRow.id);
        if (id) {
          const storagePath = asOptionalString(canonicalMediaRow.storage_path);
          const fileTypeRaw = String(canonicalMediaRow.file_type ?? "").toLowerCase();
          const fileType =
            fileTypeRaw === "video"
              ? ("video" as const)
              : fileTypeRaw === "audio"
                ? ("audio" as const)
                : ("image" as const);
          return {
            id,
            storagePath,
            fileType,
            posterVariantPath: asOptionalString(canonicalMediaRow.poster_variant_path),
            previewVariantPath: asOptionalString(canonicalMediaRow.preview_variant_path),
          };
        }
      }
    }
  }

  const readByMetadataField = async (
    metadataField: "generation_output_index" | "index"
  ): Promise<{
    id: string;
    storagePath: string | null;
    fileType: MediaLibraryFileType;
    posterVariantPath: string | null;
    previewVariantPath: string | null;
  } | null> => {
    const { data, error } = await supabase
      .from("media_files")
      .select("id, storage_path, file_type, poster_variant_path, preview_variant_path")
      .eq("user_id", userId)
      .eq("source", "ai_studio")
      .eq("source_ref", generationId)
      .contains("metadata", { [metadataField]: index })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const id = typeof data.id === "string" ? data.id : null;
    if (!id) return null;
    const storagePath = typeof data.storage_path === "string" ? data.storage_path : null;
    const fileTypeRaw = String(data.file_type ?? "").toLowerCase();
    const fileType =
      fileTypeRaw === "video"
        ? ("video" as const)
        : fileTypeRaw === "audio"
          ? ("audio" as const)
          : ("image" as const);
    return {
      id,
      storagePath,
      fileType,
      posterVariantPath: asOptionalString(data.poster_variant_path),
      previewVariantPath: asOptionalString(data.preview_variant_path),
    };
  };

  const legacyIndexedRow =
    (await readByMetadataField("generation_output_index")) ?? (await readByMetadataField("index"));
  if (legacyIndexedRow) {
    return legacyIndexedRow;
  }
  return null;
};

const normalizePosterSourceUrl = (
  fileType: MediaLibraryFileType,
  value: string | null | undefined
): string | null => {
  if (fileType !== "video" || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(?:blob:|data:image\/|https?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
};

const upsertVideoPosterVariant = async ({
  supabase,
  userId,
  mediaFileId,
  posterSourceUrl,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  mediaFileId: string;
  posterSourceUrl: string;
}): Promise<string | null> => {
  const fetched = await fetchBlobWithTimeout(posterSourceUrl);
  const contentType = fetched.contentType ?? fetched.blob.type ?? null;
  if (!contentType?.startsWith("image/")) {
    throw new Error("Video poster source did not resolve to an image.");
  }

  const extension = resolveExtension(contentType, posterSourceUrl);
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/videos/${mediaFileId}/poster_720.${extension}`,
    userId,
    label: "AI Studio video poster storage path",
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fetched.blob, {
      upsert: true,
      contentType,
    });
  if (uploadError) {
    throw uploadError;
  }

  const dimensions = await readImageDimensionsFromBlob(fetched.blob);
  const byteSize = Number.isFinite(fetched.blob.size) ? fetched.blob.size : null;

  const { error: variantError } = await supabase.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: "poster_720",
      storage_path: storagePath,
      mime_type: contentType,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      byte_size: byteSize,
      status: "ready",
      metadata: {
        generated_by: "ai_studio_media_persistence",
        poster_source: posterSourceUrl.startsWith("data:image/")
          ? "inline_data_url"
          : posterSourceUrl.startsWith("blob:")
            ? "blob_url"
            : "remote_url",
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) {
    throw variantError;
  }

  const { error: updateError } = await supabase
    .from("media_files")
    .update({
      poster_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) {
    throw updateError;
  }

  return storagePath;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });

const extractVideoPosterBlob = async (videoBlob: Blob): Promise<Blob | null> => {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return null;
  }

  const objectUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  const videoMimeType = videoBlob.type.trim();
  if (
    videoMimeType &&
    typeof video.canPlayType === "function" &&
    !video.canPlayType(videoMimeType)
  ) {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        video.onloadeddata = null;
        video.onerror = null;
      };
      video.onloadeddata = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      video.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Video poster frame could not be decoded."));
      };
      video.src = objectUrl;
    });

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error("Video poster frame dimensions are unavailable.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Video poster frame canvas context is unavailable.");
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const posterBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    if (!posterBlob) {
      throw new Error("Video poster frame blob generation failed.");
    }
    return posterBlob;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(objectUrl);
  }
};

const upsertVideoPosterVariantFromVideoBlob = async ({
  supabase,
  userId,
  mediaFileId,
  videoBlob,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  mediaFileId: string;
  videoBlob: Blob;
}): Promise<string | null> => {
  const posterBlob = await extractVideoPosterBlob(videoBlob);
  if (!posterBlob) return null;

  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/videos/${mediaFileId}/poster_720.jpg`,
    userId,
    label: "AI Studio generated video poster storage path",
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, posterBlob, {
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadError) {
    throw uploadError;
  }

  const dimensions = await readImageDimensionsFromBlob(posterBlob);
  const byteSize = Number.isFinite(posterBlob.size) ? posterBlob.size : null;

  const { error: variantError } = await supabase.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: "poster_720",
      storage_path: storagePath,
      mime_type: "image/jpeg",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      byte_size: byteSize,
      status: "ready",
      metadata: {
        generated_by: "ai_studio_media_persistence",
        poster_source: "video_blob_frame",
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) {
    throw variantError;
  }

  const { error: updateError } = await supabase
    .from("media_files")
    .update({
      poster_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) {
    throw updateError;
  }

  return storagePath;
};

const upsertVideoPreviewVariantReference = async ({
  supabase,
  userId,
  mediaFileId,
  previewStoragePath,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  mediaFileId: string;
  previewStoragePath: string;
}): Promise<string> => {
  const storagePath = assertUserScopedMediaStoragePath({
    path: previewStoragePath,
    userId,
    label: "AI Studio video preview storage path",
  });
  const mimeType = inferVideoPreviewVariantMimeType(storagePath);

  const { error: variantError } = await supabase.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: "preview_loop_360p",
      storage_path: storagePath,
      mime_type: mimeType,
      width: null,
      height: null,
      byte_size: null,
      status: "ready",
      metadata: {
        generated_by: "ai_studio_media_persistence",
        preview_source: "existing_storage_object",
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) {
    throw variantError;
  }

  const { error: updateError } = await supabase
    .from("media_files")
    .update({
      preview_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) {
    throw updateError;
  }

  return storagePath;
};

// Generated media rows can land a moment after the task reports success, so
// retry briefly before we fall back to copying the provider URL.
const readExistingAiStudioMediaRowByOutputIndexWithRetry = async ({
  supabase,
  userId,
  generationId,
  index,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  generationId: string;
  index: number;
}): Promise<{
  id: string;
  storagePath: string | null;
  fileType: MediaLibraryFileType;
  posterVariantPath: string | null;
  previewVariantPath: string | null;
} | null> => {
  for (let attempt = 0; attempt < AI_STUDIO_EXISTING_ROW_RETRY_ATTEMPTS; attempt += 1) {
    const existingRow = await readExistingAiStudioMediaRowByOutputIndex({
      supabase,
      userId,
      generationId,
      index,
    });
    if (existingRow) {
      return existingRow;
    }
    if (attempt < AI_STUDIO_EXISTING_ROW_RETRY_ATTEMPTS - 1) {
      await sleep(AI_STUDIO_EXISTING_ROW_RETRY_DELAY_MS);
    }
  }
  return null;
};

const attachMediaFileToAiStudioGenerationOutput = async ({
  supabase,
  userId,
  generationId,
  index,
  mediaFileId,
  resultUrl,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  generationId: string;
  index: number;
  mediaFileId: string;
  resultUrl: string;
}) => {
  const nowIso = new Date().toISOString();
  const { data: existingOutput, error: existingOutputError } = await supabase
    .from("ai_generation_outputs")
    .select("id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .eq("output_index", index)
    .limit(1)
    .maybeSingle();
  if (existingOutputError) throw existingOutputError;

  const existingOutputId = asOptionalString(asRecord(existingOutput).id);
  if (existingOutputId) {
    const { error } = await supabase
      .from("ai_generation_outputs")
      .update({
        media_file_id: mediaFileId,
        updated_at: nowIso,
      })
      .eq("id", existingOutputId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error: insertError } = await supabase.from("ai_generation_outputs").insert({
    generation_id: generationId,
    user_id: userId,
    output_index: index,
    result_url: resultUrl,
    media_file_id: mediaFileId,
    metadata: {
      media_library_persistence: true,
      media_library_persisted_at: nowIso,
    },
    updated_at: nowIso,
  });
  if (!insertError) return;
  if (!isDuplicateInsertError(insertError)) throw insertError;

  const { data: duplicateOutput, error: duplicateLookupError } = await supabase
    .from("ai_generation_outputs")
    .select("id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .eq("output_index", index)
    .limit(1)
    .maybeSingle();
  if (duplicateLookupError) throw duplicateLookupError;
  const duplicateOutputId = asOptionalString(asRecord(duplicateOutput).id);
  if (!duplicateOutputId) throw insertError;
  const { error: updateError } = await supabase
    .from("ai_generation_outputs")
    .update({
      media_file_id: mediaFileId,
      updated_at: nowIso,
    })
    .eq("id", duplicateOutputId)
    .eq("user_id", userId);
  if (updateError) throw updateError;
};

/**
 * Save a prompt record to the media library.
 */
export const savePromptRecord = async (input: PromptRecordInput) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("media_prompts")
    .insert({
      user_id: userId,
      title: input.title ?? null,
      prompt_text: input.promptText,
      mode: input.mode,
      model_id: input.modelId ?? null,
      source: input.source ?? "manual",
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  const promptId = data?.id ?? null;
  const projectId = normalizeProjectId(input.projectId);
  if (promptId && projectId) {
    try {
      await associatePromptWithProject({
        projectId,
        promptId,
      });
    } catch (error) {
      logProjectAssociationWarning({
        projectId,
        entityType: "prompt",
        entityIds: [promptId],
        error,
      });
    }
  }
  return promptId;
};

/**
 * Insert a media event row (best-effort).
 */
export const logMediaEvent = async (input: MediaEventInput) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase.from("media_events").insert({
    user_id: userId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ?? {},
  });
  if (error) {
    throw error;
  }
};

const logVideoVariantHydrationFailure = async ({
  supabase,
  userId,
  mediaFileId,
  variantKind,
  source,
  generationId,
  outputIndex,
  error,
}: {
  supabase: Awaited<ReturnType<typeof ensureSupabaseQueryClient>>;
  userId: string;
  mediaFileId: string;
  variantKind: "poster" | "preview";
  source: SaveMediaUrlInput["source"];
  generationId?: string | null;
  outputIndex: number;
  error: unknown;
}) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? error)
        : String(error);
  const { error: eventError } = await supabase.from("media_events").insert({
    user_id: userId,
    event_type: "variant_hydration_failed",
    entity_type: "media_file",
    entity_id: mediaFileId,
    metadata: {
      variant_kind: variantKind,
      source,
      generation_id: generationId ?? null,
      output_index: outputIndex,
      message,
    },
  });
  if (eventError) {
    console.warn("[media/save] media_events insert failed", eventError.message);
  }
};

/**
 * Upload a media URL to storage and insert a media_files row.
 */
export const saveMediaUrlToLibrary = async (input: SaveMediaUrlInput) => {
  if (input.source === "ai_studio" && !input.generationId) {
    throw new Error(GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR);
  }
  const { supabase, userId } = await resolveSupabaseContext();
  if (input.source === "ai_studio" && input.generationId) {
    const existingRow = await readExistingAiStudioMediaRowByOutputIndexWithRetry({
      supabase,
      userId,
      generationId: input.generationId,
      index: input.index,
    });
    if (existingRow) {
      const projectId = normalizeProjectId(input.projectId);
      if (projectId) {
        try {
          await associateMediaFilesWithProject({
            projectId,
            mediaFileIds: [existingRow.id],
          });
        } catch (error) {
          logProjectAssociationWarning({
            projectId,
            entityType: "media",
            entityIds: [existingRow.id],
            error,
          });
        }
      }
      try {
        await attachMediaFileToAiStudioGenerationOutput({
          supabase,
          userId,
          generationId: input.generationId,
          index: input.index,
          mediaFileId: existingRow.id,
          resultUrl: input.url,
        });
      } catch {
        // best-effort canonical output linkage only
      }
      let durablePosterStoragePath = existingRow.posterVariantPath;
      let durablePreviewStoragePath = existingRow.previewVariantPath;
      const posterSourceUrl = normalizePosterSourceUrl(existingRow.fileType, input.posterUrlHint);
      if (existingRow.id && existingRow.fileType === "video" && !existingRow.posterVariantPath) {
        try {
          durablePosterStoragePath = posterSourceUrl
            ? await upsertVideoPosterVariant({
                supabase,
                userId,
                mediaFileId: existingRow.id,
                posterSourceUrl,
              })
            : await (async () => {
                const fetched = await fetchBlobWithTimeout(input.url);
                return await upsertVideoPosterVariantFromVideoBlob({
                  supabase,
                  userId,
                  mediaFileId: existingRow.id,
                  videoBlob: fetched.blob,
                });
              })();
        } catch (error) {
          await logVideoVariantHydrationFailure({
            supabase,
            userId,
            mediaFileId: existingRow.id,
            variantKind: "poster",
            source: input.source,
            generationId: input.generationId,
            outputIndex: input.index,
            error,
          });
        }
      }
      const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
        fileType: existingRow.fileType,
        previewStoragePath: input.previewStoragePathHint,
        fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
      });
      if (existingRow.id && previewVariantPath) {
        try {
          durablePreviewStoragePath = await upsertVideoPreviewVariantReference({
            supabase,
            userId,
            mediaFileId: existingRow.id,
            previewStoragePath: previewVariantPath,
          });
        } catch (error) {
          await logVideoVariantHydrationFailure({
            supabase,
            userId,
            mediaFileId: existingRow.id,
            variantKind: "preview",
            source: input.source,
            generationId: input.generationId,
            outputIndex: input.index,
            error,
          });
        }
      }
      const delivery = {
        previewStoragePath:
          durablePreviewStoragePath ?? input.previewStoragePathHint ?? existingRow.storagePath,
        previewPosterStoragePath: durablePosterStoragePath,
        fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
        previewUrl: input.previewUrlHint ?? null,
        previewPosterUrl: input.posterUrlHint ?? null,
        fullUrl: input.fullUrlHint ?? input.previewUrlHint ?? null,
      };
      return {
        mediaFileId: existingRow.id,
        storagePath: existingRow.storagePath ?? "",
        fileType: existingRow.fileType,
        fileSize: 0,
        delivery,
      } satisfies SaveMediaUrlResult;
    }
  }
  if (shouldPreferServerCopyForAiStudioVideo(input)) {
    return await saveMediaUrlToLibraryViaServerCopy(input);
  }
  let blob: Blob;
  let contentType: string | null;
  try {
    const fetched = await fetchBlobWithTimeout(input.url);
    blob = fetched.blob;
    contentType = fetched.contentType;
  } catch (error) {
    if (shouldUseServerCopyFallback({ input, error })) {
      return await saveMediaUrlToLibraryViaServerCopy(input);
    }
    throw error;
  }
  const fileType = resolveFileType(contentType, input.mode, input.fileTypeHint);
  const metadataDimensions = resolveImageDimensionsFromMetadata(input.metadata ?? null);
  const decodedDimensions = fileType === "image" ? await readImageDimensionsFromBlob(blob) : null;
  const canonicalMetadata = withCanonicalImageDimensions(
    {
      provider: input.provider ?? null,
      model_id: input.modelId ?? null,
      prompt: input.promptText ?? null,
      generation_output_index: input.index,
      index: input.index,
      ...input.metadata,
    },
    decodedDimensions ?? metadataDimensions
  );
  const extension = resolveExtension(contentType, input.url);
  const typeFolder = fileType === "video" ? "videos" : fileType === "audio" ? "audio" : "images";
  const rootFolder = input.source === "ai_studio" ? "generations" : "uploads";
  const storageName = `${crypto.randomUUID()}-${input.index}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/${rootFolder}/${typeFolder}/${storageName}`,
    userId,
    label: "AI Studio media storage path",
  });
  const friendlyName = buildFilename(input.promptText, extension, input.index);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    upsert: false,
    contentType: contentType ?? undefined,
  });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from("media_files")
    .insert({
      user_id: userId,
      filename: friendlyName,
      storage_path: storagePath,
      file_type: fileType,
      file_size: blob.size,
      source: input.source,
      source_ref: input.generationId ?? null,
      prompt_id: input.promptId ?? null,
      metadata: canonicalMetadata,
    })
    .select("id")
    .single();

  if (error) {
    if (isMediaStorageQuotaExceededError(error)) {
      try {
        if (storagePath) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
        }
      } catch {
        // best-effort cleanup only
      }
      throw new Error(
        `${MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE}. Delete media, upgrade your plan, or add recurring storage before saving more files.`
      );
    }
    if (input.source === "ai_studio" && input.generationId && isDuplicateInsertError(error)) {
      const existingRow = await readExistingAiStudioMediaRowByOutputIndexWithRetry({
        supabase,
        userId,
        generationId: input.generationId,
        index: input.index,
      });
      if (existingRow) {
        const projectId = normalizeProjectId(input.projectId);
        if (projectId) {
          try {
            await associateMediaFilesWithProject({
              projectId,
              mediaFileIds: [existingRow.id],
            });
          } catch (associationError) {
            logProjectAssociationWarning({
              projectId,
              entityType: "media",
              entityIds: [existingRow.id],
              error: associationError,
            });
          }
        }
        try {
          if (storagePath) {
            await supabase.storage.from(BUCKET).remove([storagePath]);
          }
        } catch {
          // best-effort cleanup only
        }
        try {
          await attachMediaFileToAiStudioGenerationOutput({
            supabase,
            userId,
            generationId: input.generationId,
            index: input.index,
            mediaFileId: existingRow.id,
            resultUrl: input.url,
          });
        } catch {
          // best-effort canonical output linkage only
        }
        let durablePosterStoragePath = existingRow.posterVariantPath;
        let durablePreviewStoragePath = existingRow.previewVariantPath;
        const posterSourceUrl = normalizePosterSourceUrl(existingRow.fileType, input.posterUrlHint);
        if (existingRow.id && fileType === "video" && !existingRow.posterVariantPath) {
          try {
            durablePosterStoragePath = posterSourceUrl
              ? await upsertVideoPosterVariant({
                  supabase,
                  userId,
                  mediaFileId: existingRow.id,
                  posterSourceUrl,
                })
              : await upsertVideoPosterVariantFromVideoBlob({
                  supabase,
                  userId,
                  mediaFileId: existingRow.id,
                  videoBlob: blob,
                });
          } catch (error) {
            await logVideoVariantHydrationFailure({
              supabase,
              userId,
              mediaFileId: existingRow.id,
              variantKind: "poster",
              source: input.source,
              generationId: input.generationId,
              outputIndex: input.index,
              error,
            });
          }
        }
        const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
          fileType: existingRow.fileType,
          previewStoragePath: input.previewStoragePathHint,
          fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
        });
        if (existingRow.id && previewVariantPath) {
          try {
            durablePreviewStoragePath = await upsertVideoPreviewVariantReference({
              supabase,
              userId,
              mediaFileId: existingRow.id,
              previewStoragePath: previewVariantPath,
            });
          } catch (error) {
            await logVideoVariantHydrationFailure({
              supabase,
              userId,
              mediaFileId: existingRow.id,
              variantKind: "preview",
              source: input.source,
              generationId: input.generationId,
              outputIndex: input.index,
              error,
            });
          }
        }
        const delivery = {
          previewStoragePath:
            durablePreviewStoragePath ?? input.previewStoragePathHint ?? existingRow.storagePath,
          previewPosterStoragePath: durablePosterStoragePath,
          fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
          previewUrl: input.previewUrlHint ?? null,
          previewPosterUrl: input.posterUrlHint ?? null,
          fullUrl: input.fullUrlHint ?? input.previewUrlHint ?? null,
        };
        return {
          mediaFileId: existingRow.id,
          storagePath: existingRow.storagePath ?? storagePath,
          fileType: existingRow.fileType,
          fileSize: blob.size,
          delivery,
        } satisfies SaveMediaUrlResult;
      }
    }
    throw error;
  }

  const mediaFileId = data?.id ?? null;
  let durablePreviewStoragePath: string | null = null;
  const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
    fileType,
    previewStoragePath: input.previewStoragePathHint,
    fullStoragePath: input.fullStoragePathHint ?? storagePath,
  });
  if (mediaFileId && previewVariantPath) {
    try {
      durablePreviewStoragePath = await upsertVideoPreviewVariantReference({
        supabase,
        userId,
        mediaFileId,
        previewStoragePath: previewVariantPath,
      });
    } catch (error) {
      await logVideoVariantHydrationFailure({
        supabase,
        userId,
        mediaFileId,
        variantKind: "preview",
        source: input.source,
        generationId: input.generationId,
        outputIndex: input.index,
        error,
      });
    }
  }

  const delivery = {
    previewStoragePath: durablePreviewStoragePath ?? input.previewStoragePathHint ?? storagePath,
    previewPosterStoragePath: null as string | null,
    fullStoragePath: input.fullStoragePathHint ?? storagePath,
    previewUrl: input.previewUrlHint ?? null,
    previewPosterUrl: input.posterUrlHint ?? null,
    fullUrl: input.fullUrlHint ?? input.previewUrlHint ?? null,
  };

  const projectId = normalizeProjectId(input.projectId);
  if (mediaFileId && projectId) {
    try {
      await associateMediaFilesWithProject({
        projectId,
        mediaFileIds: [mediaFileId],
      });
    } catch (error) {
      logProjectAssociationWarning({
        projectId,
        entityType: "media",
        entityIds: [mediaFileId],
        error,
      });
    }
  }
  const posterSourceUrl = normalizePosterSourceUrl(fileType, input.posterUrlHint);
  if (mediaFileId && fileType === "video") {
    try {
      delivery.previewPosterStoragePath = posterSourceUrl
        ? await upsertVideoPosterVariant({
            supabase,
            userId,
            mediaFileId,
            posterSourceUrl,
          })
        : await upsertVideoPosterVariantFromVideoBlob({
            supabase,
            userId,
            mediaFileId,
            videoBlob: blob,
          });
    } catch (error) {
      await logVideoVariantHydrationFailure({
        supabase,
        userId,
        mediaFileId,
        variantKind: "poster",
        source: input.source,
        generationId: input.generationId,
        outputIndex: input.index,
        error,
      });
    }
  }

  if (input.source === "ai_studio" && input.generationId && mediaFileId) {
    try {
      await attachMediaFileToAiStudioGenerationOutput({
        supabase,
        userId,
        generationId: input.generationId,
        index: input.index,
        mediaFileId,
        resultUrl: input.url,
      });
    } catch {
      // best-effort canonical output linkage only
    }
  }

  return {
    mediaFileId,
    storagePath,
    fileType,
    fileSize: blob.size,
    delivery,
  } satisfies SaveMediaUrlResult;
};
