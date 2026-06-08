/**
 * Edit and video panel runtime assembly for AI Studio.
 * Keeps edit/video properties wiring out of the page composition root while preserving the same panel contracts.
 */
import { useCallback } from "react";
import { useAiStudioEditExpertPanelProps } from "./useAiStudioEditExpertPanelProps";
import { useAiStudioVideoPanelProps } from "./useAiStudioVideoPanelProps";
import { resolveReferenceTransferUrl } from "../utils/dragDrop";
import type { AiStudioPageBaseRuntime } from "./useAiStudioPageBaseRuntime";
import type { useAiStudioWorkspaceActions } from "./useAiStudioWorkspaceActions";
import type { useAiStudioGenerationController } from "./useAiStudioGenerationController";

type UseAiStudioEditVideoPanelRuntimesParams = {
  base: AiStudioPageBaseRuntime;
  currentCostCredits: number | null;
  removeBackgroundCostCredits: number | null;
  effectiveGenerationGuardrail: string | null;
  effectiveIsGenerateDisabled: boolean;
  referenceImageWarning: string | null;
  handleOpenModelModal: ReturnType<typeof useAiStudioWorkspaceActions>["handleOpenModelModal"];
  handleEditPromptTextChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleEditPromptTextChange"];
  handleVideoPromptTextChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleVideoPromptTextChange"];
  handleImageRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleImageRegenerateWithDebit"];
  handleRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleRegenerateWithDebit"];
  resolveExpertEditVariantCostCredits: (input: {
    modelId: string;
    imageWidth: number;
    imageHeight: number;
  }) => number | null;
};

/**
 * Builds the owned Edit and Video panel prop contracts used by the page content runtime.
 */
