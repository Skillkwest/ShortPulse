import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  isInsufficientCreditError,
  isMissingReservationSchemaError,
  isMissingRpcFunctionError,
  isReservationRpcAmbiguityError,
  readErrorCode,
} from "./errorGuards";
import type { JsonObject, ReservationRpcResult, ReservationRpcState, RpcInvoker } from "./types";
import { asString, readObject } from "./utils";

const normalizeRpcStatus = (value: unknown, fallback: ReservationRpcState): ReservationRpcState => {
  const normalized = String(value ?? fallback).toLowerCase();
  switch (normalized) {
    case "reserved":
    case "already_reserved":
    case "admission_limited":
    case "captured":
    case "already_captured":
    case "released":
    case "already_released":
    case "not_found":
      return normalized;
    default:
      return fallback;
  }
};

const asInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseReservationRow = (
  data: unknown,
  fallbackStatus: ReservationRpcState,
  fallbackSourceRef: string | null
): ReservationRpcResult => {
  const row = readObject(Array.isArray(data) ? data[0] : data);
  const admissionGlobalActive = asInteger(row.admission_global_active);
  const admissionGlobalMax = asInteger(row.admission_global_max);
  const admissionTierActive = asInteger(row.admission_tier_active);
  const admissionTierMax = asInteger(row.admission_tier_max);
  const retryAfterSeconds = asInteger(row.retry_after_seconds);
  const admissionTier = asString(row.admission_tier);
  const admissionReason = asString(row.admission_reason);
  const hasAdmissionSnapshot =
    admissionGlobalActive !== null &&
    admissionGlobalMax !== null &&
    admissionTierActive !== null &&
    admissionTierMax !== null &&
    retryAfterSeconds !== null &&
    admissionTier !== null;

  return {
    status: normalizeRpcStatus(row.status, fallbackStatus),
    sourceRef: asString(row.source_ref) ?? fallbackSourceRef,
    message: asString(row.message) ?? null,
    admission: hasAdmissionSnapshot
      ? {
          reason: admissionReason ?? null,
          globalActive: admissionGlobalActive,
          globalMax: admissionGlobalMax,
          tier: admissionTier ?? "unknown",
          tierActive: admissionTierActive,
          tierMax: admissionTierMax,
          retryAfterSeconds,
        }
      : null,
  };
};

type ReserveGenerationCreditsAdmission = {
  mode: "off" | "shadow" | "enforce";
  globalMax: number;
  tier: string;
  tierMax: number;
  retryAfterSeconds: number;
};

const mapReserveRpcError = (error: { code?: string | null; message?: string | null }) => {
  const code = readErrorCode(error);
  if (isMissingRpcFunctionError(code, error.message ?? undefined)) {
    return { status: "failed" as const, message: "missing_reservation_function", code };
  }
  if (isMissingReservationSchemaError(code, error.message ?? undefined)) {
    return { status: "failed" as const, message: "missing_reservation_schema", code };
  }
  if (isReservationRpcAmbiguityError(code, error.message ?? undefined)) {
    return { status: "failed" as const, message: "reservation_rpc_ambiguous_column", code };
  }
  if (isInsufficientCreditError(error.message ?? undefined)) {
    return { status: "failed" as const, message: "insufficient_credits", code };
  }
  return { status: "failed" as const, message: error.message ?? "reservation_failed", code };
};

export const reserveGenerationCredits = async ({
  userId,
  sourceRef,
  modelId,
  amountCents,
  reason,
  metadata,
  admission,
}: {
  userId: string;
  sourceRef: string;
  modelId: string;
  amountCents: number;
  reason: string;
  metadata: JsonObject;
  admission?: ReserveGenerationCreditsAdmission;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    if (!admission) {
      return { status: "failed", message: "missing_admission_config", code: null };
    }
    const { data, error } = await rpcClient.rpc("admit_and_reserve_generation_credits", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_model_id: modelId,
      p_amount_cents: amountCents,
      p_reason: reason,
      p_metadata: metadata,
      p_admission_mode: admission.mode,
      p_global_max: admission.globalMax,
      p_tier: admission.tier,
      p_tier_max: admission.tierMax,
      p_retry_after_seconds: admission.retryAfterSeconds,
    });
    if (error) {
      return mapReserveRpcError(error);
    }
    return parseReservationRow(data, "reserved", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error), code: null };
  }
};

