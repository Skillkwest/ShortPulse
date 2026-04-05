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
import {
  attachMediaFileToGenerationOutput,
  readPersistedGenerationOutputs,
} from "../api/generationOutputs";
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
const MEDIA_PERSIST_CONCURRENCY = 3;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const runWithConcurrency = async <TItem>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<void>
): Promise<void> => {
  const activeWorkers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async (_, workerIndex) => {
      for (let index = workerIndex; index < items.length; index += Math.max(1, concurrency)) {
        await worker(items[index] as TItem);
      }
    }
  );
  await Promise.all(activeWorkers);
};

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
  generationId: string,
  userId?: string
): Promise<ExistingRecoveryMediaRow[]> => {
  const canonicalRows =
    userId && userId.trim().length
      ? await readPersistedGenerationOutputs({
          generationId,
          userId,
        }).catch(() => [])
      : [];
  const rowsByIndex = new Map<number, ExistingRecoveryMediaRow>();
  for (const row of canonicalRows) {
    if (!row.mediaFileId) continue;
    rowsByIndex.set(row.outputIndex, {
      id: row.mediaFileId,
      index: row.outputIndex,
    });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select("id, metadata")
    .eq("source_ref", generationId)
    .eq("source", "ai_studio")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  if (!Array.isArray(data)) {
    return Array.from(rowsByIndex.values()).sort((left, right) => {
      const leftIndex = left.index ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = right.index ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const id = asString(row.id);
    if (!id) continue;
    const rawIndex = Number.parseInt(
      String(asObject(row.metadata).generation_output_index ?? ""),
      10
    );
    const index = Number.isFinite(rawIndex) ? rawIndex : null;
    if (index !== null && rowsByIndex.has(index)) continue;
    rowsByIndex.set(index ?? rowsByIndex.size + 1000, {
      id,
      index,
    });
  }
  return Array.from(rowsByIndex.values()).sort((left, right) => {
    const leftIndex = left.index ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.index ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
};

export const persistRecoveryMediaFilesForGeneration = async ({
  generation,
  mediaUrls,
}: {
  generation: RecoveryPersistenceGeneration;
  mediaUrls: string[];
}): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const existingRows = await readExistingRecoveryMediaRows(generation.id, generation.user_id);
  if (existingRows.length && existingRows.length >= mediaUrls.length) {
    return existingRows.map((row) => row.id);
  }

  const existingByIndex = new Map<number, string>();
  for (const row of existingRows) {
    if (row.index !== null) {
      existingByIndex.set(row.index, row.id);
    }
  }

  const mediaFileIdsByIndex = new Array<string | null>(mediaUrls.length).fill(null);
  const promptBase = clampPrompt(generation.prompt_text);
  const generationMetadata = asObject(generation.metadata);
  const generationTraceId = asString(generationMetadata.generation_trace_id);
  const submissionTraceId = asString(generationMetadata.submission_trace_id);

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const existingId = existingByIndex.get(index);
    if (existingId) {
      mediaFileIdsByIndex[index] = existingId;
    }
  }

  const persistMediaAtIndex = async ({
    index,
    mediaUrl,
  }: {
    index: number;
    mediaUrl: string;
  }): Promise<void> => {
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
          try {
            await attachMediaFileToGenerationOutput({
              generationId: generation.id,
              userId: generation.user_id,
              outputIndex: index,
              mediaFileId: existingRowId,
              resultUrl: mediaUrl,
              providerRequestId: generation.request_id,
              metadata: {
                recovery_execution: true,
              },
            });
          } catch {
            // best-effort canonical output linkage only
          }
          mediaFileIdsByIndex[index] = existingRowId;
          return;
        }
      }
      throw new Error(`media_files insert failed: ${insertError.message}`);
    }
    const mediaFileId = asString(asObject(data).id);
    if (mediaFileId) {
      try {
        await attachMediaFileToGenerationOutput({
          generationId: generation.id,
          userId: generation.user_id,
          outputIndex: index,
          mediaFileId,
          resultUrl: mediaUrl,
          providerRequestId: generation.request_id,
          metadata: {
            recovery_execution: true,
          },
        });
      } catch {
        // best-effort canonical output linkage only
      }
      mediaFileIdsByIndex[index] = mediaFileId;
    }
  };

  const uncachedMedia = mediaUrls
    .map((mediaUrl, index) => ({ mediaUrl, index }))
    .filter(({ index }) => !existingByIndex.has(index));

  await runWithConcurrency(uncachedMedia, MEDIA_PERSIST_CONCURRENCY, persistMediaAtIndex);

  const mediaFileIds = mediaFileIdsByIndex.filter((value): value is string => Boolean(value));

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
