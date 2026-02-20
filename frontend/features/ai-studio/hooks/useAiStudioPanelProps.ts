/**
 * AI Studio panel prop composition hook.
 * Builds text/image/video panel prop objects so page-level orchestration stays lean.
 */
import {
  useCallback,
  useMemo,
  type Dispatch,
  type DragEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { aspectOptions } from "../constants";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { AgentActions, AgentAttachment, AgentMessage } from "../../ai-agent/types";
import type { StudioMode, StudioOutput } from "../types";

type UseAiStudioPanelPropsParams = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  prompt: string;
  promptRef: RefObject<HTMLTextAreaElement>;
  agentEnabled: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedAgentPrompt?: string | null;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  handleAgentSend: () => void;
  handleAgentEnhanceSend: () => void;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAgentApplyPrompt: (promptText: string) => void;
  handleAgentSelectVariation: (promptText: string) => void;
  handleAgentDescribeTargets: (targets: string[]) => void;
  handleGenerateFromAgentOutputPrompt: (promptText: string) => void;
  useReferenceImageIndicator: boolean;
  activeOutput: StudioOutput | null;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
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
  setModel: (value: string | null) => void;
  handleManualPromptChange: (value: string) => void;
  toggleReferenceIndicator: () => void;
  isPromptGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  generationGuardrail: string | null;
  handleExpandChat: () => void;
  handleClearAgentChat: () => void;
  isAgentChatOpen: boolean;
  handlePrimarySubmit: () => void;
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  setAspect: (value: string) => void;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  beginnerMode: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  handleImageRegenerateWithDebit: () => void;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  isReferencePromptEnhancing: boolean;
  handleReferencePromptEnhance: () => void;
  setReferenceImageUrl: (url: string | null) => void;
  setExtraImageUrl: (index: number, url: string | null) => void;
  handleEditPromptTextChange: (value: string) => void;
  videoReferenceText: string;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  setVideoReferenceMode: Dispatch<SetStateAction<"standard" | "keyframes" | "kling3" | "motion">>;
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
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
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
  handleVideoPromptTextChange: (value: string) => void;
  handleRegenerateWithDebit: () => void;
};

/**
 * Returns the three properties panel prop objects consumed by `AiStudioPageContent`.
 */
export const useAiStudioPanelProps = ({
  mode,
  aspect,
  model,
  currentModelLabel,
  prompt,
  promptRef,
  agentEnabled,
  agentMessages,
  agentActions,
  agentInput,
  agentBusy,
  agentAttachmentError,
  agentError,
  agentPrimarySource,
  stagedAgentPrompt,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  handleAgentSend,
  handleAgentEnhanceSend,
  handleAgentAttachmentDrop,
  handleAgentAttachmentDragOver,
  handleAgentAttachmentDragEnter,
  handleAgentAttachmentDragLeave,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAgentApplyPrompt,
  handleAgentSelectVariation,
  handleAgentDescribeTargets,
  handleGenerateFromAgentOutputPrompt,
  useReferenceImageIndicator,
  activeOutput,
  isModelModalOpen,
  modelModalAnchor,
  handleOpenModelModal,
  setModel,
  handleManualPromptChange,
  toggleReferenceIndicator,
  isPromptGenerating,
  isPromptRefining,
  describeInFlightCount,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  isGenerateDisabled,
  isGenerateClickLocked,
  generationGuardrail,
  handleExpandChat,
  handleClearAgentChat,
  isAgentChatOpen,
  handlePrimarySubmit,
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  videoDurationSeconds,
  videoResolution,
  imageResolution,
  videoGenerateAudio,
  videoCameraFixed,
  videoAutoFix,
  setAspect,
  setVideoDurationSeconds,
  setVideoResolution,
  setImageResolution,
  setVideoGenerateAudio,
  setVideoCameraFixed,
  setVideoAutoFix,
  beginnerMode,
  referenceImageUrl,
  extraImageUrls,
  editReferenceText,
  handleImageRegenerateWithDebit,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  isReferencePromptEnhancing,
  handleReferencePromptEnhance,
  setReferenceImageUrl,
  setExtraImageUrl,
  handleEditPromptTextChange,
  videoReferenceText,
  videoReferenceMode,
  setVideoReferenceMode,
  klingNegativePrompt,
  klingCfgScale,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  setKlingNegativePrompt,
  setKlingCfgScale,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingMultiPrompts,
  setKlingElements,
  motionReferenceVideoUrl,
  setMotionReferenceVideoUrl,
  handleVideoPromptTextChange,
  handleRegenerateWithDebit,
}: UseAiStudioPanelPropsParams): Pick<
  AiStudioPageContentProps,
  "propertiesText" | "propertiesImage" | "propertiesVideo"
