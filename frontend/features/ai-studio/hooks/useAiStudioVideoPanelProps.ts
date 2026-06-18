/**
 * Video workflow panel-prop composition hook for AI Studio.
 * Isolates video properties panel wiring from create/edit workflows.
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { aspectOptions } from "../constants";
import type { ModelModalContext } from "../components/ModelModal";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { AiStudioVideoPanelContract } from "./contracts/pageContentContracts";
import type { LipSyncAudioState, VideoReferenceMode } from "../types";
import type { VideoUploadResult } from "../utils/videoUpload";
import type { CanvasTearOutComposerTargetRegistry } from "./useAiStudioCanvasTearOutTargets";

type UseAiStudioVideoPanelPropsParams = {
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  videoReferenceMode: VideoReferenceMode;
  setVideoReferenceMode: Dispatch<SetStateAction<VideoReferenceMode>>;
  lipSyncAudio: LipSyncAudioState;
  setLipSyncAudio: Dispatch<SetStateAction<LipSyncAudioState>>;
  lipSyncTurboMode: boolean;
  setLipSyncTurboMode: Dispatch<SetStateAction<boolean>>;
  videoDurationSeconds: number;
  videoResolution: string;
  videoGenerateAudio: boolean;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  videoCameraFixed: boolean;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  videoAutoFix: boolean;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingWorkflowMode?: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  handleKlingVoiceIdChange: (index: number, value: string) => void;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  motionReferenceVideoUrl: string | null;
  setMotionReferenceVideoUrl: (url: string | null) => void;
  stageMotionVideoSelection: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  onRecordedMotionVideoReady?: (
    upload: VideoUploadResult,
    sourceFile: File
  ) => void | Promise<void>;
  clearMotionVideoSelection: () => void;
  motionReferenceVideoPending: boolean;
  motionReferenceVideoError: string | null;
  videoReferenceText: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  setAspect: (value: string) => void;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  setReferenceImageUrl: (url: string | null) => void;
  setExtraImageUrl: (index: number, url: string | null) => void;
  handleVideoPromptTextChange: (value: string) => void;
  onPinPromptReference?: (text: string) => void;
  handleRegenerateWithDebit: () => void;
  currentCostCredits: number | null;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  resolveOutputVideoUrl: (id: string | null | undefined) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  onCreateCharacter: () => void;
  onCreateElement: () => void;
};

/**
 * Builds props for the video properties panel.
 */
