/**
 * AI Studio reroll controller.
 * Validates stored workflow payloads before routing them back through the normal submit path.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { createLipSyncAudioStateFromDurableUrl } from "../logic/lipSyncAudioState";
import type { AiStudioKlingElement } from "../logic/klingElements";
import {
  canRerollOutput,
  hasUnavailableWorkflowRerollReference,
  registerWorkflowRerollInternalMediaRefs,
  resolveWorkflowRerollConfigForOutput,
} from "../logic/workflowReroll";
import type { AiStudioTaskSubmitOptions } from "./contracts/taskSubmissionContracts";
import type { StudioOutput, WorkflowReloadConfigV1, WorkflowReloadVideoMediaSlot } from "../types";

type SubmitTask = (
  prompt: string,
  referenceInputs: string[],
  options: AiStudioTaskSubmitOptions
) => Promise<unknown>;

type UseAiStudioRerollControllerParams = {
  findOutputById: (id: string) => StudioOutput | null;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  submitTask: SubmitTask;
};

const mediaSlotsToUrls = (slots?: readonly WorkflowReloadVideoMediaSlot[]): string[] =>
  slots?.map((slot) => slot.sourceUrl) ?? [];

const mapKlingElements = (
  elements: readonly Record<string, unknown>[] = []
): AiStudioKlingElement[] => elements.map((element) => ({ ...element }) as AiStudioKlingElement);

const buildImageRerollOptions = (config: WorkflowReloadConfigV1): AiStudioTaskSubmitOptions => {
  const payload = config.payload;
  if (payload.kind !== "image") return {};
  return {
    modeOverride: "image",
    selectedToolOverride: payload.submitTool,
    displayPromptOverride: config.prompt.display,
    characterContextOverride: payload.characterContext,
    styleContextOverride: payload.styleContext,
    modelIdOverride: config.model.id,
    aspectOverride: payload.aspect,
    imageResolutionOverride: payload.imageResolution ?? "model_default",
    internalMediaRefsOverride: payload.internalMediaRefs ?? [],
    expertEditReferences: payload.expertEditReferences ?? null,
  };
};

const buildVideoRerollOptions = (config: WorkflowReloadConfigV1): AiStudioTaskSubmitOptions => {
  const payload = config.payload;
  if (payload.kind !== "video") return {};
  const videoReferences = payload.videoReferences;
  const seedance2ReferenceImageUrls = videoReferences?.seedance2ReferenceImages
    ? mediaSlotsToUrls(videoReferences.seedance2ReferenceImages)
    : (payload.seedance2ReferenceImageUrls ?? []);
  const seedance2ReferenceVideoUrls = videoReferences?.seedance2ReferenceVideos
    ? mediaSlotsToUrls(videoReferences.seedance2ReferenceVideos)
    : (payload.seedance2ReferenceVideoUrls ?? []);
  const seedance2ReferenceAudioUrls = videoReferences?.seedance2ReferenceAudio
    ? mediaSlotsToUrls(videoReferences.seedance2ReferenceAudio)
    : (payload.seedance2ReferenceAudioUrls ?? []);
  const klingElements = videoReferences?.klingElementSlots?.length
    ? mapKlingElements(videoReferences.klingElementSlots.map((slot) => slot.element))
    : mapKlingElements(payload.klingElements);

  return {
    modeOverride: "video",
    selectedToolOverride: "video",
    displayPromptOverride: config.prompt.display,
    modelIdOverride: config.model.id,
    aspectOverride: payload.aspect,
    styleContextOverride: payload.styleContext,
    internalMediaRefsOverride: payload.internalMediaRefs ?? [],
    videoReferenceModeOverride: payload.videoReferenceMode,
    videoReferenceImageUrlOverride:
      videoReferences?.firstFrame?.sourceUrl ?? payload.referenceInputs[0] ?? null,
    ...(payload.durationSeconds != null
      ? { videoDurationSecondsOverride: payload.durationSeconds }
      : {}),
    ...(payload.resolution ? { videoResolutionOverride: payload.resolution } : {}),
    ...(payload.generateAudio != null ? { videoGenerateAudioOverride: payload.generateAudio } : {}),
    ...(payload.cameraFixed != null ? { videoCameraFixedOverride: payload.cameraFixed } : {}),
    ...(payload.autoFix != null ? { videoAutoFixOverride: payload.autoFix } : {}),
    motionReferenceVideoUrlOverride: payload.motionReferenceVideoUrl ?? null,
    lipSyncAudioOverride: createLipSyncAudioStateFromDurableUrl({
      url: payload.lipSyncAudioUrl ?? null,
      title: "Re-rolled lip sync audio",
      durationMs: payload.lipSyncAudioDurationMs ?? null,
      sourceKind: "reference",
      storagePath: payload.lipSyncAudioStoragePath ?? null,
    }),
    ...(payload.lipSyncTurboMode != null
      ? { lipSyncTurboModeOverride: payload.lipSyncTurboMode }
      : {}),
    ...(payload.seedance2InputMode
      ? { seedance2InputModeOverride: payload.seedance2InputMode }
      : {}),
    seedance2ReferenceImageUrlsOverride: seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrlsOverride: seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrlsOverride: seedance2ReferenceAudioUrls,
    ...(payload.seedance2ReturnLastFrame != null
      ? { seedance2ReturnLastFrameOverride: payload.seedance2ReturnLastFrame }
      : {}),
    ...(payload.seedance2WebSearch != null
      ? { seedance2WebSearchOverride: payload.seedance2WebSearch }
      : {}),
    ...(payload.klingNegativePrompt != null
      ? { klingNegativePromptOverride: payload.klingNegativePrompt }
      : {}),
    ...(payload.klingCfgScale != null ? { klingCfgScaleOverride: payload.klingCfgScale } : {}),
    ...(payload.klingWorkflowMode ? { klingWorkflowModeOverride: payload.klingWorkflowMode } : {}),
    ...(payload.klingShotType ? { klingShotTypeOverride: payload.klingShotType } : {}),
    ...(payload.klingVoiceIds ? { klingVoiceIdsOverride: payload.klingVoiceIds } : {}),
    klingMultiPromptsOverride: payload.klingMultiPrompts ?? [],
    klingElementsOverride: klingElements,
  };
};

/**
 * Returns the reroll action for workflow metadata backed outputs.
 */
