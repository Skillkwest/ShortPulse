/**
 * Media library persistence helpers for AI Studio.
 * Handles Supabase inserts/updates for generations, prompts, and audit events.
 */
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import type { StudioMode } from "../types";

const BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 20000;

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
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export type GenerationRecordInput = {
  mode: StudioMode;
  provider: string;
  modelId: string;
  promptText: string;
  aspect?: string | null;
  durationSeconds?: number | null;
  resolution?: string | null;
  requestId?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
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

/**
 * Create a generation record and return the new id.
 */
export const createGenerationRecord = async (input: GenerationRecordInput) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("ai_generations")
    .insert({
      user_id: userId,
      mode: input.mode,
      provider: input.provider,
      model_id: input.modelId,
      prompt_text: input.promptText,
      aspect: input.aspect ?? null,
      duration_seconds: input.durationSeconds ?? null,
      resolution: input.resolution ?? null,
      request_id: input.requestId ?? null,
      status: input.status ?? "pending",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data?.id ?? null;
};

/**
 * Update a generation record by id.
 */
export const updateGenerationRecord = async (id: string, patch: Partial<GenerationRecordInput>) => {
  const { supabase } = await resolveSupabaseContext();
  const updates: Record<string, unknown> = {
    mode: patch.mode,
    provider: patch.provider,
    model_id: patch.modelId,
    prompt_text: patch.promptText,
    aspect: patch.aspect ?? null,
    duration_seconds: patch.durationSeconds ?? null,
    resolution: patch.resolution ?? null,
    request_id: patch.requestId ?? null,
    status: patch.status,
  };
  if (patch.metadata !== undefined) {
    updates.metadata = patch.metadata;
  }
  if (patch.status === "success" || patch.status === "fail") {
    updates.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("ai_generations").update(updates).eq("id", id);
  if (error) {
    throw error;
  }
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
  const { blob, contentType } = await fetchBlobWithTimeout(input.url);
  const fileType = resolveFileType(contentType, input.mode, input.fileTypeHint);
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
      metadata: {
        provider: input.provider ?? null,
        model_id: input.modelId ?? null,
        prompt: input.promptText ?? null,
        index: input.index,
        ...input.metadata,
      },
    })
    .select("id")
    .single();

  if (error) {
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