export const useAiStudioVideoPanelProps = ({
  aspect,
  model,
  currentModelLabel,
  referenceImageUrl,
  extraImageUrls,
  videoReferenceMode,
  setVideoReferenceMode,
  lipSyncAudio,
  setLipSyncAudio,
  lipSyncTurboMode,
  setLipSyncTurboMode,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  setVideoDurationSeconds,
  setVideoResolution,
  setVideoGenerateAudio,
  videoCameraFixed,
  setVideoCameraFixed,
  videoAutoFix,
  setVideoAutoFix,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  setSeedance2InputMode,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  klingNegativePrompt,
  klingCfgScale,
  klingWorkflowMode,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  setKlingNegativePrompt,
  setKlingCfgScale,
  setKlingWorkflowMode,
  setKlingShotType,
  handleKlingVoiceIdChange,
  setKlingMultiPrompts,
  setKlingElements,
  motionReferenceVideoUrl,
  setMotionReferenceVideoUrl,
  stageMotionVideoSelection,
  onRecordedMotionVideoReady,
  clearMotionVideoSelection,
  motionReferenceVideoPending,
  motionReferenceVideoError,
  videoReferenceText,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  setReferenceImageUrl,
  setExtraImageUrl,
  handleVideoPromptTextChange,
  onPinPromptReference,
  handleRegenerateWithDebit,
  currentCostCredits,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  resolveOutputVideoUrl,
  resolveInternalReferenceImageDropSource,
  resolveInternalReferenceVideoDropSource,
  canvasTearOutTargetRegistry,
  isGenerateDisabled,
  generationGuardrail,
  onCreateCharacter,
  onCreateElement,
}: UseAiStudioVideoPanelPropsParams): AiStudioVideoPanelContract =>
  useMemo(
    () => ({
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      referenceImageUrl,
      extraImageUrls,
      videoReferenceMode,
      onVideoReferenceModeChange: setVideoReferenceMode,
      lipSyncAudio,
      onLipSyncAudioChange: setLipSyncAudio,
      lipSyncTurboMode,
      onLipSyncTurboModeChange: setLipSyncTurboMode,
      videoDurationSeconds,
      videoResolution,
      videoGenerateAudio,
      onVideoDurationChange: setVideoDurationSeconds,
      onVideoResolutionChange: setVideoResolution,
      onVideoGenerateAudioChange: setVideoGenerateAudio,
      videoCameraFixed,
      onVideoCameraFixedChange: setVideoCameraFixed,
      videoAutoFix,
      onVideoAutoFixChange: setVideoAutoFix,
      seedance2InputMode,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReferenceAudioUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      onSeedance2InputModeChange: setSeedance2InputMode,
      onSeedance2ReferenceImageUrlsChange: setSeedance2ReferenceImageUrls,
      onSeedance2ReferenceVideoUrlsChange: setSeedance2ReferenceVideoUrls,
      onSeedance2ReferenceAudioUrlsChange: setSeedance2ReferenceAudioUrls,
      onSeedance2ReturnLastFrameChange: setSeedance2ReturnLastFrame,
      onSeedance2WebSearchChange: setSeedance2WebSearch,
      klingNegativePrompt,
      klingCfgScale,
      klingWorkflowMode,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
      onKlingNegativePromptChange: setKlingNegativePrompt,
      onKlingCfgScaleChange: setKlingCfgScale,
      onKlingWorkflowModeChange: setKlingWorkflowMode,
      onKlingShotTypeChange: setKlingShotType,
      onKlingVoiceIdChange: handleKlingVoiceIdChange,
      onKlingMultiPromptsChange: setKlingMultiPrompts,
      onKlingElementsChange: setKlingElements,
      motionVideoUrl: motionReferenceVideoUrl,
      onMotionVideoChange: setMotionReferenceVideoUrl,
      onStageMotionVideoSelection: stageMotionVideoSelection,
      onRecordedMotionVideoReady,
      onClearMotionVideo: clearMotionVideoSelection,
      motionVideoLoading: motionReferenceVideoPending,
      motionVideoError: motionReferenceVideoError,
      referenceText: videoReferenceText,
      aspectOptions,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPrimaryImageChange: setReferenceImageUrl,
      onExtraImageChange: setExtraImageUrl,
      onPromptTextChange: handleVideoPromptTextChange,
      onPinPromptReference,
      onRegenerate: handleRegenerateWithDebit,
      costCredits: currentCostCredits,
      guardrailReason: generationGuardrail,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      resolveMotionVideoUrlById: resolveOutputVideoUrl,
      resolveInternalReferenceImageDropSource,
      resolveInternalReferenceVideoDropSource,
      canvasTearOutTargetRegistry,
      isGenerateDisabled,
      onCreateCharacter,
      onCreateElement,
    }),
    [
      aspect,
      currentCostCredits,
      currentModelLabel,
      canvasTearOutTargetRegistry,
      extraImageUrls,
      generationGuardrail,
      handleKlingVoiceIdChange,
      handleOpenModelModal,
      handleRegenerateWithDebit,
      handleVideoPromptTextChange,
      isGenerateDisabled,
      isModelModalOpen,
      klingCfgScale,
      klingWorkflowMode,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingShotType,
      klingVoiceIds,
      lipSyncAudio,
      lipSyncTurboMode,
      model,
      modelModalAnchor,
      motionReferenceVideoError,
      motionReferenceVideoPending,
      motionReferenceVideoUrl,
      onCreateCharacter,
      onCreateElement,
      onPinPromptReference,
      onRecordedMotionVideoReady,
      clearMotionVideoSelection,
      referenceImageUrl,
      referenceImageWarning,
      resolveInternalReferenceImageDropSource,
      resolveInternalReferenceVideoDropSource,
      resolveOutputPreviewUrl,
      resolveOutputVideoUrl,
      seedance2InputMode,
      seedance2ReferenceAudioUrls,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      setAspect,
      setExtraImageUrl,
      setKlingCfgScale,
      setKlingWorkflowMode,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingShotType,
      setLipSyncAudio,
      setLipSyncTurboMode,
      setMotionReferenceVideoUrl,
      setReferenceImageUrl,
      setSeedance2InputMode,
      setSeedance2ReferenceAudioUrls,
      setSeedance2ReferenceImageUrls,
      setSeedance2ReferenceVideoUrls,
      setSeedance2ReturnLastFrame,
      setSeedance2WebSearch,
      stageMotionVideoSelection,
      setVideoDurationSeconds,
      setVideoGenerateAudio,
      setVideoReferenceMode,
      setVideoResolution,
      setVideoAutoFix,
      setVideoCameraFixed,
      videoAutoFix,
      videoCameraFixed,
      videoDurationSeconds,
      videoGenerateAudio,
      videoReferenceMode,
      videoReferenceText,
      videoResolution,
    ]
  );
