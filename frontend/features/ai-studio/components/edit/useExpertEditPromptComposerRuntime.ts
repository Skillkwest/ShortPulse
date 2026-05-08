import React from "react";
import type { AspectOption } from "../../types";
import {
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL,
  resolveInpaintPromptReferencePolicy,
} from "../../logic/inpaintSubmission";
import { stripEditLabel } from "../../utils/modelLabels";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import { useCreateCharacterModeController } from "../create/useCreateCharacterModeController";
import { useExpertEditPromptTokenController } from "./useExpertEditPromptTokenController";
import { useExpertEditPresetRuntime } from "./useExpertEditPresetRuntime";
import {
  COMPOSITE_REGENERATE_COHESION_PROMPT,
  LOCKED_EDIT_TOOL_MODEL_LOGO_SRC,
} from "./expertEditPanelViewContract";
import type { ExpertEditCustomPresetOverrides, ExpertEditPresetId } from "./expertEditPresets";

type UseExpertEditPromptComposerRuntimeParams = {
  promptTextValue: string;
  extraImageUrls: [string | null, string | null, string | null];
  selectedLayerImageUrl: string | null;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  shouldLockMarkupModelPicker: boolean;
  isInpaintSubmitMode: boolean;
  isModelPickerLocked: boolean;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  aspectOptions: AspectOption[];
  characterModeEnabled: boolean;
  characterOptions: Array<{ id: string; name: string; profileImageUrl: string | null }>;
  selectedCharacterId: string;
  isCharacterOptionsLoading: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  populatedLayerCount: number;
  effectiveEditSubmitIntent: "standard" | "inpaint" | "markup";
  onEditSubmitIntentChange?: (intent: "standard" | "inpaint" | "markup") => void;
  guardrailReason: string | null;
  layers: Array<{ id: string; imageUrl: string | null }>;
  customPresetOverrides: ExpertEditCustomPresetOverrides;
  updateSelectedPresetIds: (presetIds: ExpertEditPresetId[]) => void;
  updateCustomPresetOverrides: (overrides: ExpertEditCustomPresetOverrides) => void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

export const useExpertEditPromptComposerRuntime = ({
  promptTextValue,
  extraImageUrls,
  selectedLayerImageUrl,
  onExtraImageChange,
  onPromptTextChange,
  resolvePreviewUrlById,
  modelId,
  modelLabel,
  modelLogoSrc,
  shouldLockMarkupModelPicker,
  isInpaintSubmitMode,
  isModelPickerLocked,
  imageResolution,
  onImageResolutionChange,
  aspectOptions,
  characterModeEnabled,
  characterOptions,
  selectedCharacterId,
  isCharacterOptionsLoading,
  onCharacterModeEnabledChange,
  populatedLayerCount,
  effectiveEditSubmitIntent,
  onEditSubmitIntentChange,
  guardrailReason,
  layers,
  customPresetOverrides,
  updateSelectedPresetIds,
  updateCustomPresetOverrides,
  showStatusToast,
}: UseExpertEditPromptComposerRuntimeParams) => {
  const inpaintPromptReferencePolicy = React.useMemo(
    () =>
      resolveInpaintPromptReferencePolicy({
        promptText: promptTextValue,
        extraImageUrls,
      }),
    [extraImageUrls, promptTextValue]
  );

  const effectiveSelectorModelId = isInpaintSubmitMode
    ? inpaintPromptReferencePolicy.modelId
    : shouldLockMarkupModelPicker
      ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID
      : modelId;
  const effectiveModelPickerLabel = isInpaintSubmitMode
    ? inpaintPromptReferencePolicy.modelLabel
    : shouldLockMarkupModelPicker
      ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL
      : stripEditLabel(modelLabel);
  const effectiveModelPickerLogoSrc = isModelPickerLocked
    ? LOCKED_EDIT_TOOL_MODEL_LOGO_SRC
    : modelLogoSrc;

  const {
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    extraDragActive,
    handleFileSelection,
    handleExtraDrop,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
  } = useReferencePropertiesInteractions({
    referenceImageUrl: selectedLayerImageUrl,
    extraImageUrls,
    onPrimaryImageChange: () => {},
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    klingMultiPrompts: [],
    klingElements: [],
  });

  const { imageResolutionValue, imageResolutionOptions, modelConfig, aspectOptionsForModel } =
    useReferencePropertiesDerivedState({
      variant: "image",
      modelId: effectiveSelectorModelId,
      aspectOptions,
      klingMultiPrompts: [],
      klingElements: [],
      klingVoiceIds: ["", ""],
      klingCfgScale: 0.5,
      klingNegativePrompt: "",
      imageResolution,
    });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue: 6,
    videoResolutionValue: "1080p",
    isVideoVariant: false,
    imageResolution,
    imageResolutionValue,
    onImageResolutionChange,
  });

  const { isCharacterPickerOpen, closeCharacterPicker } = useCreateCharacterModeController({
    beginnerMode: false,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
  });

  const inputRefs = [extraOneInputRef, extraTwoInputRef, extraThreeInputRef] as const;
  const shouldShowResolutionControl = imageResolutionOptions.length > 0;
  const hasPromptText = promptTextValue.trim().length > 0;
  const [isPromptComposerExpanded, setIsPromptComposerExpanded] = React.useState(false);
  const suppressInlineReferenceGuardrail =
    guardrailReason === "Add a reference image before generating.";
  const inlineGuardrailReason = suppressInlineReferenceGuardrail ? null : guardrailReason;
  const inpaintLayerSources = React.useMemo(
    () => layers.map((layer) => ({ id: layer.id, imageUrl: layer.imageUrl })),
    [layers]
  );

  const {
    promptInputShellRef,
    promptHighlightRef,
    promptTextareaRef,
    promptVisualRowCount,
    promptHighlightSegments,
    promptTokenPickerState,
    promptTokenInlineError,
    populatedPromptTokenSlotIndexes,
    handlePromptTextChange,
    handleInvalidPromptReferenceToken,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    closePromptTokenPicker,
    insertPromptTokenFromPicker,
  } = useExpertEditPromptTokenController({
    promptTextValue,
    extraImageUrls,
    populatedLayerCount,
    allowSecondaryReferenceTokens: isInpaintSubmitMode
      ? inpaintPromptReferencePolicy.allowSecondaryReferenceTokens
      : true,
    maxSecondaryReferenceTokens: isInpaintSubmitMode
      ? inpaintPromptReferencePolicy.maxSecondaryReferenceTokens
      : undefined,
    isPromptComposerExpanded,
    onPromptTextChange,
    showStatusToast,
  });

  const handlePromptFocus = React.useCallback(() => {
    setIsPromptComposerExpanded(true);
  }, []);
  const shouldBlurPromptUnderlay = isPromptComposerExpanded && promptVisualRowCount >= 8;

  const handlePromptBlur = React.useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      closePromptTokenPicker();
      if (
        promptInputShellRef.current &&
        event.relatedTarget instanceof Node &&
        promptInputShellRef.current.contains(event.relatedTarget)
      ) {
        return;
      }
      setIsPromptComposerExpanded(false);
    },
    [closePromptTokenPicker, promptInputShellRef]
  );

  React.useEffect(() => {
    if (!onEditSubmitIntentChange) return;
    onEditSubmitIntentChange(effectiveEditSubmitIntent);
  }, [effectiveEditSubmitIntent, onEditSubmitIntentChange]);

  const handleCompositeRegeneratePromptInsert = React.useCallback(() => {
    handlePromptTextChange(COMPOSITE_REGENERATE_COHESION_PROMPT);
  }, [handlePromptTextChange]);

  const {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handlePanelPresetApply,
    handleCustomPresetSave,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  } = useExpertEditPresetRuntime({
    customPresetOverrides,
    updateSelectedPresetIds,
    updateCustomPresetOverrides,
    handlePromptTextChange,
    showStatusToast,
  });

  return {
    aspectOptionsForModel,
    closeCharacterPicker,
    closePromptTokenPicker,
    effectiveModelPickerLabel,
    effectiveModelPickerLogoSrc,
    effectiveSelectorModelId,
    extraDragActive,
    handleCompositeRegeneratePromptInsert,
    handleCustomPresetSave,
    handleExtraDragEnter,
    handleExtraDragLeave,
    handleExtraDragOver,
    handleExtraDrop,
    handleFileSelection,
    handleInvalidPromptReferenceToken,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragLeave,
    handlePresetPanelDragOver,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDrop,
    handlePromptBlur,
    handlePromptFocus,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    handlePromptTextChange,
    handleSurfacePresetDragStart,
    hasPromptText,
    imageResolutionValue,
    imageResolutionOptions,
    inlineGuardrailReason,
    inputRefs,
    inpaintLayerSources,
    inpaintPromptReferencePolicy,
    insertPromptTokenFromPicker,
    isCharacterPickerOpen,
    isPromptComposerExpanded,
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    populatedPromptTokenSlotIndexes,
    promptHighlightRef,
    promptHighlightSegments,
    promptInputShellRef,
    promptTextareaRef,
    promptTokenInlineError,
    promptTokenPickerState,
    promptVisualRowCount,
    resetPresetDropState,
    shouldBlurPromptUnderlay,
    shouldShowResolutionControl,
  };
};
