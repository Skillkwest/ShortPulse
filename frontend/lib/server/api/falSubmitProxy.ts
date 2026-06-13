/**
 * Shared charged submit proxy for Fal generation endpoints.
 */
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import { chargeGenerationRequest } from "./generationBilling";
import {
  filterExternalUrlsFromInternalRefs,
  readInternalEditMediaRefsFromPayload,
  readInternalMediaRefsFromPayload,
  resolveSignedUrlsForInternalEditMediaRefs,
  resolveSignedUrlsForInternalMediaRefs,
  type InternalEditMediaRefs,
} from "./internalMediaRefResolution";
import { resolveRuntimeSafetyProfile } from "./agentSafetyPolicyControlPlane";
import { logGenerationFailure, writeAppErrorLog } from "./appErrorLogs";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_MESSAGE,
} from "../../explicitContentFailure";
import { normalizeExplicitContentFailure } from "../../explicitContentFailure";
import { normalizeCustomerFacingProviderError } from "../../customerFacingProviderText";
import { evaluateGenerationAdmissionDecision } from "./generationAdmission/generationAdmissionPolicy";
import { evaluateScopedGenerationAdmission } from "./generationAdmission/generationAdmissionService";
import { shouldEmitRecoveryBackpressureTelemetry } from "./generationAdmission/recoveryBackpressure";
import type { SubmitTarget } from "../falIntegration/contracts";
import { upsertGenerationProjection } from "./generationProjection";
import {
  resolveGenerationAspectFromPayload,
  resolveGenerationModeFromPayload,
  resolveGenerationPromptFromPayload,
  resolveGenerationResolutionFromPayload,
  readGenerationDurationSeconds,
} from "./generationPayloadMetadata";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import {
  dispatchProviderSubmit,
  ProviderSubmitValidationError,
} from "../providerIntegration/submitProviderDispatcher";
import { readProviderContentPolicyMessage } from "../providerIntegration/statusProviderPayload";
import { getModelPayloadValidationSpec } from "../../model-runtime/modelCatalog";
import type { InternalMediaRef } from "../../media/internalMediaRefs";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../model-runtime/falModelIds";
import { evaluateFalPayloadContractForModel } from "./falPayloadValidation";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import { resolveSafetyEnvironment } from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { enforceServerGenerationSafetyPayload } from "../../../features/agent-runtime/safetyPolicy/generationSafetyPolicy";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";
import { normalizeVideoSubmitIngressPayload } from "./videoSubmitContracts";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { applyAcceptedRunningGenerationTransition } from "./generationAcceptedTransitionService";
import { buildAcceptedRunningGenerationUpdate } from "./generationRequestTransitions";
import { associateGenerationWithProjectForUserBestEffort } from "../projectGenerationAssociationsService";
import { requestGenerationControlPlaneWake } from "../generationControlPlane/controlPlaneWake";
import { createMotionReferenceVideoLeaseForGeneration } from "../motionReferenceVideoAssetLease";
import {
  readGenerationProjectIdFromContext,
  readGenerationWorkspaceRuntimeKeyFromContext,
} from "./generationWorkspaceRuntimeKey";

type FalSubmitConfig = {
  modelId: string;
  provider?: string;
  submitUrl?: string;
  submitTargets?: SubmitTarget[];
  skipBilling?: boolean;
  routeLabel: string;
  timeoutMs?: number;
  validatePayload?: (payload: Record<string, unknown>) =>
    | {
        valid: true;
        projectedPayload: Record<string, unknown>;
      }
    | {
        valid: false;
        code?: string;
        error: string;
        detail?: unknown;
      }
    | {
        code?: string;
        error: string;
        detail?: unknown;
      }
    | null;
};

type JsonValue = Record<string, unknown>;

const selectEffectiveAdmissionDecision = ({
  providerDecision,
  userDecision,
}: {
  providerDecision: ReturnType<typeof evaluateGenerationAdmissionDecision> | null;
  userDecision: ReturnType<typeof evaluateGenerationAdmissionDecision>;
}) => {
  if (providerDecision?.enforced) return providerDecision;
  if (userDecision.wouldLimit) return userDecision;
  if (providerDecision?.wouldLimit) return providerDecision;
  return userDecision;
};

const resolveAdmissionScope = ({
  providerDecision,
  admissionDecision,
}: {
  providerDecision: ReturnType<typeof evaluateGenerationAdmissionDecision> | null;
  admissionDecision: ReturnType<typeof evaluateGenerationAdmissionDecision>;
}): "shared_provider" | "per_user" =>
  providerDecision &&
  admissionDecision.snapshot.globalMax === providerDecision.snapshot.globalMax &&
  admissionDecision.snapshot.tierMax === providerDecision.snapshot.tierMax
    ? "shared_provider"
    : "per_user";

const buildAdmissionUnavailablePayload = (retryAfterSeconds: number) => ({
  error: "Generation admission is temporarily unavailable. Please retry shortly.",
  code: "GENERATION_ADMISSION_UNAVAILABLE",
  retryAfterSeconds,
});

const buildDirectSubmitUnavailablePayload = (retryAfterSeconds: number) => ({
  error:
    "Direct provider submit is unavailable for this route in the current runtime. Please retry or use a supported generation route.",
  code: "GENERATION_DIRECT_SUBMIT_UNAVAILABLE",
  retryAfterSeconds,
});

const PROVIDER_CREDITS_UNAVAILABLE_MESSAGE =
  "This image model is temporarily unavailable. Your ShortPulse credits were not charged.";
const PROVIDER_CREDITS_UNAVAILABLE_DETAIL =
  "The provider could not accept this request right now. Try another image model or retry after service is restored.";

const classifyProviderSubmitFailure = ({
  upstreamStatus,
  providerBodyCode,
}: {
  upstreamStatus: number;
  providerBodyCode: number | null;
}): {
  code: "PROVIDER_CREDITS_UNAVAILABLE";
  clientStatus: 503;
  message: string;
  detail: string;
  chargeState: "released";
} | null => {
  if (upstreamStatus !== 402 && providerBodyCode !== 402) return null;
  return {
    code: "PROVIDER_CREDITS_UNAVAILABLE",
    clientStatus: 503,
    message: PROVIDER_CREDITS_UNAVAILABLE_MESSAGE,
    detail: PROVIDER_CREDITS_UNAVAILABLE_DETAIL,
    chargeState: "released",
  };
};

