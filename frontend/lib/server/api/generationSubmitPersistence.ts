import { getModelConfig } from "../../model-runtime/pricing";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { resolveProviderFromModelId } from "../providerIntegration/providerRuntimeConfig";
import {
  ensureAcceptedGenerationAttempt,
  updateGenerationAttemptState,
} from "./generationAttempts";

type JsonObject = Record<string, unknown>;

type GenerationMode = "image" | "video";

type SubmitPersistenceInput = {
  userId: string;
  modelId: string;
  routeLabel: string;
  payload: JsonObject;
  providerRequestId: string;
  sourceRef: string;
  submitTargetUrl: string;
  submitTargetIndex: number;
};

type SubmitPersistenceResult =
  | {
      ok: true;
      generationId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]+/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const readWebhookFromSubmitTarget = (submitTargetUrl: string): string | null => {
  try {
    const parsed = new URL(submitTargetUrl);
    return asString(parsed.searchParams.get("fal_webhook"));
  } catch {
    return null;
  }
};

const readDurationSeconds = (payload: JsonObject): number | null => {
  const durationSeconds = asNumber(payload.duration_seconds);
  if (durationSeconds !== null) return Math.max(1, Math.round(durationSeconds));
  const duration = asNumber(payload.duration);
  if (duration !== null) return Math.max(1, Math.round(duration));
  return null;
};

const resolvePromptText = (routeLabel: string, payload: JsonObject): string => {
  return (
    asString(payload.prompt) ??
    asString(payload.input) ??
    asString(payload.description) ??
    `${routeLabel} generation`
  );
};

const resolveMode = (modelId: string, payload: JsonObject): GenerationMode => {
  const config = getModelConfig(modelId);
  if (config?.mediaType === "video" || config?.mediaType === "image-to-video") {
    return "video";
  }
  if (config?.mediaType === "image" || config?.mediaType === "multi") {
    return "image";
  }

  if (readDurationSeconds(payload) !== null) return "video";
  const lowered = modelId.toLowerCase();
  if (
    lowered.includes("video") ||
    lowered.includes("seedance") ||
    lowered.includes("kling") ||
    lowered.includes("veo") ||
    lowered.includes("sora")
  ) {
    return "video";
  }
  return "image";
};

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const raw = (error as Record<string, unknown>).code;
  return typeof raw === "string" && raw.trim().length ? raw.trim() : null;
};

