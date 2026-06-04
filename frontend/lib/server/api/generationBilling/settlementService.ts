import { resolveGenerationLineageByProviderRequest } from "../generationLineageResolver";
import {
  isMissingGenerationAttemptSchemaError,
  isRecoverableReservationFailure,
} from "./errorGuards";
import {
  markGenerationReservationSubmitted,
  captureGenerationReservationByProviderRequest,
  releaseGenerationReservationByProviderRequest,
} from "./reservationRpcAdapter";
import { resolveCaptureSettlementPolicy } from "./settlementPolicy";
import type {
  FailedGenerationSettlementOptions,
  FailedGenerationSettlementResult,
  GenerationSettlementOptions,
  GenerationSettlementResult,
  JsonObject,
} from "./types";

const lookupGenerationSourceRefByProviderRequest = async ({
  userId,
  providerRequestId,
}: {
  userId: string;
  providerRequestId: string;
}): Promise<{ generationId: string | null; sourceRef: string | null }> => {
  const lineage = await resolveGenerationLineageByProviderRequest({
    userId,
    providerRequestId,
    includeProjection: true,
  });
  if (lineage.attemptLookupError) {
    if (
      !isMissingGenerationAttemptSchemaError(
        lineage.attemptLookupError.code ?? null,
        lineage.attemptLookupError.message ?? undefined
      )
    ) {
      console.error(
        "[generationBilling] lookupGenerationSourceRefByProviderRequest attempt lookup failed",
        {
          providerRequestId,
          userId,
          message: lineage.attemptLookupError.message ?? null,
        }
      );
    }
  }
  return {
    generationId: lineage.generationId,
    sourceRef: lineage.sourceRef,
  };
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
