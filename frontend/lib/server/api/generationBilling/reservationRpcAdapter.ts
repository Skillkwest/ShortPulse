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

const parseReservationRow = (
  data: unknown,
  fallbackStatus: ReservationRpcState,
  fallbackSourceRef: string | null
): ReservationRpcResult => {
  const row = readObject(Array.isArray(data) ? data[0] : data);
  return {
    status: normalizeRpcStatus(row.status, fallbackStatus),
    sourceRef: asString(row.source_ref) ?? fallbackSourceRef,
    message: asString(row.message) ?? null,
  };
};

export const reserveGenerationCredits = async ({
  userId,
  sourceRef,
  modelId,
  amountCents,
  reason,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  modelId: string;
  amountCents: number;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("reserve_generation_credits", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_model_id: modelId,
      p_amount_cents: amountCents,
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
      if (isInsufficientCreditError(error.message ?? undefined)) {
        return { status: "failed", message: "insufficient_credits", code };
      }
      return { status: "failed", message: error.message ?? "reservation_failed", code };
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