const applyRewrittenPromptToPayload = ({
  payload,
  rewrittenPrompt,
}: {
  payload: Record<string, unknown>;
  rewrittenPrompt: string;
}): void => {
  if (typeof payload.prompt === "string") {
    payload.prompt = rewrittenPrompt;
  } else if (typeof payload.input === "string") {
    payload.input = rewrittenPrompt;
  } else if (typeof payload.description === "string") {
    payload.description = rewrittenPrompt;
  } else {
    payload.prompt = rewrittenPrompt;
  }
};

const asProviderString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asProviderInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const normalized = asProviderString(value);
  if (!normalized || !/^-?\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
};

const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asProviderString(item))
    .filter((item): item is string => Boolean(item));
};

const dedupeStrings = (values: Array<string | null | undefined>, limit = 10): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  values.forEach((value) => {
    const normalized = asProviderString(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });
  return deduped.slice(0, limit);
};

const asJsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const FAL_CDN_MEDIA_HOST_SUFFIXES = ["fal.media"] as const;

const isFalCdnMediaUrl = (value: string | null): boolean => {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.trim().toLowerCase();
    return FAL_CDN_MEDIA_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
};

const validateOmniHumanProviderPayload = (
  payload: Record<string, unknown>
):
  | { valid: true }
  | {
      valid: false;
      code: string;
      error: string;
      detail: Record<string, unknown>;
    } => {
  const imageUrl = asProviderString(payload.image_url);
  const audioUrl = asProviderString(payload.audio_url);
  const invalidFields = [
    !isFalCdnMediaUrl(imageUrl) ? "image_url" : null,
    !isFalCdnMediaUrl(audioUrl) ? "audio_url" : null,
  ].filter((field): field is string => Boolean(field));
  if (!invalidFields.length) return { valid: true };
  return {
    valid: false,
    code: "LIP_SYNC_MEDIA_NOT_STAGED",
    error: "Lip Sync media could not be prepared. Re-add the image or audio and try again.",
    detail: {
      invalid_fields: invalidFields,
      expected_host: "fal.media",
    },
  };
};

const readProviderSubmitFailureMessage = (payload: Record<string, unknown>): string | null => {
  return asProviderString(normalizeCustomerFacingProviderError(payload, ""));
};

const readProviderBodyCode = (payload: Record<string, unknown>): number | null => {
  const candidates = [
    payload,
    asJsonObject(payload.data),
    asJsonObject(payload.result),
    asJsonObject(payload.response),
  ];
  for (const candidate of candidates) {
    const code = asProviderInteger(candidate.code);
    if (code !== null) return code;
  }
  return null;
};

const readSubmitPayloadSource = (payload: Record<string, unknown>): Record<string, unknown> => {
  const inputPayload = asJsonObject(payload.input);
  return Object.keys(inputPayload).length ? inputPayload : payload;
};

const countSubmitUrlList = (payload: Record<string, unknown>, fields: string[]): number => {
  const values = fields.flatMap((field) => {
    const raw = payload[field];
    if (Array.isArray(raw)) return asTrimmedStringArray(raw);
    const direct = asProviderString(raw);
    return direct ? [direct] : [];
  });
  return dedupeStrings(values, 50).length;
};

