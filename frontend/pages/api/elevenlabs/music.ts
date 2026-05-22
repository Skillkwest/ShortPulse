import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequiredAudioMusicModelId } from "../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsMusic,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";
import { markAudioCompanionArtPending } from "../../../lib/server/audioCompanionArt/processing";
import { probeMediaDurationSeconds } from "../../../lib/server/mediaAudioExtraction";

type MusicRequestBody = {
  text?: unknown;
  durationSeconds?: unknown;
  bpm?: unknown;
  mode?: unknown;
  structure?: unknown;
  energyPercent?: unknown;
  outputFormat?: unknown;
  modelId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  shortpulse_context?: unknown;
};

type GenerateMusicSuccessResponse = {
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
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type GenerateMusicErrorResponse = {
  error: string;
  details?: string;
};

const DEFAULT_MUSIC_MODEL_ID = resolveRequiredAudioMusicModelId();
const MIN_DURATION_SECONDS = 8;
const MAX_DURATION_SECONDS = 180;
const MIN_BPM = 60;
const MAX_BPM = 180;
const MAX_TEXT_LENGTH = 2000;
const ALLOWED_OUTPUT_FORMATS = new Set(["mp3_44100_128", "wav_48000"]);
const ALLOWED_MODEL_IDS = new Set([DEFAULT_MUSIC_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseRequiredFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const buildProviderPrompt = ({
  text,
  bpm,
  structure,
  energyPercent,
  mode,
}: {
  text: string;
  bpm: number;
  structure: "loop" | "full-track" | "cinematic";
  energyPercent: number;
  mode: "instrumental" | "vocal";
}): string =>
  [
    text,
    "",
    "Creative direction:",
    `- Arrangement: ${structure}.`,
    `- Tempo target: ${bpm} BPM.`,
    `- Energy: ${energyPercent}%.`,
    mode === "vocal"
      ? "- Include vocals or topline direction when it fits the prompt."
      : "- Keep the track fully instrumental.",
  ].join("\n");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateMusicSuccessResponse | GenerateMusicErrorResponse>
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
    const body = (req.body ?? {}) as MusicRequestBody;
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const modelId = normalizeRequiredString(body.modelId) ?? DEFAULT_MUSIC_MODEL_ID;
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
    const shortpulseContext = asRecord(body.shortpulse_context);
    const isAutoDuration = body.durationSeconds == null;
    const durationSeconds = isAutoDuration ? null : parseRequiredFiniteNumber(body.durationSeconds);
    const bpm = parseRequiredFiniteNumber(body.bpm);
    const energyPercent = parseRequiredFiniteNumber(body.energyPercent);
    const mode =
      body.mode === "vocal" ? "vocal" : body.mode === "instrumental" ? "instrumental" : null;
    const structure =
      body.structure === "loop" || body.structure === "full-track" || body.structure === "cinematic"
        ? body.structure
        : null;

    if (
      !text ||
      !outputFormat ||
      (!isAutoDuration && durationSeconds === null) ||
      bpm === null ||
      energyPercent === null ||
      !mode ||
      !structure
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "text, bpm, energyPercent, mode, structure, and outputFormat are required. durationSeconds must be a finite number when provided.",
      });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: "Invalid request",
        details: `text must be ${MAX_TEXT_LENGTH} characters or fewer.`,
      });
    }

    if (
      durationSeconds != null &&
      (durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS)
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details: `durationSeconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      });
    }

    if (bpm < MIN_BPM || bpm > MAX_BPM) {
      return res.status(400).json({
        error: "Invalid request",
        details: `bpm must be between ${MIN_BPM} and ${MAX_BPM}.`,
      });
    }

    if (energyPercent < 0 || energyPercent > 100) {
      return res.status(400).json({
        error: "Invalid request",
        details: "energyPercent must be between 0 and 100.",
      });
    }

    if (!ALLOWED_OUTPUT_FORMATS.has(outputFormat)) {
      return res.status(400).json({
        error: "Invalid request",
        details: "outputFormat must be one of: mp3_44100_128, wav_48000.",
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
      payload: durationSeconds == null ? {} : { duration_seconds: durationSeconds },
      reason: "elevenlabs-music generation",
      shortpulseContext,
    });
    if (!charge) return;

    const providerPrompt = buildProviderPrompt({
      text,
      bpm,
      structure,
      energyPercent,
      mode,
    });

    const generated = await generateElevenLabsMusic({
      prompt: providerPrompt,
      outputFormat,
      body: {
        model_id: modelId,
        force_instrumental: mode === "instrumental",
        ...(durationSeconds != null
          ? {
              music_length_ms: Math.round(durationSeconds * 1000),
            }
          : {}),
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
      source_mode: "music",
      song_id: generated.songId,
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
      sourceMode: "music",
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      extraMetadata: {
        duration_seconds: durationSeconds,
        resolved_duration_seconds: resolvedDurationSeconds,
        duration_ms: responseDurationMs,
        tempo_bpm: bpm,
        structure,
        energy_percent: energyPercent,
        music_mode: mode,
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        provider_song_id: generated.songId,
        provider_prompt: providerPrompt,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "Audio music generation completed.",
      routeLabel: "elevenlabs-music",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "music",
        song_id: generated.songId,
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture generation billing reservation: ${captureResult.note}`);
    }
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
        saveState: persisted.saveState,
        saveError: persisted.saveError,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: audio music generation failed.", {
        source_mode: "music",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-music",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to generate music",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to generate music."
      ),
    });
  }
}
