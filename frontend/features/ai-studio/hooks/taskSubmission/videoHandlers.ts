/**
 * Video submission handlers for AI Studio task generation.
 */
import {
  type FalSubmitResponse,
  submitKieKlingImageToVideo,
  submitKieSeedance2FastVideo,
  submitKieSeedance2Video,
  submitKieSeedanceVideo,
  submitKieVeoImageToVideo,
} from "../../../../lib/falClient";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { needsVideoUpload, prepareVideoUrlForSubmission } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  buildKieKlingElementsPayload,
  buildKieKlingMultiPromptPayload,
  resolveKieKlingDuration,
  resolveKieKlingMode,
  resolveKlingResolution,
  resolveSeedance2Duration,
  resolveSeedance2Resolution,
  resolveSeedanceI2VDuration,
  resolveSeedanceI2VResolution,
  resolveSeedanceTextAspect,
} from "./videoPayloads";

const FAL_KLING_IMAGE_MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";
const FAL_KLING_TEXT_MODEL_ID = "fal-ai/kling-video/v3/pro/text-to-video";
const FAL_KLING_DISABLED_MESSAGE = "Fal Kling 3.0 is disabled. Use Kie Kling 3.0 instead.";
const FAL_VEO_TEXT_MODEL_ID = "fal-ai/veo3.1";
const FAL_VEO_IMAGE_MODEL_ID = "fal-ai/veo3.1/image-to-video";
const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";
const FAL_VEO_DISABLED_MESSAGE = "Fal Veo 3.1 is disabled. Use Kie Veo 3.1 instead.";
const FAL_SEEDANCE_TEXT_MODEL_ID = "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";
const FAL_SEEDANCE_IMAGE_MODEL_ID = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
const FAL_NON_KIE_VIDEO_DISABLED_MESSAGE =
  "Fal-hosted video generation is disabled. Use Kie Veo 3.1, Kie Kling 3.0, or Kie Seedance 1.5 instead.";