const summarizeProviderSubmitPayload = ({
  provider,
  payload,
}: {
  provider: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> | null => {
  if (provider !== "kie") return null;
  const source = readSubmitPayloadSource(payload);
  const summary: Record<string, unknown> = {};
  const providerModel = asProviderString(payload.model);
  const aspectRatio = asProviderString(source.aspect_ratio) ?? asProviderString(source.aspect);
  const resolution = asProviderString(source.resolution);
  const duration =
    asProviderString(source.duration) ??
    (typeof source.duration === "number" && Number.isFinite(source.duration)
      ? String(Math.trunc(source.duration))
      : null) ??
    (typeof source.duration_seconds === "number" && Number.isFinite(source.duration_seconds)
      ? String(Math.trunc(source.duration_seconds))
      : null);
  const mode = asProviderString(source.mode);
  const generationType = asProviderString(source.generation_type);
  const prompt = asProviderString(source.prompt);
  const firstFramePresent = Boolean(asProviderString(source.first_frame_url));
  const lastFramePresent = Boolean(asProviderString(source.last_frame_url));
  const imageUrlCount = countSubmitUrlList(source, ["image_url", "image_urls"]);
  const inputUrlCount = countSubmitUrlList(source, ["input_url", "input_urls"]);
  const videoUrlCount = countSubmitUrlList(source, ["video_url", "video_urls"]);
  const referenceImageCount = countSubmitUrlList(source, ["reference_image_urls"]);
  const referenceVideoCount = countSubmitUrlList(source, ["reference_video_urls"]);
  const referenceAudioCount = countSubmitUrlList(source, ["reference_audio_urls"]);
  const multiPromptCount = Array.isArray(source.multi_prompt) ? source.multi_prompt.length : 0;

  if (providerModel) summary.provider_model = providerModel;
  if (prompt) summary.prompt_present = true;
  if (aspectRatio) summary.aspect_ratio = aspectRatio;
  if (resolution) summary.resolution = resolution;
  if (duration) summary.duration = duration;
  if (mode) summary.mode = mode;
  if (generationType) summary.generation_type = generationType;
  if (typeof source.generate_audio === "boolean") summary.generate_audio = source.generate_audio;
  if (typeof source.sound === "boolean") summary.sound = source.sound;
  if (typeof source.return_last_frame === "boolean") {
    summary.return_last_frame = source.return_last_frame;
  }
  if (typeof source.web_search === "boolean") summary.web_search = source.web_search;
  if (typeof source.multi_shots === "boolean") summary.multi_shots = source.multi_shots;
  if (firstFramePresent) summary.first_frame_present = true;
  if (lastFramePresent) summary.last_frame_present = true;
  if (imageUrlCount > 0) summary.image_url_count = imageUrlCount;
  if (inputUrlCount > 0) summary.input_url_count = inputUrlCount;
  if (videoUrlCount > 0) summary.video_url_count = videoUrlCount;
  if (referenceImageCount > 0) summary.reference_image_count = referenceImageCount;
  if (referenceVideoCount > 0) summary.reference_video_count = referenceVideoCount;
  if (referenceAudioCount > 0) summary.reference_audio_count = referenceAudioCount;
  if (multiPromptCount > 0) summary.multi_prompt_count = multiPromptCount;
  return Object.keys(summary).length ? summary : null;
};

const resolveInlineSubmitTargets = ({
  submitTargets,
  submitUrl,
}: {
  submitTargets?: SubmitTarget[];
  submitUrl?: string;
}): SubmitTarget[] => {
  if (Array.isArray(submitTargets) && submitTargets.length > 0) {
    return submitTargets;
  }
  if (typeof submitUrl === "string" && submitUrl.trim().length > 0) {
    return [{ submitUrl: submitUrl.trim() }];
  }
  return [];
};

const resolveModelSupportsPayloadField = ({
  modelId,
  field,
}: {
  modelId: string;
  field: string;
}): boolean => {
  const spec = getModelPayloadValidationSpec(modelId);
  if (!spec) return false;
  if (spec.allowedTopLevelFields?.includes(field)) return true;
  if ((spec.requiredStringFields ?? []).includes(field)) return true;
  if ((spec.requiredAnyOfStringFields ?? []).includes(field)) return true;
  if ((spec.requiredAnyOfStringArrayFields ?? []).includes(field)) return true;
  return (spec.requiredStringArrayFields ?? []).some((requirement) => requirement.field === field);
};

const mergeInternalImagePayloadUrls = ({
  modelId,
  payload,
  internalMediaRefs,
  signedUrls,
}: {
  modelId: string;
  payload: Record<string, unknown>;
  internalMediaRefs: Array<InternalMediaRef | null | undefined>;
  signedUrls: string[];
}): Record<string, unknown> => {
  const nextPayload = { ...payload };
  const externalImageUrl =
    filterExternalUrlsFromInternalRefs(
      [asProviderString(payload.image_url)],
      internalMediaRefs
    )[0] ?? null;
  const externalImageUrls = filterExternalUrlsFromInternalRefs(
    asTrimmedStringArray(payload.image_urls),
    internalMediaRefs
  );
  const externalInputUrl =
    filterExternalUrlsFromInternalRefs(
      [asProviderString(payload.input_url)],
      internalMediaRefs
    )[0] ?? null;
  const externalInputUrls = filterExternalUrlsFromInternalRefs(
    asTrimmedStringArray(payload.input_urls),
    internalMediaRefs
  );
  const mergedImageUrls = dedupeStrings([...signedUrls, ...externalImageUrls], 10);
  const mergedInputUrls = dedupeStrings([...signedUrls, ...externalInputUrls], 16);
  const supportsImageUrls = resolveModelSupportsPayloadField({ modelId, field: "image_urls" });
  const supportsImageUrl = resolveModelSupportsPayloadField({ modelId, field: "image_url" });
  const supportsInputUrls = resolveModelSupportsPayloadField({ modelId, field: "input_urls" });
  const supportsInputUrl = resolveModelSupportsPayloadField({ modelId, field: "input_url" });
  if (supportsImageUrls && (mergedImageUrls.length > 0 || Array.isArray(payload.image_urls))) {
    nextPayload.image_urls = mergedImageUrls;
  }
  if (
    supportsImageUrl &&
    (mergedImageUrls[0] ||
      externalImageUrl ||
      Object.prototype.hasOwnProperty.call(payload, "image_url"))
  ) {
    nextPayload.image_url = mergedImageUrls[0] ?? externalImageUrl;
  }
  if (supportsInputUrls && (mergedInputUrls.length > 0 || Array.isArray(payload.input_urls))) {
    nextPayload.input_urls = mergedInputUrls;
  }
  if (
    supportsInputUrl &&
    (mergedInputUrls[0] ||
      externalInputUrl ||
      Object.prototype.hasOwnProperty.call(payload, "input_url"))
  ) {
    nextPayload.input_url = mergedInputUrls[0] ?? externalInputUrl;
  }
  return nextPayload;
};

const countAvailableImagePayloadUrls = (payload: Record<string, unknown>): number =>
  dedupeStrings(
    [
      asProviderString(payload.image_url),
      asProviderString(payload.input_url),
      ...asTrimmedStringArray(payload.image_urls),
      ...asTrimmedStringArray(payload.input_urls),
    ],
    20
  ).length;

const supportsInlineSubmitForGenerationMode = ({
  provider,
  generationMode,
}: {
  provider: string;
  generationMode: string;
}): boolean => {
  if (provider === "kie") return true;
  if (provider !== "fal") return false;
  return generationMode === "image" || generationMode === "video";
};

const resolveExternalEditPayloadUrl = ({
  value,
  ref,
}: {
  value: unknown;
  ref: InternalMediaRef | null;
}): string | null => {
  const normalized = asProviderString(value);
  if (!normalized) return null;
  if (!ref) return normalized;
  return filterExternalUrlsFromInternalRefs([normalized], [ref])[0] ?? null;
};

const stripInternalEditPayloadUrls = ({
  payload,
  refs,
}: {
  payload: Record<string, unknown>;
  refs: InternalEditMediaRefs;
}): {
  payload: Record<string, unknown>;
  resolvedFallbackCount: number;
  expectedFallbackCount: number;
} => {
  const nextPayload = { ...payload };
  const baseImageUrl = resolveExternalEditPayloadUrl({
    value: payload.image_url,
    ref: refs.baseImageRef,
  });
  const maskUrl = resolveExternalEditPayloadUrl({
    value: payload.mask_url,
    ref: refs.maskRef,
  });
  const referenceImageUrl = resolveExternalEditPayloadUrl({
    value: payload.reference_image_url,
    ref: refs.referenceImageRef,
  });
  const expectedFallbackCount = [refs.baseImageRef, refs.maskRef, refs.referenceImageRef].filter(
    (ref) => Boolean(ref)
  ).length;

  if (refs.baseImageRef) {
    if (baseImageUrl) nextPayload.image_url = baseImageUrl;
    else delete nextPayload.image_url;
  }
  if (refs.maskRef) {
    if (maskUrl) nextPayload.mask_url = maskUrl;
    else delete nextPayload.mask_url;
  }
  if (refs.referenceImageRef) {
    if (referenceImageUrl) nextPayload.reference_image_url = referenceImageUrl;
    else delete nextPayload.reference_image_url;
  }

  return {
    payload: nextPayload,
    resolvedFallbackCount: [baseImageUrl, maskUrl, referenceImageUrl].filter((value) =>
      Boolean(value)
    ).length,
    expectedFallbackCount,
  };
};

const applyInternalEditPayloadUrls = ({
  payload,
  baseImageUrl,
  maskUrl,
  referenceImageUrl,
}: {
  payload: Record<string, unknown>;
  baseImageUrl: string | null;
  maskUrl: string | null;
  referenceImageUrl: string | null;
}): Record<string, unknown> => ({
  ...payload,
  ...(baseImageUrl ? { image_url: baseImageUrl } : {}),
  ...(maskUrl ? { mask_url: maskUrl } : {}),
  ...(referenceImageUrl ? { reference_image_url: referenceImageUrl } : {}),
});

/**
 * Builds a Next.js API handler that debits credits before forwarding to Fal.
 */
export const createFalSubmitHandler = ({
  modelId,
  provider = "fal",
  submitUrl,
  submitTargets,
  skipBilling = false,
  routeLabel,
  timeoutMs = 20000,
  validatePayload,
}: FalSubmitConfig) => {
  const evaluateSharedPayloadContract = evaluateFalPayloadContractForModel(modelId, {
    projectAllowedTopLevelFields: true,
    enforceAllowedTopLevelFields: true,
  });

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const user = await requireApiUser(req, res);
    if (!user) {
      return;
    }

    const providerKey = provider.trim().toLowerCase();
    try {
      readProviderApiKey(providerKey);
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.config_missing",
        message: String(error),
        statusCode: 500,
        metadata: { model_id: modelId, provider: providerKey },
      });
      return res.status(500).json({ error: String(error) });
    }

    const rawPayload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const {
      generation_replay: rawGenerationReplay,
      workflow_reload: rawWorkflowReload,
      character_context: rawCharacterContext,
      style_context: rawStyleContext,
      shortpulse_context: rawShortpulseContext,
      shortpulse_internal_media_refs: rawInternalMediaRefs,
      shortpulse_internal_edit_media_refs: rawInternalEditMediaRefs,
      input_image_count: rawInputImageCount,
      ...rawPayloadWithoutContext
    } = rawPayload;
    const generationReplayContext = asJsonObject(rawGenerationReplay);
    const workflowReloadContext = asJsonObject(rawWorkflowReload);
    const characterContext = asJsonObject(rawCharacterContext);
    const styleContext = asJsonObject(rawStyleContext);
    const shortpulseContext = asJsonObject(rawShortpulseContext);
    const internalMediaRefs = readInternalMediaRefsFromPayload(rawInternalMediaRefs, 16);
    const internalEditMediaRefs = readInternalEditMediaRefsFromPayload(rawInternalEditMediaRefs);
    let payload = rawPayloadWithoutContext;
    const runtimeFlags = readFalRuntimeFlags();
    const generationPrecheckEnabled =
      process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED === "true";
    const safetyProfile = await resolveRuntimeSafetyProfile({
      envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
    });
    const safetyPolicyDocument = resolveSafetyPolicyDocument({
      activePolicy: safetyProfile.activePolicy,
      profileId: safetyProfile.profileId,
    });
    const generationMode = resolveGenerationModeFromPayload(modelId, payload);
    if (generationMode === "image" && internalMediaRefs.some((ref) => Boolean(ref))) {
      try {
        const signedUrls = await resolveSignedUrlsForInternalMediaRefs({
          refs: internalMediaRefs,
          userId: user.id,
        });
        payload = mergeInternalImagePayloadUrls({
          modelId,
          payload,
          internalMediaRefs,
          signedUrls,
        });
      } catch (error) {
        const fallbackPayload = mergeInternalImagePayloadUrls({
          modelId,
          payload,
          internalMediaRefs,
          signedUrls: [],
        });
        const fallbackReferenceCount = countAvailableImagePayloadUrls(fallbackPayload);
        const detail = error instanceof Error ? error.message : String(error);
        if (fallbackReferenceCount > 0) {
          payload = fallbackPayload;
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.internal_media_ref_sign_fallback",
            message:
              "Internal reference signing failed; continuing submit with remaining external references.",
            statusCode: 200,
            userId: user.id,
            userEmail: user.email ?? null,
            metadata: {
              model_id: modelId,
              fallback_reference_count: fallbackReferenceCount,
              detail,
            },
          });
        } else {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.internal_media_ref_sign_failed",
            message: "Reference media could not be prepared. Please retry.",
            statusCode: 503,
            userId: user.id,
            userEmail: user.email ?? null,
            metadata: {
              model_id: modelId,
              detail,
            },
          });
          res.setHeader("Retry-After", "20");
          return res.status(503).json({
            error: "Reference media could not be prepared. Please retry.",
            detail: "Unable to refresh internal reference media URLs.",
          });
        }
      }
    }
    if (
      generationMode === "image" &&
      (internalEditMediaRefs.baseImageRef ||
        internalEditMediaRefs.maskRef ||
        internalEditMediaRefs.referenceImageRef)
    ) {
      try {
        const signedEditUrls = await resolveSignedUrlsForInternalEditMediaRefs({
          refs: internalEditMediaRefs,
          userId: user.id,
        });
        payload = applyInternalEditPayloadUrls({
          payload,
          baseImageUrl: signedEditUrls.baseImageUrl,
          maskUrl: signedEditUrls.maskUrl,
          referenceImageUrl: signedEditUrls.referenceImageUrl,
        });
      } catch (error) {
        const fallback = stripInternalEditPayloadUrls({
          payload,
          refs: internalEditMediaRefs,
        });
        const detail = error instanceof Error ? error.message : String(error);
        if (
          fallback.expectedFallbackCount > 0 &&
          fallback.resolvedFallbackCount === fallback.expectedFallbackCount
        ) {
          payload = fallback.payload;
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.internal_edit_media_ref_sign_fallback",
            message:
              "Internal edit reference signing failed; continuing submit with external fallback URLs.",
            statusCode: 200,
            userId: user.id,
            userEmail: user.email ?? null,
            metadata: {
              model_id: modelId,
              fallback_reference_count: fallback.resolvedFallbackCount,
              detail,
            },
          });
        } else {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.internal_edit_media_ref_sign_failed",
            message: "Edit reference media could not be prepared. Please retry.",
            statusCode: 503,
            userId: user.id,
            userEmail: user.email ?? null,
            metadata: {
              model_id: modelId,
              expected_fallback_count: fallback.expectedFallbackCount,
              resolved_fallback_count: fallback.resolvedFallbackCount,
              detail,
            },
          });
          res.setHeader("Retry-After", "20");
          return res.status(503).json({
            error: "Edit reference media could not be prepared. Please retry.",
            detail: "Unable to refresh internal edit media URLs.",
          });
        }
      }
    }
    const promptForPolicy = resolveGenerationPromptFromPayload(routeLabel, payload);
    const promptPrecheck = runStudioAgentSafetyInputPrecheck({
      enabled: generationPrecheckEnabled,
      messages: [{ role: "user", content: promptForPolicy }],
      context: {},
      canonicalPrompt: null,
      modality: generationMode,
      profileId: safetyProfile.profileId,
      environment: resolveSafetyEnvironment(process.env.NODE_ENV),
      devAbsoluteZeroEnabled: process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true",
      policyDocument: safetyPolicyDocument,
      fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
        sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
        scopedRawValue:
          process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT,
      }),
    });
    if (promptPrecheck.outcome === "refusal") {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.safety_blocked",
        message: "Generation submit blocked by pre-provider safety policy.",
        statusCode: 422,
        metadata: {
          model_id: modelId,
          policy_version: safetyProfile.policyVersion,
          profile_id: safetyProfile.profileId,
          category: promptPrecheck.decision?.category ?? null,
          decision_action: promptPrecheck.decision?.action ?? "refuse",
          refusal_field: promptPrecheck.scopeTelemetry.refusalField,
          rewritten_fields: promptPrecheck.scopeTelemetry.rewrittenFields,
          non_blocking_signal_count: promptPrecheck.scopeTelemetry.nonBlockingSignalCount,
        },
      });
      return res.status(422).json({
        error: EXPLICIT_CONTENT_FAILURE_MESSAGE,
        detail: EXPLICIT_CONTENT_FAILURE_DETAIL,
        code: "GENERATION_SAFETY_BLOCKED",
      });
    }
    if (promptPrecheck.outcome === "rewritten") {
      const rewrittenPrompt = promptPrecheck.messages[0]?.content ?? promptForPolicy;
      applyRewrittenPromptToPayload({
        payload,
        rewrittenPrompt,
      });
    }
    const normalizedVideoContract = normalizeVideoSubmitIngressPayload({ modelId, payload });
    if (!normalizedVideoContract.ok) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.video_contract_violation",
        message: normalizedVideoContract.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          code: normalizedVideoContract.code,
          detail: normalizedVideoContract.detail ?? null,
        },
      });
      return res.status(400).json({
        error: normalizedVideoContract.error,
        code: normalizedVideoContract.code,
        detail: normalizedVideoContract.detail ?? null,
      });
    }
    payload = normalizedVideoContract.payload;
    const contractValidation = evaluateSharedPayloadContract(payload);
    if (!contractValidation.valid) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.validation_failed",
        message: contractValidation.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          code: contractValidation.code,
          detail: contractValidation.detail ?? null,
        },
      });
      return res.status(400).json({
        error: contractValidation.error,
        code: contractValidation.code,
        detail: contractValidation.detail ?? null,
      });
    }
    payload = contractValidation.projectedPayload;

    const payloadValidation = validatePayload?.(payload);
    if (payloadValidation && "valid" in payloadValidation && payloadValidation.valid) {
      payload = payloadValidation.projectedPayload;
    } else if (payloadValidation) {
      const validationCode = payloadValidation.code ?? "GENERATION_PAYLOAD_CONTRACT_VIOLATION";
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.validation_failed",
        message: payloadValidation.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          code: validationCode,
          detail: payloadValidation.detail ?? null,
        },
      });
      return res.status(400).json({
        error: payloadValidation.error,
        code: validationCode,
        detail: payloadValidation.detail ?? null,
      });
    }
    if (modelId === FAL_OMNIHUMAN_V15_MODEL_ID) {
      const lipSyncProviderPayloadValidation = validateOmniHumanProviderPayload(payload);
      if (!lipSyncProviderPayloadValidation.valid) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.fal_submit.lip_sync_media_not_staged",
          message: lipSyncProviderPayloadValidation.error,
          statusCode: 400,
          userId: user.id,
          userEmail: user.email ?? null,
          metadata: {
            model_id: modelId,
            code: lipSyncProviderPayloadValidation.code,
            detail: lipSyncProviderPayloadValidation.detail,
          },
        });
        return res.status(400).json({
          error: lipSyncProviderPayloadValidation.error,
          code: lipSyncProviderPayloadValidation.code,
          detail: lipSyncProviderPayloadValidation.detail,
        });
      }
    }
    const generationSpec = getModelPayloadValidationSpec(modelId);
    const safetyEnforcement = enforceServerGenerationSafetyPayload({
      payload,
      modelId,
      modality: generationMode === "video" ? "video" : "image",
      spec: generationSpec,
      policyDocument: safetyPolicyDocument,
    });
    if (safetyEnforcement.enforced) {
      console.info(
        "[fal-submit][safety-input-precheck]",
        JSON.stringify({
          route: routeLabel,
          model_id: modelId,
          safety_stage: "input_precheck",
          safety_outcome: promptPrecheck.outcome,
          policy_version: safetyProfile.policyVersion,
          profile_id: safetyProfile.profileId,
          category: promptPrecheck.decision?.category ?? null,
          decision_action: promptPrecheck.decision?.action ?? null,
          refusal_field: promptPrecheck.scopeTelemetry.refusalField,
          rewritten_fields: promptPrecheck.scopeTelemetry.rewrittenFields,
          non_blocking_signal_count: promptPrecheck.scopeTelemetry.nonBlockingSignalCount,
          generation_safety_level: safetyEnforcement.enforcedLevel,
        })
      );
    }
    const billingPayload =
      rawInputImageCount === undefined
        ? payload
        : {
            ...payload,
            input_image_count: rawInputImageCount,
          };
    const charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: billingPayload,
      reason: `${routeLabel} generation`,
      skipBilling,
    });
    if (!charge) return;
    try {
      const evaluateAdmissionForScope = async ({
        scopeUserId,
        globalMax,
      }: {
        scopeUserId?: string | null;
        globalMax: number;
      }) => {
        const { decision, capacitySnapshot, backpressure } =
          await evaluateScopedGenerationAdmission({
            scopeUserId,
            provider: providerKey,
            modelId,
            config: runtimeFlags.admission,
            globalMax,
            staleIgnoreMinAgeSeconds: runtimeFlags.queueMaxWaitSeconds,
            activeGenerationStaleIgnoreMinAgeSeconds: Math.max(
              runtimeFlags.runningExhaustMinAgeSeconds,
              runtimeFlags.providerAttachedReservationCleanupMinAgeSeconds
            ),
            orphanGraceSeconds: Math.max(60, runtimeFlags.queueBaseBackoffSeconds * 12),
          });
        if (capacitySnapshot.staleIgnoredGlobal > 0) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.capacity_stale_ignored",
            message:
              "Ignored stale provider-attached reservations while evaluating submit admission.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              tier: capacitySnapshot.tier,
              stale_ignored_global: capacitySnapshot.staleIgnoredGlobal,
              stale_ignored_tier: capacitySnapshot.staleIgnoredTier,
            },
          });
        }
        if (
          scopeUserId == null &&
          backpressure &&
          shouldEmitRecoveryBackpressureTelemetry({
            actor: "submit",
            provider: providerKey,
            level: backpressure.level,
            effectiveGlobalMax: backpressure.effectiveGlobalMax,
          })
        ) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.recovery_backpressure_applied",
            message: "Applied recovery-lag backpressure to shared-provider admission.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              requested_global_max: backpressure.requestedGlobalMax,
              effective_global_max: backpressure.effectiveGlobalMax,
              reduction: backpressure.reduction,
              backpressure_level: backpressure.level,
              stale_provider_attached_reservations:
                backpressure.signals.staleProviderAttachedReservations,
              stale_recoverable_generations: backpressure.signals.staleRecoverableGenerations,
              recent_queue_wait_timeouts: backpressure.signals.recentQueueWaitTimeouts,
              recent_recovery_p95_ms: backpressure.signals.recentRecoveryP95Ms,
            },
          });
        }
        return decision;
      };

      const sharedProviderDecision = runtimeFlags.admission.sharedProviderEnabled
        ? await evaluateAdmissionForScope({
            scopeUserId: null,
            globalMax: runtimeFlags.admission.sharedProviderGlobalMax,
          })
        : null;
      const userGlobalMax =
        charge.concurrencyEntitlement?.maxConcurrentGenerations ?? runtimeFlags.admission.globalMax;
      const userAdmissionDecision = await evaluateAdmissionForScope({
        scopeUserId: charge.userId,
        globalMax: userGlobalMax,
      });
      const admissionDecision = selectEffectiveAdmissionDecision({
        providerDecision: sharedProviderDecision,
        userDecision: userAdmissionDecision,
      });
      const admissionScope = resolveAdmissionScope({
        providerDecision: sharedProviderDecision,
        admissionDecision,
      });

      if (admissionDecision.wouldLimit) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.api.fal_submit.admission_limited",
          message: "Generation admission limit reached.",
          statusCode: 429,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            mode: admissionDecision.mode,
            reason: admissionDecision.reason,
            global_active: admissionDecision.snapshot.globalActive,
            global_max: admissionDecision.snapshot.globalMax,
            tier: admissionDecision.snapshot.tier,
            tier_active: admissionDecision.snapshot.tierActive,
            tier_max: admissionDecision.snapshot.tierMax,
            admission_scope: admissionScope,
            plan_id: charge.concurrencyEntitlement?.planId ?? null,
            max_concurrent_generations:
              charge.concurrencyEntitlement?.maxConcurrentGenerations ?? null,
            entitlement_source: charge.concurrencyEntitlement?.source ?? null,
          },
        });
      }

      const inlineSubmitTargets = resolveInlineSubmitTargets({ submitTargets, submitUrl });
      const supportsInlineDirectSubmit =
        inlineSubmitTargets.length > 0 &&
        supportsInlineSubmitForGenerationMode({
          provider: providerKey,
          generationMode,
        });
      const canUseInlineDirectSubmit = supportsInlineDirectSubmit;

      if (canUseInlineDirectSubmit) {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const dispatchAtIso = new Date().toISOString();
          const submitResult = await dispatchProviderSubmit({
            provider: providerKey,
            modelId,
            targets: inlineSubmitTargets,
            payload: payload as JsonValue,
            apiKey: readProviderApiKey(providerKey),
            signal: controller.signal,
            requestStartTimeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
          });
          const providerSubmitSummary = summarizeProviderSubmitPayload({
            provider: providerKey,
            payload,
          });

          if (!submitResult.response.ok || !submitResult.providerRequestId) {
            const upstreamMessage =
              readProviderSubmitFailureMessage(submitResult.data) ??
              (submitResult.providerRequestId
                ? "Provider submit failed."
                : "Provider submit response missing request id.");
            const providerBodyCode = readProviderBodyCode(submitResult.data);
            const contentPolicyMessage = readProviderContentPolicyMessage({
              provider: providerKey,
              payload: submitResult.data,
            });
            const providerSubmitFailure = classifyProviderSubmitFailure({
              upstreamStatus: submitResult.response.status,
              providerBodyCode,
            });
            const explicitContentFailure = normalizeExplicitContentFailure({
              message: contentPolicyMessage ?? upstreamMessage,
              detail: contentPolicyMessage ?? upstreamMessage,
              force: Boolean(contentPolicyMessage),
            });
            const upstreamFailureStatus =
              submitResult.response.ok && !submitResult.providerRequestId
                ? 502
                : submitResult.response.status || 502;
            const failureStatus = providerSubmitFailure?.clientStatus ?? upstreamFailureStatus;
            const userFacingMessage =
              providerSubmitFailure?.message ??
              explicitContentFailure?.errorMessage ??
              upstreamMessage;
            const userFacingDetail =
              providerSubmitFailure?.detail ??
              normalizeCustomerFacingProviderError(
                explicitContentFailure?.errorDetail ?? submitResult.data,
                userFacingMessage
              );
            await charge.refund("Auto-release: inline provider submit failed.", {
              reason: submitResult.providerRequestId
                ? "direct_submit_failed"
                : "direct_submit_missing_request_id",
              failure_class: providerSubmitFailure?.code ?? "PROVIDER_SUBMIT_FAILED",
              upstream_status: submitResult.response.status,
              client_status: failureStatus,
              upstream_target_url: submitResult.targetUrl,
              upstream_target_index: submitResult.targetIndex,
              upstream_payload: submitResult.data,
              provider_body_code: providerBodyCode,
              ...(providerSubmitSummary ? { provider_submit_summary: providerSubmitSummary } : {}),
            });
            await logGenerationFailure({
              req,
              routeLabel,
              source: "api.fal_submit.direct_submit_failed",
              message: userFacingMessage,
              statusCode: failureStatus,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                source_ref: charge.sourceRef,
                upstream_status: submitResult.response.status,
                upstream_failure_status: upstreamFailureStatus,
                client_status: failureStatus,
                upstream_target_url: submitResult.targetUrl,
                upstream_target_index: submitResult.targetIndex,
                provider_request_id: submitResult.providerRequestId,
                provider_submit_failure_class:
                  providerSubmitFailure?.code ?? "PROVIDER_SUBMIT_FAILED",
                charge_state: providerSubmitFailure?.chargeState ?? "released",
                explicit_content_blocked: explicitContentFailure != null,
                upstream_message: upstreamMessage,
                provider_body_code: providerBodyCode,
                ...(providerSubmitSummary
                  ? { provider_submit_summary: providerSubmitSummary }
                  : {}),
              },
            });
            return res.status(failureStatus).json({
              ...(providerSubmitFailure
                ? {
                    code: providerSubmitFailure.code,
                    chargeState: providerSubmitFailure.chargeState,
                    upstreamStatus: submitResult.response.status,
                  }
                : {}),
              error: userFacingMessage,
              detail: userFacingDetail,
            });
          }

          const providerRequestId = submitResult.providerRequestId;
          const generationId = randomUUID();
          const nextRecoveryAtIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();
          const displayPrompt = resolveGenerationPromptFromPayload(routeLabel, payload);
          const generationMode = resolveGenerationModeFromPayload(modelId, payload);
          const generationAspect = resolveGenerationAspectFromPayload(payload);
          const generationDurationSeconds = readGenerationDurationSeconds(payload);
          const generationResolution = resolveGenerationResolutionFromPayload(payload);
          const generationMetadata = {
            source_ref: charge.sourceRef,
            generation_submit_authority: "direct",
            route: req.url ?? null,
            route_label: routeLabel,
            upstream_target_url: submitResult.targetUrl,
            upstream_target_index: submitResult.targetIndex,
            provider_status_url: submitResult.providerStatusUrl,
            provider_response_url: submitResult.providerResponseUrl,
            provider_cancel_url: submitResult.providerCancelUrl,
            provider_diagnostics: submitResult.providerDiagnostics ?? null,
            ...(providerSubmitSummary ? { provider_submit_summary: providerSubmitSummary } : {}),
            ...(Object.keys(generationReplayContext).length > 0
              ? { generation_replay: generationReplayContext }
              : {}),
            ...(Object.keys(workflowReloadContext).length > 0
              ? { workflow_reload: workflowReloadContext }
              : {}),
            ...(Object.keys(characterContext).length > 0
              ? { character_context: characterContext }
              : {}),
            ...(Object.keys(styleContext).length > 0 ? { style_context: styleContext } : {}),
            ...(Object.keys(shortpulseContext).length > 0
              ? { shortpulse_context: shortpulseContext }
              : {}),
          };
          const attemptInput = {
            generationId,
            userId: charge.userId,
            provider: providerKey,
            modelId,
            providerRequestId,
            dispatchSource: "direct_submit" as const,
            submitRoute: req.url ?? routeLabel,
            metadata: {
              source_ref: charge.sourceRef,
              generation_submit_authority: "direct",
              submit_target_url: submitResult.targetUrl,
              submit_target_index: submitResult.targetIndex,
              provider_status_url: submitResult.providerStatusUrl,
              provider_response_url: submitResult.providerResponseUrl,
              provider_cancel_url: submitResult.providerCancelUrl,
              provider_diagnostics: submitResult.providerDiagnostics ?? null,
              ...(providerSubmitSummary ? { provider_submit_summary: providerSubmitSummary } : {}),
              ...(Object.keys(shortpulseContext).length > 0
                ? { shortpulse_context: shortpulseContext }
                : {}),
            },
            observedAt: dispatchAtIso,
          };
          const buildGenerationMutation = (mode: "insert" | "upsert") => {
            const generationRow = {
              id: generationId,
              user_id: charge.userId,
              mode: generationMode,
              provider: providerKey,
              model_id: modelId,
              prompt_text: displayPrompt,
              aspect: generationAspect,
              duration_seconds: generationDurationSeconds,
              resolution: generationResolution,
              ...buildAcceptedRunningGenerationUpdate({
                provider: providerKey,
                modelId,
                providerRequestId,
                nextRecoveryAtIso,
                metadata: generationMetadata,
              }),
            };
            return async () => {
              const query = getSupabaseAdmin().from("ai_generations");
              const response =
                mode === "insert"
                  ? await query.insert(generationRow).select("id").single()
                  : await query.upsert(generationRow, { onConflict: "id" }).select("id").single();
              if (response.error) {
                return {
                  ok: false as const,
                  error: response.error.message ?? "generation_insert_failed",
                };
              }
              return { ok: true as const };
            };
          };
          const repairAcceptedTracking = () =>
            applyAcceptedRunningGenerationTransition({
              applyGenerationMutation: buildGenerationMutation("upsert"),
              attemptInput,
            });
          let motionReferenceLeaseAttempted = false;
          const tryCreateMotionReferenceLease = async () => {
            if (motionReferenceLeaseAttempted) return;
            motionReferenceLeaseAttempted = true;
            try {
              await createMotionReferenceVideoLeaseForGeneration({
                generationId,
                userId: charge.userId,
                shortpulseContext,
              });
            } catch (error) {
              await writeAppErrorLog({
                source: "telemetry.motion_reference_video.lease_create_failed",
                message:
                  "Motion reference video lease creation failed after provider submit acceptance.",
                requestId: providerRequestId,
                userId: charge.userId,
                statusCode: 200,
                metadata: {
                  generation_id: generationId,
                  route_label: routeLabel,
                  provider: providerKey,
                  model_id: modelId,
                  motion_reference_asset: shortpulseContext.motion_reference_asset ?? null,
                  lease_error: error instanceof Error ? error.message : String(error),
                },
              }).catch(() => undefined);
            }
          };
          const markSubmittedResult = await charge.markSubmitted(providerRequestId, {
            generation_submit_authority: "direct",
            submit_route: req.url ?? routeLabel,
            submit_marked_at: dispatchAtIso,
            provider: providerKey,
            model_id: modelId,
            upstream_target_url: submitResult.targetUrl,
            upstream_target_index: submitResult.targetIndex,
            provider_status_url: submitResult.providerStatusUrl,
            provider_response_url: submitResult.providerResponseUrl,
            provider_cancel_url: submitResult.providerCancelUrl,
          });

          if (!markSubmittedResult.ok) {
            const trackingRepairResult = await repairAcceptedTracking();
            if (trackingRepairResult.ok) {
              await tryCreateMotionReferenceLease();
            }
            await charge.refund(
              "Auto-release: failed to bind provider request id after direct submit.",
              {
                reason: "direct_submit_mark_submitted_failed",
                provider_request_id: providerRequestId,
                source_ref: charge.sourceRef,
                submit_link_status: markSubmittedResult.status,
                submit_link_code: markSubmittedResult.code ?? null,
                submit_link_message: markSubmittedResult.message ?? null,
              }
            );
            await logGenerationFailure({
              req,
              routeLabel,
              source: "api.fal_submit.direct_submit_mark_submitted_failed",
              message:
                markSubmittedResult.message ??
                "Failed to record provider request ownership after direct submit.",
              statusCode: 500,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                submit_link_status: markSubmittedResult.status,
                submit_link_code: markSubmittedResult.code ?? null,
                tracking_repair_stage: trackingRepairResult.ok ? null : trackingRepairResult.stage,
                tracking_repair_error: trackingRepairResult.ok ? null : trackingRepairResult.error,
              },
            });
            return res.status(500).json({
              error: "Failed to start generation tracking. Please retry.",
            });
          }
          const transitionResult = await applyAcceptedRunningGenerationTransition({
            applyGenerationMutation: buildGenerationMutation("insert"),
            attemptInput,
          });

          if (!transitionResult.ok) {
            const trackingRepairResult = await repairAcceptedTracking();
            if (trackingRepairResult.ok) {
              await tryCreateMotionReferenceLease();
            }
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.api.fal_submit.direct_transition_failed",
              message: "Direct submit accepted, but generation transition failed.",
              statusCode: 200,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                generation_id: generationId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                stage: transitionResult.stage,
                error: transitionResult.error,
                tracking_repair_stage: trackingRepairResult.ok ? null : trackingRepairResult.stage,
                tracking_repair_error: trackingRepairResult.ok ? null : trackingRepairResult.error,
              },
            });
            if (!trackingRepairResult.ok) {
              return res.status(502).json({
                error: "Provider accepted the generation, but tracking could not be repaired.",
                request_id: providerRequestId,
              });
            }
          }
          await tryCreateMotionReferenceLease();

          const projectId = readGenerationProjectIdFromContext(shortpulseContext);
          const workspaceRuntimeKey = readGenerationWorkspaceRuntimeKeyFromContext({
            context: shortpulseContext,
            projectId,
          });

          try {
            await upsertGenerationProjection({
              generationId,
              userId: charge.userId,
              projectId,
              workspaceRuntimeKey,
              sourceRef: charge.sourceRef,
              requestId: providerRequestId,
              provider: providerKey,
              providerRequestId,
              status: "ready",
              taskState: "running",
              queueState: "dispatched",
              displayPrompt,
              modelId,
              saveState: "idle",
              publicationState: "pending",
              resultUrls: [],
              savedMediaIds: [],
              generationReplay: generationReplayContext,
              workflowReload: workflowReloadContext,
              characterContext,
              styleContext,
              startedAt: dispatchAtIso,
            });
          } catch (projectionError) {
            await logGenerationFailure({
              req,
              routeLabel,
              source: "telemetry.api.fal_submit.direct_projection_failed",
              message: "Direct submit projection sync failed.",
              statusCode: 200,
              userId: charge.userId,
              metadata: {
                generation_id: generationId,
                source_ref: charge.sourceRef,
                provider_request_id: providerRequestId,
                projection_error:
                  projectionError instanceof Error
                    ? projectionError.message
                    : String(projectionError),
              },
            }).catch(() => undefined);
          }

          await associateGenerationWithProjectForUserBestEffort({
            userId: charge.userId,
            projectId,
            generationId,
            onError: async ({ projectId: normalizedProjectId, error }) => {
              await logGenerationFailure({
                req,
                routeLabel,
                source: "telemetry.api.fal_submit.project_association_failed",
                message: "Direct submit project association failed.",
                statusCode: 200,
                userId: charge.userId,
                metadata: {
                  generation_id: generationId,
                  project_id: normalizedProjectId,
                  source_ref: charge.sourceRef,
                  provider_request_id: providerRequestId,
                  association_error: error instanceof Error ? error.message : String(error),
                },
              }).catch(() => undefined);
            },
          });

          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_submit.direct_submitted",
            message: "Generation submitted directly to provider.",
            statusCode: 200,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              generation_id: generationId,
              source_ref: charge.sourceRef,
              provider_request_id: providerRequestId,
              upstream_target_url: submitResult.targetUrl,
              upstream_target_index: submitResult.targetIndex,
            },
          });

          void requestGenerationControlPlaneWake({
            routeLabel,
            reason: "direct_submit_accepted",
          });

          return res.status(200).json({
            request_id: providerRequestId,
            generationId,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          if (error instanceof ProviderSubmitValidationError) {
            await charge.refund("Auto-release: direct provider submit validation failed.", {
              reason: "direct_submit_validation_failed",
              code: error.code,
              detail: error.detail,
            });
            await logGenerationFailure({
              req,
              routeLabel,
              source: "api.fal_submit.direct_submit_validation_failed",
              message: error.message,
              statusCode: error.statusCode,
              userId: charge.userId,
              metadata: {
                model_id: modelId,
                source_ref: charge.sourceRef,
                validation_code: error.code,
                validation_detail: error.detail,
              },
            });
            return res.status(error.statusCode).json({
              error: error.message,
              code: error.code,
              detail: error.detail,
            });
          }
          await charge.refund(
            "Auto-release: direct provider submit threw before request tracking completed.",
            {
              reason: "direct_submit_error",
              detail,
            }
          );
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.direct_submit_error",
            message: detail,
            statusCode: 502,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              source_ref: charge.sourceRef,
            },
          });
          return res.status(502).json({
            error: "Failed to submit generation to provider. Please retry.",
          });
        } finally {
          clearTimeout(timeoutHandle);
        }
      }

      const retryAfterSeconds = 20;
      await charge.refund("Auto-release: no direct provider submit path was available.", {
        reason: "direct_submit_unavailable",
        admission_enforced: admissionDecision.enforced,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.direct_submit_unavailable",
        message: "No direct provider submit path was available before reaching any inline path.",
        statusCode: 503,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          source_ref: charge.sourceRef,
          admission_enforced: admissionDecision.enforced,
        },
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json(buildDirectSubmitUnavailablePayload(retryAfterSeconds));
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.admission_check_failed",
        message: "Generation admission check failed; submit failed closed.",
        statusCode: 500,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          detail: String(error),
        },
      });
      const retryAfterSeconds = runtimeFlags.admission.retryAfterSeconds;
      await charge.refund("Auto-refund: generation admission check failed.", {
        model_id: modelId,
        detail: String(error),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json(buildAdmissionUnavailablePayload(retryAfterSeconds));
    }

    return;
  };
};