> => {
  const isDevBuild = process.env.NODE_ENV === "development";
  const explicitExpertCreateUiFlag = process.env.NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI;
  const normalizedExpertCreateUiFlag = explicitExpertCreateUiFlag?.trim().toLowerCase();
  const isExpertCreateUiEnabledByEnv =
    normalizedExpertCreateUiFlag === "true"
      ? true
      : normalizedExpertCreateUiFlag === "false"
        ? false
        : isDevBuild;
  const handleEditPromptSave = useCallback(
    () => savePromptReference(editReferenceText ?? ""),
    [editReferenceText, savePromptReference]
  );
  const handleVideoPromptSave = useCallback(
    () => savePromptReference(videoReferenceText ?? ""),
    [savePromptReference, videoReferenceText]
  );
  const handleKlingVoiceIdChange = useCallback(
    (index: number, value: string) => {
      setKlingVoiceIds((prev) => {
        const next: [string, string] = [...prev] as [string, string];
        next[index] = value;
        return next;
      });
    },
    [setKlingVoiceIds]
  );

  const propertiesText: AiStudioPageContentProps["propertiesText"] = useMemo(
    () => ({
      mode,
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      prompt,
      promptRef,
      agentEnabled,
      agentMessages,
      agentActions,
      agentInput,
      agentIsSending: agentBusy,
      agentError: agentAttachmentError ?? agentError ?? undefined,
      agentPrimarySource,
      stagedPrompt: stagedAgentPrompt,
      stagedAttachments: agentAttachments,
      agentDropActive: isAgentDropActive,
      onAgentInputChange: handleAgentInputChange,
      onAgentSend: handleAgentSend,
      onAgentEnhanceSend: handleAgentEnhanceSend,
      onAgentAttachmentDrop: handleAgentAttachmentDrop,
      onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
      onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
      onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
      onRemoveAgentAttachment: handleRemoveAgentAttachment,
      onClearAgentAttachments: handleClearAgentAttachments,
      onAgentApplyPrompt: handleAgentApplyPrompt,
      onAgentSelectVariation: handleAgentSelectVariation,
      onAgentDescribeTargets: handleAgentDescribeTargets,
      onGenerateFromAgentOutputPrompt: handleGenerateFromAgentOutputPrompt,
      useReferenceImageIndicator,
      hasReferencePreview: Boolean(activeOutput?.previewUrl),
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onModelIdChange: setModel,
      onPromptChange: handleManualPromptChange,
      onToggleReferenceIndicator: toggleReferenceIndicator,
      isPromptGenerating: isPromptGenerating || isPromptRefining || describeInFlightCount > 0,
      costCredits: currentCostCredits,
      outputGenerateCostCredits: promptReferenceGenerateCostCredits,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked,
      guardrailReason: generationGuardrail,
      onExpandChat: handleExpandChat,
      onClearAgentChat: handleClearAgentChat,
      shouldDisableSave: useReferenceImageIndicator && mode === "text",
      onGenerate: handlePrimarySubmit,
      onSavePrompt: savePromptReference,
      agentChatOpen: isAgentChatOpen,
      characterOptions,
      selectedCharacterId,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      beginnerMode,
      expertCreateUiEligible: !beginnerMode && isExpertCreateUiEnabledByEnv,
    }),
    [
      activeOutput?.previewUrl,
      agentActions,
      agentAttachmentError,
      agentAttachments,
      agentBusy,
      agentEnabled,
      agentError,
      agentInput,
      agentMessages,
      agentPrimarySource,
      aspect,
      beginnerMode,
      characterOptions,
      currentCostCredits,
      currentModelLabel,
      describeInFlightCount,
      generationGuardrail,
      handleAgentApplyPrompt,
      handleAgentAttachmentDragEnter,
      handleAgentAttachmentDragLeave,
      handleAgentAttachmentDragOver,
      handleAgentAttachmentDrop,
      handleAgentDescribeTargets,
      handleAgentEnhanceSend,
      handleAgentInputChange,
      handleAgentSelectVariation,
      handleAgentSend,
      handleClearAgentAttachments,
      handleClearAgentChat,
      handleExpandChat,
      handleGenerateFromAgentOutputPrompt,
      handleManualPromptChange,
      handleOpenModelModal,
      handlePrimarySubmit,
      handleRemoveAgentAttachment,
      hasSufficientCreditsForPromptReferenceGenerate,
      imageResolution,
      isAgentChatOpen,
      isAgentDropActive,
      isCharacterModeEnabled,
      isCharacterOptionsLoading,
      isExpertCreateUiEnabledByEnv,
      isGenerateClickLocked,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptGenerating,
      isPromptRefining,
      mode,
      model,
      modelModalAnchor,
      prompt,
      promptRef,
      promptReferenceGenerateCostCredits,
      savePromptReference,
      selectedCharacterId,
      setAspect,
      setImageResolution,
      setIsCharacterModeEnabled,
      setModel,
      setSelectedCharacterId,
      stagedAgentPrompt,
      toggleReferenceIndicator,
      useReferenceImageIndicator,
    ]
  );

  const propertiesImage: AiStudioPageContentProps["propertiesImage"] = useMemo(
    () => ({
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      referenceImageUrl,
      extraImageUrls,
      referenceText: editReferenceText,
      aspectOptions,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPrimaryImageChange: setReferenceImageUrl,
      onExtraImageChange: setExtraImageUrl,
      onPromptTextChange: handleEditPromptTextChange,
      onSave: handleEditPromptSave,
      onRegenerate: handleImageRegenerateWithDebit,
      costCredits: currentCostCredits,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked || isPromptGenerating,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      agentIsSending: isReferencePromptEnhancing || isPromptGenerating,
      onAgentEnhanceSend: handleReferencePromptEnhance,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      beginnerMode,
    }),
    [
      aspect,
      beginnerMode,
      currentCostCredits,
      currentModelLabel,
      editReferenceText,
      extraImageUrls,
      handleEditPromptTextChange,
      handleEditPromptSave,
      handleImageRegenerateWithDebit,
      handleOpenModelModal,
      handleReferencePromptEnhance,
      imageResolution,
      isGenerateClickLocked,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptGenerating,
      isReferencePromptEnhancing,
      model,
      modelModalAnchor,
      referenceImageUrl,
      referenceImageWarning,
      resolveOutputPreviewUrl,
      setAspect,
      setExtraImageUrl,
      setImageResolution,
      setReferenceImageUrl,
    ]
  );

  const propertiesVideo: AiStudioPageContentProps["propertiesVideo"] = useMemo(
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

  return {
    propertiesText,
    propertiesImage,
    propertiesVideo,
  };
};
