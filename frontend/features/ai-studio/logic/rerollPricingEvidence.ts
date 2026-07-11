/**
 * Resolves active pricing-policy evidence for workflow re-roll submissions.
 * Keeps replayed generation debit aligned with the same shared pricing authority as first-run submits.
 */
import { resolveCreateImageBilledCreditLookup } from "../../../lib/model-runtime/createImageBilledCredits";
import { resolveEditImageBilledCreditLookup } from "../../../lib/model-runtime/editImageBilledCredits";
import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../../../lib/model-runtime/klingMotionControlPricing";
import { normalizeDurationForModel } from "../../../lib/model-runtime/modelDurationConstraints";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { buildDefaultPricingParams } from "../../../lib/model-runtime/pricing";
import type { PricingParams } from "../../../lib/model-runtime/pricingTypes";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import {
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { resolveVideoBilledCreditLookup } from "../../../lib/model-runtime/videoBilledCredits";
import type { AiStudioKlingElement } from "./klingElements";
import { resolveSeedanceElementProviderEligibility } from "./klingElements";
import {
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromInputs,
} from "./referenceInputs";
import { resolveSeedanceInputVideoDurationSeconds } from "./seedanceVideoPricing";
import type { WorkflowReloadConfigV1 } from "../types";

export type RerollPricingEvidence = {
  displayedBilledCredits: number | null;
  displayedPricingPolicyVersion: number | null;
  displayedPricingVariantId: string | null;
};

type ResolveRerollPricingEvidenceInput = {
  config: WorkflowReloadConfigV1;
  pricingPolicy: ModelPricingPolicyDocument | null;
  activePricingPolicyVersion: number | null;
};

const countRerollImageInputs = ({
  referenceInputs,
  internalMediaRefs,
}: {
  referenceInputs: readonly string[];
  internalMediaRefs?: readonly unknown[] | null;
}): number => {
  const referenceCount = referenceInputs.filter((input) => input.trim().length > 0).length;
  const internalRefCount =
    internalMediaRefs?.filter((ref) => ref != null && typeof ref === "object").length ?? 0;
  return Math.max(referenceCount, internalRefCount);
};

const buildImagePricingEvidence = ({
  config,
  pricingPolicy,
  activePricingPolicyVersion,
}: ResolveRerollPricingEvidenceInput): RerollPricingEvidence | null => {
  const payload = config.payload;
  if (payload.kind !== "image") return null;

  const modelId = config.model.id;
  const imageResolution = payload.imageResolution ?? undefined;
  const inputImageCount = countRerollImageInputs({
    referenceInputs: payload.referenceInputs,
    internalMediaRefs: payload.internalMediaRefs,
  });
  const baseParams = buildDefaultPricingParams(modelId, {
    aspect: payload.aspect,
    ...(imageResolution ? { resolution: imageResolution } : {}),
    ...(inputImageCount > 0 ? { inputImageCount } : {}),
  });

  const lookup =
    payload.submitTool === "create"
      ? resolveCreateImageBilledCreditLookup({
          modelId,
          params: baseParams,
          pricingPolicy,
        })
      : resolveEditImageBilledCreditLookup({
          modelId,
          params: {
            ...baseParams,
            inputImageCount: Math.max(1, inputImageCount),
            inputFidelity: "high",
            maskPresent: false,
          },
          pricingPolicy,
        });
  if (!lookup.breakdown) return null;

  return {
    displayedBilledCredits: lookup.breakdown.credits,
    displayedPricingPolicyVersion: activePricingPolicyVersion,
    displayedPricingVariantId: lookup.breakdown.variantId,
  };
};

const collectSeedanceRerollVideoReferences = (
  payload: Extract<WorkflowReloadConfigV1["payload"], { kind: "video" }>
): string[] => {
  const directVideoUrls = payload.seedance2ReferenceVideoUrls ?? [];
  const slottedVideoUrls =
    payload.videoReferences?.seedance2ReferenceVideos?.map((slot) => slot.sourceUrl) ?? [];
  const elementVideoUrls = (payload.klingElements ?? []).flatMap(
    (element) =>
      resolveSeedanceElementProviderEligibility(element as AiStudioKlingElement).videoUrls
  );
  return Array.from(
    new Set(
      [...directVideoUrls, ...slottedVideoUrls, ...elementVideoUrls]
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
};

const resolveLipSyncPricingDurationSeconds = ({
  audioDurationMs,
  fallbackDurationSeconds,
}: {
  audioDurationMs?: number | null;
  fallbackDurationSeconds: number;
}): number => {
  const audioDurationSeconds =
    typeof audioDurationMs === "number" && Number.isFinite(audioDurationMs) && audioDurationMs > 0
      ? audioDurationMs / 1000
      : null;
  const rawDurationSeconds = audioDurationSeconds ?? fallbackDurationSeconds;
  return (
    normalizeDurationForModel(rawDurationSeconds, FAL_OMNIHUMAN_V15_MODEL_ID) ?? rawDurationSeconds
  );
};

const buildVideoPricingEvidence = ({
  config,
  pricingPolicy,
  activePricingPolicyVersion,
}: ResolveRerollPricingEvidenceInput): RerollPricingEvidence | null => {
  const payload = config.payload;
  if (payload.kind !== "video") return null;

  const videoLane = resolveVideoGenerationLaneFromInputs({
    imageInputs: payload.referenceInputs,
    referenceMode: payload.videoReferenceMode,
  });
  const modelId = resolveAutoVideoModelForLane({
    currentModel: config.model.id,
    lane: videoLane,
  });
  if (!modelId) return null;

  const durationSeconds =
    videoLane === "lip-sync"
      ? resolveLipSyncPricingDurationSeconds({
          audioDurationMs: payload.lipSyncAudioDurationMs,
          fallbackDurationSeconds: payload.durationSeconds ?? 0,
        })
      : (payload.durationSeconds ?? undefined);
  const seedanceVideoReferences = collectSeedanceRerollVideoReferences(payload);
  const isSeedance2Model =
    modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const inputVideoDurationSeconds =
    isSeedance2Model && seedanceVideoReferences.length > 0
      ? resolveSeedanceInputVideoDurationSeconds({
          referenceVideoUrls: seedanceVideoReferences,
          persistedVideoReferences: payload.videoReferences?.seedance2ReferenceVideos,
        })
      : null;
  const params: Omit<PricingParams, "modelId"> = buildDefaultPricingParams(modelId, {
    aspect: payload.aspect,
    ...(durationSeconds != null ? { durationSeconds } : {}),
    ...(payload.resolution ? { resolution: payload.resolution } : {}),
    audio: videoLane === "lip-sync" ? true : (payload.generateAudio ?? undefined),
    ...(videoLane === "motion" ? { variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } : {}),
    ...(isSeedance2Model
      ? {
          inputVideoCount: seedanceVideoReferences.length,
          ...(inputVideoDurationSeconds != null ? { inputVideoDurationSeconds } : {}),
        }
      : {}),
  });
  const lookup = resolveVideoBilledCreditLookup({
    modelId,
    params,
    pricingPolicy,
  });
  if (!lookup.breakdown) return null;

  return {
    displayedBilledCredits: lookup.breakdown.credits,
    displayedPricingPolicyVersion: activePricingPolicyVersion,
    displayedPricingVariantId: lookup.breakdown.variantId,
  };
};

/**
 * Returns displayed pricing evidence reconstructed from durable workflow replay metadata.
 * Returns null when pricing policy data or replay parameters are insufficient, so the server can fail closed.
 */
export const resolveRerollPricingEvidence = (
  input: ResolveRerollPricingEvidenceInput
): RerollPricingEvidence | null => {
  if (!input.pricingPolicy || input.activePricingPolicyVersion == null) return null;
  return buildImagePricingEvidence(input) ?? buildVideoPricingEvidence(input);
};
