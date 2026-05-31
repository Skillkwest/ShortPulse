/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, reserves before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * release helpers for failed submits and failed status outcomes.
 */
import { randomUUID } from "crypto";
import { computeCostForModel } from "../../model-runtime/pricing";
import { resolvePricingGridCostBreakdown } from "../../model-runtime/pricingGridBilledCredits";
import { requireApiUser } from "./auth";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import { resolveRuntimeModelPricingPolicy } from "./modelPricingControlPlane";
import { isRecoverableReservationFailure } from "./generationBilling/errorGuards";
import { logGenerationFailure } from "./appErrorLogs";
import {
  ADMISSION_LIMITED_TELEMETRY_SOURCE,
  DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE,
} from "./errorTelemetryPolicy";
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

const asJsonObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;

const readShortpulseContextFromReq = (req: ChargeOptions["req"]): JsonObject | null => {
  const body = asJsonObject(req.body);
  return asJsonObject(body?.shortpulse_context);
};

const resolveShortpulseContext = ({
  req,
  shortpulseContext = null,
}: Pick<ChargeOptions, "req" | "shortpulseContext">): JsonObject | null =>
  asJsonObject(shortpulseContext) ?? readShortpulseContextFromReq(req);

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildPricingObservability = ({
  shortpulseContext,
  billedCredits,
}: {
  shortpulseContext: JsonObject | null;
  billedCredits: number;
}): JsonObject | null => {
  if (!shortpulseContext) return null;
  const displayedBilledCredits = readFiniteNumber(shortpulseContext.displayed_billed_credits);
  const pricingDisplaySource =
    typeof shortpulseContext.pricing_display_source === "string" &&
    shortpulseContext.pricing_display_source.trim()
      ? shortpulseContext.pricing_display_source.trim()
      : null;
  const pricingPolicyReady =
    typeof shortpulseContext.pricing_policy_ready === "boolean"
      ? shortpulseContext.pricing_policy_ready
      : null;

  if (
    displayedBilledCredits == null &&
    pricingDisplaySource == null &&
    pricingPolicyReady == null
  ) {
    return null;
  }

  const deltaCredits =
    displayedBilledCredits == null
      ? null
      : Number((billedCredits - displayedBilledCredits).toFixed(4));

  return {
    displayed_billed_credits: displayedBilledCredits,
    actual_billed_credits: billedCredits,
    delta_credits: deltaCredits,
    mismatch: deltaCredits == null ? null : deltaCredits !== 0,
    pricing_display_source: pricingDisplaySource,
    pricing_policy_ready: pricingPolicyReady,
  };
};

const resolveSourceRef = ({
  req,
  shortpulseContext = null,
}: Pick<ChargeOptions, "req" | "shortpulseContext">): string => {
  const headerValue = req.headers["x-shortpulse-request-id"];
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  const resolvedShortpulseContext = resolveShortpulseContext({ req, shortpulseContext });
  const sourceRef = resolvedShortpulseContext?.source_ref;
  if (typeof sourceRef === "string" && sourceRef.trim()) return sourceRef.trim();
  return randomUUID();
};

const resolveAdmissionLimitedTelemetrySource = (routeLabel: string): string =>
  routeLabel.startsWith("/api/fal/")
    ? ADMISSION_LIMITED_TELEMETRY_SOURCE
    : DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE;

const isCreateImageBillingPath = ({
  shortpulseContext,
}: {
  shortpulseContext: JsonObject | null;
}): boolean => {
  const selectedTool =
    typeof shortpulseContext?.selected_tool === "string" ? shortpulseContext.selected_tool : null;
  if (selectedTool !== "create") return false;
  const resolvedMode =
    typeof shortpulseContext?.mode === "string" ? shortpulseContext.mode.trim() : null;
  return resolvedMode === "image";
};

/**
 * Reserves credits for a model call before provider submission.
 */
