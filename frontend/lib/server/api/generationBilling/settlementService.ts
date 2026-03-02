import { insertCreditLedgerEntry } from "../creditLedger";
import { readFalRuntimeFlags } from "../falRuntimeFlags";
import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  isDuplicateError,
  isMissingLedgerSchemaError,
  isRecoverableReservationFailure,
  readErrorCode,
} from "./errorGuards";
import {
  captureGenerationReservationByProviderRequest,
  releaseGenerationReservationByProviderRequest,
} from "./reservationRpcAdapter";
import { resolveCaptureSettlementPolicy } from "./settlementPolicy";
import type {
  FailedGenerationSettlementOptions,
  FailedGenerationSettlementResult,
  GenerationSettlementOptions,
  GenerationSettlementResult,
  GenerationSettlementOutcome,
  JsonObject,
  LedgerChargeRow,
} from "./types";
import { asString, readJsonObject, readObject } from "./utils";

const parseLedgerChargeRow = (data: unknown): LedgerChargeRow | null => {
  if (!data) return null;
  const row = readObject(data);
  const id = row.id;
  if (id === undefined || id === null) return null;
  return {
    id: String(id),
    source_ref: asString(row.source_ref) ?? null,
    change_cents: Number(row.change_cents ?? 0),
    metadata: readJsonObject(row.metadata),
  };
};

const lookupChargeBySourceRef = async (
  userId: string,
  sourceRef: string
): Promise<LedgerChargeRow | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, source_ref, change_cents, metadata")
      .eq("user_id", userId)
      .eq("source", "generation_charge")
      .eq("source_ref", sourceRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupChargeBySourceRef failed", error.message);
      }
      return null;
    }
    return parseLedgerChargeRow(data);
  } catch (error) {
    console.error("[generationBilling] lookupChargeBySourceRef threw", String(error));
    return null;
  }
};

const lookupLegacyChargeByProviderRequestId = async (
  userId: string,
  providerRequestId: string
): Promise<LedgerChargeRow | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, source_ref, change_cents, metadata")
      .eq("user_id", userId)
      .eq("source", "generation_charge")
      .contains("metadata", { provider_request_id: providerRequestId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupChargeByProviderRequestId failed", error.message);
      }
      return null;
    }
    return parseLedgerChargeRow(data);
  } catch (error) {
    console.error("[generationBilling] lookupChargeByProviderRequestId threw", String(error));
    return null;
  }
};

export const attachProviderRequestToCharge = async ({
  userId,
  sourceRef,
  providerRequestId,
  metadataExtra = {},
}: {
  userId: string;
  sourceRef: string;
  providerRequestId: string;
  metadataExtra?: JsonObject;
}) => {
  if (!providerRequestId) return;
  const existing = await lookupChargeBySourceRef(userId, sourceRef);
  if (!existing) return;

  const nextMetadata = {
    ...readJsonObject(existing.metadata),
    provider_request_id: providerRequestId,
    ...metadataExtra,
  };
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .update({ metadata: nextMetadata })
      .eq("id", existing.id);
    if (error && !isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
      console.error("[generationBilling] attachProviderRequestToCharge failed", error.message);
    }
  } catch (error) {
    console.error("[generationBilling] attachProviderRequestToCharge threw", String(error));
  }
};

const refundChargeRow = async ({
  userId,
  charge,
  reason,
  metadata,
}: {
  userId: string;
  charge: LedgerChargeRow;
  reason: string;
  metadata: JsonObject;
}): Promise<FailedGenerationSettlementResult> => {
  if (!charge.source_ref) {
    return { settled: false, sourceRef: null, note: "charge_missing_source_ref" };
  }
  const refundCents = Math.abs(Math.trunc(Number(charge.change_cents ?? 0)));
  if (!refundCents) {
    return { settled: false, sourceRef: charge.source_ref, note: "charge_missing_amount" };
  }
  const { error } = await insertCreditLedgerEntry({
    userId,
    changeCents: refundCents,
    reason,
    source: "generation_refund",
    sourceRef: charge.source_ref,
    metadata,
    createdBy: userId,
  });
  if (!error) {
    return { settled: true, sourceRef: charge.source_ref, note: "refund_inserted" };
  }
  if (isDuplicateError(readErrorCode(error), error.message)) {
    return { settled: true, sourceRef: charge.source_ref, note: "refund_already_exists" };
  }
  return { settled: false, sourceRef: charge.source_ref, note: error.message ?? "refund_failed" };
};