const isCharacterScopedMediaUrl = (value: string): boolean => {
  const normalized = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })().toLowerCase();
  return normalized.includes("/characters/") || normalized.includes("%2fcharacters%2f");
};

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
    | "fal-veo"
    | "fal-veo-i2v"
    | "kie-veo"
    | "kie-kling"
    | "kie-seedance"
    | "kie-seedance-2"
    | "kie-seedance-2-fast";
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
  videoCameraFixed,
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  seedance2ReturnLastFrame = false,
  seedance2WebSearch = false,
  klingCfgScale,
  klingWorkflowMode,
  klingMultiPrompts,
  klingElements,
}: VideoSubmissionArgs): Promise<boolean> => {
  const candidateMediaUrls = [
    ...preparedImageInputs,
    videoReferenceImageUrl ?? "",
    motionReferenceVideoUrl ?? "",
    ...seedance2ReferenceImageUrls,
    ...seedance2ReferenceVideoUrls,
    ...seedance2ReferenceAudioUrls,
    ...klingElements.map((element) => element.videoUrl.trim()),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  if (candidateMediaUrls.some((value) => isCharacterScopedMediaUrl(value))) {
    notifyGenerationFailure(
      id,
      "Character media references are blocked for video models. Use non-character media assets."
    );
    return true;
  }

  if (finalModel === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    const resolvedGenerationType =
      preparedImageInputs.length === 0 ? "TEXT_2_VIDEO" : "FIRST_AND_LAST_FRAMES_2_VIDEO";
    const keyframeImageUrls =
      preparedImageInputs.length >= 2
        ? preparedImageInputs.slice(0, 2)
        : preparedImageInputs.slice(0, 1);
    const aspectRatio = aspect === "9:16" ? "9:16" : "16:9";
    const duration = requestedDurationSeconds <= 5 ? 5 : 8;
    const resolution = requestedResolution?.toLowerCase().includes("1080") ? "1080p" : "720p";
    const response = await submitKieVeoImageToVideo({
      prompt: cleanedPrompt,
      image_url: keyframeImageUrls[0],
      image_urls: keyframeImageUrls,
      generation_type: resolvedGenerationType,
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

  if (finalModel === FAL_KLING_IMAGE_MODEL_ID || finalModel === FAL_KLING_TEXT_MODEL_ID) {
    notifyGenerationFailure(id, FAL_KLING_DISABLED_MESSAGE);
    return true;
  }

  if (
    finalModel === FAL_VEO_TEXT_MODEL_ID ||
    finalModel === FAL_VEO_IMAGE_MODEL_ID ||
    finalModel === FAL_VEO_FIRST_LAST_MODEL_ID
  ) {
    notifyGenerationFailure(id, FAL_VEO_DISABLED_MESSAGE);
    return true;
  }

  if (finalModel === FAL_SEEDANCE_TEXT_MODEL_ID || finalModel === FAL_SEEDANCE_IMAGE_MODEL_ID) {
    notifyGenerationFailure(id, FAL_NON_KIE_VIDEO_DISABLED_MESSAGE);
    return true;
  }

  if (finalModel === KIE_SEEDANCE_15_PRO_MODEL_ID) {
    const inputUrls =
      preparedImageInputs.length >= 2
        ? preparedImageInputs.slice(0, 2)
        : preparedImageInputs.slice(0, 1);
    const response = await submitKieSeedanceVideo({
      prompt: cleanedPrompt,
      input_urls: inputUrls,
      aspect_ratio: resolveSeedanceTextAspect(aspect, modelConfig),
      duration: resolveSeedanceI2VDuration(requestedDurationSeconds),
      resolution: resolveSeedanceI2VResolution(requestedResolution),
      fixed_lens: videoCameraFixed,
      generate_audio: requestedAudio,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-seedance",
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === KIE_SEEDANCE_2_MODEL_ID || finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID) {
    const hasPreparedFirstFrame = preparedImageInputs.length >= 1;
    const hasPreparedLastFrame = preparedImageInputs.length >= 2;
    const hasMultimodalReferences = Boolean(
      seedance2ReferenceImageUrls.length ||
      seedance2ReferenceVideoUrls.length ||
      seedance2ReferenceAudioUrls.length
    );
    const effectiveInputMode =
      seedance2InputMode === "multimodal" && hasMultimodalReferences
        ? "multimodal"
        : hasPreparedLastFrame
          ? "first-last"
          : hasPreparedFirstFrame
            ? "first-frame"
            : "text";
    const submitSeedance2 =
      finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID
        ? submitKieSeedance2FastVideo
        : submitKieSeedance2Video;
    const pollingProvider =
      finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID ? "kie-seedance-2-fast" : "kie-seedance-2";

    const response = await submitSeedance2({
      prompt: cleanedPrompt,
      ...(effectiveInputMode === "first-frame" || effectiveInputMode === "first-last"
        ? { first_frame_url: preparedImageInputs[0] }
        : {}),
      ...(effectiveInputMode === "first-last" ? { last_frame_url: preparedImageInputs[1] } : {}),
      ...(effectiveInputMode === "multimodal" && seedance2ReferenceImageUrls.length
        ? { reference_image_urls: seedance2ReferenceImageUrls }
        : {}),
      ...(effectiveInputMode === "multimodal" && seedance2ReferenceVideoUrls.length
        ? { reference_video_urls: seedance2ReferenceVideoUrls }
        : {}),
      ...(effectiveInputMode === "multimodal" && seedance2ReferenceAudioUrls.length
        ? { reference_audio_urls: seedance2ReferenceAudioUrls }
        : {}),
      aspect_ratio: resolveSeedanceTextAspect(aspect, modelConfig),
      duration: resolveSeedance2Duration(requestedDurationSeconds),
      resolution: resolveSeedance2Resolution(requestedResolution),
      generate_audio: requestedAudio,
      return_last_frame: seedance2ReturnLastFrame,
      web_search: seedance2WebSearch,
    });
    handoffSubmitResponse({
      response,
      pollingProvider,
      startPollingWithGeneration,
    });
    return true;
  }

  if (finalModel === KIE_KLING_30_MODEL_ID) {
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
        generate_audio: requestedAudio,
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
    const multiPromptPayload = buildKieKlingMultiPromptPayload(klingMultiPrompts);
    const effectiveKlingWorkflowMode =
      klingWorkflowMode ?? (multiPromptPayload?.length ? "custom" : "single");
    if (effectiveKlingWorkflowMode === "custom" && !multiPromptPayload?.length) {
      notifyGenerationFailure(id, "Custom Kling mode requires at least one shot prompt.");
      return true;
    }
    const multiShots =
      effectiveKlingWorkflowMode === "custom" && Boolean(multiPromptPayload?.length);
    const imageUrls =
      multiShots || preparedImageInputs.length < 2
        ? [preparedImageInputs[0]]
        : preparedImageInputs.slice(0, 2);
    let elementsPayload: ReturnType<typeof buildKieKlingElementsPayload>;
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
      elementsPayload = buildKieKlingElementsPayload(preparedKlingElements);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kling element reference preparation failed";
      notifyGenerationFailure(id, `Kling element reference preparation failed: ${message}`);
      return true;
    }
    const aspectRatio = ["16:9", "9:16", "1:1"].includes(aspect) ? aspect : "16:9";
    const duration = resolveKieKlingDuration(requestedDurationSeconds);
    const klingPrompt =
      multiShots && multiPromptPayload?.[0]?.prompt ? multiPromptPayload[0].prompt : cleanedPrompt;
    const response = await submitKieKlingImageToVideo({
      prompt: klingPrompt,
      image_url: preparedImageInputs[0],
      image_urls: imageUrls,
      aspect_ratio: aspectRatio,
      duration,
      resolution: resolveKlingResolution(requestedResolution),
      mode: resolveKieKlingMode(requestedResolution),
      cfg_scale: klingCfgScale,
      generate_audio: multiShots ? true : requestedAudio,
      sound: multiShots ? true : requestedAudio,
      multi_shots: multiShots,
      multi_prompt: multiPromptPayload,
      kling_elements: elementsPayload,
    });
    handoffSubmitResponse({
      response,
      pollingProvider: "kie-kling",
      startPollingWithGeneration,
    });
    return true;
  }

  return false;
};