export const chargeGenerationRequest = async ({
  req,
  res,
  modelId,
  payload,
  reason,
  skipBilling = false,
  shortpulseContext: explicitShortpulseContext = null,
}: ChargeOptions): Promise<ChargeResult | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;
  const shortpulseContext = resolveShortpulseContext({
    req,
    shortpulseContext: explicitShortpulseContext,
  });
  const sourceRef = resolveSourceRef({ req, shortpulseContext });
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

  const pricingParams = buildPricingParams(modelId, payload, { shortpulseContext });
  const runtimePricingPolicy = await resolveRuntimeModelPricingPolicy().catch(async (error) => {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_pricing_policy_unavailable",
      message: error instanceof Error ? error.message : "Model pricing policy is unavailable.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
      },
    });
    return null;
  });
  if (!runtimePricingPolicy) {
    res.status(500).json({ error: "Model pricing policy is unavailable." });
    return null;
  }
  const breakdown = isCreateImageBillingPath({
    shortpulseContext,
  })
    ? resolvePricingGridCostBreakdown({
        modelId,
        params: pricingParams,
        pricingPolicy: runtimePricingPolicy.policy,
      })
    : computeCostForModel(modelId, pricingParams, runtimePricingPolicy.policy);
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

  const pricingObservability = buildPricingObservability({
    shortpulseContext,
    billedCredits: breakdown.credits,
  });
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
    ...(pricingObservability ? { pricing_observability: pricingObservability } : {}),
    debited_credits: breakdown.credits,
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };
  const buildBypassCharge = (reason: string): ChargeResult => {
    console.warn("[generationBilling] bypassing reservation gate", {
      modelId,
      route: req.url ?? null,
      sourceRef,
      reason,
    });
    return {
      userId: user.id,
      modelId,
      credits: breakdown.credits,
      sourceRef,
      billingMode: "bypass",
      chargeMetadata: {
        ...chargeMetadata,
        reservation_bypass_reason: reason,
      },
      pricingBreakdown: {
        billedCredits: breakdown.credits,
        billedUsd: breakdown.usd,
        pricingPolicySource: runtimePricingPolicy.source,
        pricingPolicyVersion: runtimePricingPolicy.activePolicyVersion,
        rawCredits: breakdown.rawCredits,
        usdRaw: breakdown.usdRaw,
      },
      pricingParams,
      markSubmitted: async () => ({
        ok: true,
        status: "bypass",
        sourceRef,
        message: reason,
        code: null,
      }),
      refund: async () => undefined,
    };
  };
  const pricingBreakdown = {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
    pricingPolicyVersion: runtimePricingPolicy.activePolicyVersion,
    pricingPolicySource: runtimePricingPolicy.source,
  };
  const respondChargeFailure = async ({
    statusCode,
    message,
    metadata = {},
    responseBody = {},
    source = "api.generation_billing_failure",
  }: {
    statusCode: number;
    message: string;
    metadata?: JsonObject;
    responseBody?: JsonObject;
    source?: string;
  }): Promise<null> => {
    await logGenerationFailure({
      req,
      routeLabel,
      source,
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
    res.status(statusCode).json({
      error: message,
      ...responseBody,
    });
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
      return respondChargeFailure({
        statusCode: 402,
        message: "Insufficient credits. Add credits or switch plans before retrying.",
        metadata: {
          reservation_mode: true,
          reservation_status: reserveResult.status,
          reservation_message: reserveResult.message ?? null,
          reservation_code: reserveResult.code ?? null,
        },
        responseBody: {
          code: "INSUFFICIENT_CREDITS",
        },
      });
    }
    const reservationFailureReason = isRecoverableReservationFailure(reserveResult)
      ? "reservation_rpc_unavailable"
      : "reservation_failed";
    console.error("[generationBilling] reservation gate bypassed", {
      modelId,
      route: req.url ?? null,
      sourceRef,
      code: reserveResult.code ?? null,
      message: reserveResult.message ?? null,
    });
    return buildBypassCharge(reservationFailureReason);
  }
  if (reserveResult.status === "admission_limited") {
    const retryAfterSeconds = Math.max(
      1,
      reserveResult.admission?.retryAfterSeconds ?? runtimeFlags.admission.retryAfterSeconds
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return respondChargeFailure({
      statusCode: 429,
      message: "Too many active generations. Please retry shortly.",
      source: resolveAdmissionLimitedTelemetrySource(routeLabel),
      metadata: {
        reservation_mode: true,
        reservation_status: reserveResult.status,
        reservation_message: reserveResult.message ?? null,
        admission_scope: "per_user",
        admission_reason: reserveResult.admission?.reason ?? null,
        admission_global_active: reserveResult.admission?.globalActive ?? null,
        admission_global_max: reserveResult.admission?.globalMax ?? null,
        admission_tier: reserveResult.admission?.tier ?? null,
        admission_tier_active: reserveResult.admission?.tierActive ?? null,
        admission_tier_max: reserveResult.admission?.tierMax ?? null,
        retry_after_seconds: retryAfterSeconds,
      },
      responseBody: {
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds,
        admissionScope: "per_user",
      },
    });
  }
  if (reserveResult.status === "already_captured" || reserveResult.status === "already_released") {
    return respondChargeFailure({
      statusCode: 409,
      message: "Duplicate submit request id. Retry with a new request id.",
      metadata: {
        reservation_mode: true,
        reservation_status: reserveResult.status,
      },
    });
  }
  if (reserveResult.status !== "reserved" && reserveResult.status !== "already_reserved") {
    return respondChargeFailure({
      statusCode: 500,
      message: GENERATION_BILLING_FAILURE_MESSAGE,
      metadata: {
        reservation_mode: true,
        reservation_status: reserveResult.status,
        reservation_message: reserveResult.message ?? null,
        reservation_code: reserveResult.code ?? null,
      },
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
