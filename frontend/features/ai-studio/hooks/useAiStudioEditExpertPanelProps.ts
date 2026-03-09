/**
 * Expert edit workflow panel-prop composition hook for AI Studio.
 * Keeps expert edit surface wiring isolated from legacy edit and other workflows.
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { aspectOptions } from "../constants";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import type { AiStudioEditExpertPanelContract } from "./contracts/pageContentContracts";
import type {
  ExpertEditCustomPresetOverrides,
  ExpertEditPresetId,
} from "../components/edit/expertEditPresets";

type UseAiStudioEditExpertPanelPropsParams = {
  expertEditEligible: boolean;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
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
  handleEditPromptTextChange: (value: string) => void;
  handleImageRegenerateWithDebit: (options?: {
    referenceInputsOverride?: string[];
    inpaintOverride?: InpaintSubmissionOverride | null;
    modelIdOverride?: string | null;
    costOverrideCredits?: number | null;
    hideOutputFromReferenceGrid?: boolean;
    displayPromptOverride?: string | null;
    submissionPromptOverride?: string | null;
  }) => void | Promise<void>;
  addSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  isPromptGenerating: boolean;
  isPrimaryStageGenerating: boolean;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  imageResolution: string;
  setImageResolution: Dispatch<SetStateAction<string>>;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  selectedPresetIds?: readonly ExpertEditPresetId[];
  onSelectedPresetIdsChange?: (presetIds: ExpertEditPresetId[]) => void;
  customPresetOverrides?: ExpertEditCustomPresetOverrides;
  onCustomPresetOverridesChange?: (overrides: ExpertEditCustomPresetOverrides) => void;
};

/**
 * Builds props for the expert edit properties panel.
 */
export const useAiStudioEditExpertPanelProps = ({
  expertEditEligible,
  aspect,
  model,
  currentModelLabel,
  referenceImageUrl,
  extraImageUrls,
  editReferenceText,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  setReferenceImageUrl,
  setExtraImageUrl,
  handleEditPromptTextChange,
  handleImageRegenerateWithDebit,
  addSessionMediaReference,
  currentCostCredits,
  isGenerateDisabled,
  isGenerateClickLocked,
  isPromptGenerating,
  isPrimaryStageGenerating,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  imageResolution,
  setImageResolution,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  selectedPresetIds,
  onSelectedPresetIdsChange,
  customPresetOverrides,
  onCustomPresetOverridesChange,
}: UseAiStudioEditExpertPanelPropsParams): AiStudioEditExpertPanelContract =>
  useMemo(
    () => ({
      expertEditEligible,
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
      onRegenerate: handleImageRegenerateWithDebit,
      onRegenerateWithReferenceInputs: (
        referenceInputs: string[],
        options?: {
          inpaintOverride?: InpaintSubmissionOverride | null;
          modelIdOverride?: string | null;
          costOverrideCredits?: number | null;
          hideOutputFromReferenceGrid?: boolean;
          displayPromptOverride?: string | null;
          submissionPromptOverride?: string | null;
        }
      ) =>
        handleImageRegenerateWithDebit({
          referenceInputsOverride: referenceInputs,
          inpaintOverride: options?.inpaintOverride,
          modelIdOverride: options?.modelIdOverride,
          costOverrideCredits: options?.costOverrideCredits,
          hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
          displayPromptOverride: options?.displayPromptOverride,
          submissionPromptOverride: options?.submissionPromptOverride,
        }),
      onAddSessionMediaReference: addSessionMediaReference,
      costCredits: currentCostCredits,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked || isPromptGenerating,
      isGenerateBusy: isPromptGenerating,
      isPrimaryStageGenerating,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      characterOptions,
      selectedCharacterId,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
      selectedPresetIds,
      onSelectedPresetIdsChange,
      customPresetOverrides,
      onCustomPresetOverridesChange,
    }),
    [
      aspect,
      characterOptions,
      currentCostCredits,
      currentModelLabel,
      editReferenceText,
      expertEditEligible,
      extraImageUrls,
      handleEditPromptTextChange,
      handleImageRegenerateWithDebit,
      handleOpenModelModal,
      imageResolution,
      isCharacterModeEnabled,
      isCharacterOptionsLoading,
      isGenerateClickLocked,
      isGenerateDisabled,
      isPrimaryStageGenerating,
      isModelModalOpen,
      isPromptGenerating,
      model,
      modelModalAnchor,
      referenceImageUrl,
      referenceImageWarning,
      resolveOutputPreviewUrl,
      customPresetOverrides,
      onCustomPresetOverridesChange,
      onSelectedPresetIdsChange,
      selectedCharacterId,
      selectedPresetIds,
      setAspect,
      addSessionMediaReference,
      setExtraImageUrl,
      setImageResolution,
      setIsCharacterModeEnabled,
      setReferenceImageUrl,
      setSelectedCharacterId,
    ]
  );
