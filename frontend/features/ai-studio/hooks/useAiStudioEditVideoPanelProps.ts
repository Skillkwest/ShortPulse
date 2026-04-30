/**
 * AI Studio edit/video panel prop composition.
 * Keeps non-Create panel wiring separate from Standard/Pulse Create runtime ownership.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
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
import type {
  AiStudioEditExpertPanelContract,
  AiStudioVideoPanelContract,
} from "./contracts/pageContentContracts";

type UseAiStudioEditVideoPanelPropsParams = {
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  editIsGenerating: boolean;
  isPrimaryEditStageGenerating: boolean;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  editSelectedCharacterId?: string;
  setEditSelectedCharacterId?: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  editCharacterModeEnabled?: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  setEditCharacterModeEnabled?: Dispatch<SetStateAction<boolean>>;
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
  setVideoReferenceImageUrl: (url: string | null) => void;
  setVideoExtraImageUrl: (index: number, url: string | null) => void;
  setMotionReferenceVideoUrl: (url: string | null) => void;
  handleVideoPromptTextChange: (value: string) => void;
  handleRegenerateWithDebit: () => void;
  onCreateCharacter: () => void;
  onCreateElement: () => void;
};

export type AiStudioEditVideoPanelProps = {
  propertiesEditExpert: AiStudioEditExpertPanelContract;
  propertiesVideo: AiStudioVideoPanelContract;
};

/**
 * Returns edit and video properties panel props.
 */
export const useAiStudioEditVideoPanelProps = ({
  aspect,
  model,
  currentModelLabel,
  editIsGenerating,
  isPrimaryEditStageGenerating,
  currentCostCredits,
  isGenerateDisabled,
  generationGuardrail,
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  editSelectedCharacterId = selectedCharacterId,
  setEditSelectedCharacterId = (() => {}) as Dispatch<SetStateAction<string>>,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  editCharacterModeEnabled = isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  setEditCharacterModeEnabled = setIsCharacterModeEnabled,
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
  isModelModalOpen,
  modelModalAnchor,
  handleOpenModelModal,
  setVideoReferenceImageUrl,
  setVideoExtraImageUrl,
  setMotionReferenceVideoUrl,
  handleVideoPromptTextChange,
  handleRegenerateWithDebit,
  onCreateCharacter,
  onCreateElement,
}: UseAiStudioEditVideoPanelPropsParams): AiStudioEditVideoPanelProps => {
  const explicitExpertCreateUiFlag = process.env.NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI;
  const normalizedExpertCreateUiFlag = explicitExpertCreateUiFlag?.trim().toLowerCase();
  const isExpertCreateUiEnabledByEnv =
    normalizedExpertCreateUiFlag === "true"
      ? true
      : normalizedExpertCreateUiFlag === "false"
        ? false
        : process.env.NODE_ENV === "development";
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
    isCharacterModeEnabled: editCharacterModeEnabled,
    setIsCharacterModeEnabled: setEditCharacterModeEnabled,
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
    propertiesEditExpert,
    propertiesVideo,
  };
};
