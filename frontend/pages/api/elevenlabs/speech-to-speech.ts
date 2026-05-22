import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { resolveRequiredAudioVoiceChangerModelId } from "../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  assertTrustedRemoteMediaUrl,
  TrustedRemoteMediaUrlError,
} from "../../../lib/server/api/trustedRemoteMediaUrl";
import { markAudioCompanionArtPending } from "../../../lib/server/audioCompanionArt/processing";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  createRemuxedVoiceChangerVideo,
  generateElevenLabsVoiceChanger,
  persistGeneratedAudioAsset,
  persistGeneratedVideoAsset,
  readRemoteSourceBuffer,
} from "../../../lib/server/elevenlabs";
import {
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  MediaAudioExtractionInputError,
  probeMediaDurationSeconds,
  readRemoteMediaBuffer,
  readStoredMediaBuffer,
} from "../../../lib/server/mediaAudioExtraction";

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
    companionArtUrl: null;
    companionArtStoragePath: null;
    companionArtStatus: "pending";
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: null;
    modelId: string;
    voiceId: string;
    voiceName: string;
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
  remuxedVideo?: {
    provider: "elevenlabs";
    mode: "video";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    previewPosterUrl: string | null;
    resultUrls: string[];
    previewPosterStoragePath: string | null;
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: "video/mp4" | "video/webm";
    modelId: string;
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type GenerateAudioErrorResponse = {
  error: string;
  details?: string;
};

type ParsedMultipart = {
  fields: formidable.Fields;
  files: formidable.Files;
};

const DEFAULT_VOICE_CHANGER_MODEL_ID = resolveRequiredAudioVoiceChangerModelId();
const ALLOWED_MODEL_IDS = new Set([DEFAULT_VOICE_CHANGER_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFieldString = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return normalizeRequiredString(value[0]);
  return normalizeRequiredString(value);
};

const parseJsonObjectField = (value: string | null): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const parseBooleanField = (value: string | string[] | undefined): boolean => {
  const normalized = readFieldString(value)?.toLowerCase();
  return normalized === "true";
};

const parseSourceOrigin = (
  value: string | string[] | undefined
): "local" | "reference-grid" | "url" => {
  const normalized = readFieldString(value)?.toLowerCase();
  if (normalized === "reference-grid") return "reference-grid";
  if (normalized === "url") return "url";
  return "local";
};

const parseMultipart = async (req: NextApiRequest): Promise<ParsedMultipart> => {
  const form = formidable({
    maxFileSize: 100 * 1024 * 1024,
    keepExtensions: true,
  });

  return await new Promise<ParsedMultipart>((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const { fields } = await parseMultipart(req);
    const voiceId = readFieldString(fields.voiceId);
    const voiceName = readFieldString(fields.voiceName);
    const outputFormat = readFieldString(fields.outputFormat);
    const modelId = readFieldString(fields.modelId);
    const inputFormat = readFieldString(fields.inputFormat);
    const sourceUrl = readFieldString(fields.sourceUrl);
    const sourceStoragePath = readFieldString(fields.sourceStoragePath);
    const sourceOrigin = parseSourceOrigin(fields.sourceOrigin);
    const sourceName = readFieldString(fields.sourceName) ?? "Voice changer source";
    const originalVideoSourceUrl = readFieldString(fields.originalVideoSourceUrl);
    const originalVideoStoragePath = readFieldString(fields.originalVideoStoragePath);
    const originalVideoName = readFieldString(fields.originalVideoName);
    const originalVideoMimeType = readFieldString(fields.originalVideoMimeType);
    const originalVideoAspect = readFieldString(fields.originalVideoAspect);
    const projectId = readFieldString(fields.project_id) ?? readFieldString(fields.projectId);
    const shortpulseContext = parseJsonObjectField(readFieldString(fields.shortpulseContext));
    const removeBackgroundNoise = parseBooleanField(fields.removeBackgroundNoise);
    const voiceSettingsField = readFieldString(fields.voiceSettings);
    const voiceSettings = voiceSettingsField ? JSON.parse(voiceSettingsField) : null;

    if (!voiceId || !voiceName || !outputFormat || !modelId || !inputFormat || !voiceSettings) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "voiceId, voiceName, outputFormat, modelId, inputFormat, and voiceSettings are required.",
      });
    }

    if (!ALLOWED_MODEL_IDS.has(modelId)) {
      return res.status(400).json({
        error: "Invalid request",
        details: "modelId is not supported for this audio workflow.",
      });
    }

    let sourceBuffer: Buffer | null = null;
    let sourceMimeType: string | null = null;
    let sourceFilename: string | null = null;
    let remuxVideoBuffer: Buffer | null = null;
    let remuxVideoMimeType: string | null = null;
    let remuxVideoFilename: string | null = null;

    if (sourceStoragePath) {
      const trustedStoragePath = assertUserScopedMediaStoragePath({
        path: sourceStoragePath,
        userId: user.id,
        label: "Voice changer source storage path",
      });
      const storedSource = await readStoredMediaBuffer({ storagePath: trustedStoragePath });
      sourceBuffer = storedSource.buffer;
      sourceMimeType = storedSource.contentType;
      sourceFilename = trustedStoragePath.split("/").filter(Boolean).pop() ?? "source";
    } else if (sourceUrl) {
      const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
        rawUrl: sourceUrl,
        req,
        userId: user.id,
        requireUserScope: sourceOrigin === "reference-grid",
        label: "Voice changer source URL",
      });
      const remoteSource = await readRemoteSourceBuffer({ sourceUrl: trustedSourceUrl.toString() });
      sourceBuffer = remoteSource.buffer;
      sourceMimeType = remoteSource.contentType;
      sourceFilename = trustedSourceUrl.pathname.split("/").filter(Boolean).pop() ?? "source";
    }

    if (!sourceBuffer || !sourceFilename) {
      return res.status(400).json({
        error: "Invalid request",
        details: "sourceStoragePath or sourceUrl is required.",
      });
    }

    const sourceDurationSeconds = await probeMediaDurationSeconds({
      buffer: sourceBuffer,
      filename: sourceFilename,
      mimeType: sourceMimeType,
    });
    if (!sourceDurationSeconds) {
      return res.status(422).json({
        error: "Invalid request",
        details: "Unable to determine the voice changer source duration for billing.",
      });
    }

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        source_duration_seconds: sourceDurationSeconds,
      },
      reason: "elevenlabs-speech-to-speech generation",
      shortpulseContext,
    });
    if (!charge) return;

    if (originalVideoStoragePath) {
      const trustedStoragePath = assertUserScopedMediaStoragePath({
        path: originalVideoStoragePath,
        userId: user.id,
        label: "Voice changer source video storage path",
      });
      const storedVideo = await readStoredMediaBuffer({
        storagePath: trustedStoragePath,
        maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
      });
      remuxVideoBuffer = storedVideo.buffer;
      remuxVideoMimeType = originalVideoMimeType ?? storedVideo.contentType;
      remuxVideoFilename =
        originalVideoName ?? trustedStoragePath.split("/").filter(Boolean).pop() ?? "source-video";
    } else if (originalVideoSourceUrl) {
      const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
        rawUrl: originalVideoSourceUrl,
        req,
        userId: user.id,
        requireUserScope: sourceOrigin === "reference-grid",
        label: "Voice changer source video URL",
      });
      const remoteVideo = await readRemoteMediaBuffer({
        sourceUrl: trustedSourceUrl.toString(),
        maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
      });
      remuxVideoBuffer = remoteVideo.buffer;
      remuxVideoMimeType = originalVideoMimeType ?? remoteVideo.contentType;
      remuxVideoFilename =
        originalVideoName ??
        trustedSourceUrl.pathname.split("/").filter(Boolean).pop() ??
        "source-video";
    }

    const generated = await generateElevenLabsVoiceChanger({
      voiceId,
      sourceBuffer,
      sourceFilename,
      sourceMimeType,
      outputFormat,
      modelId,
      voiceSettings,
      removeBackgroundNoise,
      inputFormat,
    });
    const providerRequestId = generated.providerRequestId ?? `elevenlabs:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "voice-changer",
      source_duration_seconds: sourceDurationSeconds,
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link generation billing reservation: ${submitLink.status}`);
    }

    const persisted = await persistGeneratedAudioAsset({
      userId: charge.userId,
      promptText: `${sourceName} -> ${voiceName}`,
      provider: "elevenlabs",
      modelId,
      providerRequestId,
      requestId: charge.sourceRef,
      projectId,
      sourceMode: "voice-changer",
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
        source_duration_ms: Math.round(sourceDurationSeconds * 1000),
        source_duration_seconds: sourceDurationSeconds,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "Audio voice changer generation completed.",
      routeLabel: "elevenlabs-speech-to-speech",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "voice-changer",
        source_duration_seconds: sourceDurationSeconds,
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture generation billing reservation: ${captureResult.note}`);
    }
    await markAudioCompanionArtPending({
      generationId: persisted.generationId,
      userId: charge.userId,
    });

    let remuxedVideo: Awaited<ReturnType<typeof createRemuxedVoiceChangerVideo>> | null = null;
    let persistedRemuxedVideo: Awaited<ReturnType<typeof persistGeneratedVideoAsset>> | null = null;

    if (remuxVideoBuffer && remuxVideoFilename) {
      try {
        remuxedVideo = await createRemuxedVoiceChangerVideo({
          sourceVideoBuffer: remuxVideoBuffer,
          sourceVideoFilename: remuxVideoFilename,
          sourceVideoMimeType: remuxVideoMimeType,
          convertedAudioBuffer: generated.buffer,
          convertedAudioContentType: generated.contentType,
        });

        persistedRemuxedVideo = await persistGeneratedVideoAsset({
          userId: user.id,
          promptText: `${originalVideoName ?? sourceName} -> ${voiceName} video`,
          provider: "elevenlabs",
          modelId,
          providerRequestId,
          projectId,
          sourceMode: "voice-changer",
          outputBuffer: remuxedVideo.buffer,
          outputContentType: remuxedVideo.contentType,
          generationReplay: originalVideoAspect ? { aspect: originalVideoAspect } : undefined,
          extraMetadata: {
            derivative_kind: "voice_changer_remuxed_video",
            billing_source_ref: charge.sourceRef,
            debited_credits: charge.credits,
            pricing_metadata: charge.chargeMetadata,
            provider_request_id: providerRequestId,
            source_audio_generation_id: persisted.generationId,
            source_duration_ms: Math.round(sourceDurationSeconds * 1000),
            source_duration_seconds: sourceDurationSeconds,
            source_video_storage_path: originalVideoStoragePath,
            ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
          },
        });
      } catch (remuxError) {
        await logApiRouteException({
          req,
          error: remuxError,
          routeLabel: "elevenlabs-speech-to-speech-remux",
          scope: "generation",
          user,
        });
        remuxedVideo = null;
        persistedRemuxedVideo = null;
      }
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
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: generated.contentType,
        durationMs: Math.round(sourceDurationSeconds * 1000),
        waveformPeaks: null,
        modelId,
        voiceId,
        voiceName,
        saveState: persisted.saveState,
        saveError: persisted.saveError,
      },
      ...(persistedRemuxedVideo && remuxedVideo
        ? {
            remuxedVideo: {
              provider: "elevenlabs" as const,
              mode: "video" as const,
              generationId: persistedRemuxedVideo.generationId,
              mediaFileId: persistedRemuxedVideo.mediaFileId,
              requestId: persistedRemuxedVideo.requestId,
              previewUrl: persistedRemuxedVideo.signedUrl,
              previewPosterUrl: persistedRemuxedVideo.previewPosterUrl,
              resultUrls: [persistedRemuxedVideo.signedUrl],
              previewPosterStoragePath: persistedRemuxedVideo.previewPosterStoragePath,
              previewStoragePath: persistedRemuxedVideo.previewStoragePath,
              fullStoragePath: persistedRemuxedVideo.fullStoragePath,
              mimeType: remuxedVideo.contentType,
              modelId,
              saveState: persistedRemuxedVideo.saveState,
              saveError: persistedRemuxedVideo.saveError,
            },
          }
        : {}),
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: audio voice changer generation failed.", {
        source_mode: "voice-changer",
      });
    }
    if (
      error instanceof TrustedRemoteMediaUrlError ||
      error instanceof MediaAudioExtractionInputError
    ) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: sanitizeCustomerFacingProviderText(error.message, "Invalid voice changer source."),
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-speech-to-speech",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to convert voice",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to convert voice."
      ),
    });
  }
}
