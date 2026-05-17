/**
 * Pure selector-state adapter for Create properties panel controls.
 * Keeps selector display state and guard conditions centralized.
 */
import type { StudioMode } from "../types";
import {
  MODEL_DEFAULT_IMAGE_RESOLUTION,
  clampImageResolutionForModel,
  getImageResolutionOptions,
} from "./imageResolution";
import {
  hasMissingCreateGenerationTarget,
  shouldDisableCreatePanelOutputGenerate,
} from "./createGenerationGuards";

type DeriveCreateSelectorStateParams = {
  mode: StudioMode;
  modelId: string | null;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  isGenerateDisabled: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
  characterModeEnabled: boolean;
  selectedCharacterId: string;
  imageResolution?: string;
};

type CreateSelectorViewState = {
  imageResolutionOptions: Array<{ value: string; label: string }>;
  imageResolutionValue: string;
  shouldShowImageResolutionCard: boolean;
  isModelSelectionEmpty: boolean;
  isCreateModelPickerOpen: boolean;
  disableOutputGenerate: boolean;
};

/**
 * Returns derived selector UI state for Create panel rendering.
 */
export const deriveCreateSelectorViewState = ({
  mode,
  modelId,
  isModelModalOpen,
  modelModalAnchor,
  isGenerateDisabled,
  hasSufficientCreditsForOutputGenerate,
  characterModeEnabled,
  selectedCharacterId,
  imageResolution,
}: DeriveCreateSelectorStateParams): CreateSelectorViewState => {
  const imageResolutionOptions = getImageResolutionOptions(modelId);
  const imageResolutionValue = clampImageResolutionForModel(modelId, imageResolution);
  const shouldShowImageResolutionCard =
    imageResolutionOptions.length !== 1 ||
    imageResolutionOptions[0]?.value !== MODEL_DEFAULT_IMAGE_RESOLUTION;
  const isModelSelectionEmpty = !modelId;
  const isCreateModelPickerOpen = isModelModalOpen && modelModalAnchor === "create-model";
  const disableOutputGenerate =
    hasMissingCreateGenerationTarget({
      modelId,
      characterModeEnabled,
      selectedCharacterId,
    }) ||
    shouldDisableCreatePanelOutputGenerate({
      mode,
      isGenerateDisabled,
      hasSufficientCreditsForOutputGenerate,
      modelId,
      characterModeEnabled,
      selectedCharacterId,
    });

  return {
    imageResolutionOptions,
    imageResolutionValue,
    shouldShowImageResolutionCard,
    isModelSelectionEmpty,
    isCreateModelPickerOpen,
    disableOutputGenerate,
  };
};
