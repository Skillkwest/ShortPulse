import type { NextApiRequest, NextApiResponse } from "next";
import { ELEVENLABS_SOUND_EFFECTS_MODEL_ID } from "../../../lib/model-runtime/elevenLabsModels";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsSoundEffect,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";

type SoundEffectsRequestBody = {
  text?: unknown;
  durationSeconds?: unknown;
  loop?: unknown;
  outputFormat?: unknown;
  modelId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
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
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: null;
    modelId: string;
    characterCost: number | null;
  };
};

type GenerateSoundEffectErrorResponse = {
  error: string;
  details?: string;
};

const DEFAULT_SOUND_EFFECTS_MODEL_ID = ELEVENLABS_SOUND_EFFECTS_MODEL_ID;
const DEFAULT_PROMPT_INFLUENCE = 0.3;
const MIN_DURATION_SECONDS = 0.5;
const MAX_DURATION_SECONDS = 30;

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
      details: "ELEVENLABS_API_KEY is not configured.",
    });
  }

  try {
    const body = (req.body ?? {}) as SoundEffectsRequestBody;
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const modelId = normalizeRequiredString(body.modelId) ?? DEFAULT_SOUND_EFFECTS_MODEL_ID;
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
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

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        duration_seconds: durationSeconds ?? undefined,
        generation_count: durationSeconds == null ? 1 : undefined,
      },
      reason: "elevenlabs-sound-effects generation",
    });
    if (!charge) return;

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
      sourceMode: "sound-effects",
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        duration_seconds: durationSeconds,
        loop_enabled: loop,
        pricing_metadata: charge.chargeMetadata,
        prompt_influence: DEFAULT_PROMPT_INFLUENCE,
        provider_character_cost: generated.characterCost,
        provider_request_id: providerRequestId,
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "ElevenLabs sound effect generation completed.",
      routeLabel: "elevenlabs-sound-effects",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "sound-effects",
        provider_character_cost: generated.characterCost,
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture generation billing reservation: ${captureResult.note}`);
    }

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
        mimeType: generated.contentType,
        durationMs: durationSeconds == null ? null : Math.round(durationSeconds * 1000),
        waveformPeaks: null,
        modelId,
        characterCost: generated.characterCost,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: ElevenLabs sound effect generation failed.", {
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

    return res.status(500).json({
      error: "Unable to generate sound effect",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
