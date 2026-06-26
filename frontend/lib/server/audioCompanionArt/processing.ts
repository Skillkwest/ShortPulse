import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import sharp from "sharp";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { upsertGenerationProjection } from "../api/generationProjection";
import { resolveRuntimeAgentPrompt } from "../api/runtimeAgentPromptControlPlane";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  buildFalFluxKleinAudioCompanionArtPayload,
  generateFalFluxKleinImage,
} from "../falStylePreviewGeneration";
import { mirrorGeneratedAudioPresentationToMediaFiles } from "../generatedAudioPresentation";
import { cleanupAudioCompanionArt } from "./cleanup";
import { compileAudioCompanionArtPrompt, type AudioCompanionArtSourceMode } from "./promptCompiler";

const MEDIA_BUCKET = "media_library";
const MAX_AUDIO_COMPANION_ART_ATTEMPTS = 3;
const AUDIO_COMPANION_ART_STYLE_PROMPT_ID = "AUDIO_COMPANION_ART_STYLE_SYSTEM";
const GENERATABLE_COMPANION_ART_STATUSES_FILTER =
  "companion_art_status.is.null,companion_art_status.eq.pending,companion_art_status.eq.failed";
const AUDIO_COMPANION_ART_DELIVERY_MIME_TYPE = "image/webp";
const AUDIO_COMPANION_ART_DELIVERY_WIDTH_PX = 480;
const AUDIO_COMPANION_ART_DELIVERY_QUALITY = 68;
const AUDIO_COMPANION_ART_POLL_INTERVAL_MS = 500;
const AUDIO_COMPANION_ART_BLANK_LUMA_THRESHOLD = 246;
const AUDIO_COMPANION_ART_LOW_VARIATION_THRESHOLD = 4;
const AUDIO_COMPANION_ART_LOW_RANGE_THRESHOLD = 18;

type JsonObject = Record<string, unknown>;

type PendingAudioCompanionArtProjectionRow = {
  generation_id?: unknown;
  user_id?: unknown;
  companion_art_attempt_count?: unknown;
  publication_state?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
};

type AudioGenerationRow = {
  id?: unknown;
  user_id?: unknown;
  prompt_text?: unknown;
  metadata?: unknown;
};

type AudioCompanionArtProjectionEligibilityRow = {
  publication_state?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
};

export type AudioCompanionArtBatchMetrics = {
  claimed: number;
  processed: number;
  ready: number;
  failed: number;
  skipped: number;
  errors: number;
};

export type AudioCompanionArtDelivery = {
  companionArtStatus: "ready";
  companionArtStoragePath: string;
  companionArtUrl: string | null;
};

class AudioCompanionArtSkippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioCompanionArtSkippedError";
  }
}

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asAttemptCount = (value: unknown): number => {
  const normalized = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, normalized);
};

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
    path: `${userId}/generations/audio/${generationId}/companion-art/cover.webp`,
    label: "Audio companion art storage path",
  });

const signAudioCompanionArtStoragePath = async ({
  storagePath,
  supabaseAdmin,
}: {
  storagePath: string;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
}): Promise<string | null> => {
  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) return null;
  return signedResult.data.signedUrl;
};

const isAudioCompanionArtEligible = (
  row: AudioCompanionArtProjectionEligibilityRow | null | undefined
): boolean => {
  if (!row) return false;
  if (asTrimmedString(row.publication_state)?.toLowerCase() === "suppressed") return false;
  if (row.hidden_in_reference_grid === true) return false;
  if (row.reference_grid_visible === false) return false;
  return true;
};

const loadAudioCompanionArtEligibility = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<boolean> => {
  const { data, error } = await getSupabaseAdmin()
    .from("generation_projection")
    .select("publication_state, hidden_in_reference_grid, reference_grid_visible")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "Failed to load audio companion art eligibility.");
  }
  return isAudioCompanionArtEligible((data as AudioCompanionArtProjectionEligibilityRow) ?? null);
};

const encodeAudioCompanionArtDeliveryBuffer = async (sourceBuffer: Buffer): Promise<Buffer> => {
  return await sharp(sourceBuffer, { failOn: "error" })
    .rotate()
    .resize({
      width: AUDIO_COMPANION_ART_DELIVERY_WIDTH_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: AUDIO_COMPANION_ART_DELIVERY_QUALITY })
    .toBuffer();
};

