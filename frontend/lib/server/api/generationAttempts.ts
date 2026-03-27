import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

type GenerationAttemptStatus =
  | "created"
  | "submitted"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "abandoned";

type EnsureAcceptedGenerationAttemptInput = {
  generationId: string;
  userId: string;
  provider: string;
  modelId: string;
  providerRequestId: string;
  dispatchSource: "direct_submit" | "queued_submit" | "admin_replay" | "reconciler";
  submitRoute?: string | null;
  queueId?: string | null;
  metadata?: JsonObject;
};

type EnsureAcceptedGenerationAttemptResult =
  | {
      ok: true;
      attemptId: string | null;
      attemptNumber: number | null;
    }
  | {
      ok: false;
      error: string;
    };

type LookupGenerationAttemptByProviderRequestInput = {
  providerRequestId: string;
  userId?: string | null;
};

type LookupLatestGenerationAttemptInput = {
  generationId: string;
  userId: string;
};

export type GenerationAttemptLookupRow = {
  id: string | null;
  generationId: string | null;
  userId: string | null;
  attemptNumber: number | null;
  providerRequestId: string | null;
  metadata: JsonObject;
};

type UpdateGenerationAttemptStateInput = {
  providerRequestId: string;
  userId: string;
  status: Exclude<GenerationAttemptStatus, "created" | "submitted" | "abandoned">;
  observedAt?: string | null;
  completedAt?: string | null;
  failureReasonCode?: string | null;
  errorMessage?: string | null;
  metadata?: JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  return asString((error as Record<string, unknown>).code);
};

const lookupAttemptByProviderRequest = async ({
  generationId,
  userId,
  providerRequestId,
}: {
  generationId: string;
  userId: string;
  providerRequestId: string;
}) => {
  const { data, error } = await getSupabaseAdmin()
    .from("generation_attempts")
    .select("id, attempt_number, metadata")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .eq("provider_request_id", providerRequestId)
    .limit(1)
    .maybeSingle();
  return { data, error };
};

export const lookupGenerationAttemptByProviderRequest = async ({
  providerRequestId,
  userId = null,
}: LookupGenerationAttemptByProviderRequestInput): Promise<{
  data: GenerationAttemptLookupRow | null;
  error: { code?: string | null; message?: string | null } | null;
}> => {
  const normalizedProviderRequestId = asString(providerRequestId);
  if (!normalizedProviderRequestId) {
    return { data: null, error: null };
  }

  const query = getSupabaseAdmin()
    .from("generation_attempts")
    .select("id, generation_id, user_id, attempt_number, provider_request_id, metadata")
    .eq("provider_request_id", normalizedProviderRequestId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  const scopedQuery = userId ? query.eq("user_id", userId) : query;
  const { data, error } = await scopedQuery.maybeSingle();
  if (error) {
    return {
      data: null,
      error: {
        code: readErrorCode(error),
        message: error.message ?? "attempt_provider_request_lookup_failed",
      },
    };
  }
  const row = asObject(data);
  return {
    data: data
      ? {
          id: asString(row.id),
          generationId: asString(row.generation_id),
          userId: asString(row.user_id),
          attemptNumber: asNumber(row.attempt_number),
          providerRequestId: asString(row.provider_request_id),
          metadata: asObject(row.metadata),
        }
      : null,
    error: null,
  };
};

const lookupLatestAttempt = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}) => {
  const { data, error } = await getSupabaseAdmin()
    .from("generation_attempts")
    .select("id, attempt_number")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
};

export const lookupLatestGenerationAttempt = async ({
  generationId,
  userId,
}: LookupLatestGenerationAttemptInput): Promise<{
  data: GenerationAttemptLookupRow | null;
  error: { code?: string | null; message?: string | null } | null;
}> => {
  const { data, error } = await getSupabaseAdmin()
    .from("generation_attempts")
    .select("id, generation_id, user_id, attempt_number, provider_request_id, metadata")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      data: null,
      error: {
        code: readErrorCode(error),
        message: error.message ?? "attempt_generation_lookup_failed",
      },
    };
  }
  const row = asObject(data);
  return {
    data: data
      ? {
          id: asString(row.id),
          generationId: asString(row.generation_id),
          userId: asString(row.user_id),
          attemptNumber: asNumber(row.attempt_number),
          providerRequestId: asString(row.provider_request_id),
          metadata: asObject(row.metadata),
        }
      : null,
    error: null,
  };
};