const settleLegacyDirectDebitOutcome = async ({
  userId,
  providerRequestId,
  outcome,
  reason,
  routeLabel,
  detail,
}: {
  userId: string;
  providerRequestId: string;
  outcome: GenerationSettlementOutcome;
  reason: string;
  routeLabel: string;
  detail: JsonObject;
}): Promise<GenerationSettlementResult> => {
  const flags = readFalRuntimeFlags();
  if (!flags.directDebitFallbackEnabled) {
    return { settled: false, note: "charge_not_found" };
  }

  const charge = await lookupLegacyChargeByProviderRequestId(userId, providerRequestId);
  if (!charge) return { settled: false, note: "charge_not_found" };

  if (outcome === "success") {
    return {
      settled: true,
      sourceRef: charge.source_ref ?? null,
      note: "legacy_charge_exists",
    };
  }

  return refundChargeRow({
    userId,
    charge,
    reason,
    metadata: {
      provider_request_id: providerRequestId,
      route: routeLabel,
      settled_at: new Date().toISOString(),
      ...detail,
    },
  });
};

export const settleGenerationOutcome = async ({
  userId,
  providerRequestId,
  outcome,
  reason,
  routeLabel,
  detail = {},
}: GenerationSettlementOptions): Promise<GenerationSettlementResult> => {
  if (!providerRequestId) {
    return { settled: false, note: "missing_provider_request_id" };
  }

  if (outcome === "success") {
    const captureResult = await captureGenerationReservationByProviderRequest({
      userId,
      providerRequestId,
      reason,
      metadata: {
        route: routeLabel,
        provider_request_id: providerRequestId,
        captured_at: new Date().toISOString(),
        ...detail,
      },
    });
    const capturePolicy = resolveCaptureSettlementPolicy(captureResult.status);
    if (capturePolicy.settled) {
      return {
        settled: true,
        sourceRef: captureResult.sourceRef ?? null,
        note: capturePolicy.note,
      };
    }
    if (!capturePolicy.allowLegacyFallback) {
      return {
        settled: false,
        sourceRef: captureResult.sourceRef ?? null,
        note: capturePolicy.note,
      };
    }
    if (captureResult.status === "failed" && !isRecoverableReservationFailure(captureResult)) {
      return {
        settled: false,
        sourceRef: captureResult.sourceRef ?? null,
        note: captureResult.message ?? "reservation_capture_failed",
      };
    }
    return settleLegacyDirectDebitOutcome({
      userId,
      providerRequestId,
      outcome,
      reason,
      routeLabel,
      detail,
    });
  }

  const releaseResult = await releaseGenerationReservationByProviderRequest({
    userId,
    providerRequestId,
    reason,
    metadata: {
      route: routeLabel,
      provider_request_id: providerRequestId,
      settled_at: new Date().toISOString(),
      ...detail,
    },
  });
  if (releaseResult.status === "released" || releaseResult.status === "already_released") {
    return {
      settled: true,
      sourceRef: releaseResult.sourceRef ?? null,
      note: releaseResult.status,
    };
  }
  if (releaseResult.status === "already_captured") {
    return {
      settled: false,
      sourceRef: releaseResult.sourceRef ?? null,
      note: "already_captured",
    };
  }
  if (releaseResult.status === "failed" && !isRecoverableReservationFailure(releaseResult)) {
    return {
      settled: false,
      sourceRef: releaseResult.sourceRef ?? null,
      note: releaseResult.message ?? "reservation_release_failed",
    };
  }
  return settleLegacyDirectDebitOutcome({
    userId,
    providerRequestId,
    outcome,
    reason,
    routeLabel,
    detail,
  });
};

/**
 * Settles failed generation outcomes by provider request id.
 * This is called from status routes when the upstream reports a definitive failure.
 */
export const settleFailedGenerationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  routeLabel,
  detail = {},
}: FailedGenerationSettlementOptions): Promise<FailedGenerationSettlementResult> => {
  return settleGenerationOutcome({
    userId,
    providerRequestId,
    outcome: "fail",
    reason,
    routeLabel,
    detail,
  });
};

/**
 * Captures a previously reserved generation after provider success.
 */
export const captureSucceededGenerationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  routeLabel,
  detail = {},
}: FailedGenerationSettlementOptions): Promise<FailedGenerationSettlementResult> => {
  return settleGenerationOutcome({
    userId,
    providerRequestId,
    outcome: "success",
    reason,
    routeLabel,
    detail,
  });
};
