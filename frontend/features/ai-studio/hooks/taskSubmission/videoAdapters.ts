/**
 * Provider adapter registry for AI Studio video submissions.
 */
import { type FalSubmitResponse, submitQueuedGenerationByModelId } from "../../../../lib/falClient";
import { FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE } from "../../../../lib/model-runtime/falUploadCompatibilityTargets";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../../lib/model-runtime/falModelIds";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { normalizeDurationForModel } from "../../../../lib/model-runtime/modelDurationConstraints";
import type { VideoSubmissionAdapterKey } from "../../../../lib/model-runtime/submissionAdapterMetadata";
import { needsVideoUpload, prepareMotionReferenceVideoUrl } from "../../utils/videoUpload";
import type { VideoSubmissionArgs } from "./types";
import {
  collectSeedanceElementProviderReferences,
  resolveSeedanceReferenceLimitError,
  resolveSeedanceReferenceRequirementError,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { needsImageUpload } from "../../utils/imageUpload";
import {
  buildKieKlingElementsPayload,
  resolveKieKlingAspect,
  resolveKieKlingDuration,
  resolveKieKlingMode,
  resolveKlingResolution,
  resolveLipSyncResolution,
  resolveSeedanceI2VAspect,
  resolveSeedance2Duration,
  resolveSeedance2Resolution,
  resolveVeoResolution,
  resolveVeoTextAspect,
} from "./videoPayloads";
import {
  KLING_SINGLE_PROMPT_MAX_CHARACTERS,
  rewritePromptWithKieElementTokens,
} from "../../logic/klingShotModePromptComposition";
import { resolveLipSyncAudioDurationGuardrail } from "../../logic/lipSyncDuration";
import {
  getDurableLipSyncAudioUrl,
  getLipSyncAudioStoragePath,
  isNonDurableLipSyncAudioUrl,
  isLipSyncAudioReadyForSubmit,
} from "../../logic/lipSyncAudioState";
import {
  buildSeedancePromptPayload,
  hasKlingElementMedia,
  isLocalAudioUploadSourceUrl,
  KIE_KLING_REFERENCE_IMAGE_ADMISSION_PROFILE,
  KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE,
  prepareFalInputUrl,
  prepareKieHostedKlingElementForSubmission,
  prepareKieInputUrl,
  prepareKieKlingElementsForSubmission,
  resolveKieKlingShotModePayload,
  resolveLipSyncImageStoragePath,
  uploadUrlToKieTemporaryFile,
  uploadUrlsToKieTemporaryFiles,
  VALIDATION_FAILURE_CONTEXT,
} from "./videoSubmissionHelpers";

export type VideoPollingProvider =
  | "fal-omnihuman-v15"
  | "kie-veo"
  | "kie-kling"
  | "kie-seedance-2"
  | "kie-seedance-2-fast";

type VideoHandlerContext = {
  id: string;
  finalModel: string;
  cleanedPrompt: string;
  aspect: string;
  requestedDurationSeconds: number;
  requestedResolution?: string;
  requestedAudio: boolean;
  preparedImageInputs: string[];
  rawImageInputs: string[];
  internalMediaRefs?: VideoSubmissionArgs["internalMediaRefs"];
  modelConfig: VideoSubmissionArgs["modelConfig"];
  notifyGenerationFailure: VideoSubmissionArgs["notifyGenerationFailure"];
  updateOutputById: VideoSubmissionArgs["updateOutputById"];
  videoReferenceMode: VideoSubmissionArgs["videoReferenceMode"];
  videoReferenceImageUrl: string | null;
  motionReferenceVideoUrl: string | null;
  lipSyncAudio: VideoSubmissionArgs["lipSyncAudio"];
  lipSyncTurboMode: VideoSubmissionArgs["lipSyncTurboMode"];
  seedance2InputMode?: VideoSubmissionArgs["seedance2InputMode"];
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingCfgScale: number;
  klingWorkflowMode?: VideoSubmissionArgs["klingWorkflowMode"];
  klingMultiPrompts: VideoSubmissionArgs["klingMultiPrompts"];
  klingElements: AiStudioKlingElement[];
  shortpulseSubmitPayload: Record<string, unknown>;
};

type VideoSubmissionAdapterResult =
  | { handled: false }
  | {
      handled: true;
      response?: FalSubmitResponse;
      pollingProvider?: VideoPollingProvider;
      patch?: Parameters<VideoSubmissionArgs["startPollingWithGeneration"]>[2];
    };

type VideoSubmissionAdapter = {
  key: VideoSubmissionAdapterKey;
  matches: (modelId: string) => boolean;
  submit: (context: VideoHandlerContext) => Promise<VideoSubmissionAdapterResult>;
};

export const videoSubmissionAdapters: VideoSubmissionAdapter[] = [
  {
    key: "fal-omnihuman-v15",
    matches: (modelId) => modelId === FAL_OMNIHUMAN_V15_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      requestedResolution,
      preparedImageInputs,
      rawImageInputs,
      internalMediaRefs,
      notifyGenerationFailure,
      videoReferenceMode,
      lipSyncAudio,
      lipSyncTurboMode,
      shortpulseSubmitPayload,
    }) => {
      if (videoReferenceMode !== "lip-sync") {
        notifyGenerationFailure(
          id,
          "Lip Sync is not ready for this video mode.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }

      const rawImageUrl = (rawImageInputs[0] ?? preparedImageInputs[0] ?? "").trim();
      const preparedImageUrl = (preparedImageInputs[0] ?? rawImageUrl).trim();
      const rawAudioUrl = getDurableLipSyncAudioUrl(lipSyncAudio) ?? "";
      const imageStoragePath = resolveLipSyncImageStoragePath({
        explicitRef: internalMediaRefs?.[0] ?? null,
        rawImageUrl,
        preparedImageUrl,
      });
      const audioStoragePath = getLipSyncAudioStoragePath(lipSyncAudio);

      if (!preparedImageUrl || !rawImageUrl) {
        notifyGenerationFailure(
          id,
          "Add a character image before generating in Lip Sync.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      if (!rawAudioUrl && !audioStoragePath) {
        const message =
          lipSyncAudio.status === "uploading"
            ? "Voice audio is still uploading. Wait for it to finish before generating Lip Sync."
            : lipSyncAudio.status === "failed"
              ? (lipSyncAudio.error ??
                "Voice audio upload failed. Re-add the audio file and try again.")
              : lipSyncAudio.url && isNonDurableLipSyncAudioUrl(lipSyncAudio.url)
                ? "Local voice audio is no longer available. Re-add the audio file and try again."
                : lipSyncAudio.url
                  ? "Voice audio is not ready. Re-add it and wait for upload before generating Lip Sync."
                  : "Add voice audio before generating in Lip Sync.";
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      if (!isLipSyncAudioReadyForSubmit(lipSyncAudio)) {
        notifyGenerationFailure(
          id,
          "Voice audio is not ready. Re-add it and wait for upload before generating Lip Sync.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      const resolution = resolveLipSyncResolution(requestedResolution);
      const durationGuardrail = resolveLipSyncAudioDurationGuardrail({
        durationMs: lipSyncAudio.durationMs,
        resolution,
      });
      if (durationGuardrail) {
        notifyGenerationFailure(id, durationGuardrail, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }

      const falUploadCache = new Map<string, Promise<string>>();
      let imageUrl = "";
      try {
        imageUrl = await prepareFalInputUrl({
          rawUrl: rawImageUrl,
          preparedUrl: preparedImageUrl,
          storagePath: imageStoragePath,
          mediaKind: "image",
          compatibilityTarget: FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE,
          cache: falUploadCache,
        });
      } catch (error) {
        const message =
          needsImageUpload(rawImageUrl) &&
          error instanceof Error &&
          error.message.toLowerCase().includes("unable to read local image input")
            ? "Local character image is no longer available. Re-add the image and try again."
            : `Character image preparation failed: ${
                error instanceof Error ? error.message : "Please re-add the image and try again."
              }`;
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      let audioUrl = "";
      try {
        audioUrl = await prepareFalInputUrl({
          rawUrl: rawAudioUrl,
          preparedUrl: rawAudioUrl,
          storagePath: audioStoragePath,
          mediaKind: "audio",
          cache: falUploadCache,
        });
      } catch (error) {
        const message =
          isLocalAudioUploadSourceUrl(rawAudioUrl) &&
          error instanceof Error &&
          error.message.toLowerCase().includes("unable to read local audio input")
            ? "Local voice audio is no longer available. Re-add the audio file and try again."
            : `Voice audio preparation failed: ${
                error instanceof Error
                  ? error.message
                  : "Please re-add the audio file and try again."
              }`;
        notifyGenerationFailure(id, message, undefined, VALIDATION_FAILURE_CONTEXT);
        return { handled: true };
      }
      const prompt = cleanedPrompt.trim();
      const response = await submitQueuedGenerationByModelId(finalModel, {
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution,
        ...(prompt ? { prompt } : {}),
        ...(lipSyncTurboMode ? { turbo_mode: true } : {}),
        ...shortpulseSubmitPayload,
      });

      return {
        handled: true,
        response,
        pollingProvider: "fal-omnihuman-v15",
      };
    },
  },
  {
    key: "kie-veo-31-fast-i2v",
    matches: (modelId) => modelId === KIE_VEO_31_FAST_I2V_MODEL_ID,
    submit: async ({
      finalModel,
      cleanedPrompt,
      aspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      rawImageInputs,
      modelConfig,
      shortpulseSubmitPayload,
    }) => {
      const resolvedGenerationType =
        preparedImageInputs.length === 0 ? "TEXT_2_VIDEO" : "FIRST_AND_LAST_FRAMES_2_VIDEO";
      const keyframeImageUrlsRaw =
        preparedImageInputs.length >= 2
          ? preparedImageInputs.slice(0, 2)
          : preparedImageInputs.slice(0, 1);
      const kieUploadCache = new Map<string, Promise<string>>();
      const keyframeImageUrls = await uploadUrlsToKieTemporaryFiles({
        urls: await Promise.all(
          keyframeImageUrlsRaw.map(
            async (preparedUrl, index) =>
              await prepareKieInputUrl({
                rawUrl: rawImageInputs[index],
                preparedUrl,
                mediaKind: "image",
                cache: kieUploadCache,
              })
          )
        ),
        mediaKind: "image",
        cache: kieUploadCache,
      });
      const aspectRatio = resolveVeoTextAspect(aspect, modelConfig);
      const duration =
        normalizeDurationForModel(requestedDurationSeconds, finalModel) ??
        modelConfig?.defaultDurationSeconds ??
        6;
      const resolution = resolveVeoResolution(requestedResolution);
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: cleanedPrompt,
        image_url: keyframeImageUrls[0],
        image_urls: keyframeImageUrls,
        generation_type: resolvedGenerationType,
        aspect_ratio: aspectRatio,
        duration,
        resolution,
        generate_audio: requestedAudio,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "kie-veo",
      };
    },
  },
  {
    key: "kie-seedance-2",
    matches: (modelId) =>
      modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      aspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      rawImageInputs,
      modelConfig,
      notifyGenerationFailure,
      klingWorkflowMode,
      seedance2InputMode = "text",
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingElements,
      shortpulseSubmitPayload,
    }) => {
      const hasPreparedFirstFrame = preparedImageInputs.length >= 1;
      const hasPreparedLastFrame = preparedImageInputs.length >= 2;
      const shouldUseSeedanceMultimodalReferences = seedance2InputMode === "multimodal";
      let preparedSeedanceLinkedElements: AiStudioKlingElement[] = [];
      try {
        const seedanceElementsWithMedia = shouldUseSeedanceMultimodalReferences
          ? klingElements.filter((element) => hasKlingElementMedia(element))
          : [];
        if (seedanceElementsWithMedia.length) {
          const seedanceUploadCache = new Map<string, Promise<string>>();
          preparedSeedanceLinkedElements = await Promise.all(
            seedanceElementsWithMedia.map(
              async (element) =>
                await prepareKieHostedKlingElementForSubmission({
                  element,
                  cache: seedanceUploadCache,
                  imageAdmissionProfile: KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE,
                })
            )
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Seedance linked asset preparation failed";
        notifyGenerationFailure(id, `Seedance linked asset preparation failed: ${message}`);
        return { handled: true };
      }
      const linkedEntityReferences = collectSeedanceElementProviderReferences(
        preparedSeedanceLinkedElements
      );
      const referenceLimitError = shouldUseSeedanceMultimodalReferences
        ? resolveSeedanceReferenceLimitError({
            imageUrls: [...seedance2ReferenceImageUrls, ...linkedEntityReferences.imageUrls],
            videoUrls: [...seedance2ReferenceVideoUrls, ...linkedEntityReferences.videoUrls],
            audioUrls: [...seedance2ReferenceAudioUrls, ...linkedEntityReferences.audioUrls],
          })
        : null;
      if (referenceLimitError) {
        notifyGenerationFailure(id, referenceLimitError);
        return { handled: true };
      }
      const referenceRequirementError = shouldUseSeedanceMultimodalReferences
        ? resolveSeedanceReferenceRequirementError({
            imageUrls: [...seedance2ReferenceImageUrls, ...linkedEntityReferences.imageUrls],
            videoUrls: [...seedance2ReferenceVideoUrls, ...linkedEntityReferences.videoUrls],
            audioUrls: [...seedance2ReferenceAudioUrls, ...linkedEntityReferences.audioUrls],
          })
        : null;
      if (referenceRequirementError) {
        notifyGenerationFailure(id, referenceRequirementError);
        return { handled: true };
      }
      const hasMultimodalReferences = Boolean(
        seedance2ReferenceImageUrls.length ||
        seedance2ReferenceVideoUrls.length ||
        seedance2ReferenceAudioUrls.length ||
        linkedEntityReferences.imageUrls.length ||
        linkedEntityReferences.videoUrls.length ||
        linkedEntityReferences.audioUrls.length
      );
      const effectiveInputMode =
        shouldUseSeedanceMultimodalReferences && hasMultimodalReferences
          ? "multimodal"
          : hasPreparedLastFrame
            ? "first-last"
            : hasPreparedFirstFrame
              ? "first-frame"
              : "text";
      const promptPayload = buildSeedancePromptPayload({
        cleanedPrompt,
        klingWorkflowMode,
        preparedKlingElements: preparedSeedanceLinkedElements,
      });
      if ("error" in promptPayload) {
        notifyGenerationFailure(id, promptPayload.error);
        return { handled: true };
      }
      const pollingProvider =
        finalModel === KIE_SEEDANCE_2_FAST_MODEL_ID ? "kie-seedance-2-fast" : "kie-seedance-2";
      const kieUploadCache = new Map<string, Promise<string>>();
      const [
        firstFrameUrl,
        lastFrameUrl,
        referenceImageUrls,
        referenceVideoUrls,
        referenceAudioUrls,
      ] = await Promise.all([
        effectiveInputMode === "first-frame" || effectiveInputMode === "first-last"
          ? prepareKieInputUrl({
              rawUrl: rawImageInputs[0],
              preparedUrl: preparedImageInputs[0] ?? "",
              mediaKind: "image",
              cache: kieUploadCache,
              admissionProfile: KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE,
            })
          : Promise.resolve(""),
        effectiveInputMode === "first-last"
          ? prepareKieInputUrl({
              rawUrl: rawImageInputs[1],
              preparedUrl: preparedImageInputs[1] ?? "",
              mediaKind: "image",
              cache: kieUploadCache,
              admissionProfile: KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE,
            })
          : Promise.resolve(""),
        effectiveInputMode === "multimodal"
          ? uploadUrlsToKieTemporaryFiles({
              urls: Array.from(
                new Set([...seedance2ReferenceImageUrls, ...linkedEntityReferences.imageUrls])
              ),
              mediaKind: "image",
              cache: kieUploadCache,
              admissionProfile: KIE_SEEDANCE_REFERENCE_IMAGE_ADMISSION_PROFILE,
            })
          : Promise.resolve([]),
        effectiveInputMode === "multimodal"
          ? uploadUrlsToKieTemporaryFiles({
              urls: Array.from(
                new Set([...seedance2ReferenceVideoUrls, ...linkedEntityReferences.videoUrls])
              ),
              mediaKind: "video",
              cache: kieUploadCache,
            })
          : Promise.resolve([]),
        effectiveInputMode === "multimodal"
          ? uploadUrlsToKieTemporaryFiles({
              urls: Array.from(
                new Set([...seedance2ReferenceAudioUrls, ...linkedEntityReferences.audioUrls])
              ),
              mediaKind: "audio",
              cache: kieUploadCache,
            })
          : Promise.resolve([]),
      ]);

      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: promptPayload.prompt,
        ...(effectiveInputMode === "first-frame" || effectiveInputMode === "first-last"
          ? { first_frame_url: firstFrameUrl }
          : {}),
        ...(effectiveInputMode === "first-last" ? { last_frame_url: lastFrameUrl } : {}),
        ...(effectiveInputMode === "multimodal" && referenceImageUrls.length
          ? { reference_image_urls: referenceImageUrls }
          : {}),
        ...(effectiveInputMode === "multimodal" && referenceVideoUrls.length
          ? { reference_video_urls: referenceVideoUrls }
          : {}),
        ...(effectiveInputMode === "multimodal" && referenceAudioUrls.length
          ? { reference_audio_urls: referenceAudioUrls }
          : {}),
        aspect_ratio: resolveSeedanceI2VAspect(aspect, modelConfig),
        duration: resolveSeedance2Duration(requestedDurationSeconds),
        resolution: resolveSeedance2Resolution(requestedResolution, modelConfig),
        generate_audio: requestedAudio,
        return_last_frame: seedance2ReturnLastFrame,
        web_search: seedance2WebSearch,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider,
      };
    },
  },
  {
    key: "kie-kling-3",
    matches: (modelId) => modelId === KIE_KLING_30_MODEL_ID,
    submit: async ({
      id,
      finalModel,
      cleanedPrompt,
      aspect,
      requestedDurationSeconds,
      requestedResolution,
      requestedAudio,
      preparedImageInputs,
      rawImageInputs,
      modelConfig,
      notifyGenerationFailure,
      videoReferenceMode,
      videoReferenceImageUrl,
      motionReferenceVideoUrl,
      klingCfgScale,
      klingWorkflowMode,
      klingElements,
      shortpulseSubmitPayload,
    }) => {
      if (videoReferenceMode === "motion") {
        if (!videoReferenceImageUrl) {
          notifyGenerationFailure(
            id,
            "Motion Control requires a character image",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }
        if (!motionReferenceVideoUrl) {
          notifyGenerationFailure(
            id,
            "Motion Control requires a motion reference video",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }

        const preparedCharacterImageUrl = preparedImageInputs[0];
        if (!preparedCharacterImageUrl) {
          notifyGenerationFailure(id, "Failed to prepare character image");
          return { handled: true };
        }

        if (needsVideoUpload(motionReferenceVideoUrl)) {
          notifyGenerationFailure(
            id,
            "Motion clip is not ready yet. Re-add it and wait for upload before generating.",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }

        let characterImageUrl = preparedCharacterImageUrl;
        let motionVideoUrlFinal = motionReferenceVideoUrl;
        const kieUploadCache = new Map<string, Promise<string>>();
        let preparedKlingElementResult: Exclude<
          Awaited<ReturnType<typeof prepareKieKlingElementsForSubmission>>,
          { error: string }
        >;
        try {
          const result = await prepareKieKlingElementsForSubmission({
            klingElements,
            cache: kieUploadCache,
            imageAdmissionProfile: KIE_KLING_REFERENCE_IMAGE_ADMISSION_PROFILE,
          });
          if ("error" in result) {
            notifyGenerationFailure(id, result.error, undefined, VALIDATION_FAILURE_CONTEXT);
            return { handled: true };
          }
          preparedKlingElementResult = result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Kling element reference preparation failed";
          notifyGenerationFailure(id, `Kling element reference preparation failed: ${message}`);
          return { handled: true };
        }

        try {
          characterImageUrl = await prepareKieInputUrl({
            rawUrl: rawImageInputs[0] ?? videoReferenceImageUrl,
            preparedUrl: preparedCharacterImageUrl,
            mediaKind: "image",
            cache: kieUploadCache,
            admissionProfile: "kie_motion_control_character_image",
          });
          if (!characterImageUrl) {
            throw new Error("Character image is missing.");
          }
          const preparedMotionVideoUrl =
            await prepareMotionReferenceVideoUrl(motionReferenceVideoUrl);
          if (!preparedMotionVideoUrl) {
            throw new Error("Motion reference video is missing.");
          }
          motionVideoUrlFinal = await uploadUrlToKieTemporaryFile({
            url: preparedMotionVideoUrl,
            mediaKind: "video",
            cache: kieUploadCache,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Motion reference preparation failed";
          notifyGenerationFailure(id, `Motion reference preparation failed: ${message}`);
          return { handled: true };
        }

        const baseMotionPrompt =
          cleanedPrompt || "Transfer motion from reference video to character";
        const finalPrompt = rewritePromptWithKieElementTokens(
          baseMotionPrompt,
          preparedKlingElementResult.preparedKlingElements
        );
        if (finalPrompt.length > KLING_SINGLE_PROMPT_MAX_CHARACTERS) {
          notifyGenerationFailure(
            id,
            "Prompt exceeds Kling's 2,500 character limit.",
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }
        const motionResolution = resolveKlingResolution(requestedResolution);
        const response = await submitQueuedGenerationByModelId(finalModel, {
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
          kling_elements: preparedKlingElementResult.elementsPayload,
          ...shortpulseSubmitPayload,
        });
        return {
          handled: true,
          response,
          pollingProvider: "kie-kling",
          patch: {
            previewUrl: preparedCharacterImageUrl,
          },
        };
      }

      if (!preparedImageInputs.length) {
        notifyGenerationFailure(
          id,
          "Kling 3.0 requires at least one reference image.",
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      const kieUploadCache = new Map<string, Promise<string>>();
      let elementsPayload: ReturnType<typeof buildKieKlingElementsPayload>;
      let preparedKlingElements: AiStudioKlingElement[] = [];
      try {
        const preparedKlingElementResult = await prepareKieKlingElementsForSubmission({
          klingElements,
          cache: kieUploadCache,
          imageAdmissionProfile: KIE_KLING_REFERENCE_IMAGE_ADMISSION_PROFILE,
        });
        if ("error" in preparedKlingElementResult) {
          notifyGenerationFailure(
            id,
            preparedKlingElementResult.error,
            undefined,
            VALIDATION_FAILURE_CONTEXT
          );
          return { handled: true };
        }
        preparedKlingElements = preparedKlingElementResult.preparedKlingElements;
        elementsPayload = preparedKlingElementResult.elementsPayload;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kling element reference preparation failed";
        notifyGenerationFailure(id, `Kling element reference preparation failed: ${message}`);
        return { handled: true };
      }
      const aspectRatio = resolveKieKlingAspect(aspect, modelConfig);
      const duration = resolveKieKlingDuration(requestedDurationSeconds);
      const resolvedShotModePayload = resolveKieKlingShotModePayload({
        cleanedPrompt,
        klingWorkflowMode,
        preparedImageInputs,
        requestedAudio,
        preparedKlingElements,
      });
      if ("error" in resolvedShotModePayload) {
        notifyGenerationFailure(
          id,
          resolvedShotModePayload.error,
          undefined,
          VALIDATION_FAILURE_CONTEXT
        );
        return { handled: true };
      }
      let klingImageUrls: string[];
      try {
        klingImageUrls = await Promise.all(
          resolvedShotModePayload.imageUrls.map(
            async (preparedUrl, index) =>
              await prepareKieInputUrl({
                rawUrl: rawImageInputs[index],
                preparedUrl,
                mediaKind: "image",
                cache: kieUploadCache,
                admissionProfile: KIE_KLING_REFERENCE_IMAGE_ADMISSION_PROFILE,
              })
          )
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kling image reference preparation failed";
        notifyGenerationFailure(id, `Kling image reference preparation failed: ${message}`);
        return { handled: true };
      }
      const response = await submitQueuedGenerationByModelId(finalModel, {
        prompt: resolvedShotModePayload.prompt,
        image_url: klingImageUrls[0],
        image_urls: klingImageUrls,
        aspect_ratio: aspectRatio,
        duration,
        resolution: resolveKlingResolution(requestedResolution),
        mode: resolveKieKlingMode(requestedResolution),
        cfg_scale: klingCfgScale,
        generate_audio: resolvedShotModePayload.generateAudio,
        sound: resolvedShotModePayload.sound,
        multi_shots: resolvedShotModePayload.multiShots,
        multi_prompt: resolvedShotModePayload.multiPrompt,
        kling_elements: elementsPayload,
        ...shortpulseSubmitPayload,
      });
      return {
        handled: true,
        response,
        pollingProvider: "kie-kling",
      };
    },
  },
];
