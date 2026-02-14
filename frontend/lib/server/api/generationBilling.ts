/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, debits before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * refund helpers for failed submits and failed status outcomes.
 */
import { randomUUID } from "crypto";
import { computeCostForModel, getModelConfig } from "../../../features/ai-studio/logic/pricing";
import { requireApiUser } from "./auth";
import { insertCreditLedgerEntry } from "./creditLedger";
import {
  isDuplicateError,
  isInsufficientCreditError,
  isRecoverableReservationFailure,
  readErrorCode,
} from "./generationBilling/errorGuards";
import { logGenerationFailure } from "./appErrorLogs";
import { buildPricingParams, summarizePayload } from "./generationBilling/pricingParams";
import {
  markGenerationReservationSubmitted,
  releaseGenerationReservationBySourceRef,
  reserveGenerationCredits,
} from "./generationBilling/reservationRpcAdapter";
import { attachProviderRequestToCharge } from "./generationBilling/settlementService";
import type { ChargeOptions, ChargeResult, JsonObject } from "./generationBilling/types";
import { GENERATION_BILLING_FAILURE_MESSAGE } from "./generationBilling/types";

export { resolveProviderRequestOwnership } from "./generationBilling/ownershipResolver";
export {
  captureSucceededGenerationByProviderRequest,
  settleFailedGenerationByProviderRequest,
} from "./generationBilling/settlementService";
export type { ProviderRequestOwnership } from "./generationBilling/types";

const resolveSourceRef = (req: ChargeOptions["req"]): string => {
  const headerValue = req.headers["x-shortpulse-request-id"];
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  return randomUUID();
};

const isFalModel = (modelId: string): boolean => {
  const config = getModelConfig(modelId);
  if (config?.provider === "fal") return true;
  return modelId.toLowerCase().startsWith("fal");
};

/**
 * Debits credits for a model call before provider submission.
 */