export const useAiStudioEditVideoPanelRuntimes = ({
  base,
  currentCostCredits,
  removeBackgroundCostCredits,
  effectiveGenerationGuardrail,
  effectiveIsGenerateDisabled,
  referenceImageWarning,
  handleOpenModelModal,
  handleEditPromptTextChange,
  handleVideoPromptTextChange,
  handleImageRegenerateWithDebit,
  handleRegenerateWithDebit,
  resolveExpertEditVariantCostCredits,
}: UseAiStudioEditVideoPanelRuntimesParams) => {
  const editExpertPanelProps = useAiStudioEditExpertPanelProps({
    aspect: base.aspect,
    model: base.model,
    currentModelLabel: base.currentModelLabel,
    referenceImageUrl: base.imageReferenceImageUrl,
    extraImageUrls: base.imageExtraImageUrls,
    editReferenceText: base.editReferenceText,
    isModelModalOpen: base.isModelModalOpen,
    modelModalAnchor: base.modelModalAnchor,
    setAspect: base.setAspect,
    handleOpenModelModal,
    setReferenceImageUrl: base.setImageReferenceImageUrl,
    addPastedMediaReference: base.addPastedMediaReference,
    setExtraImageUrl: base.setImageExtraImageUrl,
    handleEditPromptTextChange,
    onPinPromptReference: base.addAgentPromptReference,
    handleImageRegenerateWithDebit,
    resolveVariantCostCredits: resolveExpertEditVariantCostCredits,
    insertOptimisticGenerationPlaceholder: (promptText: string) =>
      base.insertOptimisticGenerationPlaceholder({
        prompt: promptText,
        modeOverride: "image",
        selectedToolOverride: "edit",
      }),
    removeOptimisticGenerationPlaceholder: base.removeOptimisticGenerationPlaceholder,
    notifyGenerationFailure: base.notifyGenerationFailure,
    onEditSubmitIntentChange: base.setEditSubmitIntent,
    currentCostCredits,
    removeBackgroundCostCredits,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    generationGuardrail: effectiveGenerationGuardrail,
    isPrimaryStageGenerating: base.isPrimaryEditStageGenerating,
    referenceImageWarning,
    resolveOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    resolveInternalReferenceImageDropSource: base.resolveComposerInternalImageDropSource,
    imageResolution: base.imageResolution,
    setImageResolution: base.setImageResolution,
    characterOptions: base.characterOptions,
    selectedCharacterId: base.editSelectedCharacterId,
    setSelectedCharacterId: base.setEditSelectedCharacterId,
    isCharacterOptionsLoading: base.isCharacterOptionsLoading,
    isCharacterModeEnabled: base.isEditCharacterModeEnabled,
    setIsCharacterModeEnabled: base.setIsEditCharacterModeEnabled,
    refreshCharacterOptions: base.refreshCharacterOptions,
    resolveCharacterAvatarUrlById: base.resolveCharacterAvatarUrlById,
    selectedPresetIds: base.selectedExpertEditPresetIds,
    onSelectedPresetIdsChange: base.setSelectedExpertEditPresetIds,
    customPresetOverrides: base.expertEditCustomPresetOverrides,
    onCustomPresetOverridesChange: base.setExpertEditCustomPresetOverrides,
    systemPresetDefinitions: base.expertEditSystemPresetDefinitions,
    sessionState: base.expertEditSessionState,
    onSessionStateChange: base.publishExpertEditSessionState,
  });
  const handleKlingVoiceIdChange = useCallback(
    (index: number, value: string) => {
      base.setKlingVoiceIds((prev) => {
        const next: [string, string] = [...prev] as [string, string];
        next[index] = value;
        return next;
      });
    },
    [base]
  );
  const resolveOutputVideoUrl = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null;
      const output = base.findOutputById(id);
      if (!output || output.mode !== "video") return null;
      return resolveReferenceTransferUrl(output, "video");
    },
    [base]
  );
  const videoPanelProps = useAiStudioVideoPanelProps({
    aspect: base.aspect,
    model: base.model,
    currentModelLabel: base.currentModelLabel,
    referenceImageUrl: base.videoReferenceImageUrl,
    extraImageUrls: base.videoExtraImageUrls,
    videoReferenceMode: base.videoReferenceMode,
    setVideoReferenceMode: base.setVideoReferenceMode,
    videoDurationSeconds: base.videoDurationSeconds,
    videoResolution: base.videoResolution,
    videoGenerateAudio: base.videoGenerateAudio,
    videoCameraFixed: base.videoCameraFixed,
    videoAutoFix: base.videoAutoFix,
    seedance2InputMode: base.seedance2InputMode,
    seedance2ReferenceImageUrls: base.seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls: base.seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls: base.seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame: base.seedance2ReturnLastFrame,
    seedance2WebSearch: base.seedance2WebSearch,
    setAspect: base.setAspect,
    setVideoDurationSeconds: base.setVideoDurationSeconds,
    setVideoResolution: base.setVideoResolution,
    setVideoGenerateAudio: base.setVideoGenerateAudio,
    setVideoCameraFixed: base.setVideoCameraFixed,
    setVideoAutoFix: base.setVideoAutoFix,
    setSeedance2InputMode: base.setSeedance2InputMode,
    setSeedance2ReferenceImageUrls: base.setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls: base.setSeedance2ReferenceVideoUrls,
    setSeedance2ReferenceAudioUrls: base.setSeedance2ReferenceAudioUrls,
    setSeedance2ReturnLastFrame: base.setSeedance2ReturnLastFrame,
    setSeedance2WebSearch: base.setSeedance2WebSearch,
    videoReferenceText: base.videoReferenceText,
    klingNegativePrompt: base.klingNegativePrompt,
    klingCfgScale: base.klingCfgScale,
    klingWorkflowMode: base.klingWorkflowMode,
    klingShotType: base.klingShotType,
    klingVoiceIds: base.klingVoiceIds,
    klingMultiPrompts: base.klingMultiPrompts,
    klingElements: base.klingElements,
    setKlingNegativePrompt: base.setKlingNegativePrompt,
    setKlingCfgScale: base.setKlingCfgScale,
    setKlingWorkflowMode: base.setKlingWorkflowMode,
    setKlingShotType: base.setKlingShotType,
    handleKlingVoiceIdChange,
    setKlingMultiPrompts: base.setKlingMultiPrompts,
    setKlingElements: base.setKlingElements,
    motionReferenceVideoUrl: base.motionReferenceVideoUrl,
    stageMotionVideoSelection: base.stageMotionVideoSelection,
    clearMotionVideoSelection: base.clearMotionVideoSelection,
    motionReferenceVideoPending: base.motionReferenceVideoPending,
    motionReferenceVideoError: base.motionReferenceVideoError,
    isModelModalOpen: base.isModelModalOpen,
    modelModalAnchor: base.modelModalAnchor,
    handleOpenModelModal,
    setReferenceImageUrl: base.setVideoReferenceImageUrl,
    setExtraImageUrl: base.setVideoExtraImageUrl,
    setMotionReferenceVideoUrl: base.setMotionReferenceVideoUrl,
    handleVideoPromptTextChange,
    onPinPromptReference: base.addAgentPromptReference,
    handleRegenerateWithDebit,
    currentCostCredits,
    referenceImageWarning,
    resolveOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    resolveOutputVideoUrl,
    resolveInternalReferenceImageDropSource: base.resolveComposerInternalImageDropSource,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    generationGuardrail: effectiveGenerationGuardrail,
    onCreateCharacter: base.handleOpenCharacterCreate,
    onCreateElement: base.handleOpenElementCreate,
  });
  return { editExpertPanelProps, videoPanelProps };
};