export const useAiStudioRerollController = ({
  findOutputById,
  setUiNotice,
  submitTask,
}: UseAiStudioRerollControllerParams) => {
  const rerollStudioOutputFromReplay = useCallback(
    (output: StudioOutput) => {
      const normalizedOutputId = output.id.trim();
      if (!normalizedOutputId || !canRerollOutput(output)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "missing_output_or_replay",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }

      const config = resolveWorkflowRerollConfigForOutput(output);
      if (!config) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "invalid_replay_payload",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }

      if (hasUnavailableWorkflowRerollReference(config)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "local_reference",
          },
        });
        setUiNotice(
          "Re-roll is unavailable because original reference media are no longer accessible."
        );
        return;
      }

      const payload = config.payload;
      if (payload.kind !== "image" && payload.kind !== "video") {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "unsupported_payload_kind",
            payload_kind: payload.kind,
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }

      registerWorkflowRerollInternalMediaRefs(config);
      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "reroll_started",
        data: {
          output_id: normalizedOutputId,
          model_id: config.model.id,
          tool: config.originTool,
          payload_kind: payload.kind,
          reference_count: payload.referenceInputs.length,
        },
      });
      const options =
        payload.kind === "image"
          ? buildImageRerollOptions(config)
          : buildVideoRerollOptions(config);
      void submitTask(
        config.prompt.submission ?? config.prompt.display,
        payload.referenceInputs,
        options
      );
    },
    [setUiNotice, submitTask]
  );

  const rerollOutputFromReplay = useCallback(
    (outputId: string) => {
      const normalizedOutputId = outputId.trim();
      if (!normalizedOutputId) return;
      const output = findOutputById(normalizedOutputId);
      if (!output) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "missing_output_or_replay",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }
      rerollStudioOutputFromReplay(output);
    },
    [findOutputById, rerollStudioOutputFromReplay, setUiNotice]
  );

  return {
    rerollOutputFromReplay,
    rerollStudioOutputFromReplay,
  };
};
