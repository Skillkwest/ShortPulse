import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { generateOpenAiImage } from "../openaiImageGeneration";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { upsertGenerationProjection } from "../api/generationProjection";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { compileAudioCompanionArtPrompt, type AudioCompanionArtSourceMode } from "./promptCompiler";

const MEDIA_BUCKET = "media_library";

type JsonObject = Record<string, unknown>;

type PendingAudioCompanionArtProjectionRow = {
  generation_id?: unknown;
  user_id?: unknown;
};

type AudioGenerationRow = {
  id?: unknown;
  user_id?: unknown;
  prompt_text?: unknown;
  metadata?: unknown;
};

export type AudioCompanionArtBatchMetrics = {
  claimed: number;
  processed: number;
  ready: number;
  failed: number;
  skipped: number;
  errors: number;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const readSourceMode = (metadata: JsonObject): AudioCompanionArtSourceMode | null => {
  const normalized = asTrimmedString(metadata.source_mode)?.toLowerCase();
  if (
    normalized === "voiceover" ||
    normalized === "voice-changer" ||
    normalized === "sound-effects" ||
    normalized === "music"
  ) {
    return normalized;
  }
  return null;
};

const buildCompanionArtStoragePath = ({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}): string =>
  assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/audio/${generationId}/companion-art/cover.png`,
    label: "Audio companion art storage path",
  });

export const markAudioCompanionArtPending = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<void> => {
  try {
    await upsertGenerationProjection({
      generationId,
      userId,
      companionArtStatus: "pending",
      companionArtStoragePath: null,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.audio_companion_art.enqueue_failed",
      message: "Audio companion art enqueue failed after audio generation succeeded.",
      userId,
      statusCode: 200,
      metadata: {
        generation_id: generationId,
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }
};

const loadAudioGenerationRow = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<AudioGenerationRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id, user_id, prompt_text, metadata")
    .eq("id", generationId)
    .eq("user_id", userId)
    .eq("mode", "audio")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "Failed to load audio generation row.");
  }
  return (data as AudioGenerationRow | null) ?? null;
};

const markAudioCompanionArtFailed = async ({
  generationId,
  userId,
  error,
}: {
  generationId: string;
  userId: string;
  error: unknown;
}) => {
  const message = error instanceof Error ? error.message : String(error);
  await upsertGenerationProjection({
    generationId,
    userId,
    companionArtStatus: "failed",
  }).catch(() => undefined);
  await writeAppErrorLog({
    source: "telemetry.audio_companion_art.generation_failed",
    message: "Audio companion art generation failed.",
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      error: message,
    },
  }).catch(() => undefined);
};

export const processPendingAudioCompanionArtBatch = async ({
  limit,
}: {
  limit: number;
}): Promise<AudioCompanionArtBatchMetrics> => {
  const boundedLimit = Math.max(1, Math.min(limit, 25));
  const supabaseAdmin = getSupabaseAdmin();
  const metrics: AudioCompanionArtBatchMetrics = {
    claimed: 0,
    processed: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
  };

  const { data, error } = await supabaseAdmin
    .from("generation_projection")
    .select("generation_id, user_id")
    .eq("provider", "elevenlabs")
    .eq("task_state", "success")
    .eq("companion_art_status", "pending")
    .order("updated_at", { ascending: true })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to query pending audio companion art rows.");
  }

  const candidates = (Array.isArray(data) ? data : []) as PendingAudioCompanionArtProjectionRow[];
  for (const candidate of candidates) {
    const generationId = asTrimmedString(candidate.generation_id);
    const userId = asTrimmedString(candidate.user_id);
    if (!generationId || !userId) {
      metrics.skipped += 1;
      continue;
    }

    const claimResult = await supabaseAdmin
      .from("generation_projection")
      .update({
        companion_art_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("generation_id", generationId)
      .eq("user_id", userId)
      .eq("companion_art_status", "pending")
      .select("generation_id")
      .maybeSingle();

    if (claimResult.error) {
      metrics.errors += 1;
      continue;
    }
    if (!claimResult.data) {
      metrics.skipped += 1;
      continue;
    }

    metrics.claimed += 1;

    try {
      const generationRow = await loadAudioGenerationRow({
        generationId,
        userId,
      });
      if (!generationRow) {
        throw new Error("Audio generation row not found.");
      }

      const promptText = asTrimmedString(generationRow.prompt_text) ?? "Audio reference cover art";
      const metadata = asObject(generationRow.metadata);
      const sourceMode = readSourceMode(metadata);
      if (!sourceMode) {
        throw new Error("Audio source mode metadata is unavailable.");
      }

      const generationSpec = compileAudioCompanionArtPrompt({
        promptText,
        sourceMode,
        metadata,
      });
      const generated = await generateOpenAiImage({
        prompt: generationSpec.prompt,
        size: generationSpec.size,
        quality: generationSpec.quality,
      });
      const storagePath = buildCompanionArtStoragePath({
        userId,
        generationId,
      });
      const uploadResult = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, generated.buffer, {
          contentType: generated.contentType,
          upsert: true,
        });
      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || "Unable to persist audio companion art.");
      }

      await upsertGenerationProjection({
        generationId,
        userId,
        companionArtStatus: "ready",
        companionArtStoragePath: storagePath,
      });
      metrics.processed += 1;
      metrics.ready += 1;
    } catch (processingError) {
      metrics.processed += 1;
      metrics.failed += 1;
      await markAudioCompanionArtFailed({
        generationId,
        userId,
        error: processingError,
      });
    }
  }

  return metrics;
};
