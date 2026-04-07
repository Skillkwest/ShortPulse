/**
 * AI Studio panel prop composition hook.
 * Builds create/edit/video panel prop objects so page-level orchestration stays lean.
 */
import {
  useCallback,
  type Dispatch,
  type DragEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { StudioMode, StudioOutput } from "../types";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../logic/editSubmitIntent";
import { createWorkflowBeginnerModePolicy } from "../logic/beginnerWorkflowPolicy";
import type { AiStudioPanelContracts } from "./contracts/pageContentContracts";
import type {
  ExpertEditCustomPresetOverrides,
  ExpertEditPresetId,
} from "../components/edit/expertEditPresets";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { useAiStudioCreatePanelProps } from "./useAiStudioCreatePanelProps";
import { useAiStudioEditPanelProps } from "./useAiStudioEditPanelProps";
import { useAiStudioEditExpertPanelProps } from "./useAiStudioEditExpertPanelProps";
import { useAiStudioVideoPanelProps } from "./useAiStudioVideoPanelProps";

export type UseAiStudioPanelPropsParams = {
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
  chatModeEnabled: boolean;
  agentAssistToggleAvailable: boolean;
  agentAssistEnabled: boolean;
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedAgentPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  setChatModeEnabled: (value: boolean) => void;
  setAgentAssistEnabled: (value: boolean) => void;
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
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  handleGenerateFromAgentOutputPrompt: (request: AgentOutputGenerateInput) => void;
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
  handleManualPromptChange: (value: string) => void;
  toggleReferenceIndicator: () => void;
  createIsGenerating: boolean;
  editIsGenerating: boolean;
  videoIsGenerating: boolean;
  isPrimaryEditStageGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  isCreateGenerateClickLocked: boolean;
  isEditGenerateClickLocked: boolean;
  isVideoGenerateClickLocked: boolean;
  generationGuardrail: string | null;
  handleExpandChat: () => void;
  handleClearAgentChat: () => void;
  isAgentChatOpen: boolean;
  handlePrimarySubmit: () => void;
  handleChatOffInlineGenerate: () => void;
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  editSelectedCharacterId?: string;
  setEditSelectedCharacterId?: Dispatch<SetStateAction<string>>;
  isEditCharacterModeEnabled?: boolean;
  setIsEditCharacterModeEnabled?: Dispatch<SetStateAction<boolean>>;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  selectedExpertEditPresetIds?: readonly ExpertEditPresetId[];
  onSelectedExpertEditPresetIdsChange?: (presetIds: ExpertEditPresetId[]) => void;
  expertEditCustomPresetOverrides?: ExpertEditCustomPresetOverrides;
  onExpertEditCustomPresetOverridesChange?: (overrides: ExpertEditCustomPresetOverrides) => void;
  expertEditSessionState?: ExpertEditSessionState | null;
  onExpertEditSessionStateChange?: (state: ExpertEditSessionState) => void;
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  setAspect: (value: string) => void;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  beginnerMode: boolean;
  editReferenceImageUrl: string | null;
  editExtraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  handleImageRegenerateWithDebit: (options?: {
    referenceInputsOverride?: string[];
    referenceInputsMode?: "merge" | "replace";
    inpaintOverride?: InpaintSubmissionOverride | null;
    modelIdOverride?: string | null;
    costOverrideCredits?: number | null;
    hideOutputFromReferenceGrid?: boolean;
    displayPromptOverride?: string | null;
    submissionPromptOverride?: string | null;
  }) => void | Promise<void>;
  onEditSubmitIntentChange?: (intent: EditSubmitIntent) => void;
  addSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  isReferencePromptEnhancing: boolean;
  handleReferencePromptEnhance: () => void;
  setEditReferenceImageUrl: (url: string | null) => void;
  setEditExtraImageUrl: (index: number, url: string | null) => void;
  handleEditPromptTextChange: (value: string) => void;
  videoReferenceText: string;
  videoReferenceImageUrl: string | null;
  videoExtraImageUrls: [string | null, string | null, string | null];
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode?: "single" | "multi" | "custom";
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
  setKlingWorkflowMode?: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
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
  setVideoReferenceImageUrl: (url: string | null) => void;
  setVideoExtraImageUrl: (index: number, url: string | null) => void;
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
  chatModeEnabled,
  agentAssistToggleAvailable,
  agentAssistEnabled,
  agentBusy,
  agentAttachmentError,
  agentError,
  agentPrimarySource,
  stagedAgentPrompt,
  assistantBubbleMedia,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  setChatModeEnabled,
  setAgentAssistEnabled,
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
  handleAssistantMessageEdit,
  handleGenerateFromAgentOutputPrompt,
  useReferenceImageIndicator,
  activeOutput,
  isModelModalOpen,
  modelModalAnchor,
  handleOpenModelModal,
  handleManualPromptChange,
  toggleReferenceIndicator,
  createIsGenerating,
  editIsGenerating,
  videoIsGenerating,
  isPrimaryEditStageGenerating,
  isPromptRefining,
  describeInFlightCount,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  isGenerateDisabled,
  isCreateGenerateClickLocked,
  isEditGenerateClickLocked,
  isVideoGenerateClickLocked,
  generationGuardrail,
  handleExpandChat,
  handleClearAgentChat,
  isAgentChatOpen,
  handlePrimarySubmit,
  handleChatOffInlineGenerate,
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  editSelectedCharacterId = selectedCharacterId,
  setEditSelectedCharacterId = setSelectedCharacterId,
  isEditCharacterModeEnabled = isCharacterModeEnabled,
  setIsEditCharacterModeEnabled = setIsCharacterModeEnabled,
  refreshCharacterOptions = async () => [],
  resolveCharacterAvatarUrlById = () => null,
  selectedExpertEditPresetIds,
  onSelectedExpertEditPresetIdsChange,
  expertEditCustomPresetOverrides,
  onExpertEditCustomPresetOverridesChange,
  expertEditSessionState,
  onExpertEditSessionStateChange,
  videoDurationSeconds,
  videoResolution,
  imageResolution,
  videoGenerateAudio,
  videoCameraFixed,
  videoAutoFix,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  setAspect,
  setVideoDurationSeconds,
  setVideoResolution,
  setImageResolution,
  setVideoGenerateAudio,
  setVideoCameraFixed,
  setVideoAutoFix,
  setSeedance2InputMode,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  beginnerMode,
  editReferenceImageUrl,
  editExtraImageUrls,
  editReferenceText,
  handleImageRegenerateWithDebit,
  onEditSubmitIntentChange,
  addSessionMediaReference,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  isReferencePromptEnhancing,
  handleReferencePromptEnhance,
  setEditReferenceImageUrl,
  setEditExtraImageUrl,
  handleEditPromptTextChange,
  videoReferenceText,
  videoReferenceImageUrl,
  videoExtraImageUrls,
  videoReferenceMode,
  setVideoReferenceMode,
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
  setKlingVoiceIds,
  setKlingMultiPrompts,
  setKlingElements,
  motionReferenceVideoUrl,
  setVideoReferenceImageUrl,
  setVideoExtraImageUrl,
  setMotionReferenceVideoUrl,
  handleVideoPromptTextChange,
  handleRegenerateWithDebit,
}: UseAiStudioPanelPropsParams): AiStudioPanelContracts => {
  const isDevBuild = process.env.NODE_ENV === "development";
  const explicitExpertCreateUiFlag = process.env.NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI;
  const normalizedExpertCreateUiFlag = explicitExpertCreateUiFlag?.trim().toLowerCase();
  const isExpertCreateUiEnabledByEnv =
    normalizedExpertCreateUiFlag === "true"
      ? true
      : normalizedExpertCreateUiFlag === "false"
        ? false
        : isDevBuild;
  const explicitExpertEditUiFlag = process.env.NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI;
  const normalizedExpertEditUiFlag = explicitExpertEditUiFlag?.trim().toLowerCase();
  const isExpertEditUiEnabledByEnv =
    normalizedExpertEditUiFlag === "false"
      ? false
      : normalizedExpertEditUiFlag === "true"
        ? true
        : true;
  const beginnerPolicy = createWorkflowBeginnerModePolicy(
    beginnerMode,
    isExpertCreateUiEnabledByEnv,
    isExpertEditUiEnabledByEnv
  );

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

  const propertiesCreate = useAiStudioCreatePanelProps({
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
    chatModeEnabled,
    agentAssistToggleAvailable,
    agentAssistEnabled,
    agentBusy,
    agentAttachmentError,
    agentError,
    agentPrimarySource,
    stagedAgentPrompt,
    assistantBubbleMedia,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
    setChatModeEnabled,
    setAgentAssistEnabled,
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
    handleAssistantMessageEdit,
    handleGenerateFromAgentOutputPrompt,
    useReferenceImageIndicator,
    activeOutput,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    handleManualPromptChange,
    toggleReferenceIndicator,
    isPromptGenerating: createIsGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled,
    isGenerateClickLocked: isCreateGenerateClickLocked,
    generationGuardrail,
    handleExpandChat,
    handleClearAgentChat,
    isAgentChatOpen,
    handlePrimarySubmit,
    handleChatOffInlineGenerate,
    savePromptReference,
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
    isCharacterModeEnabled,
    setIsCharacterModeEnabled,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    imageResolution,
    setAspect,
    setImageResolution,
    beginnerMode: beginnerPolicy.create.beginnerMode,
    expertCreateUiEligible: beginnerPolicy.create.expertCreateEligible,
  });

  const propertiesImage = useAiStudioEditPanelProps({
    aspect,
    model,
    currentModelLabel,
    referenceImageUrl: editReferenceImageUrl,
    extraImageUrls: editExtraImageUrls,
    editReferenceText,
    isModelModalOpen,
    modelModalAnchor,
    setAspect,
    handleOpenModelModal,
    setReferenceImageUrl: setEditReferenceImageUrl,
    setExtraImageUrl: setEditExtraImageUrl,
    handleEditPromptTextChange,
    handleEditPromptSave,
    handleImageRegenerateWithDebit,
    currentCostCredits,
    isGenerateDisabled,
    isGenerateClickLocked: isEditGenerateClickLocked,
    isPromptGenerating: editIsGenerating,
    generationGuardrail,
    referenceImageWarning,
    resolveOutputPreviewUrl,
    isReferencePromptEnhancing,
    handleReferencePromptEnhance,
    imageResolution,
    setImageResolution,
    beginnerMode: beginnerPolicy.edit.beginnerMode,
  });
  const propertiesEditExpert = useAiStudioEditExpertPanelProps({
    expertEditEligible: beginnerPolicy.edit.expertEditEligible,
    aspect,
    model,
    currentModelLabel,
    referenceImageUrl: editReferenceImageUrl,
    extraImageUrls: editExtraImageUrls,
    editReferenceText,
    isModelModalOpen,
    modelModalAnchor,
    setAspect,
    handleOpenModelModal,
    setReferenceImageUrl: setEditReferenceImageUrl,
    setExtraImageUrl: setEditExtraImageUrl,
    handleEditPromptTextChange,
    handleImageRegenerateWithDebit,
    onEditSubmitIntentChange,
    addSessionMediaReference,
    currentCostCredits,
    isGenerateDisabled,
    isGenerateClickLocked: isEditGenerateClickLocked,
    isPromptGenerating: editIsGenerating,
    generationGuardrail,
    isPrimaryStageGenerating: isPrimaryEditStageGenerating,
    referenceImageWarning,
    resolveOutputPreviewUrl,
    imageResolution,
    setImageResolution,
    characterOptions,
    selectedCharacterId: editSelectedCharacterId,
    setSelectedCharacterId: setEditSelectedCharacterId,
    isCharacterOptionsLoading,
    isCharacterModeEnabled: isEditCharacterModeEnabled,
    setIsCharacterModeEnabled: setIsEditCharacterModeEnabled,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    selectedPresetIds: selectedExpertEditPresetIds,
    onSelectedPresetIdsChange: onSelectedExpertEditPresetIdsChange,
    customPresetOverrides: expertEditCustomPresetOverrides,
    onCustomPresetOverridesChange: onExpertEditCustomPresetOverridesChange,
    sessionState: expertEditSessionState,
    onSessionStateChange: onExpertEditSessionStateChange,
  });

  const propertiesVideo = useAiStudioVideoPanelProps({
    aspect,
    model,
    currentModelLabel,
    referenceImageUrl: videoReferenceImageUrl,
    extraImageUrls: videoExtraImageUrls,
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
    videoReferenceText,
    isModelModalOpen,
    modelModalAnchor,
    setAspect,
    handleOpenModelModal,
    setReferenceImageUrl: setVideoReferenceImageUrl,
    setExtraImageUrl: setVideoExtraImageUrl,
    handleVideoPromptTextChange,
    handleVideoPromptSave,
    handleRegenerateWithDebit,
    currentCostCredits,
    referenceImageWarning,
    resolveOutputPreviewUrl,
    isGenerateDisabled,
    isGenerateClickLocked: isVideoGenerateClickLocked,
    isPromptGenerating: videoIsGenerating,
    isReferencePromptEnhancing,
    generationGuardrail,
    handleReferencePromptEnhance,
    beginnerMode: beginnerPolicy.video.beginnerMode,
  });

  return {
    propertiesCreate,
    // Temporary alias while downstream callsites are migrated.
    propertiesText: propertiesCreate,
    propertiesImage,
    propertiesEditExpert,
    propertiesVideo,
  };
};