const assertAudioCompanionArtHasRenderableContent = async (sourceBuffer: Buffer): Promise<void> => {
  const stats = await sharp(sourceBuffer, { failOn: "error" }).stats();
  const channels = stats.channels.slice(0, 3);
  if (channels.length < 3) return;

  const [red, green, blue] = channels;
  const meanLuma = red.mean * 0.2126 + green.mean * 0.7152 + blue.mean * 0.0722;
  const averageDeviation = (red.stdev + green.stdev + blue.stdev) / 3;
  const maxChannelRange = Math.max(red.max - red.min, green.max - green.min, blue.max - blue.min);
  const isNearWhiteBlank =
    meanLuma >= AUDIO_COMPANION_ART_BLANK_LUMA_THRESHOLD &&
    averageDeviation <= AUDIO_COMPANION_ART_LOW_VARIATION_THRESHOLD &&
    maxChannelRange <= AUDIO_COMPANION_ART_LOW_RANGE_THRESHOLD;

  if (isNearWhiteBlank) {
    throw new Error("Audio companion art image was blank or near-white.");
  }
};

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
      companionArtAttemptCount: 0,
    });
    await mirrorGeneratedAudioPresentationToMediaFiles({
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
  await mirrorGeneratedAudioPresentationToMediaFiles({
    generationId,
    userId,
    companionArtStatus: "failed",
    companionArtStoragePath: null,
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

const generateAndPersistAudioCompanionArt = async ({
  generationId,
  userId,
  supabaseAdmin,
  runtimeStyleLine,
}: {
  generationId: string;
  userId: string;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  runtimeStyleLine: string | null | undefined;
}): Promise<{ storagePath: string; runtimeStyleLine: string | null }> => {
  if (!(await loadAudioCompanionArtEligibility({ generationId, userId }))) {
    await cleanupAudioCompanionArt({
      generationId,
      userId,
      supabaseAdmin,
    });
    throw new AudioCompanionArtSkippedError("Audio companion art is no longer eligible.");
  }

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

  let resolvedRuntimeStyleLine = runtimeStyleLine;
  if (resolvedRuntimeStyleLine === undefined) {
    const resolvedRuntimePrompt = await resolveRuntimeAgentPrompt({
      promptId: AUDIO_COMPANION_ART_STYLE_PROMPT_ID,
    });
    resolvedRuntimeStyleLine = resolvedRuntimePrompt.promptBody;
  }

  const generationSpec = compileAudioCompanionArtPrompt({
    promptText,
    sourceMode,
    metadata,
    styleLine: resolvedRuntimeStyleLine,
  });
  const generated = await generateFalFluxKleinImage({
    payload: buildFalFluxKleinAudioCompanionArtPayload(generationSpec.prompt),
    pollIntervalMs: AUDIO_COMPANION_ART_POLL_INTERVAL_MS,
    initialPollDelayMs: 0,
  });
  await assertAudioCompanionArtHasRenderableContent(generated.buffer);
  const deliveryBuffer = await encodeAudioCompanionArtDeliveryBuffer(generated.buffer);
  if (!(await loadAudioCompanionArtEligibility({ generationId, userId }))) {
    await cleanupAudioCompanionArt({
      generationId,
      userId,
      supabaseAdmin,
    });
    throw new AudioCompanionArtSkippedError("Audio companion art became ineligible.");
  }

  const storagePath = buildCompanionArtStoragePath({
    userId,
    generationId,
  });
  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, deliveryBuffer, {
      contentType: AUDIO_COMPANION_ART_DELIVERY_MIME_TYPE,
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
  await mirrorGeneratedAudioPresentationToMediaFiles({
    generationId,
    userId,
    companionArtStatus: "ready",
    companionArtStoragePath: storagePath,
    supabaseAdmin,
  });

  return {
    storagePath,
    runtimeStyleLine: resolvedRuntimeStyleLine ?? null,
  };
};

export const generateAudioCompanionArtForGeneration = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<AudioCompanionArtDelivery> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generated = await generateAndPersistAudioCompanionArt({
    generationId,
    userId,
    supabaseAdmin,
    runtimeStyleLine: undefined,
  });
  const signedUrl = await signAudioCompanionArtStoragePath({
    storagePath: generated.storagePath,
    supabaseAdmin,
  });
  return {
    companionArtStatus: "ready",
    companionArtStoragePath: generated.storagePath,
    companionArtUrl: signedUrl,
  };
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
    .select(
      "generation_id, user_id, companion_art_attempt_count, publication_state, hidden_in_reference_grid, reference_grid_visible"
    )
    .eq("provider", "elevenlabs")
    .eq("task_state", "success")
    .not("publication_state", "eq", "suppressed")
    .lt("companion_art_attempt_count", MAX_AUDIO_COMPANION_ART_ATTEMPTS)
    .or(GENERATABLE_COMPANION_ART_STATUSES_FILTER)
    .order("updated_at", { ascending: true })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to query pending audio companion art rows.");
  }

  const candidates = (Array.isArray(data) ? data : []) as PendingAudioCompanionArtProjectionRow[];
  let runtimeStyleLine: string | null | undefined;
  for (const candidate of candidates) {
    const generationId = asTrimmedString(candidate.generation_id);
    const userId = asTrimmedString(candidate.user_id);
    if (!generationId || !userId) {
      metrics.skipped += 1;
      continue;
    }
    if (!isAudioCompanionArtEligible(candidate)) {
      metrics.skipped += 1;
      continue;
    }
    const nextAttemptCount = asAttemptCount(candidate.companion_art_attempt_count) + 1;

    const claimResult = await supabaseAdmin
      .from("generation_projection")
      .update({
        companion_art_status: "processing",
        companion_art_attempt_count: nextAttemptCount,
        updated_at: new Date().toISOString(),
      })
      .eq("generation_id", generationId)
      .eq("user_id", userId)
      .not("publication_state", "eq", "suppressed")
      .lt("companion_art_attempt_count", MAX_AUDIO_COMPANION_ART_ATTEMPTS)
      .or(GENERATABLE_COMPANION_ART_STATUSES_FILTER)
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
      const generated = await generateAndPersistAudioCompanionArt({
        generationId,
        userId,
        supabaseAdmin,
        runtimeStyleLine,
      });
      runtimeStyleLine = generated.runtimeStyleLine;
      metrics.processed += 1;
      metrics.ready += 1;
    } catch (processingError) {
      metrics.processed += 1;
      if (processingError instanceof AudioCompanionArtSkippedError) {
        metrics.skipped += 1;
        continue;
      }
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
