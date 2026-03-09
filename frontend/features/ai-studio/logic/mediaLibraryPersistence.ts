/**
 * Media library persistence helpers for AI Studio.
 * Handles Supabase inserts/updates for generations, prompts, and audit events.
 */
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  resolveImageDimensionsFromMetadata,
  withCanonicalImageDimensions,
  type ImageDimensions,
} from "../../../lib/mediaDimensionMetadata";
import type { StudioMode } from "../types";

const BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;

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
  const supabase = ensureSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new Error("Not signed in");
  }
  return { supabase, userId };
};

const fetchBlobWithTimeout = async (url: string) => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
      window.clearTimeout(timeoutId);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch media.");
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
  supabase: ReturnType<typeof ensureSupabaseClient>;
  userId: string;
  generationId: string;
  index: number;
}): Promise<{ id: string; storagePath: string | null; fileType: "image" | "video" } | null> => {
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
  const { supabase, userId } = await resolveSupabaseContext();
  if (input.source === "ai_studio" && input.generationId) {
    const existingRow = await readExistingAiStudioMediaRowByOutputIndex({
      supabase,
      userId,
      generationId: input.generationId,
      index: input.index,
    });
    if (existingRow) {
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
  const { blob, contentType } = await fetchBlobWithTimeout(input.url);
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

  return {
    mediaFileId: data?.id ?? null,
    storagePath,
    fileType,
    fileSize: blob.size,
    delivery,
  } satisfies SaveMediaUrlResult;
};
