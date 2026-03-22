/**
 * Video submission handlers for AI Studio task generation.
 */
import {
  type FalSubmitResponse,
  submitKieKlingImageToVideo,
  submitKieVeoImageToVideo,
  submitFalKlingV3ImageToVideo,
  submitFalKlingV3Text,
  submitFalSeedance,
  submitFalSeedanceI2V,
  submitFalSoraPro,
  submitFalVeo,
  submitFalVeoFirstLast,
  submitFalVeoImageToVideo,
} from "../../../../lib/falClient";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import {
  resolveKlingAspectRatio,
  resolveKlingV3Duration,
  resolveSoraDuration,
} from "../../logic/stateParsers";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  buildKlingElementsPayload,
  buildKlingMultiPromptPayload,
  resolveSeedanceI2VAspect,
  resolveSeedanceI2VDuration,
  resolveSeedanceI2VResolution,
  resolveSeedanceTextAspect,
  resolveSeedanceTextResolution,
  resolveSoraAspect,
  resolveSoraResolution,
  resolveVeoAspect,
  resolveVeoDuration,
  resolveVeoResolution,
  resolveVeoTextAspect,
  resolveKlingShotType,
  resolveKlingResolution,
  buildKlingVoiceIds,
} from "./videoPayloads";
import { resolveVideoSubmissionSafetyPayload } from "./safetyPolicy";

const handoffSubmitResponse = ({
  response,
  pollingProvider,
  patch,
  startPollingWithGeneration,
}: {
  response: FalSubmitResponse;
  pollingProvider:
    | "fal-kling"
    | "fal-kling-3"
    | "fal-seedance"
    | "fal-seedance-i2v"
    | "fal-sora"
    | "fal-veo"
    | "fal-veo-i2v"
    | "kie-veo"
    | "kie-kling";
  patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
  startPollingWithGeneration: VideoSubmissionArgs["startPollingWithGeneration"];
}) => {
  if ("status" in response && response.status === "queued") {
    startPollingWithGeneration(undefined, pollingProvider, patch, response);
    return;
  }
  const requestId =
    "request_id" in response && typeof response.request_id === "string"
      ? response.request_id
      : undefined;
  startPollingWithGeneration(requestId, pollingProvider, patch, response);
};

/**
 * Handles video model submissions. Returns true when a matching model is handled.
 */
