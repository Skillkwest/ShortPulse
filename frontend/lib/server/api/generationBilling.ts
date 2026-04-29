/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, debits before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * refund helpers for failed submits and failed status outcomes.
 */
import { randomUUID } from "crypto";
import { computeCostForModel } from "../../model-runtime/pricing";
import { requireApiUser } from "./auth";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import { resolveRuntimeModelPricingPolicy } from "./modelPricingControlPlane";
import { isRecoverableReservationFailure } from "./generationBilling/errorGuards";
import { logGenerationFailure } from "./appErrorLogs";
import { buildPricingParams, summarizePayload } from "./generationBilling/pricingParams";
import {
  markGenerationReservationSubmitted,
  releaseGenerationReservationBySourceRef,
  reserveGenerationCredits,
} from "./generationBilling/reservationRpcAdapter";
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
  const body = req.body;
  const shortpulseContext =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).shortpulse_context
      : null;
  if (
    shortpulseContext &&
    typeof shortpulseContext === "object" &&
    !Array.isArray(shortpulseContext)
  ) {
    const sourceRef = (shortpulseContext as Record<string, unknown>).source_ref;
    if (typeof sourceRef === "string" && sourceRef.trim()) return sourceRef.trim();
  }
  return randomUUID();
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
      chargeMetadata: {},
      pricingBreakdown: {
        billedCredits: 0,
        billedUsd: 0,
        pricingPolicySource: null,
        pricingPolicyVersion: null,
        rawCredits: 0,
        usdRaw: 0,
      },
      pricingParams: {},
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
  const runtimePricingPolicy = await resolveRuntimeModelPricingPolicy();
  const breakdown = computeCostForModel(modelId, pricingParams, runtimePricingPolicy.policy);
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
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
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
      pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
      pricing_policy_source: runtimePricingPolicy.source,
    },
    debited_credits: breakdown.credits,
  };
  const pricingBreakdown = {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
    pricingPolicyVersion: runtimePricingPolicy.activePolicyVersion,
    pricingPolicySource: runtimePricingPolicy.source,
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
      console.error("[generationBilling] admit_and_reserve_generation_credits failed", {
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
    console.error("[generationBilling] reservation RPC unavailable", {
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
  if (reserveResult.status === "admission_limited") {
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
      source: "telemetry.api.generation_submit.admission_limited",
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
      admissionScope: "per_user",
      admissionReason: reserveResult.admission?.reason ?? "admission_limited",
      ...(limits ? { limits } : {}),
    });
    return null;
  }
  if (reserveResult.status === "already_captured" || reserveResult.status === "already_released") {
    return respondChargeFailure(409, "Duplicate submit request id. Retry with a new request id.", {
      reservation_mode: true,
      reservation_status: reserveResult.status,
    });
  }
  if (reserveResult.status !== "reserved" && reserveResult.status !== "already_reserved") {
    return respondChargeFailure(500, GENERATION_BILLING_FAILURE_MESSAGE, {
      reservation_mode: true,
      reservation_status: reserveResult.status,
      reservation_message: reserveResult.message ?? null,
      reservation_code: reserveResult.code ?? null,
    });
  }

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
    chargeMetadata,
    pricingBreakdown,
    pricingParams,
    markSubmitted,
    refund,
  };
};
