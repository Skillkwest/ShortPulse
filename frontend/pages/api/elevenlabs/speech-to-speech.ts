import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { resolveRequiredAudioVoiceChangerModelId } from "../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  readElevenLabsProviderError,
  resolveElevenLabsProviderUserMessage,
} from "../../../lib/server/api/elevenlabsProviderError";
import { listSavedVoicesForUser } from "../../../lib/server/api/userSavedVoices";
import { logApiRouteException, writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  assertTrustedRemoteMediaUrl,
  TrustedRemoteMediaUrlError,
} from "../../../lib/server/api/trustedRemoteMediaUrl";
import { markAudioCompanionArtPendingBestEffort } from "../../../lib/server/audioCompanionArt/routePending";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  createRemuxedVoiceChangerVideo,
  generateElevenLabsVoiceChanger,
  listElevenLabsVoices,
  persistGeneratedAudioAsset,
  persistGeneratedVideoAsset,
  readRemoteSourceBuffer,
} from "../../../lib/server/elevenlabs";
import { resolveVoiceAccessForUser } from "../../../lib/server/elevenlabsVoiceLibrary";
import {
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  MediaAudioExtractionInputError,
  probeMediaDurationSeconds,
  readRemoteMediaBuffer,
  readStoredMediaBuffer,
} from "../../../lib/server/mediaAudioExtraction";
import { transcribeAudioBuffer } from "../../../lib/server/openAiAudioTranscription";
import { readGenerationWorkspaceRuntimeKeyFromContext } from "../../../lib/server/api/generationWorkspaceRuntimeKey";
import { generateAudioReferenceTitleBestEffort } from "../../../lib/server/audioTitleGeneration";
import {
  recordVoiceSourceLifecycleState,
  VOICE_CHANGER_SOURCE_RETENTION_DAYS,
} from "../../../lib/server/voiceSourceLifecycle";

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
    companionArtUrl: string | null;
    companionArtStoragePath: string | null;
    companionArtStatus: "pending";
    mimeType: string;
    durationMs: number | null;
    waveformPeaks: null;
    title: string;
    modelId: string;
    voiceId: string;
    voiceName: string;
    transcriptText: string | null;
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
    transcriptText: string | null;
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type GenerateAudioErrorResponse = {
  error: string;
  details?: string;
  code?: string;
  retryAfterSeconds?: number;
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

const hasUploadedFiles = (files: formidable.Files): boolean =>
  Object.values(files).some((entry) => (Array.isArray(entry) ? entry.length > 0 : Boolean(entry)));

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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-speech-to-speech.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to convert voice",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to convert voice."
      ),
    });
  }
  if (!user) return;
  const authenticatedUser = user;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;
  let lifecycleSourceStoragePath: string | null = null;
  let lifecycleOriginalVideoStoragePath: string | null = null;
  let lifecycleSourceRef: string | null = null;

  const recordVoiceChangerLifecycleBestEffort = async ({
    storagePath,
    sourceKind,
    state,
    generationId = null,
    providerRequestId = null,
    metadata = null,
  }: {
    storagePath: string | null;
    sourceKind: "audio" | "video";
    state: "submitted" | "terminal_success" | "terminal_failure";
    generationId?: string | null;
    providerRequestId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> => {
    if (!storagePath) return;
    await recordVoiceSourceLifecycleState({
      userId: authenticatedUser.id,
      workflowKind: "voice_changer",
      sourceKind,
      storagePath,
      state,
      lifecycleKey: lifecycleSourceRef ?? state,
      sourceRef: lifecycleSourceRef,
      generationId,
      providerRequestId,
      retentionDays: state === "submitted" ? null : VOICE_CHANGER_SOURCE_RETENTION_DAYS,
      metadata,
    }).catch((lifecycleError) =>
      logApiRouteException({
        req,
        error: lifecycleError,
        routeLabel: "elevenlabs-speech-to-speech.lifecycle",
        scope: "generation",
        user: authenticatedUser,
      })
    );
  };

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return res.status(503).json({
      error: "Service unavailable",
      details: "Audio generation is temporarily unavailable.",
    });
  }

  try {
    const { fields, files } = await parseMultipart(req);
    if (hasUploadedFiles(files)) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "Voice changer generation requires a staged sourceStoragePath or trusted sourceUrl; direct media uploads are not accepted.",
      });
    }
    const voiceId = readFieldString(fields.voiceId);
    const voiceName = readFieldString(fields.voiceName);
    const outputFormat = readFieldString(fields.outputFormat);
    const modelId = readFieldString(fields.modelId);
    const inputFormat = readFieldString(fields.inputFormat);
    const sourceUrl = readFieldString(fields.sourceUrl);
    const sourceStoragePath = readFieldString(fields.sourceStoragePath);
    const sourceName = readFieldString(fields.sourceName) ?? "Voice changer source";
    const originalVideoSourceUrl = readFieldString(fields.originalVideoSourceUrl);
    const originalVideoStoragePath = readFieldString(fields.originalVideoStoragePath);
    const originalVideoName = readFieldString(fields.originalVideoName);
    const originalVideoMimeType = readFieldString(fields.originalVideoMimeType);
    const originalVideoAspect = readFieldString(fields.originalVideoAspect);
    const projectId = readFieldString(fields.project_id) ?? readFieldString(fields.projectId);
    const shortpulseContext = parseJsonObjectField(readFieldString(fields.shortpulseContext));
    const workspaceRuntimeKey = readGenerationWorkspaceRuntimeKeyFromContext({
      context: shortpulseContext,
      projectId,
    });
    const workflowReload = parseJsonObjectField(readFieldString(fields.workflowReload)) ?? {};
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

    const savedVoices = await listSavedVoicesForUser(user.id);
    const savedVoiceMatch = savedVoices.some(
      (savedVoice) => savedVoice.voiceId.trim().toLowerCase() === voiceId.toLowerCase()
    );
    let providerVoices = [] as Awaited<ReturnType<typeof listElevenLabsVoices>>;
    let providerLookupFailed = false;
    if (!savedVoiceMatch) {
      try {
        providerVoices = await listElevenLabsVoices();
      } catch {
        providerLookupFailed = true;
      }
    }

    const voiceAccess = resolveVoiceAccessForUser({
      voiceId,
      savedVoices,
      providerVoices,
    });
    if (!voiceAccess) {
      if (providerLookupFailed && !savedVoiceMatch) {
        return res.status(503).json({
          error: "Voice is unavailable",
          details: "The selected voice could not be verified right now. Try again shortly.",
        });
      }
      return res.status(403).json({
        error: "Voice is unavailable",
        details: "The selected voice is not available for this account.",
      });
    }
    const effectiveVoiceName = voiceAccess.resolvedVoice.name;

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
      lifecycleSourceStoragePath = trustedStoragePath;
      const storedSource = await readStoredMediaBuffer({ storagePath: trustedStoragePath });
      sourceBuffer = storedSource.buffer;
      sourceMimeType = storedSource.contentType;
      sourceFilename = trustedStoragePath.split("/").filter(Boolean).pop() ?? "source";
    } else if (sourceUrl) {
      const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
        rawUrl: sourceUrl,
        req,
        userId: user.id,
        requireUserScope: true,
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
    const settledCharge = charge;
    lifecycleSourceRef = charge.sourceRef;
    await recordVoiceChangerLifecycleBestEffort({
      storagePath: lifecycleSourceStoragePath,
      sourceKind: "audio",
      state: "submitted",
      metadata: {
        source_duration_seconds: sourceDurationSeconds,
        source_name: sourceName,
      },
    });

    if (originalVideoStoragePath) {
      const trustedStoragePath = assertUserScopedMediaStoragePath({
        path: originalVideoStoragePath,
        userId: user.id,
        label: "Voice changer source video storage path",
      });
      lifecycleOriginalVideoStoragePath = trustedStoragePath;
      await recordVoiceChangerLifecycleBestEffort({
        storagePath: lifecycleOriginalVideoStoragePath,
        sourceKind: "video",
        state: "submitted",
        metadata: {
          source_duration_seconds: sourceDurationSeconds,
          source_name: originalVideoName ?? sourceName,
        },
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
        requireUserScope: true,
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

    let transcriptText: string | null = null;
    try {
      transcriptText = await transcribeAudioBuffer({
        audioBuffer: sourceBuffer,
        audioContentType: sourceMimeType ?? generated.contentType,
        filename: sourceFilename,
      });
    } catch (transcriptionError) {
      await writeAppErrorLog({
        source: "telemetry.voice_changer.transcription_failed",
        message: "Voice changer transcript generation failed; continuing with prompt fallback.",
        requestId: charge.sourceRef,
        userId: charge.userId,
        statusCode: 200,
        metadata: {
          provider_request_id: providerRequestId,
          model_id: modelId,
          source_mode: "voice-changer",
          error:
            transcriptionError instanceof Error
              ? transcriptionError.message
              : "unknown_transcription_error",
        },
      }).catch(() => undefined);
      transcriptText = null;
    }
    const voiceChangerTitle = await generateAudioReferenceTitleBestEffort({
      sourceMode: "voice-changer",
      promptText: `${sourceName} -> ${effectiveVoiceName}`,
      transcriptText,
      sourceName,
      voiceName: effectiveVoiceName,
      uniqueSeed: charge.sourceRef,
    });

    const persisted = await persistGeneratedAudioAsset({
      userId: charge.userId,
      promptText: `${sourceName} -> ${effectiveVoiceName}`,
      transcriptText,
      provider: "elevenlabs",
      modelId,
      providerRequestId,
      requestId: charge.sourceRef,
      projectId,
      workspaceRuntimeKey,
      sourceMode: "voice-changer",
      displayTitle: voiceChangerTitle,
      voiceId,
      voiceName: effectiveVoiceName,
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      workflowReload,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        source_duration_ms: Math.round(sourceDurationSeconds * 1000),
        source_duration_seconds: sourceDurationSeconds,
        voice_changer_title: voiceChangerTitle,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
      beforeVisibleSettlement: async ({ generationId }) => {
        const captureResult = await captureSucceededGenerationByProviderRequest({
          userId: settledCharge.userId,
          providerRequestId,
          reason: "Audio voice changer generation completed.",
          routeLabel: "elevenlabs-speech-to-speech",
          detail: {
            generation_id: generationId,
            source_ref: settledCharge.sourceRef,
            source_mode: "voice-changer",
            source_duration_seconds: sourceDurationSeconds,
          },
        });
        if (!captureResult.settled) {
          throw new Error(
            `Unable to capture generation billing reservation: ${captureResult.note}`
          );
        }
      },
    });
    const persistedVoiceChangerTitle = persisted.displayTitle ?? voiceChangerTitle;
    await recordVoiceChangerLifecycleBestEffort({
      storagePath: lifecycleSourceStoragePath,
      sourceKind: "audio",
      state: "terminal_success",
      generationId: persisted.generationId,
      providerRequestId,
      metadata: {
        source_duration_seconds: sourceDurationSeconds,
        generated_audio_generation_id: persisted.generationId,
      },
    });
    await markAudioCompanionArtPendingBestEffort({
      req,
      routeLabel: "elevenlabs-speech-to-speech",
      generationId: persisted.generationId,
      userId: charge.userId,
      user,
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
          promptText: `${originalVideoName ?? sourceName} -> ${effectiveVoiceName} video`,
          transcriptText,
          provider: "elevenlabs",
          modelId,
          providerRequestId,
          projectId,
          workspaceRuntimeKey,
          sourceMode: "voice-changer",
          outputBuffer: remuxedVideo.buffer,
          outputContentType: remuxedVideo.contentType,
          generationReplay: originalVideoAspect ? { aspect: originalVideoAspect } : undefined,
          workflowReload,
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
    await recordVoiceChangerLifecycleBestEffort({
      storagePath: lifecycleOriginalVideoStoragePath,
      sourceKind: "video",
      state: "terminal_success",
      generationId: persistedRemuxedVideo?.generationId ?? persisted.generationId,
      providerRequestId,
      metadata: {
        source_duration_seconds: sourceDurationSeconds,
        generated_audio_generation_id: persisted.generationId,
        remuxed_video_generation_id: persistedRemuxedVideo?.generationId ?? null,
        remux_status: persistedRemuxedVideo ? "persisted" : "not_persisted",
      },
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
        durationMs: Math.round(sourceDurationSeconds * 1000),
        waveformPeaks: null,
        title: persistedVoiceChangerTitle,
        modelId,
        voiceId,
        voiceName: effectiveVoiceName,
        transcriptText,
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
              transcriptText,
              saveState: persistedRemuxedVideo.saveState,
              saveError: persistedRemuxedVideo.saveError,
            },
          }
        : {}),
    });
  } catch (error) {
    if (charge) {
      lifecycleSourceRef = charge.sourceRef;
      await recordVoiceChangerLifecycleBestEffort({
        storagePath: lifecycleSourceStoragePath,
        sourceKind: "audio",
        state: "terminal_failure",
        metadata: {
          source_ref: charge.sourceRef,
        },
      });
      await recordVoiceChangerLifecycleBestEffort({
        storagePath: lifecycleOriginalVideoStoragePath,
        sourceKind: "video",
        state: "terminal_failure",
        metadata: {
          source_ref: charge.sourceRef,
        },
      });
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

    const providerError = readElevenLabsProviderError(error);
    if (providerError && (providerError.status === 429 || providerError.status === 503)) {
      if (providerError.retryAfterSeconds !== null) {
        res.setHeader("Retry-After", String(providerError.retryAfterSeconds));
      }
      return res.status(providerError.status).json({
        error: "Unable to convert voice",
        details: sanitizeCustomerFacingProviderText(
          resolveElevenLabsProviderUserMessage(providerError),
          "Unable to convert voice."
        ),
        code: providerError.code ?? undefined,
        retryAfterSeconds: providerError.retryAfterSeconds ?? undefined,
      });
    }

    return res.status(500).json({
      error: "Unable to convert voice",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to convert voice."
      ),
    });
  }
}
