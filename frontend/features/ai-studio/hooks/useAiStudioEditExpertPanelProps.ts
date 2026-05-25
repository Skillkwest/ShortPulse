/**
 * Expert edit workflow panel-prop composition hook for AI Studio.
 * Keeps expert edit surface wiring isolated from legacy edit and other workflows.
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { aspectOptions } from "../constants";
import type { EditSubmitIntent } from "../logic/editSubmitIntent";
import { isExpertEditImageUrl } from "../components/edit/expertEditLayerSessionUtils";
import type { AiStudioEditExpertPanelContract } from "./contracts/pageContentContracts";
import type { ModelModalContext } from "../components/ModelModal";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type {
  ExpertEditCustomPresetOverrides,
  ExpertEditPresetId,
  ExpertEditSystemPresetDefinition,
} from "../components/edit/expertEditPresets";
import type {
  ExpertEditRegenerateOptions,
  ExpertEditRegenerateWithReferenceInputsHandler,
  ExpertEditVariantCostResolver,
} from "../components/edit/expertEditSubmissionContract";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

type UseAiStudioEditExpertPanelPropsParams = {
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls?: [string | null, string | null, string | null];
  editReferenceText: string;
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
  handleEditPromptTextChange: (value: string) => void;
  handleImageRegenerateWithDebit: (
    options?: ExpertEditRegenerateOptions & { referenceInputsOverride?: string[] }
  ) => void | Promise<void>;
  resolveVariantCostCredits?: ExpertEditVariantCostResolver;
  insertOptimisticGenerationPlaceholder?: (prompt: string) => string | null;
  removeOptimisticGenerationPlaceholder?: (outputId: string) => void;
  notifyGenerationFailure?: (outputId: string, message: string, detail?: string) => void;
  onEditSubmitIntentChange?: (intent: EditSubmitIntent) => void;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  isPrimaryStageGenerating: boolean;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  imageResolution: string;
  setImageResolution: Dispatch<SetStateAction<string>>;
  characterOptions: Array<{ id: string; name: string; profileImageUrl: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  refreshCharacterOptions: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById: (characterId: string | null | undefined) => string | null;
  selectedPresetIds?: readonly ExpertEditPresetId[];
  onSelectedPresetIdsChange?: (presetIds: ExpertEditPresetId[]) => void;
  customPresetOverrides?: ExpertEditCustomPresetOverrides;
  onCustomPresetOverridesChange?: (overrides: ExpertEditCustomPresetOverrides) => void;
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[];
  sessionState?: ExpertEditSessionState | null;
  onSessionStateChange?: (state: ExpertEditSessionState) => void;
};

/**
 * Builds props for the expert edit properties panel.
 */
export const useAiStudioEditExpertPanelProps = ({
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
  resolveVariantCostCredits,
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  notifyGenerationFailure,
  onEditSubmitIntentChange,
  currentCostCredits,
  isGenerateDisabled,
  generationGuardrail,
  isPrimaryStageGenerating,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  resolveInternalReferenceImageDropSource,
  imageResolution,
  setImageResolution,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  selectedPresetIds,
  onSelectedPresetIdsChange,
  customPresetOverrides,
  onCustomPresetOverridesChange,
  systemPresetDefinitions,
  sessionState,
  onSessionStateChange,
}: UseAiStudioEditExpertPanelPropsParams): AiStudioEditExpertPanelContract =>
  useMemo(() => {
    const normalizedReferenceImageUrl =
      isExpertEditImageUrl(referenceImageUrl) && typeof referenceImageUrl === "string"
        ? referenceImageUrl.trim()
        : null;
    const normalizedExtraImageUrls = (extraImageUrls ?? [null, null, null]).map((url) =>
      isExpertEditImageUrl(url) && typeof url === "string" ? url.trim() : null
    ) as [string | null, string | null, string | null];

    return {
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      referenceImageUrl: normalizedReferenceImageUrl,
      extraImageUrls: normalizedExtraImageUrls,
      referenceText: editReferenceText,
      aspectOptions,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPrimaryImageChange: setReferenceImageUrl,
      onExtraImageChange: setExtraImageUrl,
      onPromptTextChange: handleEditPromptTextChange,
      onEditSubmitIntentChange,
      onRegenerate: handleImageRegenerateWithDebit,
      insertOptimisticGenerationPlaceholder,
      removeOptimisticGenerationPlaceholder,
      notifyGenerationFailure,
      resolveVariantCostCredits,
      onRegenerateWithReferenceInputs: ((
        referenceInputs: string[],
        options?: ExpertEditRegenerateOptions
      ) =>
        handleImageRegenerateWithDebit({
          referenceInputsOverride: referenceInputs,
          inpaintOverride: options?.inpaintOverride,
          modelIdOverride: options?.modelIdOverride,
          outputIdOverride: options?.outputIdOverride,
          costOverrideCredits: options?.costOverrideCredits,
          hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
          displayPromptOverride: options?.displayPromptOverride,
          submissionPromptOverride: options?.submissionPromptOverride,
          ...(options?.referenceInputsMode
            ? { referenceInputsMode: options.referenceInputsMode }
            : {}),
        })) as ExpertEditRegenerateWithReferenceInputsHandler,
      costCredits: currentCostCredits,
      isGenerateDisabled,
      guardrailReason: generationGuardrail,
      isPrimaryStageGenerating,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      resolveInternalReferenceImageDropSource,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      characterOptions,
      selectedCharacterId,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
      refreshCharacterOptions,
      resolveCharacterAvatarUrlById,
      selectedPresetIds,
      onSelectedPresetIdsChange,
      customPresetOverrides,
      onCustomPresetOverridesChange,
      systemPresetDefinitions,
      sessionState,
      onSessionStateChange,
    };
  }, [
    aspect,
    characterOptions,
    currentCostCredits,
    currentModelLabel,
    editReferenceText,
    extraImageUrls,
    generationGuardrail,
    handleEditPromptTextChange,
    handleImageRegenerateWithDebit,
    resolveVariantCostCredits,
    onEditSubmitIntentChange,
    handleOpenModelModal,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isCharacterModeEnabled,
    isCharacterOptionsLoading,
    isGenerateDisabled,
    isPrimaryStageGenerating,
    isModelModalOpen,
    model,
    modelModalAnchor,
    notifyGenerationFailure,
    removeOptimisticGenerationPlaceholder,
    referenceImageUrl,
    referenceImageWarning,
    resolveInternalReferenceImageDropSource,
    resolveOutputPreviewUrl,
    customPresetOverrides,
    onCustomPresetOverridesChange,
    systemPresetDefinitions,
    sessionState,
    onSessionStateChange,
    onSelectedPresetIdsChange,
    selectedCharacterId,
    selectedPresetIds,
    setAspect,
    setExtraImageUrl,
    setImageResolution,
    setIsCharacterModeEnabled,
    setReferenceImageUrl,
    setSelectedCharacterId,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
  ]);
