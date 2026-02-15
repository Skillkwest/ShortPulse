/**
 * Video submission handlers for AI Studio task generation.
 */
import {
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
  resolveKlingAspectRatio,
  resolveKlingV3Duration,
  resolveSoraDuration,
} from "../../logic/stateParsers";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  buildKlingElementsPayload,
  buildKlingMultiPromptPayload,
  resolveKlingShotType,
  buildKlingVoiceIds,
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
} from "./videoPayloads";

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
  if (finalModel === "fal-ai/kling-video/v3/pro/image-to-video") {
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

      const motionElementsPayload = [
        {
          video_url: motionVideoUrlFinal,
          frontal_image_url: characterImageUrl,
        },
      ];

      let finalPrompt = cleanedPrompt || "Transfer motion from reference video to character";
      if (!finalPrompt.includes("@Element")) {
        finalPrompt = `${finalPrompt} @Element1`;
      }

      const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
      const { request_id } = await submitFalKlingV3ImageToVideo({
        prompt: finalPrompt,
        start_image_url: characterImageUrl,
        duration: klingDuration,
        aspect_ratio: resolveKlingAspectRatio(aspect),
        negative_prompt: klingNegativePrompt,
        cfg_scale: klingCfgScale,
        generate_audio: requestedAudio,
        elements: motionElementsPayload,
      });

      startPollingWithGeneration(request_id, "fal-kling-3", {
        previewUrl: characterImageUrl,
      });
      return true;
    }

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
    const { request_id } = await submitFalKlingV3ImageToVideo({
      prompt: cleanedPrompt,
      start_image_url: preparedImageInputs[0],
      end_image_url: endImageUrl,
      duration: klingDuration,
      aspect_ratio: resolveKlingAspectRatio(aspect),
      negative_prompt: klingNegativePrompt,
      cfg_scale: klingCfgScale,
      generate_audio: requestedAudio,
      voice_ids: voiceIds.length ? voiceIds : undefined,
      multi_prompt: multiPromptPayload,
      shot_type: resolveKlingShotType(klingShotType),
      elements: elementsPayload,
    });
    startPollingWithGeneration(request_id, "fal-kling-3");
    return true;
  }

  if (finalModel === "fal-ai/veo3.1/image-to-video") {
    const normalizedAspect = resolveVeoAspect(aspect);
    const duration = resolveVeoDuration(requestedDurationSeconds);
    const resolution = resolveVeoResolution(requestedResolution);
    const { request_id } = await submitFalVeoImageToVideo({
      prompt: cleanedPrompt,
      image_urls: [preparedImageInputs[0]],
      aspect_ratio: normalizedAspect,
      duration,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      safety_tolerance: "5",
      enable_safety_checker: false,
    });
    startPollingWithGeneration(request_id, "fal-veo-i2v");
    return true;
  }

  if (finalModel === "fal-ai/kling-video/v3/pro/text-to-video") {
    const klingDuration = resolveKlingV3Duration(requestedDurationSeconds);
    const { request_id } = await submitFalKlingV3Text({
      prompt: cleanedPrompt,
      aspect_ratio: resolveKlingAspectRatio(aspect),
      duration: klingDuration,
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
      generate_audio: requestedAudio,
    });
    startPollingWithGeneration(request_id, "fal-kling");
    return true;
  }

  if (finalModel === "fal-ai/bytedance/seedance/v1.5/pro/text-to-video") {
    const normalizedAspect = resolveSeedanceTextAspect(aspect, modelConfig);
    const resolution = resolveSeedanceTextResolution(requestedResolution);
    const { request_id } = await submitFalSeedance({
      prompt: cleanedPrompt,
      duration: requestedDurationSeconds.toString(),
      aspect_ratio: normalizedAspect,
      resolution,
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
      generate_audio: requestedAudio,
      enable_safety_checker: false,
    });
    startPollingWithGeneration(request_id, "fal-seedance");
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
    const { request_id } = await submitFalSeedanceI2V({
      prompt: cleanedPrompt,
      image_url: preparedImageInputs[0],
      end_image_url: endImageUrl,
      aspect_ratio: normalizedAspect,
      resolution,
      duration,
      generate_audio: requestedAudio,
      camera_fixed: videoCameraFixed,
      enable_safety_checker: false,
    });
    startPollingWithGeneration(request_id, "fal-seedance-i2v");
    return true;
  }

  if (finalModel === "fal-ai/veo3.1/first-last-frame-to-video") {
    const normalizedAspect = resolveVeoAspect(aspect);
    const duration = resolveVeoDuration(requestedDurationSeconds);
    const resolution = resolveVeoResolution(requestedResolution);
    const { request_id } = await submitFalVeoFirstLast({
      prompt: cleanedPrompt,
      first_frame_url: preparedImageInputs[0],
      last_frame_url: preparedImageInputs[1],
      aspect_ratio: normalizedAspect,
      duration,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      safety_tolerance: "5",
      enable_safety_checker: false,
    });
    startPollingWithGeneration(request_id, "fal-veo");
    return true;
  }

  if (finalModel === "fal-ai/sora-2/text-to-video/pro") {
    const soraDuration = resolveSoraDuration(requestedDurationSeconds);
    const normalizedAspect = resolveSoraAspect(aspect, modelConfig);
    const resolution = resolveSoraResolution(requestedResolution);
    const { request_id } = await submitFalSoraPro({
      prompt: cleanedPrompt,
      aspect_ratio: normalizedAspect,
      duration: soraDuration,
      resolution,
      delete_video: true,
    });
    startPollingWithGeneration(request_id, "fal-sora");
    return true;
  }

  if (finalModel === "fal-ai/veo3.1") {
    const normalizedAspect = resolveVeoTextAspect(aspect, modelConfig);
    const resolution = resolveVeoResolution(requestedResolution, "1080p");
    const { request_id } = await submitFalVeo({
      prompt: cleanedPrompt,
      aspect_ratio: normalizedAspect,
      duration: `${Math.max(4, Math.min(8, requestedDurationSeconds))}s`,
      resolution,
      generate_audio: requestedAudio,
      auto_fix: videoAutoFix,
      safety_tolerance: "5",
      enable_safety_checker: false,
    });
    startPollingWithGeneration(request_id, "fal-veo");
    return true;
  }

  return false;
};
