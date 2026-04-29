import { lookupGenerationAttemptByProviderRequest } from "../generationAttempts";
import {
  readGenerationProjectionLinkByGenerationId,
  readGenerationProjectionLinkByProviderRequestId,
  readGenerationProjectionLinkByRequestId,
} from "../generationProjection";
import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  isMissingGenerationAttemptSchemaError,
  isMissingLedgerSchemaError,
  isRecoverableReservationFailure,
  readErrorCode,
} from "./errorGuards";
import {
  markGenerationReservationSubmitted,
  captureGenerationReservationByProviderRequest,
  releaseGenerationReservationByProviderRequest,
} from "./reservationRpcAdapter";
import { resolveCaptureSettlementPolicy } from "./settlementPolicy";
import type {
  ChargeSubmitLinkResult,
  FailedGenerationSettlementOptions,
  FailedGenerationSettlementResult,
  GenerationSettlementOptions,
  GenerationSettlementResult,
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
}): Promise<ChargeSubmitLinkResult> => {
  if (!providerRequestId) {
    return {
      ok: false,
      status: "missing_provider_request_id",
      sourceRef,
      message: "provider_request_id is required",
      code: null,
    };
  }
  const existing = await lookupChargeBySourceRef(userId, sourceRef);
  if (!existing) {
    return {
      ok: false,
      status: "charge_not_found",
      sourceRef,
      message: "charge_not_found",
      code: null,
    };
  }

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
      return {
        ok: false,
        status: "charge_update_failed",
        sourceRef: existing.source_ref ?? sourceRef,
        message: error.message ?? "charge_update_failed",
        code: readErrorCode(error),
      };
    }
    return {
      ok: true,
      status: "attached",
      sourceRef: existing.source_ref ?? sourceRef,
      message: null,
      code: null,
    };
  } catch (error) {
    console.error("[generationBilling] attachProviderRequestToCharge threw", String(error));
    return {
      ok: false,
      status: "charge_update_failed",
      sourceRef: existing.source_ref ?? sourceRef,
      message: String(error),
      code: null,
    };
  }
};

const lookupGenerationSourceRefByProviderRequest = async ({
  userId,
  providerRequestId,
}: {
  userId: string;
  providerRequestId: string;
}): Promise<{ generationId: string | null; sourceRef: string | null }> => {
  const attemptLookup = await lookupGenerationAttemptByProviderRequest({
    userId,
    providerRequestId,
  });
  if (attemptLookup.error) {
    if (
      !isMissingGenerationAttemptSchemaError(
        attemptLookup.error.code ?? null,
        attemptLookup.error.message ?? undefined
      )
    ) {
      console.error(
        "[generationBilling] lookupGenerationSourceRefByProviderRequest attempt lookup failed",
        {
          providerRequestId,
          userId,
          message: attemptLookup.error.message ?? null,
        }
      );
    }
  } else if (attemptLookup.data?.generationId) {
    try {
      const projectionLink = await readGenerationProjectionLinkByGenerationId({
        userId,
        generationId: attemptLookup.data.generationId,
      }).catch(() => null);
      if (projectionLink?.sourceRef) {
        return {
          generationId: projectionLink.generationId,
          sourceRef: projectionLink.sourceRef,
        };
      }
    } catch (error) {
      console.error(
        "[generationBilling] lookupGenerationSourceRefByProviderRequest generation lookup threw",
        String(error)
      );
    }
  }

  try {
    const projectionProviderLink = await readGenerationProjectionLinkByProviderRequestId({
      userId,
      providerRequestId,
    }).catch(() => null);
    if (projectionProviderLink?.sourceRef) {
      return {
        generationId: projectionProviderLink.generationId,
        sourceRef: projectionProviderLink.sourceRef,
      };
    }

    const projectionLink = await readGenerationProjectionLinkByRequestId({
      userId,
      requestId: providerRequestId,
    }).catch(() => null);
    if (projectionLink?.sourceRef) {
      return {
        generationId: projectionLink.generationId,
        sourceRef: projectionLink.sourceRef,
      };
    }

    return { generationId: null, sourceRef: null };
  } catch (error) {
    console.error(
      "[generationBilling] lookupGenerationSourceRefByProviderRequest threw",
      String(error)
    );
    return { generationId: null, sourceRef: null };
  }
};

