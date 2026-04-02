/**
 * Queue-status scoped recovery claim helper.
 * Claims one due generation for the requesting user so status polling can
 * advance stale recovery rows without cross-user side effects.
 */

import { readFalRuntimeFlags } from "../falRuntimeFlags";
import { readGenerationProjectionLinkBySourceRef } from "../generationProjection";
import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  resolveSupportedRecoveryProviderFamily,
  tryClaimRecoveryCandidate,
} from "../generationRecoveryClaimPolicy";
import { repairGenerationRequestIdFromReservation } from "./requestIdRepair";

type JsonObject = Record<string, unknown>;

type QueueStatusRecoveryClaimReason =
  | "claimed"
  | "missing_lookup_key"
  | "disabled"
  | "not_found"
  | "provider_not_supported"
  | "missing_request_id"
  | "state_not_eligible"
  | "status_not_eligible"
  | "not_due"
  | "too_recent"
  | "max_attempts_reached"
  | "claim_conflict"
  | "db_error";

export type QueueStatusRecoveryClaimResult = {
  claimed: boolean;
  generationId: string | null;
  requestId: string | null;
  reason: QueueStatusRecoveryClaimReason;
  errorMessage: string | null;
};

type RecoveryCandidate = {
  id: string;
  requestId: string | null;
  provider: string;
  status: string;
  recoveryState: string;
  recoveryAttempts: number;
  nextRecoveryAt: string | null;
  createdAt: string | null;
};

const RECOVERY_STATES = new Set(["queued", "recovering"]);
const GENERATION_STATUSES = new Set(["pending", "submitted", "running", "fail"]);

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
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseCandidate = (value: unknown): RecoveryCandidate | null => {
  const row = asObject(value);
  if (!row) return null;
  const id = asString(row.id);
  const provider = asString(row.provider);
  const status = asString(row.status)?.toLowerCase();
  const recoveryState = asString(row.recovery_state)?.toLowerCase();
  if (!id || !provider || !status || !recoveryState) return null;
  return {
    id,
    requestId: asString(row.request_id),
    provider,
    status,
    recoveryState,
    recoveryAttempts: Math.max(0, asInteger(row.recovery_attempts, 0)),
    nextRecoveryAt: asString(row.next_recovery_at),
    createdAt: asString(row.created_at),
  };
};

const parseIsoMs = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readRecoveryCandidate = async ({
  userId,
  generationId,
  sourceRef,
}: {
  userId: string;
  generationId: string | null;
  sourceRef: string | null;
}): Promise<RecoveryCandidate | null> => {
  const supabase = getSupabaseAdmin();
  const selectFields =
    "id, request_id, provider, status, recovery_state, recovery_attempts, next_recovery_at, created_at";

  if (generationId) {
    const { data } = await supabase
      .from("ai_generations")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("id", generationId)
      .maybeSingle();
    return parseCandidate(data);
  }

  if (!sourceRef) return null;
  const projectionLink = await readGenerationProjectionLinkBySourceRef({
    userId,
    sourceRef,
    supabaseAdmin: supabase,
  }).catch(() => null);
  if (projectionLink?.generationId) {
    const { data } = await supabase
      .from("ai_generations")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("id", projectionLink.generationId)
      .maybeSingle();
    return parseCandidate(data);
  }

  const { data } = await supabase
    .from("ai_generations")
    .select(selectFields)
    .eq("user_id", userId)
    .contains("metadata", { source_ref: sourceRef })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return parseCandidate(data);
};

