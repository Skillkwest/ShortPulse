/**
 * AI Studio session snapshot controller.
 * Owns snapshot build/apply orchestration, including signed-url refresh for restored outputs.
 */
import { useCallback, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import type { AgentMessage } from "../../../prefabs/agent/types";
import {
  buildAiStudioSessionSnapshot,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import {
  buildAiStudioSessionHydrationPayload,
  type AiStudioSessionHydrationPayload,
} from "../logic/sessionSnapshotHydrator";
import {
  applySessionRestoreSignedUrls,
  buildSessionOutputSigningFingerprintById,
  resolveSessionRestoreSignedUrls,
} from "../logic/sessionRestoreMediaSigning";
import type { ReferenceProjectionState } from "../reference-projections";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

type UseAiStudioSessionSnapshotControllerParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  model: string | null;
  aspect: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode: "single" | "multi" | "custom";
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  motionReferenceVideoUrl: string | null;
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds: string[];
  removedFromAllRefsIds: string[];
  sessionHydrationSigningRevisionRef: MutableRefObject<number>;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setSelectedTool: Dispatch<SetStateAction<ToolId | null>>;
  setSharedPrompt: (value: string) => void;
  setModel: (value: string | null) => void;
  setAspect: Dispatch<SetStateAction<string>>;
  setReferenceImageUrl: (value: string | null) => void;
  setExtraImageUrl: (index: number, value: string | null) => void;
  setEditReferenceText: (value: string) => void;
  setVideoReferenceText: (value: string) => void;
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingWorkflowMode: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  setMotionReferenceVideoUrl: Dispatch<SetStateAction<string | null>>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
};

/**
 * Returns session snapshot build/apply helpers used by AI Studio state and persistence controllers.
 */
export const useAiStudioSessionSnapshotController = ({
  mode,
  selectedTool,
  prompt,
  model,
  aspect,
  referenceImageUrl,
  extraImageUrls,
  editReferenceText,
  videoReferenceText,
  videoReferenceMode,
  videoDurationSeconds,
  videoResolution,
  imageResolution,
  videoGenerateAudio,
  videoCameraFixed,
  videoAutoFix,
  klingNegativePrompt,
  klingCfgScale,
  klingWorkflowMode,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  motionReferenceVideoUrl,
  outputs,
  archivedOutputs,
  activeOutputId,
  curatedReferenceIds,
  removedFromAllRefsIds,
  sessionHydrationSigningRevisionRef,
  setMode,
  setSelectedTool,
  setSharedPrompt,
  setModel,
  setAspect,
  setReferenceImageUrl,
  setExtraImageUrl,
  setEditReferenceText,
  setVideoReferenceText,
  setVideoReferenceMode,
  setVideoDurationSeconds,
  setVideoResolution,
  setImageResolution,
  setVideoGenerateAudio,
  setVideoCameraFixed,
  setVideoAutoFix,
  setKlingNegativePrompt,
  setKlingCfgScale,
  setKlingWorkflowMode,
  setSeedance2InputMode,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingMultiPrompts,
  setKlingElements,
  setMotionReferenceVideoUrl,
  setOutputsState,
  setArchivedOutputs,
  setReferenceProjectionState,
  setActiveOutputId,
  setSaved,
}: UseAiStudioSessionSnapshotControllerParams) => {
  const hydrateFromSessionSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot): AiStudioSessionHydrationPayload => {
      const payload = buildAiStudioSessionHydrationPayload(snapshot);
      const workspace = payload.workspace;
      const outputPayload = payload.outputs;

      setMode(workspace.mode);
      setSelectedTool(workspace.selectedTool);
      setSharedPrompt(workspace.prompt);
      setModel(workspace.model);
      setAspect(workspace.aspect);
      setReferenceImageUrl(workspace.referenceImageUrl);
      workspace.extraImageUrls.forEach((url, index) => {
        setExtraImageUrl(index, url);
      });
      setEditReferenceText(workspace.editReferenceText);
      setVideoReferenceText(workspace.videoReferenceText);
      setVideoReferenceMode(workspace.videoReferenceMode);
      setVideoDurationSeconds(workspace.videoDurationSeconds);
      setVideoResolution(workspace.videoResolution);
      setImageResolution(workspace.imageResolution);
      setVideoGenerateAudio(workspace.videoGenerateAudio);
      setVideoCameraFixed(workspace.videoCameraFixed);
      setVideoAutoFix(workspace.videoAutoFix);
      setKlingNegativePrompt(workspace.klingNegativePrompt);
      setKlingCfgScale(workspace.klingCfgScale);
      setKlingWorkflowMode(workspace.klingWorkflowMode);
      setSeedance2InputMode(workspace.seedance2InputMode);
      setSeedance2ReferenceImageUrls(workspace.seedance2ReferenceImageUrls);
      setSeedance2ReferenceVideoUrls(workspace.seedance2ReferenceVideoUrls);
      setSeedance2ReferenceAudioUrls(workspace.seedance2ReferenceAudioUrls);
      setSeedance2ReturnLastFrame(workspace.seedance2ReturnLastFrame);
      setSeedance2WebSearch(workspace.seedance2WebSearch);
      setKlingShotType(workspace.klingShotType);
      setKlingVoiceIds(workspace.klingVoiceIds);
      setKlingMultiPrompts(workspace.klingMultiPrompts);
      setKlingElements(workspace.klingElements);
      setMotionReferenceVideoUrl(workspace.motionReferenceVideoUrl);

      setOutputsState(outputPayload.active);
      setArchivedOutputs(outputPayload.archived);
      setReferenceProjectionState({
        quickSlotIds: outputPayload.curatedReferenceIds,
        removedFromAllRefsIds: outputPayload.removedFromAllRefsIds,
      });
      setActiveOutputId(outputPayload.activeOutputId);
      setSaved(false);

      const signingRevision = sessionHydrationSigningRevisionRef.current + 1;
      sessionHydrationSigningRevisionRef.current = signingRevision;
      const activeBaselineById = buildSessionOutputSigningFingerprintById(outputPayload.active);
      const archivedBaselineById = buildSessionOutputSigningFingerprintById(outputPayload.archived);
      const hydrationOutputs = [...outputPayload.active, ...outputPayload.archived];
      void resolveSessionRestoreSignedUrls(hydrationOutputs)
        .then((signedByPath) => {
          if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
          if (signedByPath.size === 0) return;

          setOutputsState((rows) => {
            const patched = applySessionRestoreSignedUrls(rows, signedByPath, {
              baselineById: activeBaselineById,
            });
            return patched.changed ? patched.outputs : rows;
          });
          setArchivedOutputs((rows) => {
            const patched = applySessionRestoreSignedUrls(rows, signedByPath, {
              baselineById: archivedBaselineById,
            });
            return patched.changed ? patched.outputs : rows;
          });
        })
        .catch((error) => {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "ai_studio_session_restore_sign_batch_failed",
            data: {
              error: error instanceof Error ? error.message : "unknown_error",
            },
          });
        });

      return payload;
    },
    [
      sessionHydrationSigningRevisionRef,
      setActiveOutputId,
      setArchivedOutputs,
      setAspect,
      setEditReferenceText,
      setExtraImageUrl,
      setImageResolution,
      setKlingCfgScale,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingWorkflowMode,
      setSeedance2InputMode,
      setSeedance2ReferenceAudioUrls,
      setSeedance2ReferenceImageUrls,
      setSeedance2ReferenceVideoUrls,
      setSeedance2ReturnLastFrame,
      setSeedance2WebSearch,
      setKlingShotType,
      setKlingVoiceIds,
      setMode,
      setModel,
      setMotionReferenceVideoUrl,
      setOutputsState,
      setReferenceImageUrl,
      setReferenceProjectionState,
      setSaved,
      setSelectedTool,
      setSharedPrompt,
      setVideoAutoFix,
      setVideoCameraFixed,
      setVideoDurationSeconds,
      setVideoGenerateAudio,
      setVideoReferenceMode,
      setVideoReferenceText,
      setVideoResolution,
    ]
  );

  const buildSessionSnapshot = useCallback(
    ({
      sessionId,
      updatedAt,
      agentMessages,
      agentInput,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled,
      canvasState,
      expertEditSessionState,
    }: {
      sessionId: string;
      updatedAt?: string;
      agentMessages: AgentMessage[];
      agentInput: string;
      latestAgentPrompt: string | null;
      promptOrigin: "manual" | "agent" | "reference";
      chatModeEnabled: boolean;
      canvasState?: AiStudioSessionCanvasState;
      expertEditSessionState?: ExpertEditSessionState | null;
    }): AiStudioSessionSnapshotV2 =>
      buildAiStudioSessionSnapshot({
        sessionId,
        updatedAt,
        mode,
        selectedTool,
        prompt,
        model,
        aspect,
        referenceImageUrl,
        extraImageUrls,
        editReferenceText,
        videoReferenceText,
        videoReferenceMode,
        videoDurationSeconds,
        videoResolution,
        imageResolution,
        videoGenerateAudio,
        videoCameraFixed,
        videoAutoFix,
        klingNegativePrompt,
        klingCfgScale,
        klingWorkflowMode,
        seedance2InputMode,
        seedance2ReferenceImageUrls,
        seedance2ReferenceVideoUrls,
        seedance2ReferenceAudioUrls,
        seedance2ReturnLastFrame,
        seedance2WebSearch,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        motionReferenceVideoUrl,
        outputs,
        archivedOutputs,
        activeOutputId,
        curatedReferenceIds,
        removedFromAllRefsIds,
        agentMessages,
        agentInput,
        latestAgentPrompt,
        promptOrigin,
        chatModeEnabled,
        canvasState,
        expertEditSessionState,
      }),
    [
      activeOutputId,
      archivedOutputs,
      aspect,
      curatedReferenceIds,
      editReferenceText,
      extraImageUrls,
      imageResolution,
      klingCfgScale,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingWorkflowMode,
      seedance2InputMode,
      seedance2ReferenceAudioUrls,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingShotType,
      klingVoiceIds,
      mode,
      model,
      motionReferenceVideoUrl,
      outputs,
      prompt,
      referenceImageUrl,
      removedFromAllRefsIds,
      selectedTool,
      videoAutoFix,
      videoCameraFixed,
      videoDurationSeconds,
      videoGenerateAudio,
      videoReferenceMode,
      videoReferenceText,
      videoResolution,
    ]
  );

  return {
    hydrateFromSessionSnapshot,
    buildSessionSnapshot,
  };
};
