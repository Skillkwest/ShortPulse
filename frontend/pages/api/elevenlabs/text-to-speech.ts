import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequiredAudioVoiceoverModelId } from "../../../lib/model-runtime/modelCatalog";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsVoiceover,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";

type TextToSpeechRequestBody = {
  voiceId?: unknown;
  voiceName?: unknown;
  text?: unknown;
  outputFormat?: unknown;
  config?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  shortpulse_context?: unknown;
};

type GenerateAudioSuccessResponse = {
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
    durationMs: null;
    waveformPeaks: null;
    modelId: string;
    voiceId: string;
    voiceName: string;
  };
};

type GenerateAudioErrorResponse = {
  error: string;
  details?: string;
};

const DEFAULT_VOICEOVER_MODEL_ID = resolveRequiredAudioVoiceoverModelId();
const ALLOWED_MODEL_IDS = new Set([DEFAULT_VOICEOVER_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateAudioSuccessResponse | GenerateAudioErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  try {
    const body = (req.body ?? {}) as TextToSpeechRequestBody;
    const voiceId = normalizeRequiredString(body.voiceId);
    const voiceName = normalizeRequiredString(body.voiceName);
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const config =
      body.config && typeof body.config === "object" && !Array.isArray(body.config)
        ? (body.config as Record<string, unknown>)
        : null;
    const modelId = normalizeRequiredString(config?.model_id);
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
    const shortpulseContext = asRecord(body.shortpulse_context);

    if (!voiceId || !voiceName || !text || !outputFormat || !config || !modelId) {
      return res.status(400).json({
        error: "Invalid request",
        details: "voiceId, voiceName, text, outputFormat, and config.model_id are required.",
      });
    }

    if (!ALLOWED_MODEL_IDS.has(modelId)) {
      return res.status(400).json({
        error: "Invalid request",
        details: `config.model_id must be ${DEFAULT_VOICEOVER_MODEL_ID}.`,
      });
    }

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        text,
        text_characters: text.length,
      },
      reason: "elevenlabs-text-to-speech generation",
      shortpulseContext,
    });
    if (!charge) return;

    const generated = await generateElevenLabsVoiceover({
      voiceId,
      text,
      outputFormat,
      body: config,
    });
    const providerRequestId = generated.providerRequestId ?? `elevenlabs:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "voiceover",
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
      sourceMode: "voiceover",
      voiceId,
      voiceName,
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        text_character_count: text.length,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "ElevenLabs voiceover generation completed.",
      routeLabel: "elevenlabs-text-to-speech",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "voiceover",
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
        durationMs: null,
        waveformPeaks: null,
        modelId,
        voiceId,
        voiceName,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: ElevenLabs voiceover generation failed.", {
        source_mode: "voiceover",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-text-to-speech",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to generate speech",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
