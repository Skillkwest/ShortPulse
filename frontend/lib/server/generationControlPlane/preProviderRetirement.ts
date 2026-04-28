/**
 * Retires stale pre-provider generation artifacts.
 * This is the cleanup path for historical worker-owned queue rows after the
 * pre-provider submit queue was retired for the lean generation pipeline.
 */
import { releaseGenerationReservationBySourceRef } from "../api/generationBilling/reservationRpcAdapter";
import { applyGenerationLifecycleTransition } from "../api/generationLifecycleTransitionService";
import { upsertGenerationProjection } from "../api/generationProjection";
import { buildQueueDispatchExhaustedGenerationUpdate } from "../api/generationRequestTransitions";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { markQueueItemExhausted } from "../api/generationQueue/service";

type JsonObject = Record<string, unknown>;

type QueueRow = {
  id: string;
  generation_id: string;
  user_id: string;
  source_ref: string;
  attempts: number | null;
};

type PendingGenerationRow = {
  id: string;
  user_id: string;
  provider: string;
  model_id: string;
  prompt_text: string | null;
  metadata: JsonObject | null;
};

export type PreProviderRetirementMetrics = {
  scanned: number;
  queueExhausted: number;
  generationsExhausted: number;
  reservationsReleased: number;
  errors: number;
};

const STALE_PRE_PROVIDER_MESSAGE =
  "Generation expired before provider submission because the pre-provider queue is retired.";

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readSourceRef = (metadata: unknown): string | null => asString(asObject(metadata).source_ref);

const failPendingGeneration = async ({
  generation,
  sourceRef,
}: {
  generation: PendingGenerationRow;
  sourceRef: string | null;
}): Promise<void> => {
  const completedAtIso = new Date().toISOString();
  const update = buildQueueDispatchExhaustedGenerationUpdate({
    message: STALE_PRE_PROVIDER_MESSAGE,
    completedAtIso,
  });
  const supabaseAdmin = getSupabaseAdmin();
  const result = await applyGenerationLifecycleTransition({
    intent: "queue_dispatch_exhausted",
    applyGenerationMutation: async () => {
      const response = await supabaseAdmin
        .from("ai_generations")
        .update(update)
        .eq("id", generation.id)
        .eq("user_id", generation.user_id)
        .select("id");
      if (response.error) {
        return { ok: false, error: response.error.message ?? "generation_update_failed" };
      }
      const affectedCount = Array.isArray(response.data) ? response.data.length : 0;
      if (affectedCount !== 1) {
        return {
          ok: false,
          error: `Expected one generation row update, received ${affectedCount}.`,
        };
      }
      return { ok: true };
    },
  });
  if (!result.ok) throw new Error(result.error);

  await upsertGenerationProjection({
    generationId: generation.id,
    userId: generation.user_id,
    sourceRef,
    requestId: null,
    provider: generation.provider,
    providerRequestId: null,
    status: "ready",
    taskState: "fail",
    queueState: "failed",
    displayPrompt: generation.prompt_text,
    modelId: generation.model_id,
    errorMessage: STALE_PRE_PROVIDER_MESSAGE,
    errorMessageShort: "Generation failed",
    errorDetail: STALE_PRE_PROVIDER_MESSAGE,
    saveState: "idle",
    publicationState: "suppressed",
    resultUrls: [],
    savedMediaIds: [],
    completedAt: completedAtIso,
  }).catch(() => undefined);
};

const releaseReservation = async ({
  userId,
  sourceRef,
}: {
  userId: string;
  sourceRef: string | null;
}): Promise<boolean> => {
  if (!sourceRef) return false;
  const result = await releaseGenerationReservationBySourceRef({
    userId,
    sourceRef,
    reason: STALE_PRE_PROVIDER_MESSAGE,
    metadata: {
      cleanup_source: "pre_provider_retirement",
    },
  });
  return result.status === "released" || result.status === "already_released";
};

const readGeneration = async (generationId: string): Promise<PendingGenerationRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id, user_id, provider, model_id, prompt_text, metadata")
    .eq("id", generationId)
    .maybeSingle();
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Partial<PendingGenerationRow>;
  if (!row.id || !row.user_id || !row.provider || !row.model_id) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    model_id: row.model_id,
    prompt_text: row.prompt_text ?? null,
    metadata: asObject(row.metadata),
  };
};

export const retireStalePreProviderGenerations = async ({
  limit,
  maxAgeSeconds,
}: {
  limit: number;
  maxAgeSeconds: number;
}): Promise<PreProviderRetirementMetrics> => {
  const metrics: PreProviderRetirementMetrics = {
    scanned: 0,
    queueExhausted: 0,
    generationsExhausted: 0,
    reservationsReleased: 0,
    errors: 0,
  };
  const boundedLimit = Math.max(1, Math.trunc(limit));
  const cutoffIso = new Date(Date.now() - Math.max(60, maxAgeSeconds) * 1000).toISOString();
  const supabaseAdmin = getSupabaseAdmin();
  const { data: queueRows, error: queueError } = await supabaseAdmin
    .from("ai_generation_submit_queue")
    .select("id, generation_id, user_id, source_ref, attempts")
    .in("status", ["queued", "dispatching"])
    .lte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(boundedLimit);

  if (queueError) {
    metrics.errors += 1;
    return metrics;
  }

  const queueItems = Array.isArray(queueRows) ? (queueRows as QueueRow[]) : [];
  for (const item of queueItems) {
    metrics.scanned += 1;
    try {
      const generation = await readGeneration(item.generation_id);
      const exhaustResult = await markQueueItemExhausted({
        queueId: item.id,
        attempts: Math.max(item.attempts ?? 0, 1),
        lastError: STALE_PRE_PROVIDER_MESSAGE,
        lastErrorCode: "PRE_PROVIDER_QUEUE_RETIRED",
      });
      if (!exhaustResult.ok) throw new Error(exhaustResult.errorMessage ?? "queue_exhaust_failed");
      metrics.queueExhausted += 1;
      if (generation) {
        await failPendingGeneration({
          generation,
          sourceRef: item.source_ref,
        });
        metrics.generationsExhausted += 1;
      }
      if (
        await releaseReservation({
          userId: item.user_id,
          sourceRef: item.source_ref,
        })
      ) {
        metrics.reservationsReleased += 1;
      }
    } catch {
      metrics.errors += 1;
    }
  }

  const remainingLimit = Math.max(0, boundedLimit - metrics.scanned);
  if (remainingLimit === 0) return metrics;

  const { data: pendingRows, error: pendingError } = await supabaseAdmin
    .from("ai_generations")
    .select("id, user_id, provider, model_id, prompt_text, metadata")
    .eq("status", "pending")
    .is("request_id", null)
    .lte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(remainingLimit);

  if (pendingError) {
    metrics.errors += 1;
    return metrics;
  }

  const pendingItems = Array.isArray(pendingRows) ? (pendingRows as PendingGenerationRow[]) : [];
  for (const generation of pendingItems) {
    metrics.scanned += 1;
    const sourceRef = readSourceRef(generation.metadata);
    try {
      await failPendingGeneration({
        generation: {
          ...generation,
          metadata: asObject(generation.metadata),
        },
        sourceRef,
      });
      metrics.generationsExhausted += 1;
      if (
        await releaseReservation({
          userId: generation.user_id,
          sourceRef,
        })
      ) {
        metrics.reservationsReleased += 1;
      }
    } catch {
      metrics.errors += 1;
    }
  }

  return metrics;
};
