/**
 * Authenticated no-charge Voice Changer video retry route.
 * Derives both media inputs from an owned audio generation and never calls a provider or billing.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertUserScopedMediaStoragePath,
  isVoiceChangerSourceVideoStoragePath,
} from "../../../lib/mediaStoragePath";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException, writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { readStoredMediaBuffer } from "../../../lib/server/mediaAudioExtraction";
import {
  recordVoiceSourceLifecycleState,
  VOICE_CHANGER_SOURCE_RETENTION_DAYS,
} from "../../../lib/server/voiceSourceLifecycle";
import { detectVideoMimeType } from "../../../lib/server/uploadSignature";
import {
  buildVoiceChangerRemuxRequestId,
  executeVoiceChangerRemux,
  patchVoiceChangerRemuxMetadata,
  resolveExistingVoiceChangerRemuxGeneration,
  type VoiceChangerRemuxFailure,
} from "../../../lib/server/voiceChangerRemux";

type RetryRequest = { sourceAudioGenerationId?: unknown };

const VOICE_CHANGER_REMUX_RATE_LIMIT = {
  keyPrefix: "media-voice-changer-remux",
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
} as const;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

class VoiceChangerRemuxInProgressError extends Error {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...VOICE_CHANGER_REMUX_RATE_LIMIT,
      keyPrefix: `${VOICE_CHANGER_REMUX_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  const sourceAudioGenerationId = asString(
    (req.body as RetryRequest | null)?.sourceAudioGenerationId
  );
  if (!sourceAudioGenerationId) {
    return res.status(400).json({
      error: "Invalid request",
      code: "VOICE_CHANGER_AUDIO_GENERATION_REQUIRED",
    });
  }

  const admin = getSupabaseAdmin();
  try {
    const audioLookup = await admin
      .from("ai_generations")
      .select("id, model_id, prompt_text, request_id, metadata")
      .eq("id", sourceAudioGenerationId)
      .eq("user_id", user.id)
      .eq("mode", "audio")
      .maybeSingle();
    if (audioLookup.error) throw new Error(audioLookup.error.message);
    if (!audioLookup.data) {
      return res.status(404).json({ error: "Voice Changer audio generation not found." });
    }

    const audioGeneration = audioLookup.data;
    const metadata = asObject(audioGeneration.metadata);
    if (metadata.expects_remux !== true) {
      return res.status(409).json({
        error: "This audio generation does not have a recoverable video source.",
        code: "VOICE_CHANGER_REMUX_NOT_EXPECTED",
      });
    }

    const audioStoragePath = assertUserScopedMediaStoragePath({
      path: asString(metadata.generated_audio_storage_path) ?? "",
      userId: user.id,
      label: "Voice Changer generated audio storage path",
    });
    const videoStoragePath = assertUserScopedMediaStoragePath({
      path: asString(metadata.original_video_storage_path) ?? "",
      userId: user.id,
      label: "Voice Changer original video storage path",
    });
    if (!isVoiceChangerSourceVideoStoragePath(videoStoragePath, user.id)) {
      return res.status(409).json({
        error: "This audio generation does not reference a canonical Voice Changer video source.",
        code: "VOICE_CHANGER_ORIGINAL_VIDEO_AUTHORITY_INVALID",
      });
    }
    const remuxRequestId = buildVoiceChangerRemuxRequestId(sourceAudioGenerationId);
    const markSucceededBestEffort = async (videoGenerationId: string) => {
      try {
        await patchVoiceChangerRemuxMetadata({
          userId: user.id,
          audioGenerationId: sourceAudioGenerationId,
          patch: {
            remux_status: "succeeded",
            remuxed_video_generation_id: videoGenerationId,
            remux_failure_code: null,
            remux_failure_stage: null,
          },
        });
      } catch (metadataError) {
        await writeAppErrorLog({
          source: "telemetry.voice_changer.retry_metadata_update_failed",
          message:
            "Voice Changer retry found or persisted a video, but terminal metadata did not converge.",
          requestId: remuxRequestId,
          userId: user.id,
          statusCode: 200,
          metadata: {
            source_audio_generation_id: sourceAudioGenerationId,
            remuxed_video_generation_id: videoGenerationId,
            error:
              metadataError instanceof Error
                ? metadataError.message
                : "remux_metadata_update_failed",
          },
        }).catch(() => undefined);
      }
      try {
        await recordVoiceSourceLifecycleState({
          userId: user.id,
          workflowKind: "voice_changer",
          sourceKind: "video",
          storagePath: videoStoragePath,
          state: "terminal_success",
          sourceRef: asString(audioGeneration.request_id) ?? remuxRequestId,
          generationId: videoGenerationId,
          providerRequestId: asString(metadata.provider_request_id),
          retentionDays: VOICE_CHANGER_SOURCE_RETENTION_DAYS,
          metadata: {
            recovery_route: "media-voice-changer-remux",
            source_audio_generation_id: sourceAudioGenerationId,
            remux_request_id: remuxRequestId,
          },
        });
      } catch (lifecycleError) {
        await writeAppErrorLog({
          source: "telemetry.voice_changer.retry_lifecycle_update_failed",
          message: "Voice Changer retry succeeded, but source lifecycle proof did not converge.",
          requestId: remuxRequestId,
          userId: user.id,
          statusCode: 200,
          metadata: {
            source_audio_generation_id: sourceAudioGenerationId,
            remuxed_video_generation_id: videoGenerationId,
            original_video_storage_path: videoStoragePath,
            error:
              lifecycleError instanceof Error
                ? lifecycleError.message
                : "retry_lifecycle_update_failed",
          },
        }).catch(() => undefined);
      }
    };

    const readExistingRemuxVideo = async () => {
      const resolution = await resolveExistingVoiceChangerRemuxGeneration({
        userId: user.id,
        remuxRequestId,
      });
      if (
        resolution.state === "none" ||
        resolution.state === "reclaimed" ||
        resolution.state === "stale_unpublished"
      ) {
        return null;
      }
      if (resolution.state === "in_progress") {
        throw new VoiceChangerRemuxInProgressError(
          "Voice Changer video assembly is already in progress."
        );
      }
      const published = resolution.generation;
      return {
        status: "succeeded",
        sourceAudioGenerationId,
        remuxRequestId,
        videoGenerationId: published.generationId,
        reused: true,
        video: {
          provider: "elevenlabs",
          mode: "video",
          generationId: published.generationId,
          mediaFileId: published.mediaFileId,
          requestId: remuxRequestId,
          previewUrl: published.signedUrl,
          previewPosterUrl: null,
          resultUrls: [published.signedUrl],
          previewPosterStoragePath: null,
          previewStoragePath: published.previewStoragePath,
          fullStoragePath: published.fullStoragePath,
          mimeType: published.mimeType ?? "video/mp4",
          modelId:
            published.modelId ?? asString(audioGeneration.model_id) ?? "eleven_multilingual_sts_v2",
          transcriptText: published.transcriptText,
          saveState: published.saveState,
          saveError: published.saveError,
        },
      };
    };

    const existingVideo = await readExistingRemuxVideo();
    if (existingVideo) {
      await markSucceededBestEffort(existingVideo.videoGenerationId);
      return res.status(200).json(existingVideo);
    }

    const [audio, video] = await Promise.all([
      readStoredMediaBuffer({ storagePath: audioStoragePath }),
      readStoredMediaBuffer({ storagePath: videoStoragePath }),
    ]);
    const verifiedVideoMimeType = detectVideoMimeType(video.buffer);
    if (!verifiedVideoMimeType) {
      return res.status(409).json({
        error: "The stored Voice Changer source is not a verified supported video.",
        code: "VOICE_CHANGER_ORIGINAL_VIDEO_INVALID",
      });
    }
    let result;
    try {
      result = await executeVoiceChangerRemux({
        userId: user.id,
        audioGenerationId: sourceAudioGenerationId,
        sourceVideoBuffer: video.buffer,
        sourceVideoFilename:
          asString(metadata.original_video_name) ??
          videoStoragePath.split("/").pop() ??
          "source-video",
        sourceVideoMimeType: verifiedVideoMimeType,
        convertedAudioBuffer: audio.buffer,
        convertedAudioContentType:
          asString(metadata.mime_type) ?? audio.contentType ?? "application/octet-stream",
        promptText: `${asString(metadata.original_video_name) ?? "Source video"} remux`,
        transcriptText: asString(metadata.transcript_text),
        modelId: asString(audioGeneration.model_id) ?? "eleven_multilingual_sts_v2",
        providerRequestId: asString(metadata.provider_request_id),
        projectId: asString(metadata.project_id),
        workspaceRuntimeKey: asString(metadata.workspace_runtime_key),
        aspect: asString(metadata.original_video_aspect),
        workflowReload: asObject(metadata.workflow_reload),
        extraMetadata: {
          recovered_without_provider_generation: true,
          source_video_storage_path: videoStoragePath,
        },
      });
    } catch (error) {
      const concurrentVideo = await readExistingRemuxVideo();
      if (!concurrentVideo) throw error;
      await markSucceededBestEffort(concurrentVideo.videoGenerationId);
      return res.status(200).json(concurrentVideo);
    }

    await markSucceededBestEffort(result.persistedVideo.generationId);

    return res.status(200).json({
      status: "succeeded",
      sourceAudioGenerationId,
      remuxRequestId,
      videoGenerationId: result.persistedVideo.generationId,
      reused: false,
      video: {
        provider: "elevenlabs",
        mode: "video",
        generationId: result.persistedVideo.generationId,
        mediaFileId: result.persistedVideo.mediaFileId,
        requestId: result.persistedVideo.requestId,
        previewUrl: result.persistedVideo.signedUrl,
        previewPosterUrl: result.persistedVideo.previewPosterUrl,
        resultUrls: [result.persistedVideo.signedUrl],
        previewPosterStoragePath: result.persistedVideo.previewPosterStoragePath,
        previewStoragePath: result.persistedVideo.previewStoragePath,
        fullStoragePath: result.persistedVideo.fullStoragePath,
        mimeType: result.remuxedVideo.contentType,
        modelId: asString(audioGeneration.model_id) ?? "eleven_multilingual_sts_v2",
        transcriptText: asString(metadata.transcript_text),
        saveState: result.persistedVideo.saveState,
        saveError: result.persistedVideo.saveError,
      },
    });
  } catch (error) {
    if (error instanceof VoiceChangerRemuxInProgressError) {
      return res.status(409).json({
        error: error.message,
        code: "VOICE_CHANGER_REMUX_IN_PROGRESS",
        retryable: true,
      });
    }
    const failure = error as Partial<VoiceChangerRemuxFailure>;
    await patchVoiceChangerRemuxMetadata({
      userId: user.id,
      audioGenerationId: sourceAudioGenerationId,
      patch: {
        remux_status: "failed",
        remux_failure_code: failure.code ?? "VOICE_CHANGER_REMUX_RETRY_FAILED",
        remux_failure_stage: failure.stage ?? "persistence",
      },
    }).catch(() => undefined);
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-voice-changer-remux",
      scope: "generation",
      user,
      metadata: {
        source_audio_generation_id: sourceAudioGenerationId,
        remux_request_id: buildVoiceChangerRemuxRequestId(sourceAudioGenerationId),
        remux_failure_code: failure.code ?? "VOICE_CHANGER_REMUX_RETRY_FAILED",
        remux_failure_stage: failure.stage ?? "persistence",
      },
    });
    return res.status(500).json({
      error: "Unable to retry video assembly.",
      code: failure.code ?? "VOICE_CHANGER_REMUX_RETRY_FAILED",
      retryable: true,
    });
  }
}