export const markGenerationReservationSubmitted = async ({
  userId,
  sourceRef,
  providerRequestId,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  providerRequestId: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("mark_generation_reservation_submitted", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_provider_request_id: providerRequestId,
      p_metadata: metadata,
    });
    if (error) {
      const code = readErrorCode(error);
      if (isMissingRpcFunctionError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function", code };
      }
      if (isMissingReservationSchemaError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_schema", code };
      }
      if (isReservationRpcAmbiguityError(code, error.message ?? undefined)) {
        return { status: "failed", message: "reservation_rpc_ambiguous_column", code };
      }
      console.error(
        "[generationBilling] mark_generation_reservation_submitted failed",
        error.message
      );
      return { status: "failed", message: error.message ?? "mark_submitted_failed", code };
    }
    return parseReservationRow(data, "not_found", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error), code: null };
  }
};

export const releaseGenerationReservationBySourceRef = async ({
  userId,
  sourceRef,
  reason,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("release_generation_reservation_by_source_ref", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_reason: reason,
      p_metadata: metadata,
    });
    if (error) {
      const code = readErrorCode(error);
      if (isMissingRpcFunctionError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function", code };
      }
      if (isMissingReservationSchemaError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_schema", code };
      }
      if (isReservationRpcAmbiguityError(code, error.message ?? undefined)) {
        return { status: "failed", message: "reservation_rpc_ambiguous_column", code };
      }
      console.error("[generationBilling] release by source_ref failed", error.message);
      return { status: "failed", message: error.message ?? "release_failed", code };
    }
    return parseReservationRow(data, "not_found", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error), code: null };
  }
};

export const releaseGenerationReservationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  metadata,
}: {
  userId: string;
  providerRequestId: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc(
      "release_generation_reservation_by_provider_request",
      {
        p_user_id: userId,
        p_provider_request_id: providerRequestId,
        p_reason: reason,
        p_metadata: metadata,
      }
    );
    if (error) {
      const code = readErrorCode(error);
      if (isMissingRpcFunctionError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function", code };
      }
      if (isMissingReservationSchemaError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_schema", code };
      }
      if (isReservationRpcAmbiguityError(code, error.message ?? undefined)) {
        return { status: "failed", message: "reservation_rpc_ambiguous_column", code };
      }
      console.error("[generationBilling] release by provider_request failed", error.message);
      return { status: "failed", message: error.message ?? "release_failed", code };
    }
    return parseReservationRow(data, "not_found", null);
  } catch (error) {
    return { status: "failed", message: String(error), code: null };
  }
};

export const captureGenerationReservationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  metadata,
}: {
  userId: string;
  providerRequestId: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc(
      "capture_generation_reservation_by_provider_request",
      {
        p_user_id: userId,
        p_provider_request_id: providerRequestId,
        p_reason: reason,
        p_metadata: metadata,
      }
    );
    if (error) {
      const code = readErrorCode(error);
      if (isMissingRpcFunctionError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function", code };
      }
      if (isMissingReservationSchemaError(code, error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_schema", code };
      }
      if (isReservationRpcAmbiguityError(code, error.message ?? undefined)) {
        return { status: "failed", message: "reservation_rpc_ambiguous_column", code };
      }
      console.error("[generationBilling] capture by provider_request failed", error.message);
      return { status: "failed", message: error.message ?? "capture_failed", code };
    }
    return parseReservationRow(data, "not_found", null);
  } catch (error) {
    return { status: "failed", message: String(error), code: null };
  }
};
