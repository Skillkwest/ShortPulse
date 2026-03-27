import { lookupLatestGenerationAttempt } from "../generationAttempts";
import { isMissingGenerationAttemptSchemaError } from "../generationBilling/errorGuards";
import { getSupabaseAdmin } from "../supabaseAdmin";

type JsonObject = Record<string, unknown>;

const RECOVERY_STATES = new Set(["queued", "recovering"]);
const GENERATION_STATUSES = new Set(["pending", "submitted", "running", "fail"]);
const SUPPORTED_PROVIDER_PREFIXES = ["fal", "kie"] as const;

type RepairCandidate = {
  id: string;
  userId: string;
  requestId: string | null;
  provider: string;
  status: string;
  recoveryState: string;
  recoveryAttempts: number;
  sourceRef: string | null;
  metadata: JsonObject;
};

type ReadRepairCandidateResult = {
  candidate: RepairCandidate | null;
  errorMessage: string | null;
};

type ReservationProviderRequestIdLookupResult = {
  providerRequestId: string | null;
  errorMessage: string | null;
};

type AttemptProviderRequestIdLookupResult = {
  providerRequestId: string | null;
  errorMessage: string | null;
};

export type GenerationRequestIdRepairResult = {
  repaired: boolean;
  generationId: string | null;
  requestId: string | null;
  sourceRef: string | null;
  reason:
    | "repaired"
    | "already_present"
    | "missing_lookup_key"
    | "not_found"
    | "provider_not_supported"
    | "state_not_eligible"
    | "status_not_eligible"
    | "missing_source_ref"
    | "missing_provider_request_id"
    | "db_error";
  errorMessage: string | null;
};

export type GenerationRequestIdRepairBatchResult = {
  scanned: number;
  repaired: number;
  errors: number;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const isSupportedProvider = (provider: string): boolean => {
  const normalized = provider.trim().toLowerCase();
  return SUPPORTED_PROVIDER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const parseRepairCandidate = (value: unknown): RepairCandidate | null => {
  const row = asObject(value);
  if (!row) return null;
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const provider = asString(row.provider);
  const status = asString(row.status)?.toLowerCase();
  const recoveryState = asString(row.recovery_state)?.toLowerCase();
  const metadata = asObject(row.metadata) ?? {};
  if (!id || !userId || !provider || !status || !recoveryState) return null;
  return {
    id,
    userId,
    requestId: asString(row.request_id),
    provider,
    status,
    recoveryState,
    recoveryAttempts: Math.max(0, asInteger(row.recovery_attempts, 0)),
    sourceRef: asString(metadata.source_ref),
    metadata,
  };
};

const readRepairCandidate = async ({
  userId,
  generationId,
  sourceRef,
}: {
  userId: string;
  generationId: string | null;
  sourceRef: string | null;
}): Promise<ReadRepairCandidateResult> => {
  const supabase = getSupabaseAdmin();
  const selectFields =
    "id, user_id, request_id, provider, status, recovery_state, recovery_attempts, metadata";

  if (generationId) {
    const { data, error } = await supabase
      .from("ai_generations")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("id", generationId)
      .maybeSingle();
    return {
      candidate: parseRepairCandidate(data),
      errorMessage: error?.message ?? null,
    };
  }

  if (!sourceRef) {
    return {
      candidate: null,
      errorMessage: null,
    };
  }
  const { data, error } = await supabase
    .from("ai_generations")
    .select(selectFields)
    .eq("user_id", userId)
    .contains("metadata", { source_ref: sourceRef })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    candidate: parseRepairCandidate(data),
    errorMessage: error?.message ?? null,
  };
};

const readReservationProviderRequestId = async ({
  userId,
  sourceRef,
}: {
  userId: string;
  sourceRef: string;
}): Promise<ReservationProviderRequestIdLookupResult> => {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("provider_request_id")
    .eq("user_id", userId)
    .eq("source_ref", sourceRef)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[generationQueue] reservation lookup for request-id repair failed", {
      userId,
      sourceRef,
      message: error.message,
    });
    return {
      providerRequestId: null,
      errorMessage: error.message ?? "reservation_lookup_failed",
    };
  }
  return {
    providerRequestId: asString(
      (data as { provider_request_id?: unknown } | null)?.provider_request_id
    ),
    errorMessage: null,
  };
};

const readAttemptProviderRequestId = async ({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string;
}): Promise<AttemptProviderRequestIdLookupResult> => {
  const attemptLookup = await lookupLatestGenerationAttempt({
    userId,
    generationId,
  });
  if (attemptLookup.error) {
    if (
      isMissingGenerationAttemptSchemaError(
        attemptLookup.error.code ?? null,
        attemptLookup.error.message ?? undefined
      )
    ) {
      return {
        providerRequestId: null,
        errorMessage: null,
      };
    }
    console.error("[generationQueue] attempt lookup for request-id repair failed", {
      userId,
      generationId,
      message: attemptLookup.error.message ?? null,
    });
    return {
      providerRequestId: null,
      errorMessage: attemptLookup.error.message ?? "attempt_lookup_failed",
    };
  }
  return {
    providerRequestId: asString(attemptLookup.data?.providerRequestId),
    errorMessage: null,
  };
};

