import type { NextApiRequest, NextApiResponse } from "next";
import { ELEVENLABS_MUSIC_MODEL_ID } from "../../../lib/model-runtime/elevenLabsModels";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { chargeGenerationRequest } from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsMusic,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";

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
    mimeType: string;
    durationMs: number;
    waveformPeaks: null;
    modelId: string;
  };
};

type GenerateMusicErrorResponse = {
  error: string;
  details?: string;
};

const DEFAULT_MUSIC_MODEL_ID = ELEVENLABS_MUSIC_MODEL_ID;
const MIN_DURATION_SECONDS = 8;
const MAX_DURATION_SECONDS = 180;
const MIN_BPM = 60;
const MAX_BPM = 180;
const MAX_TEXT_LENGTH = 800;
const ALLOWED_OUTPUT_FORMATS = new Set(["mp3_44100_128", "wav_48000"]);
const ALLOWED_MODEL_IDS = new Set([DEFAULT_MUSIC_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
      details: "ELEVENLABS_API_KEY is not configured.",
    });
  }

  try {
    const body = (req.body ?? {}) as MusicRequestBody;
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const modelId = normalizeRequiredString(body.modelId) ?? DEFAULT_MUSIC_MODEL_ID;
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
    const durationSeconds = parseRequiredFiniteNumber(body.durationSeconds);
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
      durationSeconds === null ||
      bpm === null ||
      energyPercent === null ||
      !mode ||
      !structure
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "text, durationSeconds, bpm, energyPercent, mode, structure, and outputFormat are required.",
      });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: "Invalid request",
        details: `text must be ${MAX_TEXT_LENGTH} characters or fewer.`,
      });
    }

    if (durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS) {
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
        details: `modelId must be ${DEFAULT_MUSIC_MODEL_ID}.`,
      });
    }

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        duration_seconds: durationSeconds,
      },
      reason: "elevenlabs-music generation",
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
        music_length_ms: Math.round(durationSeconds * 1000),
        force_instrumental: mode === "instrumental",
      },
    });

    const persisted = await persistGeneratedAudioAsset({
      userId: charge.userId,
      promptText: text,
      provider: "elevenlabs",
      modelId,
      providerRequestId: generated.providerRequestId,
      requestId: charge.sourceRef,
      projectId,
      sourceMode: "music",
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      extraMetadata: {
        duration_seconds: durationSeconds,
        tempo_bpm: bpm,
        structure,
        energy_percent: energyPercent,
        music_mode: mode,
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: generated.providerRequestId,
        provider_song_id: generated.songId,
        provider_prompt: providerPrompt,
      },
    });
    if (generated.providerRequestId) {
      await charge.markSubmitted(generated.providerRequestId, {
        source_mode: "music",
        song_id: generated.songId,
      });
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
        durationMs: Math.round(durationSeconds * 1000),
        waveformPeaks: null,
        modelId,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: ElevenLabs music generation failed.", {
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
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
