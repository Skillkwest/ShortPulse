/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, debits before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * refund helpers for failed submits and failed status outcomes.
 */
import { randomUUID } from "crypto";
import { computeCostForModel, getModelConfig } from "../../model-runtime/pricing";
import { requireApiUser } from "./auth";
import { insertCreditLedgerEntry } from "./creditLedger";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
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
import { resolveGenerationAdmissionTier } from "../../model-runtime/generationAdmissionTiers";

export { resolveProviderRequestOwnership } from "./generationBilling/ownershipResolver";
export {
  captureSucceededGenerationByProviderRequest,
  settleGenerationOutcome,
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
  if (config?.provider === "fal" || config?.provider === "kie") return true;
  const normalizedModelId = modelId.toLowerCase();
  return normalizedModelId.startsWith("fal") || normalizedModelId.startsWith("kie");
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
  skipBilling = false,
}: ChargeOptions): Promise<ChargeResult | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;
  const sourceRef = resolveSourceRef(req);
  const routeLabel = req.url ?? "/api/generation";

  if (skipBilling) {
    return {
      userId: user.id,
      modelId,
      credits: 0,
      sourceRef,
      billingMode: "reservation",
      markSubmitted: async () => ({
        ok: true,
        status: "skipped",
        sourceRef,
        message: null,
        code: null,
      }),
      refund: async () => undefined,
    };
  }

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
    pricing_breakdown: {
      usd_raw: breakdown.usdRaw,
      raw_credits: breakdown.rawCredits,
      billed_credits: breakdown.credits,
      billed_usd: breakdown.usd,
    },
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
    const runtimeFlags = readFalRuntimeFlags();
    const admissionTier = resolveGenerationAdmissionTier(modelId);
    const reserveResult = await reserveGenerationCredits({
      userId: user.id,
      sourceRef,
      modelId,
      amountCents: Math.abs(Math.trunc(breakdown.credits)),
      reason,
      metadata: {
        ...chargeMetadata,
        admission_tier: admissionTier,
      },
      admission: {
        atomicEnabled: runtimeFlags.admissionAtomicEnabled && !runtimeFlags.queueEnabled,
        mode: runtimeFlags.admission.mode,
        globalMax: runtimeFlags.admission.globalMax,
        tier: admissionTier,
        tierMax: runtimeFlags.admission.tierLimits[admissionTier],
        retryAfterSeconds: runtimeFlags.admission.retryAfterSeconds,
      },
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
      if (!runtimeFlags.directDebitFallbackEnabled) {
        console.error(
          "[generationBilling] reservation RPC unavailable; direct debit fallback off",
          {
            modelId,
            route: req.url ?? null,
            sourceRef,
            code: reserveResult.code ?? null,
            message: reserveResult.message ?? null,
          }
        );
        return respondChargeFailure(500, GENERATION_BILLING_FAILURE_MESSAGE, {
          reservation_mode: true,
          reservation_status: reserveResult.status,
          reservation_message: reserveResult.message ?? null,
          reservation_code: reserveResult.code ?? null,
          fallback_enabled: false,
        });
      }
      console.warn(
        "[generationBilling] reservation RPC unavailable; direct debit fallback enabled",
        {
          modelId,
          route: req.url ?? null,
          sourceRef,
          code: reserveResult.code ?? null,
          message: reserveResult.message ?? null,
        }
      );
    } else if (reserveResult.status === "admission_limited") {
      const retryAfterSeconds =
        reserveResult.admission?.retryAfterSeconds ?? runtimeFlags.admission.retryAfterSeconds;
      const limits =
        reserveResult.admission &&
        typeof reserveResult.admission.tier === "string" &&
        reserveResult.admission.tier.length > 0
          ? {
              globalMax: reserveResult.admission.globalMax,
              globalActive: reserveResult.admission.globalActive,
              tier: reserveResult.admission.tier,
              tierMax: reserveResult.admission.tierMax,
              tierActive: reserveResult.admission.tierActive,
            }
          : null;
      await logGenerationFailure({
        req,
        routeLabel,
        source: "telemetry.api.fal_submit.admission_limited",
        message: "Generation admission limit reached.",
        statusCode: 429,
        userId: user.id,
        metadata: {
          model_id: modelId,
          mode: runtimeFlags.admission.mode,
          reason: reserveResult.admission?.reason ?? "admission_limited",
          global_active: reserveResult.admission?.globalActive ?? null,
          global_max: reserveResult.admission?.globalMax ?? runtimeFlags.admission.globalMax,
          tier: reserveResult.admission?.tier ?? admissionTier,
          tier_active: reserveResult.admission?.tierActive ?? null,
          tier_max:
            reserveResult.admission?.tierMax ?? runtimeFlags.admission.tierLimits[admissionTier],
          admission_scope: "per_user",
          admission_source: "atomic_reservation_rpc",
        },
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds,
        ...(limits ? { limits } : {}),
      });
      return null;
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
        if (!providerRequestId) {
          return {
            ok: false,
            status: "missing_provider_request_id",
            sourceRef,
            message: "provider_request_id is required",
            code: null,
          };
        }
        const status = await markGenerationReservationSubmitted({
          userId: user.id,
          sourceRef,
          providerRequestId,
          metadata: {
            submit_marked_at: new Date().toISOString(),
            ...extra,
          },
        });
        if (status.status === "reserved" || status.status === "already_reserved") {
          return {
            ok: true,
            status: status.status,
            sourceRef: status.sourceRef ?? sourceRef,
            message: status.message ?? null,
            code: status.code ?? null,
          };
        }
        if (status.status === "failed") {
          console.error("[generationBilling] reservation markSubmitted failed", status.message);
        }
        return {
          ok: false,
          status: status.status,
          sourceRef: status.sourceRef ?? sourceRef,
          message: status.message ?? null,
          code: status.code ?? null,
        };
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
        billingMode: "reservation",
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
    if (!providerRequestId) {
      return {
        ok: false,
        status: "missing_provider_request_id",
        sourceRef,
        message: "provider_request_id is required",
        code: null,
      };
    }
    return attachProviderRequestToCharge({
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
    billingMode: "direct_debit",
    markSubmitted,
    refund,
  };
};
