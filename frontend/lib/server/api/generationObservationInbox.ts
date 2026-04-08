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

export type GenerationObservationProcessingState =
  | "pending"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export type ClaimedGenerationObservation = {
  id: string;
  generationId: string | null;
  generationAttemptId: string | null;
  userId: string | null;
  provider: string;
  providerRequestId: string | null;
  observationSource: "webhook" | "poll" | "replay" | "reconciler";
  observationType: string;
  idempotencyKey: string;
  payload: JsonObject;
  observedAt: string | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
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

const parseClaimedGenerationObservation = (value: unknown): ClaimedGenerationObservation | null => {
  const row = asObject(value);
  const id = asString(row?.id);
  const provider = asString(row?.provider);
  const observationSource = asString(row?.observation_source) as
    | "webhook"
    | "poll"
    | "replay"
    | "reconciler"
    | null;
  const observationType = asString(row?.observation_type);
  const idempotencyKey = asString(row?.idempotency_key);
  const payload = asObject(row?.payload);
  if (!id || !provider || !observationSource || !observationType || !idempotencyKey || !payload) {
    return null;
  }

  return {
    id,
    generationId: asString(row?.generation_id),
    generationAttemptId: asString(row?.generation_attempt_id),
    userId: asString(row?.user_id),
    provider,
    providerRequestId: asString(row?.provider_request_id),
    observationSource,
    observationType,
    idempotencyKey,
    payload,
    observedAt: asString(row?.observed_at),
  };
};

export const claimPendingGenerationObservations = async ({
  limit,
  leaseSeconds,
}: {
  limit: number;
  leaseSeconds: number;
}): Promise<ClaimedGenerationObservation[]> => {
  const { data, error } = await getSupabaseAdmin().rpc("claim_generation_observation_inbox_batch", {
    p_limit: Math.max(1, Math.trunc(limit)),
    p_lease_seconds: Math.max(1, Math.trunc(leaseSeconds)),
  });
  if (error || !Array.isArray(data)) {
    throw error ?? new Error("claim_generation_observation_inbox_batch returned non-array payload");
  }

  return data
    .map((row) => parseClaimedGenerationObservation(row))
    .filter((row): row is ClaimedGenerationObservation => Boolean(row));
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
    processed_at:
      processingState === "pending" || processingState === "processing"
        ? null
        : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from("generation_observation_inbox")
    .update(row)
    .eq("idempotency_key", normalizedIdempotencyKey);
  if (error) throw error;
};
