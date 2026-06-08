import type { NextApiRequest, NextApiResponse } from "next";
import {
  ELEVENLABS_SOUND_EFFECT_DURATION_MAX_SECONDS,
  ELEVENLABS_SOUND_EFFECT_DURATION_MIN_SECONDS,
} from "../../../lib/model-runtime/elevenLabsAudioDurations";
import { resolveRequiredAudioSoundEffectsModelId } from "../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  readElevenLabsProviderError,
  resolveElevenLabsProviderUserMessage,
} from "../../../lib/server/api/elevenlabsProviderError";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsSoundEffect,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";
import { markAudioCompanionArtPending } from "../../../lib/server/audioCompanionArt/processing";
import { probeMediaDurationSeconds } from "../../../lib/server/mediaAudioExtraction";
import { readGenerationWorkspaceRuntimeKeyFromContext } from "../../../lib/server/api/generationWorkspaceRuntimeKey";

type SoundEffectsRequestBody = {
  text?: unknown;
  durationSeconds?: unknown;
  loop?: unknown;
  outputFormat?: unknown;
  modelId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  shortpulse_context?: unknown;
  workflow_reload?: unknown;
};

type GenerateSoundEffectSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    companionArtUrl: null;
    companionArtStoragePath: null;
    companionArtStatus: "pending";
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: null;
    modelId: string;
    characterCost: number | null;
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type GenerateSoundEffectErrorResponse = {
  error: string;
  details?: string;
  code?: string;
  retryAfterSeconds?: number;
};

const DEFAULT_SOUND_EFFECTS_MODEL_ID = resolveRequiredAudioSoundEffectsModelId();
const DEFAULT_PROMPT_INFLUENCE = 0.3;
const MIN_DURATION_SECONDS = ELEVENLABS_SOUND_EFFECT_DURATION_MIN_SECONDS;
const MAX_DURATION_SECONDS = ELEVENLABS_SOUND_EFFECT_DURATION_MAX_SECONDS;
const ALLOWED_MODEL_IDS = new Set([DEFAULT_SOUND_EFFECTS_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseOptionalNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateSoundEffectSuccessResponse | GenerateSoundEffectErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return res.status(503).json({
      error: "Service unavailable",
      details: "Audio generation is temporarily unavailable.",
    });
  }

  try {
    const body = (req.body ?? {}) as SoundEffectsRequestBody;
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const modelId = normalizeRequiredString(body.modelId) ?? DEFAULT_SOUND_EFFECTS_MODEL_ID;
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
    const shortpulseContext = asRecord(body.shortpulse_context);
    const workspaceRuntimeKey = readGenerationWorkspaceRuntimeKeyFromContext({
      context: shortpulseContext,
      projectId,
    });
    const workflowReload = asRecord(body.workflow_reload) ?? {};
    const durationSeconds = parseOptionalNumber(body.durationSeconds);
    const loop = typeof body.loop === "boolean" ? body.loop : false;

    if (!text || !outputFormat) {
      return res.status(400).json({
        error: "Invalid request",
        details: "text and outputFormat are required.",
      });
    }

    if (
      durationSeconds !== null &&
      (durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS)
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details: `durationSeconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      });
    }

    if (!ALLOWED_MODEL_IDS.has(modelId)) {
      return res.status(400).json({
        error: "Invalid request",
        details: "modelId is not supported for this audio workflow.",
      });
    }

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        duration_seconds: durationSeconds ?? undefined,
        generation_count: durationSeconds == null ? 1 : undefined,
      },
      reason: "elevenlabs-sound-effects generation",
      shortpulseContext,
    });
    if (!charge) return;
    const settledCharge = charge;

    const generated = await generateElevenLabsSoundEffect({
      text,
      outputFormat,
      body: {
        model_id: modelId,
        loop,
        duration_seconds: durationSeconds ?? undefined,
        prompt_influence: DEFAULT_PROMPT_INFLUENCE,
      },
    });
    let resolvedDurationSeconds: number | null = null;
    try {
      resolvedDurationSeconds = await probeMediaDurationSeconds({
        buffer: generated.buffer,
        filename: null,
        mimeType: generated.contentType,
      });
    } catch {
      resolvedDurationSeconds = null;
    }
    const responseDurationMs =
      resolvedDurationSeconds != null
        ? Math.round(resolvedDurationSeconds * 1000)
        : durationSeconds == null
          ? null
          : Math.round(durationSeconds * 1000);
    const providerRequestId = generated.providerRequestId ?? `elevenlabs:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "sound-effects",
      provider_character_cost: generated.characterCost,
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link generation billing reservation: ${submitLink.status}`);
    }

    const persisted = await persistGeneratedAudioAsset({
      userId: charge.userId,
      promptText: text,
      provider: "elevenlabs",
      modelId,
      providerRequestId,
      requestId: charge.sourceRef,
      projectId,
      workspaceRuntimeKey,
      sourceMode: "sound-effects",
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      workflowReload,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        duration_seconds: durationSeconds,
        resolved_duration_seconds: resolvedDurationSeconds,
        duration_ms: responseDurationMs,
        loop_enabled: loop,
        pricing_metadata: charge.chargeMetadata,
        prompt_influence: DEFAULT_PROMPT_INFLUENCE,
        provider_character_cost: generated.characterCost,
        provider_request_id: providerRequestId,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
      beforeVisibleSettlement: async ({ generationId }) => {
        const captureResult = await captureSucceededGenerationByProviderRequest({
          userId: settledCharge.userId,
          providerRequestId,
          reason: "Audio sound effect generation completed.",
          routeLabel: "elevenlabs-sound-effects",
          detail: {
            generation_id: generationId,
            source_ref: settledCharge.sourceRef,
            source_mode: "sound-effects",
            provider_character_cost: generated.characterCost,
          },
        });
        if (!captureResult.settled) {
          throw new Error(
            `Unable to capture generation billing reservation: ${captureResult.note}`
          );
        }
      },
    });
    await markAudioCompanionArtPending({
      generationId: persisted.generationId,
      userId: charge.userId,
    });

    return res.status(200).json({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: persisted.generationId,
        mediaFileId: persisted.mediaFileId,
        requestId: persisted.requestId,
        previewUrl: persisted.signedUrl,
        resultUrls: [persisted.signedUrl],
        previewStoragePath: persisted.storagePath,
        fullStoragePath: persisted.storagePath,
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: generated.contentType,
        durationMs: responseDurationMs,
        waveformPeaks: null,
        modelId,
        characterCost: generated.characterCost,
        saveState: persisted.saveState,
        saveError: persisted.saveError,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: audio sound effect generation failed.", {
        source_mode: "sound-effects",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-sound-effects",
      scope: "generation",
      user,
    });

    const providerError = readElevenLabsProviderError(error);
    if (providerError && (providerError.status === 429 || providerError.status === 503)) {
      if (providerError.retryAfterSeconds !== null) {
        res.setHeader("Retry-After", String(providerError.retryAfterSeconds));
      }
      return res.status(providerError.status).json({
        error: "Unable to generate sound effect",
        details: sanitizeCustomerFacingProviderText(
          resolveElevenLabsProviderUserMessage(providerError),
          "Unable to generate sound effect."
        ),
        code: providerError.code ?? undefined,
        retryAfterSeconds: providerError.retryAfterSeconds ?? undefined,
      });
    }

    return res.status(500).json({
      error: "Unable to generate sound effect",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to generate sound effect."
      ),
    });
  }
}
