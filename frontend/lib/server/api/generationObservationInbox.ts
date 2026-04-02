import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type PersistGenerationObservationInput = {
  generationId?: string | null;
  generationAttemptId?: string | null;
  userId?: string | null;
  provider: string;
  providerRequestId?: string | null;
  observationSource: "webhook" | "poll" | "replay" | "reconciler";
  observationType: string;
  idempotencyKey: string;
  payload: JsonObject;
  observedAt?: string;
};

export type GenerationObservationProcessingState = "pending" | "processed" | "ignored" | "failed";

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const persistGenerationObservation = async ({
  generationId,
  generationAttemptId,
  userId,
  provider,
  providerRequestId,
  observationSource,
  observationType,
  idempotencyKey,
  payload,
  observedAt,
}: PersistGenerationObservationInput): Promise<void> => {
  const normalizedProvider = asString(provider);
  const normalizedObservationType = asString(observationType);
  const normalizedIdempotencyKey = asString(idempotencyKey);
  if (!normalizedProvider || !normalizedObservationType || !normalizedIdempotencyKey) {
    throw new Error(
      "Generation observation requires provider, observation type, and idempotency key."
    );
  }

  const row: Record<string, unknown> = {
    provider: normalizedProvider,
    observation_source: observationSource,
    observation_type: normalizedObservationType,
    idempotency_key: normalizedIdempotencyKey,
    payload,
    observed_at: observedAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const normalizedGenerationId = asString(generationId);
  if (normalizedGenerationId) row.generation_id = normalizedGenerationId;
  const normalizedAttemptId = asString(generationAttemptId);
  if (normalizedAttemptId) row.generation_attempt_id = normalizedAttemptId;
  const normalizedUserId = asString(userId);
  if (normalizedUserId) row.user_id = normalizedUserId;
  const normalizedProviderRequestId = asString(providerRequestId);
  if (normalizedProviderRequestId) row.provider_request_id = normalizedProviderRequestId;

  const { error } = await getSupabaseAdmin().from("generation_observation_inbox").upsert(row, {
    onConflict: "idempotency_key",
  });
  if (error) throw error;
};

export const markGenerationObservationProcessingState = async ({
  idempotencyKey,
  processingState,
  processingError,
}: {
  idempotencyKey: string;
  processingState: GenerationObservationProcessingState;
  processingError?: string | null;
}): Promise<void> => {
  const normalizedIdempotencyKey = asString(idempotencyKey);
  if (!normalizedIdempotencyKey) {
    throw new Error("Generation observation processing update requires an idempotency key.");
  }

  const row: Record<string, unknown> = {
    processing_state: processingState,
    processing_error: asString(processingError),
    processed_at: processingState === "pending" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from("generation_observation_inbox")
    .update(row)
    .eq("idempotency_key", normalizedIdempotencyKey);
  if (error) throw error;
};
