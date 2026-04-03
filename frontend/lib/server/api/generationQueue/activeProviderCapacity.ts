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
import { resolveProviderFromModelId } from "../../providerIntegration/providerRuntimeConfig";
import { getSupabaseAdmin } from "../supabaseAdmin";

type JsonObject = Record<string, unknown>;

type ReservationRow = {
  userId: string;
  modelId: string;
  providerRequestId: string | null;
  createdAtMs: number | null;
};

type GenerationRow = {
  userId: string;
  requestId: string;
  status: string | null;
  recoveryState: string | null;
  createdAtMs: number | null;
};

type GenerationAttemptRow = {
  userId: string;
  requestId: string;
  generationId: string;
};

type GenerationStateRow = {
  userId: string;
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
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  if (!userId || !modelId) return null;
  return {
    userId,
    modelId,
    providerRequestId: asString(row.provider_request_id),
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const parseGenerationRow = (value: unknown): GenerationRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const userId = asString(row.user_id);
  const requestId = asString(row.request_id);
  if (!userId || !requestId) return null;
  return {
    userId,
    requestId,
    status: asString(row.status)?.toLowerCase() ?? null,
    recoveryState: asString(row.recovery_state)?.toLowerCase() ?? null,
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const parseGenerationAttemptRow = (value: unknown): GenerationAttemptRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const userId = asString(row.user_id);
  const requestId = asString(row.provider_request_id);
  const generationId = asString(row.generation_id);
  if (!userId || !requestId || !generationId) return null;
  return {
    userId,
    requestId,
    generationId,
  };
};

const parseGenerationStateRow = (value: unknown): GenerationStateRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const userId = asString(row.user_id);
  const generationId = asString(row.id);
  if (!userId || !generationId) return null;
  return {
    userId,
    generationId,
    status: asString(row.status)?.toLowerCase() ?? null,
    recoveryState: asString(row.recovery_state)?.toLowerCase() ?? null,
    createdAtMs: parseTimestampMs(row.created_at),
  };
};

const STALE_ACTIVE_RECOVERY_STATES = new Set(["queued", "recovering"]);

const buildScopedRequestKey = ({
  userId,
  requestId,
}: {
  userId: string;
  requestId: string;
}): string => `${userId}:${requestId}`;

const readGenerationRowsByAttemptRequestIds = async ({
  userId,
  requestIds,
}: {
  userId?: string | null;
  requestIds: string[];
}): Promise<{ rows: GenerationRow[]; handled: boolean }> => {
  let attemptsQuery = getSupabaseAdmin()
    .from("generation_attempts")
    .select("user_id, provider_request_id, generation_id");
  if (userId) {
    attemptsQuery = attemptsQuery.eq("user_id", userId);
  }
  const attemptsResponse = await attemptsQuery.in("provider_request_id", requestIds);

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
  let generationsQuery = getSupabaseAdmin()
    .from("ai_generations")
    .select("user_id, id, status, recovery_state, created_at");
  if (userId) {
    generationsQuery = generationsQuery.eq("user_id", userId);
  }
  const generationsResponse = await generationsQuery.in("id", generationIds);
  if (generationsResponse.error) throw generationsResponse.error;

  const generationsById = new Map<string, GenerationStateRow>();
  const generationRows = (Array.isArray(generationsResponse.data) ? generationsResponse.data : [])
    .map((row) => parseGenerationStateRow(row))
    .filter((row): row is GenerationStateRow => Boolean(row));

  for (const row of generationRows) {
    generationsById.set(
      buildScopedRequestKey({ userId: row.userId, requestId: row.generationId }),
      row
    );
  }

  const resolvedRows: GenerationRow[] = [];
  for (const attemptRow of attemptRows) {
    const generation = generationsById.get(
      buildScopedRequestKey({ userId: attemptRow.userId, requestId: attemptRow.generationId })
    );
    if (!generation) continue;
    resolvedRows.push({
      ...generation,
      userId: attemptRow.userId,
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
 * Reads active reserved holds for the requested provider scope and classifies stale holds so
 * queue/admission capacity checks can ignore known-non-active reservations.
 */
export const readActiveProviderCapacitySnapshot = async ({
  userId,
  provider,
  modelId,
  staleIgnoreMinAgeSeconds,
  orphanGraceSeconds,
  activeGenerationStaleIgnoreMinAgeSeconds,
  nowMs = Date.now(),
}: {
  userId?: string | null;
  provider: string;
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

  let reservationsQuery = getSupabaseAdmin()
    .from("ai_credit_reservations")
    .select("user_id, model_id, provider_request_id, created_at")
    .eq("status", ACTIVE_RESERVATION_STATUS);
  if (userId) {
    reservationsQuery = reservationsQuery.eq("user_id", userId);
  }
  if (!includeUnattachedReservations) {
    reservationsQuery = reservationsQuery.not("provider_request_id", "is", null);
  }
  const reservationsResponse = await reservationsQuery;
  if (reservationsResponse.error) throw reservationsResponse.error;

  const reservations = (Array.isArray(reservationsResponse.data) ? reservationsResponse.data : [])
    .map((row) => parseReservationRow(row))
    .filter(
      (row): row is ReservationRow =>
        row !== null &&
        resolveProviderFromModelId({ modelId: row.modelId, fallback: provider }) === provider
    );

  if (!reservations.length) {
    return {
      tier,
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    };
  }

  const requestIds = Array.from(
    new Set(
      reservations
        .map((row) => row.providerRequestId)
        .filter((requestId): requestId is string => Boolean(requestId))
    )
  );
  const generationRowsByRequestId = new Map<string, GenerationRow[]>();
  let generationRows: GenerationRow[] = [];

  if (requestIds.length > 0) {
    const attemptScopedRows = await readGenerationRowsByAttemptRequestIds({
      userId,
      requestIds,
    });
    generationRows = attemptScopedRows.rows;

    if (!attemptScopedRows.handled) {
      let generationsQuery = getSupabaseAdmin()
        .from("ai_generations")
        .select("user_id, request_id, status, recovery_state, created_at");
      if (userId) {
        generationsQuery = generationsQuery.eq("user_id", userId);
      }
      const generationsResponse = await generationsQuery.in("request_id", requestIds);
      if (generationsResponse.error) throw generationsResponse.error;
      generationRows = (Array.isArray(generationsResponse.data) ? generationsResponse.data : [])
        .map((row) => parseGenerationRow(row))
        .filter((row): row is GenerationRow => Boolean(row));
    }
  }

  for (const row of generationRows) {
    const requestKey = buildScopedRequestKey({ userId: row.userId, requestId: row.requestId });
    const existing = generationRowsByRequestId.get(requestKey) ?? [];
    existing.push(row);
    generationRowsByRequestId.set(requestKey, existing);
  }

  let globalActive = 0;
  let tierActive = 0;
  let staleIgnoredGlobal = 0;
  let staleIgnoredTier = 0;

  for (const reservation of reservations) {
    const generationRowsForRequest =
      reservation.providerRequestId === null
        ? []
        : (generationRowsByRequestId.get(
            buildScopedRequestKey({
              userId: reservation.userId,
              requestId: reservation.providerRequestId,
            })
          ) ?? []);
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
