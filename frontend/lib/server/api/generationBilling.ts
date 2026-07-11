/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, reserves before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * release helpers for failed submits and failed status outcomes.
 */
import { randomUUID } from "crypto";
import { computeCostForModel } from "../../model-runtime/pricing";
import type { PricingParams } from "../../model-runtime/pricingTypes";
import { resolveCreateImageBilledCreditLookup } from "../../model-runtime/createImageBilledCredits";
import {
  resolveEditImageBilledCreditLookup,
  supportsCanonicalEditImageBilledPricing,
} from "../../model-runtime/editImageBilledCredits";
import { resolvePricingGridCostBreakdown } from "../../model-runtime/pricingGridBilledCredits";
import { resolveVideoBilledCreditLookup } from "../../model-runtime/videoBilledCredits";
import { materializeImageBilledCreditPolicy } from "../../model-runtime/materializeImageBilledCreditPolicy";
import { requireApiUser } from "./auth";
import { requireMediaComplianceAccepted } from "./mediaComplianceGuard";
import { resolveBillingConcurrencyEntitlement } from "./billingConcurrencyEntitlements";
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
import type {
  ChargeOptions,
  ChargeResult,
  GenerationBillingWorkflow,
  JsonObject,
} from "./generationBilling/types";
import { GENERATION_BILLING_FAILURE_MESSAGE } from "./generationBilling/types";
import { resolveGenerationAdmissionTier } from "../../model-runtime/generationAdmissionTiers";
import {
  PRICING_POLICY_STALE_CODE,
  PRICING_POLICY_VERSION_REQUIRED_CODE,
} from "../../model-runtime/pricingPolicyFreshness";

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
  activePricingPolicyVersion,
  activePricingVariantId,
}: {
  shortpulseContext: JsonObject | null;
  billedCredits: number;
  activePricingPolicyVersion: number | null;
  activePricingVariantId: string | null;
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
  const displayedPricingPolicyVersion = readFiniteNumber(
    shortpulseContext.displayed_pricing_policy_version
  );
  const displayedPricingVariantId =
    typeof shortpulseContext.displayed_pricing_variant_id === "string" &&
    shortpulseContext.displayed_pricing_variant_id.trim()
      ? shortpulseContext.displayed_pricing_variant_id.trim()
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
    ...(displayedPricingPolicyVersion != null
      ? { displayed_pricing_policy_version: displayedPricingPolicyVersion }
      : {}),
    ...(activePricingPolicyVersion != null
      ? { actual_pricing_policy_version: activePricingPolicyVersion }
      : {}),
    ...(displayedPricingVariantId
      ? { displayed_pricing_variant_id: displayedPricingVariantId }
      : {}),
    ...(activePricingVariantId ? { actual_pricing_variant_id: activePricingVariantId } : {}),
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

const PROVIDER_TIER_MAX_WHEN_ADMISSION_DISABLED = 1_000_000;

const buildPlanConcurrencyLimitMessage = ({
  planDisplayName,
  maxConcurrentGenerations,
}: {
  planDisplayName: string;
  maxConcurrentGenerations: number;
}): string => {
  if (maxConcurrentGenerations <= 0) {
    return `${planDisplayName} does not include generation access. Choose a paid plan to generate.`;
  }
  const generationLabel = maxConcurrentGenerations === 1 ? "generation" : "generations";
  return `${planDisplayName} supports ${maxConcurrentGenerations} active ${generationLabel} at a time. Please wait for one to finish, then retry.`;
};

const isLaunchDeferredEditPricingPath = ({
  pricingParams,
}: {
  pricingParams: Omit<PricingParams, "modelId">;
}): boolean => pricingParams.maskPresent === true;

const isImageBillingWorkflow = (workflow: GenerationBillingWorkflow): boolean =>
  workflow === "image" || workflow === "create_image" || workflow === "edit_image";

const shouldResolveCreateImagePricing = (workflow: GenerationBillingWorkflow): boolean =>
  workflow === "image" || workflow === "create_image";

const shouldResolveEditImagePricing = ({
  workflow,
  pricingParams,
  modelId,
}: {
  workflow: GenerationBillingWorkflow;
  pricingParams: Omit<PricingParams, "modelId">;
  modelId: string;
}): boolean =>
  (workflow === "image" || workflow === "edit_image") &&
  !isLaunchDeferredEditPricingPath({ pricingParams }) &&
  supportsCanonicalEditImageBilledPricing(modelId);

type CanonicalPricingCandidate = {
  workflow: "create_image" | "edit_image" | "video" | "audio";
  params: Omit<PricingParams, "modelId">;
  breakdown: NonNullable<ReturnType<typeof computeCostForModel>> & { variantId?: string | null };
};

const selectCanonicalPricingCandidate = ({
  candidates,
  displayedPricingVariantId,
  displayedBilledCredits,
}: {
  candidates: CanonicalPricingCandidate[];
  displayedPricingVariantId: string | null;
  displayedBilledCredits: number | null;
}): CanonicalPricingCandidate | null => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;

  const roundedDisplayedCredits =
    displayedBilledCredits == null ? null : Number(displayedBilledCredits.toFixed(4));
  const variantMatches = displayedPricingVariantId
    ? candidates.filter((candidate) => candidate.breakdown.variantId === displayedPricingVariantId)
    : candidates;
  const creditMatches =
    roundedDisplayedCredits == null
      ? variantMatches
      : variantMatches.filter(
          (candidate) => Number(candidate.breakdown.credits.toFixed(4)) === roundedDisplayedCredits
        );

  if (creditMatches.length === 1) return creditMatches[0] ?? null;
  if (variantMatches.length === 1) return variantMatches[0] ?? null;
  return null;
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
  billingWorkflow,
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
  const hasAcceptedMediaAgreement = await requireMediaComplianceAccepted({
    req,
    res,
    user,
    routeLabel,
    scope: "generation",
  });
  if (!hasAcceptedMediaAgreement) return null;

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
  const runtimePricingPolicy = await resolveRuntimeModelPricingPolicy({
    bypassCache: true,
  }).catch(async (error) => {
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
  const effectivePricingPolicy = materializeImageBilledCreditPolicy(runtimePricingPolicy.policy);
  const displayedPricingPolicyVersion = readFiniteNumber(
    shortpulseContext?.displayed_pricing_policy_version
  );
  const displayedBilledCredits = readFiniteNumber(shortpulseContext?.displayed_billed_credits);
  const displayedPricingVariantId =
    typeof shortpulseContext?.displayed_pricing_variant_id === "string" &&
    shortpulseContext.displayed_pricing_variant_id.trim()
      ? shortpulseContext.displayed_pricing_variant_id.trim()
      : null;
  const createImagePricingLookup = shouldResolveCreateImagePricing(billingWorkflow)
    ? resolveCreateImageBilledCreditLookup({
        modelId,
        params: pricingParams,
        pricingPolicy: effectivePricingPolicy,
      })
    : null;
  const editImagePricingLookup = shouldResolveEditImagePricing({
    workflow: billingWorkflow,
    pricingParams,
    modelId,
  })
    ? resolveEditImageBilledCreditLookup({
        modelId,
        params: pricingParams,
        pricingPolicy: effectivePricingPolicy,
      })
    : null;
  const videoPricingLookup =
    billingWorkflow === "video"
      ? resolveVideoBilledCreditLookup({
          modelId,
          params: pricingParams,
          pricingPolicy: effectivePricingPolicy,
        })
      : null;
  const videoPricingBreakdown = videoPricingLookup?.breakdown ?? null;
  const audioPricingBreakdown =
    billingWorkflow === "audio"
      ? resolvePricingGridCostBreakdown({
          modelId,
          params: pricingParams,
          pricingPolicy: effectivePricingPolicy,
        })
      : null;
  const canonicalPricingCandidates: CanonicalPricingCandidate[] = [];
  if (createImagePricingLookup?.breakdown) {
    canonicalPricingCandidates.push({
      workflow: "create_image",
      params: createImagePricingLookup.params,
      breakdown: createImagePricingLookup.breakdown,
    });
  }
  if (editImagePricingLookup?.breakdown) {
    canonicalPricingCandidates.push({
      workflow: "edit_image",
      params: editImagePricingLookup.params,
      breakdown: editImagePricingLookup.breakdown,
    });
  }
  if (videoPricingBreakdown && videoPricingLookup) {
    canonicalPricingCandidates.push({
      workflow: "video",
      params: videoPricingLookup.params,
      breakdown: videoPricingBreakdown,
    });
  }
  if (audioPricingBreakdown) {
    canonicalPricingCandidates.push({
      workflow: "audio",
      params: pricingParams,
      breakdown: audioPricingBreakdown,
    });
  }
  const selectedCanonicalPricingCandidate = selectCanonicalPricingCandidate({
    candidates: canonicalPricingCandidates,
    displayedPricingVariantId,
    displayedBilledCredits,
  });
  const canonicalPricingBreakdown = selectedCanonicalPricingCandidate?.breakdown ?? null;
  const canonicalPricingParams = selectedCanonicalPricingCandidate?.params ?? pricingParams;
  const activePricingPolicyVersion = runtimePricingPolicy.activePolicyVersion;
  const requiresCanonicalEditImagePricing =
    billingWorkflow === "edit_image" &&
    shouldResolveEditImagePricing({
      workflow: billingWorkflow,
      pricingParams,
      modelId,
    });
  const requiresCanonicalCreateImagePricing = billingWorkflow === "create_image";
  const requiresCanonicalImagePricing = isImageBillingWorkflow(billingWorkflow);
  const requiresCanonicalVideoPricing = billingWorkflow === "video";
  const requiresCanonicalAudioPricing = billingWorkflow === "audio";
  if (
    activePricingPolicyVersion != null &&
    requiresCanonicalCreateImagePricing &&
    !createImagePricingLookup?.breakdown
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_missing_canonical_create_price",
      message: "Pricing is unavailable for this configuration.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        pricing_params: pricingParams,
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
      },
    });
    res.status(500).json({ error: "Pricing is unavailable for this configuration." });
    return null;
  }
  if (
    activePricingPolicyVersion != null &&
    requiresCanonicalImagePricing &&
    canonicalPricingCandidates.length === 0
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_missing_canonical_image_price",
      message: "Pricing is unavailable for this configuration.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        pricing_params: pricingParams,
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
      },
    });
    res.status(500).json({ error: "Pricing is unavailable for this configuration." });
    return null;
  }
  if (
    activePricingPolicyVersion != null &&
    requiresCanonicalEditImagePricing &&
    !editImagePricingLookup?.breakdown
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_missing_canonical_edit_price",
      message: "Pricing is unavailable for this configuration.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        pricing_params: pricingParams,
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
      },
    });
    res.status(500).json({ error: "Pricing is unavailable for this configuration." });
    return null;
  }
  if (
    activePricingPolicyVersion != null &&
    requiresCanonicalVideoPricing &&
    !videoPricingBreakdown
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_missing_canonical_video_price",
      message: "Pricing is unavailable for this configuration.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        pricing_params: pricingParams,
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
      },
    });
    res.status(500).json({ error: "Pricing is unavailable for this configuration." });
    return null;
  }
  if (
    activePricingPolicyVersion != null &&
    requiresCanonicalAudioPricing &&
    !audioPricingBreakdown
  ) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_missing_canonical_audio_price",
      message: "Pricing is unavailable for this configuration.",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        model_id: modelId,
        source_ref: sourceRef,
        pricing_params: pricingParams,
        pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        pricing_policy_source: runtimePricingPolicy.source,
      },
    });
    res.status(500).json({ error: "Pricing is unavailable for this configuration." });
    return null;
  }
  const requiresDisplayedPricingEvidence =
    activePricingPolicyVersion != null &&
    (requiresCanonicalImagePricing ||
      requiresCanonicalVideoPricing ||
      requiresCanonicalAudioPricing);
  if (
    requiresDisplayedPricingEvidence &&
    canonicalPricingCandidates.length > 0 &&
    !selectedCanonicalPricingCandidate
  ) {
    const code =
      displayedPricingPolicyVersion == null
        ? PRICING_POLICY_VERSION_REQUIRED_CODE
        : PRICING_POLICY_STALE_CODE;
    const message =
      "Pricing changed before generation started. Refresh pricing and review the new amount.";
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_pricing_policy_conflict",
      message,
      statusCode: 409,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        code,
        model_id: modelId,
        source_ref: sourceRef,
        displayed_pricing_policy_version: displayedPricingPolicyVersion,
        active_pricing_policy_version: activePricingPolicyVersion,
        displayed_billed_credits: displayedBilledCredits,
        displayed_pricing_variant_id: displayedPricingVariantId,
        active_pricing_candidates: canonicalPricingCandidates.map((candidate) => ({
          workflow: candidate.workflow,
          billed_credits: candidate.breakdown.credits,
          variant_id: candidate.breakdown.variantId ?? null,
        })),
      },
    });
    res.status(409).json({
      error: message,
      code,
      displayedPricingPolicyVersion,
      activePricingPolicyVersion,
      displayedBilledCredits,
      activeBilledCredits: null,
      displayedPricingVariantId,
      activePricingVariantId: null,
    });
    return null;
  }
  const effectivePricingParams = canonicalPricingParams;
  const breakdown =
    canonicalPricingBreakdown ??
    computeCostForModel(modelId, effectivePricingParams, effectivePricingPolicy);
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

  const activePricingVariantId = canonicalPricingBreakdown?.variantId ?? null;
  const versionMissing = requiresDisplayedPricingEvidence && displayedPricingPolicyVersion == null;
  const versionMismatch =
    requiresDisplayedPricingEvidence &&
    displayedPricingPolicyVersion != null &&
    displayedPricingPolicyVersion !== runtimePricingPolicy.activePolicyVersion;
  const creditMismatch =
    requiresDisplayedPricingEvidence &&
    (displayedBilledCredits == null ||
      Number(displayedBilledCredits.toFixed(4)) !== Number(breakdown.credits.toFixed(4)));
  const variantMismatch =
    requiresDisplayedPricingEvidence &&
    displayedPricingVariantId != null &&
    activePricingVariantId != null &&
    displayedPricingVariantId !== activePricingVariantId;

  if (versionMissing || versionMismatch || creditMismatch || variantMismatch) {
    const code = versionMissing ? PRICING_POLICY_VERSION_REQUIRED_CODE : PRICING_POLICY_STALE_CODE;
    const message =
      "Pricing changed before generation started. Refresh pricing and review the new amount.";
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.generation_billing_pricing_policy_conflict",
      message,
      statusCode: 409,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        code,
        model_id: modelId,
        source_ref: sourceRef,
        displayed_pricing_policy_version: displayedPricingPolicyVersion,
        active_pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
        displayed_billed_credits: displayedBilledCredits,
        active_billed_credits: breakdown.credits,
        displayed_pricing_variant_id: displayedPricingVariantId,
        active_pricing_variant_id: activePricingVariantId,
      },
    });
    res.status(409).json({
      error: message,
      code,
      displayedPricingPolicyVersion,
      activePricingPolicyVersion: runtimePricingPolicy.activePolicyVersion,
      displayedBilledCredits,
      activeBilledCredits: breakdown.credits,
      displayedPricingVariantId,
      activePricingVariantId,
    });
    return null;
  }

  const pricingObservability = buildPricingObservability({
    shortpulseContext,
    billedCredits: breakdown.credits,
    activePricingPolicyVersion: runtimePricingPolicy.activePolicyVersion,
    activePricingVariantId,
  });
  const chargeMetadata = {
    model_id: modelId,
    route: req.url ?? null,
    params: summarizePayload(payload),
    pricing_params: effectivePricingParams,
    pricing_breakdown: {
      usd_raw: breakdown.usdRaw,
      raw_credits: breakdown.rawCredits,
      billed_credits: breakdown.credits,
      billed_usd: breakdown.usd,
      ...(canonicalPricingBreakdown?.variantId
        ? { variant_id: canonicalPricingBreakdown.variantId }
        : {}),
      pricing_policy_version: runtimePricingPolicy.activePolicyVersion,
      pricing_policy_source: runtimePricingPolicy.source,
    },
    ...(pricingObservability ? { pricing_observability: pricingObservability } : {}),
    debited_credits: breakdown.credits,
    ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
  };
  const pricingBreakdown = {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
    ...(canonicalPricingBreakdown?.variantId
      ? { variantId: canonicalPricingBreakdown.variantId }
      : {}),
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
  const concurrencyEntitlement = await resolveBillingConcurrencyEntitlement(user.id).catch(
    async (error) => {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.generation_billing_concurrency_entitlement_unavailable",
        message:
          error instanceof Error
            ? error.message
            : "Generation concurrency entitlement is unavailable.",
        statusCode: 503,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          model_id: modelId,
          source_ref: sourceRef,
        },
      });
      return null;
    }
  );
  if (!concurrencyEntitlement) {
    const retryAfterSeconds = Math.max(1, runtimeFlags.admission.retryAfterSeconds);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(503).json({
      error: "Generation admission is temporarily unavailable. Please retry shortly.",
      code: "GENERATION_ADMISSION_UNAVAILABLE",
      retryAfterSeconds,
    });
    return null;
  }

  const admissionTier = resolveGenerationAdmissionTier(modelId);
  const concurrencyMetadata = {
    plan_id: concurrencyEntitlement.planId,
    plan_display_name: concurrencyEntitlement.planDisplayName,
    billing_offer_id: concurrencyEntitlement.offerId,
    billing_contract_id: concurrencyEntitlement.contractId,
    max_concurrent_generations: concurrencyEntitlement.maxConcurrentGenerations,
    entitlement_source: concurrencyEntitlement.source,
  };
  const finalChargeMetadata = {
    ...chargeMetadata,
    concurrency_entitlement: concurrencyMetadata,
  };
  const reserveResult = await reserveGenerationCredits({
    userId: user.id,
    sourceRef,
    modelId,
    amountCents: Math.abs(Math.trunc(breakdown.credits)),
    reason,
    metadata: {
      ...finalChargeMetadata,
      admission_tier: admissionTier,
    },
    admission: {
      mode: "enforce",
      globalMax: concurrencyEntitlement.maxConcurrentGenerations,
      tier: admissionTier,
      tierMax:
        runtimeFlags.admission.mode === "enforce"
          ? runtimeFlags.admission.tierLimits[admissionTier]
          : PROVIDER_TIER_MAX_WHEN_ADMISSION_DISABLED,
      retryAfterSeconds: runtimeFlags.admission.retryAfterSeconds,
    },
  });
  if (reserveResult.status === "failed") {
    if (reserveResult.message === "insufficient_credits") {
      return respondChargeFailure({
        statusCode: 402,
        message: "Insufficient credits.",
        metadata: {
          reservation_mode: true,
          reservation_status: reserveResult.status,
          reservation_message: reserveResult.message ?? null,
          reservation_code: reserveResult.code ?? null,
        },
        responseBody: {
          code: "INSUFFICIENT_CREDITS",
          chargeState: "not_reserved",
        },
      });
    }
    console.error("[generationBilling] reservation gate failed closed", {
      modelId,
      route: req.url ?? null,
      sourceRef,
      code: reserveResult.code ?? null,
      message: reserveResult.message ?? null,
    });
    const retryAfterSeconds = Math.max(1, runtimeFlags.admission.retryAfterSeconds);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return respondChargeFailure({
      statusCode: 503,
      message: "Generation admission is temporarily unavailable. Please retry shortly.",
      source: "api.generation_billing_reservation_unavailable",
      metadata: {
        reservation_mode: true,
        reservation_status: reserveResult.status,
        reservation_message: reserveResult.message ?? null,
        reservation_code: reserveResult.code ?? null,
        reservation_recoverable: isRecoverableReservationFailure(reserveResult),
        retry_after_seconds: retryAfterSeconds,
      },
      responseBody: {
        code: "GENERATION_ADMISSION_UNAVAILABLE",
        retryAfterSeconds,
      },
    });
  }
  if (reserveResult.status === "admission_limited") {
    const retryAfterSeconds = Math.max(
      1,
      reserveResult.admission?.retryAfterSeconds ?? runtimeFlags.admission.retryAfterSeconds
    );
    const admissionReason = reserveResult.admission?.reason ?? null;
    const customerMessage =
      admissionReason === "tier_limit"
        ? "Too many active generations. Please retry shortly."
        : buildPlanConcurrencyLimitMessage(concurrencyEntitlement);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return respondChargeFailure({
      statusCode: 429,
      message: customerMessage,
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
        plan_id: concurrencyEntitlement.planId,
        plan_display_name: concurrencyEntitlement.planDisplayName,
        max_concurrent_generations: concurrencyEntitlement.maxConcurrentGenerations,
        entitlement_source: concurrencyEntitlement.source,
        retry_after_seconds: retryAfterSeconds,
      },
      responseBody: {
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds,
        admissionScope: "per_user",
        planId: concurrencyEntitlement.planId,
        planDisplayName: concurrencyEntitlement.planDisplayName,
        maxConcurrentGenerations: concurrencyEntitlement.maxConcurrentGenerations,
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
    chargeMetadata: finalChargeMetadata,
    concurrencyEntitlement,
    pricingBreakdown,
    pricingParams,
    markSubmitted,
    refund,
  };
};