const claimDueQueueStatusRecoveryInternal = async ({
  userId,
  generationId,
  sourceRef,
  allowRepair,
}: {
  userId: string;
  generationId: string | null;
  sourceRef: string | null;
  allowRepair: boolean;
}): Promise<QueueStatusRecoveryClaimResult> => {
  if (!generationId && !sourceRef) {
    return {
      claimed: false,
      generationId: null,
      requestId: null,
      reason: "missing_lookup_key",
      errorMessage: null,
    };
  }

  const flags = readFalRuntimeFlags();
  if (!flags.reconcilerEnabled || flags.integrationMode === "legacy") {
    return {
      claimed: false,
      generationId: null,
      requestId: null,
      reason: "disabled",
      errorMessage: null,
    };
  }

  const candidate = await readRecoveryCandidate({ userId, generationId, sourceRef });
  if (!candidate) {
    return {
      claimed: false,
      generationId: null,
      requestId: null,
      reason: "not_found",
      errorMessage: null,
    };
  }

  const providerFamily = resolveSupportedRecoveryProviderFamily(candidate.provider);
  if (!providerFamily) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "provider_not_supported",
      errorMessage: null,
    };
  }

  if (!RECOVERY_STATES.has(candidate.recoveryState)) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "state_not_eligible",
      errorMessage: null,
    };
  }

  if (!GENERATION_STATUSES.has(candidate.status)) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "status_not_eligible",
      errorMessage: null,
    };
  }

  if (candidate.recoveryAttempts >= flags.reconcilerMaxAttempts) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "max_attempts_reached",
      errorMessage: null,
    };
  }

  const nowMs = Date.now();
  const nextRecoveryAtMs = parseIsoMs(candidate.nextRecoveryAt);
  if (nextRecoveryAtMs !== null && nextRecoveryAtMs > nowMs) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "not_due",
      errorMessage: null,
    };
  }

  const createdAtMs = parseIsoMs(candidate.createdAt);
  const oldestAllowedMs = nowMs - flags.reconcilerMinAgeSeconds * 1000;
  if (createdAtMs !== null && createdAtMs > oldestAllowedMs) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason: "too_recent",
      errorMessage: null,
    };
  }

  if (!candidate.requestId) {
    if (allowRepair) {
      const repairResult = await repairGenerationRequestIdFromReservation({
        userId,
        generationId: candidate.id,
        sourceRef,
      });
      if (repairResult.repaired) {
        return claimDueQueueStatusRecoveryInternal({
          userId,
          generationId: candidate.id,
          sourceRef,
          allowRepair: false,
        });
      }
      if (repairResult.reason === "db_error") {
        return {
          claimed: false,
          generationId: candidate.id,
          requestId: null,
          reason: "db_error",
          errorMessage: repairResult.errorMessage,
        };
      }
    }

    return {
      claimed: false,
      generationId: candidate.id,
      requestId: null,
      reason: "missing_request_id",
      errorMessage: null,
    };
  }

  const nowIso = new Date(nowMs).toISOString();
  const oldestAllowedIso = new Date(oldestAllowedMs).toISOString();
  const leaseUntilIso = new Date(nowMs + flags.reconcilerLeaseSeconds * 1000).toISOString();
  const claimResult = await tryClaimRecoveryCandidate({
    candidate: {
      id: candidate.id,
      userId,
      requestId: candidate.requestId,
      provider: candidate.provider,
      status: candidate.status,
      recoveryState: candidate.recoveryState,
      recoveryAttempts: candidate.recoveryAttempts,
    },
    maxAttempts: flags.reconcilerMaxAttempts,
    oldestAllowedIso,
    nowIso,
    leaseUntilIso,
  });
  if (!claimResult.claimed) {
    return {
      claimed: false,
      generationId: candidate.id,
      requestId: candidate.requestId,
      reason:
        claimResult.reason === "provider_not_supported"
          ? "provider_not_supported"
          : claimResult.reason,
      errorMessage: claimResult.errorMessage,
    };
  }

  return {
    claimed: true,
    generationId: candidate.id,
    requestId: claimResult.requestId,
    reason: "claimed",
    errorMessage: null,
  };
};

export const claimDueQueueStatusRecovery = async ({
  userId,
  generationId,
  sourceRef,
}: {
  userId: string;
  generationId: string | null;
  sourceRef: string | null;
}): Promise<QueueStatusRecoveryClaimResult> =>
  claimDueQueueStatusRecoveryInternal({
    userId,
    generationId,
    sourceRef,
    allowRepair: true,
  });
