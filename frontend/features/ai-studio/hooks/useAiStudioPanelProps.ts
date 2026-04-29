/**
 * AI Studio panel prop composition hook.
 * Builds create/edit/video panel prop objects so page-level orchestration stays lean.
 */
import { useCallback, useMemo, type Dispatch, type DragEvent, type SetStateAction } from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { StudioMode } from "../types";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../logic/editSubmitIntent";
import { createWorkflowBeginnerModePolicy } from "../logic/beginnerWorkflowPolicy";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type {
  ExpertEditCustomPresetOverrides,
  ExpertEditPresetId,
} from "../components/edit/expertEditPresets";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { useAiStudioEditExpertPanelProps } from "./useAiStudioEditExpertPanelProps";
import { useAiStudioVideoPanelProps } from "./useAiStudioVideoPanelProps";

export type UseAiStudioPanelPropsParams = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  prompt: string;
  agentEnabled: boolean;
  agentBootstrapReady: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  chatModeEnabled: boolean;
  directOpenAiBypassEnabled: boolean;
  agentBusy: boolean;
  agentIsSending?: boolean;
  agentUiBusy?: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  stagedAgentPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  setChatModeEnabled: (value: boolean) => void;
  handleAgentSend: () => void;
  handleAgentEnhanceSend: () => void;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  handleGenerateFromAgentOutputPrompt: (request: AgentOutputGenerateInput) => void;
  useReferenceImageIndicator: boolean;
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
  createIsGenerating: boolean;
  editIsGenerating: boolean;
  isPrimaryEditStageGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  handleClearAgentChat: () => void;
  handlePrimarySubmit: () => void;
  handleChatOffInlineGenerate: () => void;
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: (characterId: string, lookId: string) => void;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  onOpenCharacterLibrary?: () => void;
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
  loadCharacterLookOptions?: (
    characterId: string
  ) => Promise<Array<{ id: string; label: string; isDefault: boolean }>>;
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
    outputIdOverride?: string;
    costOverrideCredits?: number | null;
    hideOutputFromReferenceGrid?: boolean;
    displayPromptOverride?: string | null;
    submissionPromptOverride?: string | null;
  }) => void | Promise<void>;
  insertOptimisticGenerationPlaceholder?: (prompt: string) => string | null;
  removeOptimisticGenerationPlaceholder?: (outputId: string) => void;
  onEditSubmitIntentChange?: (intent: EditSubmitIntent) => void;
  addSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
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
  klingElements: AiStudioKlingElement[];
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingWorkflowMode?: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  motionReferenceVideoUrl: string | null;
  setVideoReferenceImageUrl: (url: string | null) => void;
  setVideoExtraImageUrl: (index: number, url: string | null) => void;
  setMotionReferenceVideoUrl: (url: string | null) => void;
  handleVideoPromptTextChange: (value: string) => void;
  handleRegenerateWithDebit: () => void;
  onCreateCharacter: () => void;
  onCreateElement: () => void;
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
  agentEnabled,
  agentBootstrapReady,
  agentMessages,
  agentInput,
  chatModeEnabled,
  directOpenAiBypassEnabled,
  agentBusy,
  agentIsSending = false,
  agentUiBusy = false,
  agentAttachmentError,
  agentError,
  stagedAgentPrompt,
  assistantBubbleMedia,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  setChatModeEnabled,
  handleAgentSend,
  handleAgentEnhanceSend,
  handleAgentAttachmentDrop,
  handleAgentAttachmentDragOver,
  handleAgentAttachmentDragEnter,
  handleAgentAttachmentDragLeave,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAssistantMessageEdit,
  handleGenerateFromAgentOutputPrompt,
  useReferenceImageIndicator,
  isModelModalOpen,
  modelModalAnchor,
  handleOpenModelModal,
  handleManualPromptChange,
  createIsGenerating,
  editIsGenerating,
  isPrimaryEditStageGenerating,
  isPromptRefining,
  describeInFlightCount,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  isGenerateDisabled,
  generationGuardrail,
  handleClearAgentChat,
  handlePrimarySubmit,
  handleChatOffInlineGenerate,
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  selectedCharacterLookId = "",
  selectedCharacterLookLabel = null,
  onOpenCharacterLibrary,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  editSelectedCharacterId = selectedCharacterId,
  setEditSelectedCharacterId = (() => {}) as Dispatch<SetStateAction<string>>,
  isEditCharacterModeEnabled = isCharacterModeEnabled,
  setIsEditCharacterModeEnabled = setIsCharacterModeEnabled,
  refreshCharacterOptions = async () => [],
  loadCharacterLookOptions,
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
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  onEditSubmitIntentChange,
  addSessionMediaReference,
  referenceImageWarning,
  resolveOutputPreviewUrl,
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
  onCreateCharacter,
  onCreateElement,
}: UseAiStudioPanelPropsParams) => {
  const isDevBuild = process.env.NODE_ENV === "development";
  const explicitExpertCreateUiFlag = process.env.NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI;
  const normalizedExpertCreateUiFlag = explicitExpertCreateUiFlag?.trim().toLowerCase();
  const isExpertCreateUiEnabledByEnv =
    normalizedExpertCreateUiFlag === "true"
      ? true
      : normalizedExpertCreateUiFlag === "false"
        ? false
        : isDevBuild;
  const beginnerPolicy = createWorkflowBeginnerModePolicy(
    beginnerMode,
    isExpertCreateUiEnabledByEnv
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

  const createGenerateCostCredits =
    mode === "text" && !chatModeEnabled
      ? (promptReferenceGenerateCostCredits ?? currentCostCredits)
      : currentCostCredits;

  const propertiesCreate = useMemo(
    () => ({
      mode,
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      prompt,
      agentEnabled,
      agentBootstrapPending: !agentBootstrapReady,
      agentMessages,
      agentInput,
      chatModeEnabled,
      directOpenAiBypassEnabled,
      agentIsSending: agentBusy,
      agentTransportSending: agentIsSending,
      agentUiBusy,
      agentError: agentAttachmentError ?? agentError ?? undefined,
      stagedPrompt: stagedAgentPrompt,
      assistantBubbleMedia,
      stagedAttachments: agentAttachments,
      agentDropActive: isAgentDropActive,
      onAgentInputChange: handleAgentInputChange,
      onChatModeEnabledChange: setChatModeEnabled,
      onAgentSend: handleAgentSend,
      onAgentEnhanceSend: handleAgentEnhanceSend,
      onAgentAttachmentDrop: handleAgentAttachmentDrop,
      onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
      onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
      onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
      onRemoveAgentAttachment: handleRemoveAgentAttachment,
      onClearAgentAttachments: handleClearAgentAttachments,
      onAssistantMessageEdit: handleAssistantMessageEdit,
      onGenerateFromAgentOutputPrompt: handleGenerateFromAgentOutputPrompt,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPromptChange: handleManualPromptChange,
      isPromptGenerating: createIsGenerating || isPromptRefining || describeInFlightCount > 0,
      costCredits: createGenerateCostCredits,
      outputGenerateCostCredits: promptReferenceGenerateCostCredits,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      isGenerateDisabled,
      isChatOffInlineGenerateDisabled: isGenerateDisabled,
      guardrailReason: generationGuardrail,
      onClearAgentChat: handleClearAgentChat,
      shouldDisableSave: useReferenceImageIndicator && mode === "text",
      onGenerate: handlePrimarySubmit,
      onChatOffInlineGenerate: handleChatOffInlineGenerate,
      onSavePrompt: savePromptReference,
      characterOptions,
      selectedCharacterId,
      selectedCharacterLookId,
      selectedCharacterLookLabel,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      onOpenCharacterLibrary,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
      refreshCharacterOptions,
      loadCharacterLookOptions,
      resolveCharacterAvatarUrlById,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      beginnerMode: beginnerPolicy.create.beginnerMode,
      expertCreateUiEligible: beginnerPolicy.create.expertCreateEligible,
    }),
    [
      agentAttachmentError,
      agentAttachments,
      agentBusy,
      chatModeEnabled,
      directOpenAiBypassEnabled,
      agentEnabled,
      agentBootstrapReady,
      agentError,
      agentInput,
      agentMessages,
      agentIsSending,
      agentUiBusy,
      assistantBubbleMedia,
      aspect,
      characterOptions,
      createGenerateCostCredits,
      createIsGenerating,
      currentModelLabel,
      describeInFlightCount,
      generationGuardrail,
      handleAgentAttachmentDragEnter,
      handleAgentAttachmentDragLeave,
      handleAgentAttachmentDragOver,
      handleAgentAttachmentDrop,
      handleAgentEnhanceSend,
      handleAgentInputChange,
      handleAssistantMessageEdit,
      handleAgentSend,
      handleClearAgentAttachments,
      handleClearAgentChat,
      handleGenerateFromAgentOutputPrompt,
      handleManualPromptChange,
      handleOpenModelModal,
      handleChatOffInlineGenerate,
      handlePrimarySubmit,
      handleRemoveAgentAttachment,
      hasSufficientCreditsForPromptReferenceGenerate,
      imageResolution,
      isAgentDropActive,
      isCharacterModeEnabled,
      isCharacterOptionsLoading,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptRefining,
      mode,
      model,
      modelModalAnchor,
      prompt,
      promptReferenceGenerateCostCredits,
      savePromptReference,
      selectedCharacterId,
      selectedCharacterLookId,
      selectedCharacterLookLabel,
      onOpenCharacterLibrary,
      setAspect,
      setChatModeEnabled,
      setImageResolution,
      setIsCharacterModeEnabled,
      setSelectedCharacterId,
      refreshCharacterOptions,
      loadCharacterLookOptions,
      resolveCharacterAvatarUrlById,
      stagedAgentPrompt,
      useReferenceImageIndicator,
      beginnerPolicy.create.beginnerMode,
      beginnerPolicy.create.expertCreateEligible,
    ]
  );

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
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    onEditSubmitIntentChange,
    addSessionMediaReference,
    currentCostCredits,
    isGenerateDisabled,
    isGenerateBusy: editIsGenerating,
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
    generationGuardrail,
    beginnerMode: beginnerPolicy.video.beginnerMode,
    onCreateCharacter,
    onCreateElement,
  });

  return {
    propertiesCreate,
    propertiesEditExpert,
    propertiesVideo,
  };
};