const maybeRepairReservationLinkage = async ({
  userId,
  providerRequestId,
  routeLabel,
  detail,
}: {
  userId: string;
  providerRequestId: string;
  routeLabel: string;
  detail: JsonObject;
}): Promise<boolean> => {
  const generationLink = await lookupGenerationSourceRefByProviderRequest({
    userId,
    providerRequestId,
  });
  if (!generationLink.sourceRef) return false;

  const repaired = await markGenerationReservationSubmitted({
    userId,
    sourceRef: generationLink.sourceRef,
    providerRequestId,
    metadata: {
      route: routeLabel,
      provider_request_id: providerRequestId,
      repaired_at: new Date().toISOString(),
      repair_source: "settlement_repair",
      generation_id: generationLink.generationId,
      ...detail,
    },
  });

  if (repaired.status === "reserved" || repaired.status === "already_reserved") {
    return true;
  }

  console.error("[generationBilling] reservation linkage repair failed", {
    providerRequestId,
    routeLabel,
    sourceRef: generationLink.sourceRef,
    status: repaired.status,
    message: repaired.message ?? null,
  });
  return false;
};

const settleAbandonedNoRefundOutcome = async ({
  userId,
  providerRequestId,
  reason,
  routeLabel,
  detail,
}: {
  userId: string;
  providerRequestId: string;
  reason: string;
  routeLabel: string;
  detail: JsonObject;
}): Promise<GenerationSettlementResult> => {
  const metadata = {
    route: routeLabel,
    provider_request_id: providerRequestId,
    captured_at: new Date().toISOString(),
    abandoned_no_refund: true,
    ...detail,
  };
  let captureResult = await captureGenerationReservationByProviderRequest({
    userId,
    providerRequestId,
    reason,
    metadata,
  });
  if (captureResult.status === "not_found") {
    const repaired = await maybeRepairReservationLinkage({
      userId,
      providerRequestId,
      routeLabel,
      detail,
    });
    if (repaired) {
      captureResult = await captureGenerationReservationByProviderRequest({
        userId,
        providerRequestId,
        reason,
        metadata,
      });
    }
  }

  const capturePolicy = resolveCaptureSettlementPolicy(captureResult.status);
  if (capturePolicy.settled) {
    return {
      settled: true,
      sourceRef: captureResult.sourceRef ?? null,
      note: `abandoned_no_refund_${capturePolicy.note}`,
    };
  }
  if (!capturePolicy.allowLinkRepair) {
    return {
      settled: false,
      sourceRef: captureResult.sourceRef ?? null,
      note: capturePolicy.note,
    };
  }
  return {
    settled: false,
    sourceRef: captureResult.sourceRef ?? null,
    note: "charge_not_found",
  };
};

export const settleGenerationOutcome = async ({
  userId,
  providerRequestId,
  outcome,
  reason,
  routeLabel,
  detail = {},
  abandonedNoRefund = false,
}: GenerationSettlementOptions): Promise<GenerationSettlementResult> => {
  if (!providerRequestId) {
    return { settled: false, note: "missing_provider_request_id" };
  }

  if (outcome === "success") {
    const metadata = {
      route: routeLabel,
      provider_request_id: providerRequestId,
      captured_at: new Date().toISOString(),
      ...detail,
    };
    let captureResult = await captureGenerationReservationByProviderRequest({
      userId,
      providerRequestId,
      reason,
      metadata,
    });
    let capturePolicy = resolveCaptureSettlementPolicy(captureResult.status);
    if (
      !capturePolicy.settled &&
      capturePolicy.allowLinkRepair &&
      captureResult.status === "not_found"
    ) {
      const repaired = await maybeRepairReservationLinkage({
        userId,
        providerRequestId,
        routeLabel,
        detail,
      });
      if (repaired) {
        captureResult = await captureGenerationReservationByProviderRequest({
          userId,
          providerRequestId,
          reason,
          metadata,
        });
        capturePolicy = resolveCaptureSettlementPolicy(captureResult.status);
      }
    }
    if (capturePolicy.settled) {
      return {
        settled: true,
        sourceRef: captureResult.sourceRef ?? null,
        note: capturePolicy.note,
      };
    }
    if (!capturePolicy.allowLinkRepair) {
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
    return {
      settled: false,
      sourceRef: captureResult.sourceRef ?? null,
      note: captureResult.message ?? capturePolicy.note,
    };
  }

  const metadata = {
    route: routeLabel,
    provider_request_id: providerRequestId,
    settled_at: new Date().toISOString(),
    ...detail,
  };
  if (abandonedNoRefund) {
    return settleAbandonedNoRefundOutcome({
      userId,
      providerRequestId,
      reason,
      routeLabel,
      detail: metadata,
    });
  }
  let releaseResult = await releaseGenerationReservationByProviderRequest({
    userId,
    providerRequestId,
    reason,
    metadata,
  });
  if (releaseResult.status === "not_found") {
    const repaired = await maybeRepairReservationLinkage({
      userId,
      providerRequestId,
      routeLabel,
      detail,
    });
    if (repaired) {
      releaseResult = await releaseGenerationReservationByProviderRequest({
        userId,
        providerRequestId,
        reason,
        metadata,
      });
    }
  }
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
  return {
    settled: false,
    sourceRef: releaseResult.sourceRef ?? null,
    note: releaseResult.message ?? releaseResult.status,
  };
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
