/**
 * Shared provider-attached capacity snapshot helper used by admission and queue dispatch.
 * Classifies stale reservations so non-active holds do not block new dispatch capacity forever.
 */
import {
  resolveGenerationAdmissionTier,
  type GenerationAdmissionTier,
} from "../../../model-runtime/generationAdmissionTiers";
import {
  isMissingGenerationAttemptSchemaError,
  readErrorCode,
} from "../generationBilling/errorGuards";
import { getSupabaseAdmin } from "../supabaseAdmin";

type JsonObject = Record<string, unknown>;

type ReservationRow = {
  modelId: string;
  providerRequestId: string;
  createdAtMs: number | null;
};

type GenerationRow = {
  requestId: string;
  status: string | null;
  recoveryState: string | null;
  createdAtMs: number | null;
};

type GenerationAttemptRow = {
  requestId: string;
  generationId: string;
};

type GenerationStateRow = {
  generationId: string;
  status: string | null;
  recoveryState: string | null;
  createdAtMs: number | null;
};

export type ActiveProviderCapacitySnapshot = {
  tier: GenerationAdmissionTier;
  globalActive: number;
  tierActive: number;
  staleIgnoredGlobal: number;
  staleIgnoredTier: number;
};

const ACTIVE_RESERVATION_STATUS = "reserved";
const ACTIVE_GENERATION_STATUSES = new Set(["pending", "submitted", "running"]);
const TERMINAL_GENERATION_STATUSES = new Set(["fail", "success", "cancelled"]);

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseTimestampMs = (value: unknown): number | null => {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseReservationRow = (value: unknown): ReservationRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const modelId = asString(row.model_id);
  const providerRequestId = asString(row.provider_request_id);
  if (!modelId || !providerRequestId) return null;
  return {
    modelId,
    providerRequestId,
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const parseGenerationRow = (value: unknown): GenerationRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const requestId = asString(row.request_id);
  if (!requestId) return null;
  return {
    requestId,
    status: asString(row.status)?.toLowerCase() ?? null,
    recoveryState: asString(row.recovery_state)?.toLowerCase() ?? null,
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const parseGenerationAttemptRow = (value: unknown): GenerationAttemptRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const requestId = asString(row.provider_request_id);
  const generationId = asString(row.generation_id);
  if (!requestId || !generationId) return null;
  return {
    requestId,
    generationId,
  };
};

const parseGenerationStateRow = (value: unknown): GenerationStateRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const generationId = asString(row.id);
  if (!generationId) return null;
  return {
    generationId,
    status: asString(row.status)?.toLowerCase() ?? null,
    recoveryState: asString(row.recovery_state)?.toLowerCase() ?? null,
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const STALE_ACTIVE_RECOVERY_STATES = new Set(["queued", "recovering"]);

const readGenerationRowsByAttemptRequestIds = async ({
  userId,
  requestIds,
}: {
  userId: string;
  requestIds: string[];
}): Promise<{ rows: GenerationRow[]; handled: boolean }> => {
  const attemptsResponse = await getSupabaseAdmin()
    .from("generation_attempts")
    .select("provider_request_id, generation_id")
    .eq("user_id", userId)
    .in("provider_request_id", requestIds);

  if (attemptsResponse.error) {
    if (
      isMissingGenerationAttemptSchemaError(
        readErrorCode(attemptsResponse.error),
        attemptsResponse.error.message
      )
    ) {
      return { rows: [], handled: false };
    }
    throw attemptsResponse.error;
  }

  const attemptRows = (Array.isArray(attemptsResponse.data) ? attemptsResponse.data : [])
    .map((row) => parseGenerationAttemptRow(row))
    .filter((row): row is GenerationAttemptRow => Boolean(row));
  if (!attemptRows.length) {
    return { rows: [], handled: true };
  }

  const generationIds = Array.from(new Set(attemptRows.map((row) => row.generationId)));
  const generationsResponse = await getSupabaseAdmin()
    .from("ai_generations")
    .select("id, status, recovery_state, created_at")
    .eq("user_id", userId)
    .in("id", generationIds);
  if (generationsResponse.error) throw generationsResponse.error;

  const generationsById = new Map<string, GenerationStateRow>();
  const generationRows = (Array.isArray(generationsResponse.data) ? generationsResponse.data : [])
    .map((row) => parseGenerationStateRow(row))
    .filter((row): row is GenerationStateRow => Boolean(row));

  for (const row of generationRows) {
    generationsById.set(row.generationId, row);
  }

  const resolvedRows: GenerationRow[] = [];
  for (const attemptRow of attemptRows) {
    const generation = generationsById.get(attemptRow.generationId);
    if (!generation) continue;
    resolvedRows.push({
      ...generation,
      requestId: attemptRow.requestId,
    });
  }

  return { rows: resolvedRows, handled: true };
};

const classifyGenerationRequestState = ({
  rows,
  nowMs,
  activeGenerationStaleIgnoreMinAgeMs,
}: {
  rows: GenerationRow[];
  nowMs: number;
  activeGenerationStaleIgnoreMinAgeMs: number;
}): "active" | "stale" | "unknown" => {
  let hasActive = false;
  let hasTerminal = false;
  let allActiveRowsLookStale = true;
  for (const row of rows) {
    const status = row.status;
    const recoveryState = row.recoveryState;
    if (recoveryState === "exhausted") {
      hasTerminal = true;
      continue;
    }
    if (status && ACTIVE_GENERATION_STATUSES.has(status)) {
      hasActive = true;
      const ageMs = row.createdAtMs == null ? null : Math.max(0, nowMs - row.createdAtMs);
      const isStaleActiveRow =
        ageMs !== null &&
        ageMs >= activeGenerationStaleIgnoreMinAgeMs &&
        STALE_ACTIVE_RECOVERY_STATES.has(recoveryState ?? "");
      if (!isStaleActiveRow) {
        allActiveRowsLookStale = false;
      }
      continue;
    }
    if (status && TERMINAL_GENERATION_STATUSES.has(status)) {
      hasTerminal = true;
    }
  }
  if (hasActive && allActiveRowsLookStale) return "stale";
  if (hasActive) return "active";
  if (hasTerminal) return "stale";
  return "unknown";
};

/**
 * Reads user provider-attached reservation activity and classifies stale holds so
 * queue/admission capacity checks can ignore known-non-active reservations.
 */
export const readActiveProviderCapacitySnapshot = async ({
  userId,
  modelId,
  staleIgnoreMinAgeSeconds,
  orphanGraceSeconds,
  activeGenerationStaleIgnoreMinAgeSeconds,
  nowMs = Date.now(),
}: {
  userId: string;
  modelId: string;
  staleIgnoreMinAgeSeconds: number;
  orphanGraceSeconds: number;
  activeGenerationStaleIgnoreMinAgeSeconds?: number;
  nowMs?: number;
}): Promise<ActiveProviderCapacitySnapshot> => {
  const tier = resolveGenerationAdmissionTier(modelId);
  const staleIgnoreMinAgeMs = Math.max(0, Math.trunc(staleIgnoreMinAgeSeconds) * 1000);
  const orphanGraceMs = Math.max(0, Math.trunc(orphanGraceSeconds) * 1000);
  const activeGenerationStaleIgnoreMinAgeMs = Math.max(
    staleIgnoreMinAgeMs,
    Math.max(
      0,
      Math.trunc(activeGenerationStaleIgnoreMinAgeSeconds ?? staleIgnoreMinAgeSeconds) * 1000
    )
  );

  const reservationsResponse = await getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("model_id, provider_request_id, created_at")
    .eq("user_id", userId)
    .eq("status", ACTIVE_RESERVATION_STATUS)
    .not("provider_request_id", "is", null);
  if (reservationsResponse.error) throw reservationsResponse.error;

  const reservations = (Array.isArray(reservationsResponse.data) ? reservationsResponse.data : [])
    .map((row) => parseReservationRow(row))
    .filter((row): row is ReservationRow => Boolean(row));

  if (!reservations.length) {
    return {
      tier,
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    };
  }

  const requestIds = Array.from(new Set(reservations.map((row) => row.providerRequestId)));
  const generationRowsByRequestId = new Map<string, GenerationRow[]>();
  const attemptScopedRows = await readGenerationRowsByAttemptRequestIds({
    userId,
    requestIds,
  });
  let generationRows = attemptScopedRows.rows;

  if (!attemptScopedRows.handled) {
    const generationsResponse = await getSupabaseAdmin()
      .from("ai_generations")
      .select("request_id, status, recovery_state, created_at")
      .eq("user_id", userId)
      .in("request_id", requestIds);
    if (generationsResponse.error) throw generationsResponse.error;
    generationRows = (Array.isArray(generationsResponse.data) ? generationsResponse.data : [])
      .map((row) => parseGenerationRow(row))
      .filter((row): row is GenerationRow => Boolean(row));
  }

  for (const row of generationRows) {
    const existing = generationRowsByRequestId.get(row.requestId) ?? [];
    existing.push(row);
    generationRowsByRequestId.set(row.requestId, existing);
  }

  let globalActive = 0;
  let tierActive = 0;
  let staleIgnoredGlobal = 0;
  let staleIgnoredTier = 0;

  for (const reservation of reservations) {
    const generationRowsForRequest =
      generationRowsByRequestId.get(reservation.providerRequestId) ?? [];
    let classification: "active" | "stale" | "unknown";
    if (generationRowsForRequest.length) {
      classification = classifyGenerationRequestState({
        rows: generationRowsForRequest,
        nowMs,
        activeGenerationStaleIgnoreMinAgeMs,
      });
    } else {
      const ageMs =
        reservation.createdAtMs == null ? 0 : Math.max(0, nowMs - reservation.createdAtMs);
      if (ageMs <= orphanGraceMs) {
        classification = "active";
      } else if (ageMs >= staleIgnoreMinAgeMs) {
        classification = "stale";
      } else {
        classification = "active";
      }
    }

    const isTierModel = resolveGenerationAdmissionTier(reservation.modelId) === tier;
    if (classification === "stale") {
      staleIgnoredGlobal += 1;
      if (isTierModel) staleIgnoredTier += 1;
      continue;
    }
    globalActive += 1;
    if (isTierModel) tierActive += 1;
  }

  return {
    tier,
    globalActive,
    tierActive,
    staleIgnoredGlobal,
    staleIgnoredTier,
  };
};