export const ensureAcceptedGenerationAttempt = async ({
  generationId,
  userId,
  provider,
  modelId,
  providerRequestId,
  dispatchSource,
  submitRoute = null,
  queueId = null,
  metadata = {},
}: EnsureAcceptedGenerationAttemptInput): Promise<EnsureAcceptedGenerationAttemptResult> => {
  try {
    const normalizedProviderRequestId = asString(providerRequestId);
    if (!normalizedProviderRequestId) {
      return { ok: false, error: "provider_request_id_required" };
    }

    const existingLookup = await lookupAttemptByProviderRequest({
      generationId,
      userId,
      providerRequestId: normalizedProviderRequestId,
    });
    if (existingLookup.error) {
      return {
        ok: false,
        error: existingLookup.error.message ?? "attempt_existing_lookup_failed",
      };
    }

    const nowIso = new Date().toISOString();
    const metadataPatch = {
      ...metadata,
      provider_request_id: normalizedProviderRequestId,
    };

    const existingRow = asObject(existingLookup.data);
    const existingId = asString(existingRow.id);
    const existingAttemptNumber = asNumber(existingRow.attempt_number);

    if (existingId) {
      const { error } = await getSupabaseAdmin()
        .from("generation_attempts")
        .update({
          provider,
          model_id: modelId,
          status: "submitted",
          dispatch_source: dispatchSource,
          submit_route: submitRoute,
          queue_id: queueId,
          submitted_at: nowIso,
          updated_at: nowIso,
          metadata: {
            ...asObject(existingRow.metadata),
            ...metadataPatch,
          },
        })
        .eq("id", existingId)
        .eq("user_id", userId);
      if (error) {
        return {
          ok: false,
          error: error.message ?? "attempt_update_failed",
        };
      }
      return {
        ok: true,
        attemptId: existingId,
        attemptNumber: existingAttemptNumber,
      };
    }

    const latestLookup = await lookupLatestAttempt({ generationId, userId });
    if (latestLookup.error) {
      return {
        ok: false,
        error: latestLookup.error.message ?? "attempt_sequence_lookup_failed",
      };
    }

    const latestRow = asObject(latestLookup.data);
    const nextAttemptNumber = Math.max(asNumber(latestRow.attempt_number) ?? 0, 0) + 1;

    const { data, error } = await getSupabaseAdmin()
      .from("generation_attempts")
      .insert({
        generation_id: generationId,
        user_id: userId,
        attempt_number: nextAttemptNumber,
        provider,
        model_id: modelId,
        provider_request_id: normalizedProviderRequestId,
        status: "submitted",
        dispatch_source: dispatchSource,
        submit_route: submitRoute,
        queue_id: queueId,
        submitted_at: nowIso,
        metadata: metadataPatch,
        updated_at: nowIso,
      })
      .select("id, attempt_number")
      .single();

    if (!error) {
      const insertedRow = asObject(data);
      return {
        ok: true,
        attemptId: asString(insertedRow.id),
        attemptNumber: asNumber(insertedRow.attempt_number),
      };
    }

    if (readErrorCode(error) !== "23505") {
      return {
        ok: false,
        error: error.message ?? "attempt_insert_failed",
      };
    }

    const retryLookup = await lookupAttemptByProviderRequest({
      generationId,
      userId,
      providerRequestId: normalizedProviderRequestId,
    });
    if (retryLookup.error) {
      return {
        ok: false,
        error: retryLookup.error.message ?? "attempt_duplicate_lookup_failed",
      };
    }
    const retryRow = asObject(retryLookup.data);
    return {
      ok: true,
      attemptId: asString(retryRow.id),
      attemptNumber: asNumber(retryRow.attempt_number),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
    };
  }
};

export const updateGenerationAttemptState = async ({
  providerRequestId,
  userId,
  status,
  observedAt = null,
  completedAt = null,
  failureReasonCode = null,
  errorMessage = null,
  metadata = {},
}: UpdateGenerationAttemptStateInput): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const lookup = await lookupGenerationAttemptByProviderRequest({
      providerRequestId,
      userId,
    });
    if (lookup.error) {
      return {
        ok: false,
        error: lookup.error.message ?? "attempt_provider_request_lookup_failed",
      };
    }

    const attemptId = asString(lookup.data?.id);
    if (!attemptId) {
      return {
        ok: false,
        error: "attempt_not_found",
      };
    }

    const nowIso = observedAt ?? new Date().toISOString();
    const nextMetadata = {
      ...asObject(lookup.data?.metadata),
      ...metadata,
    };
    const updatePayload: Record<string, unknown> = {
      status,
      last_observed_at: nowIso,
      updated_at: nowIso,
      metadata: nextMetadata,
    };

    if (status === "running") {
      updatePayload.started_at = nowIso;
      updatePayload.failure_reason_code = null;
      updatePayload.error_message = null;
    } else {
      updatePayload.completed_at = completedAt ?? nowIso;
      updatePayload.failure_reason_code = failureReasonCode;
      updatePayload.error_message = errorMessage;
    }

    const { error } = await getSupabaseAdmin()
      .from("generation_attempts")
      .update(updatePayload)
      .eq("id", attemptId)
      .eq("user_id", userId);

    if (error) {
      return {
        ok: false,
        error: error.message ?? "attempt_state_update_failed",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
    };
  }
};