export const chargeGenerationRequest = async ({
  req,
  res,
  modelId,
  payload,
  reason,
}: ChargeOptions): Promise<ChargeResult | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;
  const sourceRef = resolveSourceRef(req);
  const routeLabel = req.url ?? "/api/generation";

  const pricingParams = buildPricingParams(modelId, payload);
  const breakdown = computeCostForModel(modelId, pricingParams);
  if (!breakdown?.credits || breakdown.credits <= 0) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_failure",
      message: `No pricing strategy is configured for '${modelId}'.`,
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
      },
    });
    res.status(500).json({ error: `No pricing strategy is configured for '${modelId}'.` });
    return null;
  }

  const chargeMetadata = {
    model_id: modelId,
    route: req.url ?? null,
    params: summarizePayload(payload),
    pricing_params: pricingParams,
    debited_credits: breakdown.credits,
  };
  const respondChargeFailure = async (
    statusCode: number,
    message: string,
    metadata: JsonObject = {}
  ): Promise<null> => {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_failure",
      message,
      statusCode,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        ...metadata,
      },
    });
    res.status(statusCode).json({ error: message });
    return null;
  };

  const useReservationMode = isFalModel(modelId);
  if (useReservationMode) {
    const reserveResult = await reserveGenerationCredits({
      userId: user.id,
      sourceRef,
      modelId,
      amountCents: Math.abs(Math.trunc(breakdown.credits)),
      reason,
      metadata: chargeMetadata,
    });
    if (reserveResult.status === "failed") {
      if (reserveResult.message === "insufficient_credits") {
        return respondChargeFailure(402, "Insufficient credits for this generation.", {
          reservation_mode: true,
          reservation_status: reserveResult.status,
          reservation_message: reserveResult.message ?? null,
          reservation_code: reserveResult.code ?? null,
        });
      }
      if (!isRecoverableReservationFailure(reserveResult)) {
        console.error("[generationBilling] reserve_generation_credits failed", {
          modelId,
          route: req.url ?? null,
          sourceRef,
          code: reserveResult.code ?? null,
          message: reserveResult.message ?? null,
        });
        return respondChargeFailure(500, GENERATION_BILLING_FAILURE_MESSAGE, {
          reservation_mode: true,
          reservation_status: reserveResult.status,
          reservation_message: reserveResult.message ?? null,
          reservation_code: reserveResult.code ?? null,
        });
      }
      console.warn(
        "[generationBilling] reservation RPC unavailable; falling back to direct debit",
        {
          modelId,
          route: req.url ?? null,
          sourceRef,
          code: reserveResult.code ?? null,
          message: reserveResult.message ?? null,
        }
      );
    } else if (
      reserveResult.status === "already_captured" ||
      reserveResult.status === "already_released"
    ) {
      return respondChargeFailure(
        409,
        "Duplicate submit request id. Retry with a new request id.",
        {
          reservation_mode: true,
          reservation_status: reserveResult.status,
        }
      );
    } else if (reserveResult.status === "reserved" || reserveResult.status === "already_reserved") {
      const markSubmitted = async (providerRequestId: string, extra: JsonObject = {}) => {
        if (!providerRequestId) return;
        const status = await markGenerationReservationSubmitted({
          userId: user.id,
          sourceRef,
          providerRequestId,
          metadata: {
            submit_marked_at: new Date().toISOString(),
            ...extra,
          },
        });
        if (status.status === "failed") {
          console.error("[generationBilling] reservation markSubmitted failed", status.message);
        }
      };

      const refund = async (
        message = "Auto-release: generation submit failed.",
        extra: JsonObject = {}
      ) => {
        const released = await releaseGenerationReservationBySourceRef({
          userId: user.id,
          sourceRef,
          reason: message,
          metadata: {
            route: req.url ?? null,
            released_credits: breakdown.credits,
            ...extra,
          },
        });
        if (
          released.status === "failed" ||
          (released.status !== "released" &&
            released.status !== "already_released" &&
            released.status !== "already_captured" &&
            released.status !== "not_found")
        ) {
          console.error(
            "[generationBilling] reservation release failed",
            released.message ?? released.status
          );
        }
      };

      return {
        userId: user.id,
        modelId,
        credits: breakdown.credits,
        sourceRef,
        markSubmitted,
        refund,
      };
    }
  }

  const { error: debitError } = await insertCreditLedgerEntry({
    userId: user.id,
    changeCents: -Math.abs(Math.trunc(breakdown.credits)),
    reason,
    source: "generation_charge",
    sourceRef,
    metadata: chargeMetadata,
    createdBy: user.id,
  });

  if (debitError) {
    if (isInsufficientCreditError(debitError.message)) {
      return respondChargeFailure(402, "Insufficient credits for this generation.", {
        reservation_mode: false,
        debit_error_code: readErrorCode(debitError),
        debit_error_message: debitError.message ?? null,
      });
    }
    if (isDuplicateError(readErrorCode(debitError), debitError.message)) {
      return respondChargeFailure(
        409,
        "Duplicate submit request id. Retry with a new request id.",
        {
          reservation_mode: false,
          debit_error_code: readErrorCode(debitError),
          debit_error_message: debitError.message ?? null,
        }
      );
    }
    console.error("[generationBilling] direct debit failed", {
      modelId,
      route: req.url ?? null,
      sourceRef,
      code: readErrorCode(debitError),
      message: debitError.message ?? null,
    });
    return respondChargeFailure(500, GENERATION_BILLING_FAILURE_MESSAGE, {
      reservation_mode: false,
      debit_error_code: readErrorCode(debitError),
      debit_error_message: debitError.message ?? null,
    });
  }

  const refund = async (
    message = "Auto-refund: generation submit failed.",
    extra: JsonObject = {}
  ) => {
    const { error } = await insertCreditLedgerEntry({
      userId: user.id,
      changeCents: Math.abs(Math.trunc(breakdown.credits)),
      reason: message,
      source: "generation_refund",
      sourceRef,
      metadata: {
        model_id: modelId,
        route: req.url ?? null,
        refunded_credits: breakdown.credits,
        ...extra,
      },
      createdBy: user.id,
    });
    if (error && !isDuplicateError(readErrorCode(error), error.message)) {
      console.error("[generationBilling] refund insert failed", error.message);
    }
  };

  const markSubmitted = async (providerRequestId: string, extra: JsonObject = {}) => {
    if (!providerRequestId) return;
    await attachProviderRequestToCharge({
      userId: user.id,
      sourceRef,
      providerRequestId,
      metadataExtra: {
        submit_marked_at: new Date().toISOString(),
        reservation_mode: false,
        ...extra,
      },
    });
  };

  return {
    userId: user.id,
    modelId,
    credits: breakdown.credits,
    sourceRef,
    markSubmitted,
    refund,
  };
};