const lookupExistingGeneration = async ({
  userId,
  providerRequestId,
}: {
  userId: string;
  providerRequestId: string;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, status, metadata")
    .eq("user_id", userId)
    .eq("request_id", providerRequestId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return { row: null, error };
  const row =
    Array.isArray(data) && data.length && data[0] && typeof data[0] === "object"
      ? (data[0] as JsonObject)
      : null;
  return { row, error: null };
};

const updateGenerationWithRecoveryFallback = async ({
  userId,
  generationId,
  payload,
}: {
  userId: string;
  generationId: string;
  payload: JsonObject;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("ai_generations")
    .update(payload)
    .eq("id", generationId)
    .eq("user_id", userId);
  return { error: error ?? null };
};

const insertGenerationWithRecoveryFallback = async (payload: JsonObject) => {
  const supabaseAdmin = getSupabaseAdmin();
  return supabaseAdmin.from("ai_generations").insert(payload).select("id").single();
};

const ensureRunningGenerationAttemptState = async ({
  providerRequestId,
  userId,
  sourceRef,
  submitTargetUrl,
  submitTargetIndex,
}: {
  providerRequestId: string;
  userId: string;
  sourceRef: string;
  submitTargetUrl: string;
  submitTargetIndex: number;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const observedAt = new Date().toISOString();
  return updateGenerationAttemptState({
    providerRequestId,
    userId,
    status: "running",
    observedAt,
    metadata: {
      source_ref: sourceRef,
      submit_target_url: submitTargetUrl,
      submit_target_index: submitTargetIndex,
      direct_submit_at: observedAt,
      dispatch_source: "direct_submit",
    },
  });
};

/**
 * Ensures a durable ai_generations row exists as soon as submit returns request_id.
 * Callers decide whether persistence failure is recoverable or must fail closed.
 */
export const ensureSubmittedGenerationRecord = async (
  input: SubmitPersistenceInput
): Promise<SubmitPersistenceResult> => {
  try {
    const provider = resolveProviderFromModelId({ modelId: input.modelId, fallback: "fal" });
    const promptText = resolvePromptText(input.routeLabel, input.payload);
    const mode = resolveMode(input.modelId, input.payload);
    const durationSeconds = readDurationSeconds(input.payload);
    const aspect = asString(input.payload.aspect_ratio) ?? asString(input.payload.aspect);
    const resolution = asString(input.payload.resolution);
    const payloadMetadata = asObject(input.payload.metadata) ?? {};
    const nowIso = new Date().toISOString();
    const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const submitWebhookUrl = readWebhookFromSubmitTarget(input.submitTargetUrl);

    const metadataPatch: JsonObject = {
      source_ref: input.sourceRef,
      provider_request_id: input.providerRequestId,
      route_label: input.routeLabel,
      submit_target_url: input.submitTargetUrl,
      submit_target_index: input.submitTargetIndex,
      submit_webhook_url: submitWebhookUrl,
      submit_webhook_registered: Boolean(submitWebhookUrl),
      submission_trace_id: asString(payloadMetadata.submission_trace_id),
      generation_trace_id: asString(payloadMetadata.generation_trace_id),
      submit_persisted_at: new Date().toISOString(),
      recovery_queued_at: nowIso,
      recovery_queue_reason: "submit_persisted",
      submit_payload_summary: {
        aspect_ratio: asString(input.payload.aspect_ratio),
        resolution,
        duration: asString(input.payload.duration) ?? asNumber(input.payload.duration),
        num_images: asNumber(input.payload.num_images),
        has_image_url: Boolean(asString(input.payload.image_url)),
        image_urls_count: Array.isArray(input.payload.image_urls)
          ? input.payload.image_urls.length
          : null,
      },
    };

    const existingLookup = await lookupExistingGeneration({
      userId: input.userId,
      providerRequestId: input.providerRequestId,
    });
    if (existingLookup.error) {
      return {
        ok: false,
        error: existingLookup.error.message ?? "existing_lookup_failed",
      };
    }

    const existingRow = existingLookup.row;
    if (existingRow) {
      const existingId = asString(existingRow.id);
      if (existingId) {
        const nextMetadata = {
          ...(asObject(existingRow.metadata) ?? {}),
          ...metadataPatch,
        };
        const updatePayload: JsonObject = {
          mode,
          provider,
          model_id: input.modelId,
          request_id: input.providerRequestId,
          status: "running",
          completed_at: null,
          failure_reason_code: null,
          recovery_state: "queued",
          recovery_attempts: 0,
          last_recovery_at: null,
          next_recovery_at: nextRecoveryAtIso,
          last_media_detected_at: null,
          metadata: nextMetadata,
        };
        const { error } = await updateGenerationWithRecoveryFallback({
          userId: input.userId,
          generationId: existingId,
          payload: updatePayload,
        });
        if (error) {
          return {
            ok: false,
            error: error.message ?? "update_existing_generation_failed",
          };
        }
        const attemptResult = await ensureAcceptedGenerationAttempt({
          generationId: existingId,
          userId: input.userId,
          provider,
          modelId: input.modelId,
          providerRequestId: input.providerRequestId,
          dispatchSource: "direct_submit",
          submitRoute: input.routeLabel,
          metadata: {
            source_ref: input.sourceRef,
            submit_target_url: input.submitTargetUrl,
            submit_target_index: input.submitTargetIndex,
          },
        });
        if (!attemptResult.ok) {
          return {
            ok: false,
            error: attemptResult.error,
          };
        }
        const runningAttemptResult = await ensureRunningGenerationAttemptState({
          providerRequestId: input.providerRequestId,
          userId: input.userId,
          sourceRef: input.sourceRef,
          submitTargetUrl: input.submitTargetUrl,
          submitTargetIndex: input.submitTargetIndex,
        });
        if (!runningAttemptResult.ok) {
          return {
            ok: false,
            error: runningAttemptResult.error,
          };
        }
        return { ok: true, generationId: existingId };
      }
    }

    const insertPayload: JsonObject = {
      user_id: input.userId,
      mode,
      provider,
      model_id: input.modelId,
      prompt_text: promptText,
      aspect: aspect ?? null,
      duration_seconds: durationSeconds,
      resolution: resolution ?? null,
      request_id: input.providerRequestId,
      status: "running",
      completed_at: null,
      failure_reason_code: null,
      recovery_state: "queued",
      recovery_attempts: 0,
      last_recovery_at: null,
      next_recovery_at: nextRecoveryAtIso,
      last_media_detected_at: null,
      metadata: metadataPatch,
    };
    const { data, error } = await insertGenerationWithRecoveryFallback(insertPayload);

    if (error) {
      if (readErrorCode(error) === "23505") {
        const postInsertLookup = await lookupExistingGeneration({
          userId: input.userId,
          providerRequestId: input.providerRequestId,
        });
        const existingId = asString(postInsertLookup.row?.id);
        if (existingId) return { ok: true, generationId: existingId };
      }
      return {
        ok: false,
        error: error.message ?? "insert_generation_failed",
      };
    }

    const insertedGenerationId = asString((data as { id?: unknown } | null)?.id);
    if (!insertedGenerationId) {
      return {
        ok: false,
        error: "insert_generation_missing_id",
      };
    }

    const attemptResult = await ensureAcceptedGenerationAttempt({
      generationId: insertedGenerationId,
      userId: input.userId,
      provider,
      modelId: input.modelId,
      providerRequestId: input.providerRequestId,
      dispatchSource: "direct_submit",
      submitRoute: input.routeLabel,
      metadata: {
        source_ref: input.sourceRef,
        submit_target_url: input.submitTargetUrl,
        submit_target_index: input.submitTargetIndex,
      },
    });
    if (!attemptResult.ok) {
      return {
        ok: false,
        error: attemptResult.error,
      };
    }
    const runningAttemptResult = await ensureRunningGenerationAttemptState({
      providerRequestId: input.providerRequestId,
      userId: input.userId,
      sourceRef: input.sourceRef,
      submitTargetUrl: input.submitTargetUrl,
      submitTargetIndex: input.submitTargetIndex,
    });
    if (!runningAttemptResult.ok) {
      return {
        ok: false,
        error: runningAttemptResult.error,
      };
    }

    return { ok: true, generationId: insertedGenerationId };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
    };
  }
};
