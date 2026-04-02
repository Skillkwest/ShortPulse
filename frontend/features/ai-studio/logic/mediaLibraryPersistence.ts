/**
 * Media library persistence helpers for AI Studio.
 * Handles Supabase inserts/updates for generations, prompts, and audit events.
 */
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
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

const BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;
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
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const sanitizeFilename = (value: string) => value.replace(/[^\w.-]+/g, "_");
const URL_PROTOCOL_PATTERN = /^https?:\/\//i;

const clampPrompt = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const resolveFileType = (
  contentType: string | null,
  fallbackMode: StudioMode,
  fileTypeHint?: "image" | "video"
) => {
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("image/")) return "image";
  if (fileTypeHint) return fileTypeHint;
  return fallbackMode === "video" ? "video" : "image";
};

const extensionFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return "";
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
  fileTypeHint?: "image" | "video";
  provider?: string | null;
  modelId?: string | null;
  generationId?: string | null;
  promptId?: string | null;
  index: number;
  previewStoragePathHint?: string | null;
  fullStoragePathHint?: string | null;
  previewUrlHint?: string | null;
  fullUrlHint?: string | null;
  metadata?: Record<string, unknown>;
};

export type SaveMediaUrlResult = {
  mediaFileId: string | null;
  storagePath: string;
  fileType: "image" | "video";
  fileSize: number;
  delivery: {
    previewStoragePath: string | null;
    fullStoragePath: string | null;
    previewUrl: string | null;
    fullUrl: string | null;
  };
};

export const resolveGenerationIdForRequestId = async (
  requestId: string | null | undefined
): Promise<string | null> => {
  const { supabase, userId } = await resolveSupabaseContext();
  return await resolveGenerationIdForRequestIdFromAuthority({
    supabase,
    requestId,
    userId,
  });
};

const parseServerCopyResult = (value: unknown): SaveMediaUrlResult | null => {
  const row = asRecord(value);
  const deliveryRecord = asRecord(row.delivery);
  const storagePath = asOptionalString(row.storagePath);
  if (!storagePath) return null;
  const fileTypeRaw = asOptionalString(row.fileType)?.toLowerCase();
  if (fileTypeRaw !== "image" && fileTypeRaw !== "video") return null;
  return {
    mediaFileId: asOptionalString(row.mediaFileId),
    storagePath,
    fileType: fileTypeRaw as "image" | "video",
    fileSize: Number.isFinite(Number(row.fileSize)) ? Number(row.fileSize) : 0,
    delivery: {
      previewStoragePath: asOptionalString(deliveryRecord.previewStoragePath),
      fullStoragePath: asOptionalString(deliveryRecord.fullStoragePath),
      previewUrl: asOptionalString(deliveryRecord.previewUrl),
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
}): Promise<{ id: string; storagePath: string | null; fileType: "image" | "video" } | null> => {
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
        .select("id, storage_path, file_type")
        .eq("user_id", userId)
        .eq("id", mediaFileId)
        .limit(1)
        .maybeSingle();
      if (!canonicalMediaError && canonicalMediaRow) {
        const id = asOptionalString(canonicalMediaRow.id);
        if (id) {
          const storagePath = asOptionalString(canonicalMediaRow.storage_path);
          const fileType =
            String(canonicalMediaRow.file_type ?? "").toLowerCase() === "video"
              ? ("video" as const)
              : ("image" as const);
          return { id, storagePath, fileType };
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("media_files")
    .select("id, storage_path, file_type")
    .eq("user_id", userId)
    .eq("source", "ai_studio")
    .eq("source_ref", generationId)
    .contains("metadata", { generation_output_index: index })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const id = typeof data.id === "string" ? data.id : null;
  if (!id) return null;
  const storagePath = typeof data.storage_path === "string" ? data.storage_path : null;
  const fileType =
    String(data.file_type ?? "").toLowerCase() === "video"
      ? ("video" as const)
      : ("image" as const);
  return { id, storagePath, fileType };
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
  return data?.id ?? null;
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

/**
 * Upload a media URL to storage and insert a media_files row.
 */
export const saveMediaUrlToLibrary = async (input: SaveMediaUrlInput) => {
  if (input.source === "ai_studio" && !input.generationId) {
    throw new Error(GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR);
  }
  const { supabase, userId } = await resolveSupabaseContext();
  if (input.source === "ai_studio" && input.generationId) {
    const existingRow = await readExistingAiStudioMediaRowByOutputIndex({
      supabase,
      userId,
      generationId: input.generationId,
      index: input.index,
    });
    if (existingRow) {
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
      const delivery = {
        previewStoragePath: input.previewStoragePathHint ?? existingRow.storagePath,
        fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
        previewUrl: input.previewUrlHint ?? null,
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
  let blob: Blob;
  let contentType: string | null;
  try {
    const fetched = await fetchBlobWithTimeout(input.url);
    blob = fetched.blob;
    contentType = fetched.contentType;
  } catch (error) {
    if (URL_PROTOCOL_PATTERN.test(input.url) && isBrowserFetchBlockedError(error)) {
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
  const typeFolder = fileType === "video" ? "videos" : "images";
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
    if (input.source === "ai_studio" && input.generationId && isDuplicateInsertError(error)) {
      const existingRow = await readExistingAiStudioMediaRowByOutputIndex({
        supabase,
        userId,
        generationId: input.generationId,
        index: input.index,
      });
      if (existingRow) {
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
        const delivery = {
          previewStoragePath: input.previewStoragePathHint ?? existingRow.storagePath,
          fullStoragePath: input.fullStoragePathHint ?? existingRow.storagePath,
          previewUrl: input.previewUrlHint ?? null,
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

  const delivery = {
    previewStoragePath: input.previewStoragePathHint ?? storagePath,
    fullStoragePath: input.fullStoragePathHint ?? storagePath,
    previewUrl: input.previewUrlHint ?? null,
    fullUrl: input.fullUrlHint ?? input.previewUrlHint ?? null,
  };

  if (input.source === "ai_studio" && input.generationId && data?.id) {
    try {
      await attachMediaFileToAiStudioGenerationOutput({
        supabase,
        userId,
        generationId: input.generationId,
        index: input.index,
        mediaFileId: data.id,
        resultUrl: input.url,
      });
    } catch {
      // best-effort canonical output linkage only
    }
  }

  return {
    mediaFileId: data?.id ?? null,
    storagePath,
    fileType,
    fileSize: blob.size,
    delivery,
  } satisfies SaveMediaUrlResult;
};