const applyRequestIdRepair = async ({
  candidate,
  providerRequestId,
  repairSource,
}: {
  candidate: RepairCandidate;
  providerRequestId: string;
  repairSource: "attempt_backfill" | "reservation_backfill";
}): Promise<GenerationRequestIdRepairResult> => {
  const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update({
      request_id: providerRequestId,
      status: "running",
      failure_reason_code: null,
      error_message: null,
      completed_at: null,
      recovery_state: "queued",
      next_recovery_at: nextRecoveryAtIso,
      metadata: {
        ...candidate.metadata,
        source_ref: candidate.sourceRef,
        provider_request_id: providerRequestId,
        request_id_repaired_at: new Date().toISOString(),
        request_id_repair_source: repairSource,
      },
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.userId)
    .is("request_id", null)
    .select("id, request_id");

  if (error) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "db_error",
      errorMessage: error.message ?? "request_id_repair_failed",
    };
  }

  const repairedRequestId = asString((Array.isArray(data) ? data[0] : data)?.request_id);
  if (repairedRequestId) {
    return {
      repaired: true,
      generationId: candidate.id,
      requestId: repairedRequestId,
      sourceRef: candidate.sourceRef,
      reason: "repaired",
      errorMessage: null,
    };
  }

  return {
    repaired: false,
    generationId: candidate.id,
    requestId: null,
    sourceRef: candidate.sourceRef,
    reason: "db_error",
    errorMessage: "request_id_repair_not_applied",
  };
};

export const repairGenerationRequestIdFromReservation = async ({
  userId,
  generationId,
  sourceRef,
}: {
  userId: string;
  generationId: string | null;
  sourceRef: string | null;
}): Promise<GenerationRequestIdRepairResult> => {
  if (!generationId && !sourceRef) {
    return {
      repaired: false,
      generationId: null,
      requestId: null,
      sourceRef: null,
      reason: "missing_lookup_key",
      errorMessage: null,
    };
  }

  const { candidate, errorMessage: candidateErrorMessage } = await readRepairCandidate({
    userId,
    generationId,
    sourceRef,
  });
  if (candidateErrorMessage) {
    return {
      repaired: false,
      generationId: generationId ?? null,
      requestId: null,
      sourceRef: sourceRef ?? null,
      reason: "db_error",
      errorMessage: candidateErrorMessage,
    };
  }
  if (!candidate) {
    return {
      repaired: false,
      generationId: generationId ?? null,
      requestId: null,
      sourceRef: sourceRef ?? null,
      reason: "not_found",
      errorMessage: null,
    };
  }

  if (candidate.requestId) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      sourceRef: candidate.sourceRef,
      reason: "already_present",
      errorMessage: null,
    };
  }

  if (!isSupportedProvider(candidate.provider)) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "provider_not_supported",
      errorMessage: null,
    };
  }

  if (!RECOVERY_STATES.has(candidate.recoveryState)) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "state_not_eligible",
      errorMessage: null,
    };
  }

  if (!GENERATION_STATUSES.has(candidate.status)) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "status_not_eligible",
      errorMessage: null,
    };
  }

  if (!candidate.sourceRef) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: null,
      reason: "missing_source_ref",
      errorMessage: null,
    };
  }

  const attemptLookup = await readAttemptProviderRequestId({
    userId,
    generationId: candidate.id,
  });
  if (attemptLookup.errorMessage) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "db_error",
      errorMessage: attemptLookup.errorMessage,
    };
  }
  if (attemptLookup.providerRequestId) {
    return applyRequestIdRepair({
      candidate,
      providerRequestId: attemptLookup.providerRequestId,
      repairSource: "attempt_backfill",
    });
  }

  const reservationLookup = await readReservationProviderRequestId({
    userId,
    sourceRef: candidate.sourceRef,
  });
  if (reservationLookup.errorMessage) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "db_error",
      errorMessage: reservationLookup.errorMessage,
    };
  }
  if (!reservationLookup.providerRequestId) {
    return {
      repaired: false,
      generationId: candidate.id,
      requestId: null,
      sourceRef: candidate.sourceRef,
      reason: "missing_provider_request_id",
      errorMessage: null,
    };
  }

  return applyRequestIdRepair({
    candidate,
    providerRequestId: reservationLookup.providerRequestId,
    repairSource: "reservation_backfill",
  });
};

export const repairGenerationRequestIdsFromReservations = async ({
  limit,
}: {
  limit: number;
}): Promise<GenerationRequestIdRepairBatchResult> => {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.max(1, Math.trunc(limit));
  const { data, error } = await supabase
    .from("ai_generations")
    .select(
      "id, user_id, request_id, provider, status, recovery_state, recovery_attempts, metadata"
    )
    .is("request_id", null)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error("[generationQueue] request-id repair batch scan failed", error.message);
    return {
      scanned: 0,
      repaired: 0,
      errors: 1,
    };
  }

  const candidates = Array.isArray(data)
    ? data
        .map((row) => parseRepairCandidate(row))
        .filter((row): row is RepairCandidate => Boolean(row))
        .filter(
          (row) =>
            !row.requestId &&
            isSupportedProvider(row.provider) &&
            RECOVERY_STATES.has(row.recoveryState) &&
            GENERATION_STATUSES.has(row.status)
        )
    : [];

  let repaired = 0;
  let errors = 0;
  for (const candidate of candidates) {
    const result = await repairGenerationRequestIdFromReservation({
      userId: candidate.userId,
      generationId: candidate.id,
      sourceRef: candidate.sourceRef,
    });
    if (result.repaired) repaired += 1;
    if (result.reason === "db_error") errors += 1;
  }

  return {
    scanned: candidates.length,
    repaired,
    errors,
  };
};
