/**
 * Recovery media persistence runtime:
 * - existing media lookup
 * - remote media fetch with retry
 * - storage upload + media_files insert + dedupe fallback
 */

import { randomUUID } from "crypto";
import { withCanonicalImageDimensions } from "../../mediaDimensionMetadata";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { asString } from "./falAdapter";
import { extractImageDimensionsFromBuffer } from "../imageDimensions";
import {
  clampPrompt,
  resolveExtension,
  resolveFileType,
  sanitizeFilename,
} from "./recoveryExecutionRuntime";

type JsonObject = Record<string, unknown>;

export type ExistingRecoveryMediaRow = {
  id: string;
  index: number | null;
};

export type RecoveryPersistenceGeneration = {
  id: string;
  user_id: string;
  request_id: string | null;
  model_id: string;
  provider: string;
  prompt_text: string;
  metadata: JsonObject;
};

const MEDIA_BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const fetchBufferWithRetry = async (
  url: string
): Promise<{ buffer: Buffer; contentType: string | null }> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type");
      return { buffer: Buffer.from(arrayBuffer), contentType };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isRetryable =
        message.includes("aborted") ||
        message.includes("aborterror") ||
        message.includes("timed out") ||
        message.includes("econnreset") ||
        message.includes("fetch failed");
      if (attempt < FETCH_RETRY_ATTEMPTS && isRetryable) {
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw (lastError as Error | null) ?? new Error("Unable to fetch media file.");
};

export const readExistingRecoveryMediaRows = async (
  generationId: string
): Promise<ExistingRecoveryMediaRow[]> => {
  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select("id, metadata")
    .eq("source_ref", generationId)
    .eq("source", "ai_studio")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  const rows: ExistingRecoveryMediaRow[] = [];
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const id = asString(row.id);
    if (!id) continue;
    const rawIndex = Number.parseInt(
      String(asObject(row.metadata).generation_output_index ?? ""),
      10
    );
    rows.push({
      id,
      index: Number.isFinite(rawIndex) ? rawIndex : null,
    });
  }
  return rows;
};

export const persistRecoveryMediaFilesForGeneration = async ({
  generation,
  mediaUrls,
}: {
  generation: RecoveryPersistenceGeneration;
  mediaUrls: string[];
}): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const existingRows = await readExistingRecoveryMediaRows(generation.id);
  if (existingRows.length && existingRows.length >= mediaUrls.length) {
    return existingRows.map((row) => row.id);
  }

  const existingByIndex = new Map<number, string>();
  for (const row of existingRows) {
    if (row.index !== null) {
      existingByIndex.set(row.index, row.id);
    }
  }

  const mediaFileIds: string[] = [];
  const promptBase = clampPrompt(generation.prompt_text);
  const generationMetadata = asObject(generation.metadata);
  const generationTraceId = asString(generationMetadata.generation_trace_id);
  const submissionTraceId = asString(generationMetadata.submission_trace_id);

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const existingId = existingByIndex.get(index);
    if (existingId) {
      mediaFileIds.push(existingId);
      continue;
    }
    const mediaUrl = mediaUrls[index];
    const { buffer, contentType } = await fetchBufferWithRetry(mediaUrl);
    const fileType = resolveFileType(contentType, mediaUrl);
    const extension = resolveExtension(contentType, mediaUrl);
    const imageDimensions = fileType === "image" ? extractImageDimensionsFromBuffer(buffer) : null;
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${generation.user_id}/generations/${fileType === "video" ? "videos" : "images"}/${randomUUID()}-${index}.${extension}`,
      userId: generation.user_id,
      label: "Recovery execution media storage path",
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, buffer, {
        contentType: contentType ?? undefined,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const filename = sanitizeFilename(`${promptBase}-${index + 1}.${extension}`);
    const metadata = withCanonicalImageDimensions(
      {
        provider: generation.provider,
        model_id: generation.model_id,
        prompt: generation.prompt_text,
        generation_output_index: index,
        task_id: generation.request_id,
        generation_trace_id: generationTraceId,
        submission_trace_id: submissionTraceId,
        recovery_execution: true,
      },
      imageDimensions
    );

    const { data, error: insertError } = await supabaseAdmin
      .from("media_files")
      .insert({
        user_id: generation.user_id,
        filename,
        storage_path: storagePath,
        file_type: fileType,
        file_size: buffer.byteLength,
        source: "ai_studio",
        source_ref: generation.id,
        prompt_id: null,
        metadata,
      })
      .select("id")
      .single();
    if (insertError) {
      const duplicateError =
        insertError.code === "23505" ||
        String(insertError.message ?? "")
          .toLowerCase()
          .includes("duplicate");
      if (duplicateError) {
        const { data: existingData } = await supabaseAdmin
          .from("media_files")
          .select("id")
          .eq("source_ref", generation.id)
          .eq("source", "ai_studio")
          .contains("metadata", { generation_output_index: index })
          .limit(1)
          .maybeSingle();
        const existingRowId = asString(asObject(existingData).id);
        if (existingRowId) {
          try {
            await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([storagePath]);
          } catch {
            // best-effort cleanup only
          }
          mediaFileIds.push(existingRowId);
          continue;
        }
      }
      throw new Error(`media_files insert failed: ${insertError.message}`);
    }
    const mediaFileId = asString(asObject(data).id);
    if (mediaFileId) mediaFileIds.push(mediaFileId);
  }

  await supabaseAdmin.from("media_events").insert({
    user_id: generation.user_id,
    event_type: "generation_saved",
    entity_type: "ai_generation",
    entity_id: generation.id,
    metadata: {
      recovery_execution: true,
      request_id: generation.request_id,
      media_file_ids: mediaFileIds,
      model_id: generation.model_id,
      provider: generation.provider,
    },
  });

  return mediaFileIds;
};