export const handleVideoModelSubmission = async ({
  id,
  finalModel,
  cleanedPrompt,
  aspect,
  requestedDurationSeconds,
  requestedResolution,
  requestedAudio,
  preparedImageInputs,
  modelConfig,
  notifyGenerationFailure,
  updateOutputById,
  startPollingWithGeneration,
  videoReferenceMode,
  videoReferenceImageUrl,
  motionReferenceVideoUrl,
  videoAutoFix,
  videoCameraFixed,
  klingNegativePrompt,
  klingCfgScale,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
}: VideoSubmissionArgs): Promise<boolean> => {
  if (finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Kie Veo 3.1 Fast I2V requires at least one reference image.");
      return true;
    }
    const keyframeImageUrls =
      videoReferenceMode === "keyframes"
        ? preparedImageInputs.slice(0, 2)
        : [preparedImageInputs[0]];
    if (videoReferenceMode === "keyframes" && keyframeImageUrls.length < 2) {
      notifyGenerationFailure(
        id,
        "Kie Veo 3.1 Fast I2V keyframes mode requires both first and last frame images."
      );
      return true;
    }
    const aspectRatio = aspect === "9:16" ? "9:16" : "16:9";
    const duration = requestedDurationSeconds <= 5 ? 5 : 8;
    const resolution = requestedResolution?.toLowerCase().includes("1080") ? "1080p" : "720p";
    const response = await submitKieVeoImageToVideo({
      prompt: cleanedPrompt,
      image_url: preparedImageInputs[0],
      image_urls: keyframeImageUrls,
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      aspect_ratio: aspectRatio,
      duration,
      resolution,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-veo",
      startPollingWithGeneration,
    });
    return true;
  }

  const isLegacyFalKlingMotionModel =
    finalModel === "fal-ai/kling-video/v3/pro/image-to-video" && videoReferenceMode === "motion";

  if (finalModel === KIE_KLING_30_MODEL_ID || isLegacyFalKlingMotionModel) {
    if (videoReferenceMode === "motion") {
      if (!videoReferenceImageUrl) {
        notifyGenerationFailure(id, "Motion Control requires a character image");
        return true;
      }
      if (!motionReferenceVideoUrl) {
        notifyGenerationFailure(id, "Motion Control requires a motion reference video");
        return true;
      }

      const characterImageUrl = preparedImageInputs[0];
      if (!characterImageUrl) {
        notifyGenerationFailure(id, "Failed to prepare character image");
        return true;
      }

      let motionVideoUrlFinal = motionReferenceVideoUrl;
      const requiresUpload = needsVideoUpload(motionReferenceVideoUrl);
      try {
        if (requiresUpload) {
          updateOutputById(id, (item) => ({
            ...item,
            timestamp: "Uploading video...",
          }));
        }

        const preparedMotionVideoUrl = await prepareVideoUrlForSubmission(motionReferenceVideoUrl);
        if (!preparedMotionVideoUrl) {
          throw new Error("Motion reference video is missing.");
        }
        motionVideoUrlFinal = preparedMotionVideoUrl;

        if (requiresUpload) {
          updateOutputById(id, (item) => ({
            ...item,
            timestamp: "Video uploaded",
          }));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Motion reference preparation failed";
        const prefix = requiresUpload
          ? "Video upload failed"
          : "Motion reference preparation failed";
        notifyGenerationFailure(id, `${prefix}: ${message}`);
        return true;
      }

      const motionResolution = resolveKlingResolution(requestedResolution);
      const finalPrompt = cleanedPrompt || "Transfer motion from reference video to character";
      const response = await submitKieKlingImageToVideo({
        prompt: finalPrompt,
        image_url: characterImageUrl,
        image_urls: [characterImageUrl],
        input_urls: [characterImageUrl],
        video_url: motionVideoUrlFinal,
        video_urls: [motionVideoUrlFinal],
        resolution: motionResolution,
        mode: motionResolution,
        character_orientation: "image",
        background_source: "input_video",
      });
      handoffSubmitResponse({
        response,
        pollingProvider: "kie-kling",
        patch: {
          previewUrl: characterImageUrl,
        },
        startPollingWithGeneration,
      });
      return true;
    }

    if (!preparedImageInputs.length) {
      notifyGenerationFailure(id, "Kie Kling 3.0 requires at least one reference image.");
      return true;
    }
    const aspectRatio = ["16:9", "9:16", "1:1"].includes(aspect) ? aspect : "16:9";
    const duration = requestedDurationSeconds <= 5 ? 5 : 10;
    const response = await submitKieKlingImageToVideo({
      prompt: cleanedPrompt,
      image_url: preparedImageInputs[0],
      image_urls: [preparedImageInputs[0]],
      aspect_ratio: aspectRatio,
      duration,
      resolution: resolveKlingResolution(requestedResolution),
      cfg_scale: klingCfgScale,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-kling",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/kling-video/v3/pro/image-to-video") {
    const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
    const endImageUrl =
      (videoReferenceMode === "keyframes" || videoReferenceMode === "kling3") &&
      preparedImageInputs.length > 1
        ? preparedImageInputs[1]
        : undefined;
    const voiceIds = buildKlingVoiceIds(klingVoiceIds);
    const multiPromptPayload = buildKlingMultiPromptPayload(klingMultiPrompts);
    let elementsPayload: ReturnType<typeof buildKlingElementsPayload>;
    try {
      const preparedKlingElements = await Promise.all(
        klingElements.map(async (element) => {
          const videoUrl = element.videoUrl.trim();
          if (!videoUrl) return element;
          const preparedVideoUrl = await prepareVideoUrlForSubmission(videoUrl);
          if (!preparedVideoUrl) {
            throw new Error("Kling element video URL is missing.");
          }
          return {
            ...element,
            videoUrl: preparedVideoUrl,
          };
        })
      );
      elementsPayload = buildKlingElementsPayload(preparedKlingElements);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kling element reference preparation failed";
      notifyGenerationFailure(id, `Kling element reference preparation failed: ${message}`);
      return true;
    }
    const response = await submitFalKlingV3ImageToVideo({
      prompt: cleanedPrompt,
      start_image_url: preparedImageInputs[0],
      end_image_url: endImageUrl,
      duration: klingDuration,
      aspect_ratio: resolveKlingAspectRatio(aspect),
      resolution: resolveKlingResolution(requestedResolution),
      negative_prompt: klingNegativePrompt,
      cfg_scale: klingCfgScale,
      generate_audio: requestedAudio,
      voice_ids: voiceIds.length ? voiceIds : undefined,
      multi_prompt: multiPromptPayload,
      shot_type: resolveKlingShotType(klingShotType),
      elements: elementsPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-kling-3",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/veo3.1/image-to-video") {
    const normalizedAspect = resolveVeoAspect(aspect);
    const duration = resolveVeoDuration(requestedDurationSeconds);
    const resolution = resolveVeoResolution(requestedResolution);
    const response = await submitFalVeoImageToVideo({
      prompt: cleanedPrompt,
      image_urls: [preparedImageInputs[0]],
      aspect_ratio: normalizedAspect,
      duration,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      ...resolveVideoSubmissionSafetyPayload(finalModel),
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-veo-i2v",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/kling-video/v3/pro/text-to-video") {
    const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
    const response = await submitFalKlingV3Text({
      prompt: cleanedPrompt,
      aspect_ratio: resolveKlingAspectRatio(aspect),
      duration: klingDuration,
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-kling",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/bytedance/seedance/v1.5/pro/text-to-video") {
    const normalizedAspect = resolveSeedanceTextAspect(aspect, modelConfig);
    const resolution = resolveSeedanceTextResolution(requestedResolution);
    const response = await submitFalSeedance({
      prompt: cleanedPrompt,
      duration: requestedDurationSeconds.toString(),
      aspect_ratio: normalizedAspect,
      resolution,
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
      generate_audio: requestedAudio,
      ...resolveVideoSubmissionSafetyPayload(finalModel),
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-seedance",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video") {
    if (preparedImageInputs.length < 1) {
      notifyGenerationFailure(id, "Seedance I2V requires a reference image.");
      return true;
    }
    const normalizedAspect = resolveSeedanceI2VAspect(aspect, modelConfig);
    const resolution = resolveSeedanceI2VResolution(requestedResolution);
    const duration = resolveSeedanceI2VDuration(requestedDurationSeconds);
    const endImageUrl = preparedImageInputs.length > 1 ? preparedImageInputs[1] : undefined;
    const response = await submitFalSeedanceI2V({
      prompt: cleanedPrompt,
      image_url: preparedImageInputs[0],
      end_image_url: endImageUrl,
      aspect_ratio: normalizedAspect,
      resolution,
      duration,
      generate_audio: requestedAudio,
      camera_fixed: videoCameraFixed,
      ...resolveVideoSubmissionSafetyPayload(finalModel),
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-seedance-i2v",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/veo3.1/first-last-frame-to-video") {
    const normalizedAspect = resolveVeoAspect(aspect);
    const duration = resolveVeoDuration(requestedDurationSeconds);
    const resolution = resolveVeoResolution(requestedResolution);
    const response = await submitFalVeoFirstLast({
      prompt: cleanedPrompt,
      first_frame_url: preparedImageInputs[0],
      last_frame_url: preparedImageInputs[1],
      aspect_ratio: normalizedAspect,
      duration,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      ...resolveVideoSubmissionSafetyPayload(finalModel),
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-veo",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/sora-2/text-to-video/pro") {
    const soraDuration = resolveSoraDuration(requestedDurationSeconds);
    const normalizedAspect = resolveSoraAspect(aspect, modelConfig);
    const resolution = resolveSoraResolution(requestedResolution);
    const response = await submitFalSoraPro({
      prompt: cleanedPrompt,
      aspect_ratio: normalizedAspect,
      duration: soraDuration,
      resolution,
      delete_video: true,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-sora",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === "fal-ai/veo3.1") {
    const normalizedAspect = resolveVeoTextAspect(aspect, modelConfig);
    const resolution = resolveVeoResolution(requestedResolution, "1080p");
    const response = await submitFalVeo({
      prompt: cleanedPrompt,
      aspect_ratio: normalizedAspect,
      duration: `${Math.max(4, Math.min(8, requestedDurationSeconds))}s`,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      ...resolveVideoSubmissionSafetyPayload(finalModel),
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "fal-veo",
      startPollingWithGeneration,
    });
    return true;
  }

  return false;
};
