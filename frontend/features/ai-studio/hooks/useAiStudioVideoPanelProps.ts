/**
 * Video workflow panel-prop composition hook for AI Studio.
 * Isolates video properties panel wiring from create/edit workflows.
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { aspectOptions } from "../constants";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";

type UseAiStudioVideoPanelPropsParams = {
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  setVideoReferenceMode: Dispatch<SetStateAction<"standard" | "keyframes" | "kling3" | "motion">>;
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
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: {
    id: string;
    frontalImageUrl: string;
    referenceImageUrls: string;
    videoUrl: string;
  }[];
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  handleKlingVoiceIdChange: (index: number, value: string) => void;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingElements: Dispatch<
    SetStateAction<
      { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
    >
  >;
  motionReferenceVideoUrl: string | null;
  setMotionReferenceVideoUrl: (url: string | null) => void;
  videoReferenceText: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  setAspect: (value: string) => void;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?:
      | "reference-image"
      | "reference-video"
      | "reference-keyframes"
      | "text-image"
      | "text-video"
      | null
  ) => void;
  setReferenceImageUrl: (url: string | null) => void;
  setExtraImageUrl: (index: number, url: string | null) => void;
  handleVideoPromptTextChange: (value: string) => void;
  handleVideoPromptSave: () => void;
  handleRegenerateWithDebit: () => void;
  currentCostCredits: number | null;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  isPromptGenerating: boolean;
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  handleReferencePromptEnhance: () => void;
  beginnerMode: boolean;
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
  klingNegativePrompt,
  klingCfgScale,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  setKlingNegativePrompt,
  setKlingCfgScale,
  setKlingShotType,
  handleKlingVoiceIdChange,
  setKlingMultiPrompts,
  setKlingElements,
  motionReferenceVideoUrl,
  setMotionReferenceVideoUrl,
  videoReferenceText,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  setReferenceImageUrl,
  setExtraImageUrl,
  handleVideoPromptTextChange,
  handleVideoPromptSave,
  handleRegenerateWithDebit,
  currentCostCredits,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  isGenerateDisabled,
  isGenerateClickLocked,
  isPromptGenerating,
  agentBusy,
  agentAttachmentError,
  agentError,
  handleReferencePromptEnhance,
  beginnerMode,
}: UseAiStudioVideoPanelPropsParams): AiStudioPageContentProps["propertiesVideo"] =>
  useMemo(
    () => ({
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      referenceImageUrl,
      extraImageUrls,
      videoReferenceMode,
      onVideoReferenceModeChange: setVideoReferenceMode,
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
      klingNegativePrompt,
      klingCfgScale,
      klingShotType,
      klingVoiceIds,
      klingMultiPrompts,
      klingElements,
      onKlingNegativePromptChange: setKlingNegativePrompt,
      onKlingCfgScaleChange: setKlingCfgScale,
      onKlingShotTypeChange: setKlingShotType,
      onKlingVoiceIdChange: handleKlingVoiceIdChange,
      onKlingMultiPromptsChange: setKlingMultiPrompts,
      onKlingElementsChange: setKlingElements,
      motionVideoUrl: motionReferenceVideoUrl,
      onMotionVideoChange: setMotionReferenceVideoUrl,
      referenceText: videoReferenceText,
      aspectOptions,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPrimaryImageChange: setReferenceImageUrl,
      onExtraImageChange: setExtraImageUrl,
      onPromptTextChange: handleVideoPromptTextChange,
      onSave: handleVideoPromptSave,
      onRegenerate: handleRegenerateWithDebit,
      costCredits: currentCostCredits,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked || isPromptGenerating,
      agentIsSending: agentBusy || isPromptGenerating,
      agentError: agentAttachmentError ?? agentError ?? undefined,
      onAgentEnhanceSend: handleReferencePromptEnhance,
      beginnerMode,
    }),
    [
      agentAttachmentError,
      agentBusy,
      agentError,
      aspect,
      beginnerMode,
      currentCostCredits,
      currentModelLabel,
      extraImageUrls,
      handleKlingVoiceIdChange,
      handleOpenModelModal,
      handleReferencePromptEnhance,
      handleRegenerateWithDebit,
      handleVideoPromptSave,
      handleVideoPromptTextChange,
      isGenerateClickLocked,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptGenerating,
      klingCfgScale,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingShotType,
      klingVoiceIds,
      model,
      modelModalAnchor,
      motionReferenceVideoUrl,
      referenceImageUrl,
      referenceImageWarning,
      resolveOutputPreviewUrl,
      setAspect,
      setExtraImageUrl,
      setKlingCfgScale,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingShotType,
      setMotionReferenceVideoUrl,
      setReferenceImageUrl,
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
