/**
 * Prompt/selectors and auxiliary composition runtime for the Expert Edit panel.
 * Owns the final composer and auxiliary React-node assembly so the panel body stays focused on runtime wiring.
 */
import React from "react";

import { ExpertEditPanelAuxiliary } from "./ExpertEditPanelAuxiliary";
import { ExpertEditPromptSelectorsColumn } from "./ExpertEditPromptSelectorsColumn";
import type { AspectOption } from "../../types";

type UseExpertEditPanelComposerRuntimeArgs = {
  isPromptComposerExpanded: boolean;
  promptInputShellRef: React.Ref<HTMLDivElement>;
  promptHighlightRef: React.Ref<HTMLDivElement>;
  promptTextareaRef: React.Ref<HTMLTextAreaElement>;
  promptHighlightSegments: readonly { kind: string; text: string }[];
  promptTextValue: string;
  handlePromptTextChange: (value: string) => void;
  handlePromptFocus: React.FocusEventHandler<HTMLTextAreaElement>;
  handlePromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  handlePromptDropWithTokenInsert: React.DragEventHandler<HTMLTextAreaElement>;
  handlePromptScroll: React.UIEventHandler<HTMLTextAreaElement>;
  handlePromptBlur: React.FocusEventHandler<HTMLTextAreaElement>;
  promptTokenPickerState: {
    isOpen: boolean;
    selectedSlotIndex: 0 | 1 | 2 | "main" | null;
  };
  hostPrimaryImageUrl: string | null;
  populatedPromptTokenSlotIndexes: readonly (0 | 1 | 2)[];
  extraImageUrls: [string | null, string | null, string | null];
  insertPromptTokenFromPicker: (selection: 0 | 1 | 2 | "main") => void;
  promptTokenInlineError: string | null;
  handleInlineGenerate: () => void;
  inlineGenerateDisabled: boolean;
  resolvedInlineGenerateBusy: boolean;
  costCredits?: number | null;
  inlineGuardrailReason?: string | null;
  effectiveSelectorModelId: string | null;
  isModelPickerLocked: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  effectiveModelPickerLogoSrc?: string;
  effectiveModelPickerLabel: string;
  onModelPickerOpen: (anchorId: string, target: HTMLElement, context?: "reference-image") => void;
  aspect: string;
  onAspectChange: (value: string) => void;
  aspectOptionsForModel: AspectOption[];
  shouldShowResolutionControl: boolean;
  imageResolutionValue: string;
  imageResolutionOptions: Array<{ value: string; label: string }>;
  onImageResolutionChange?: (value: string) => void;
  statusToastMessage: string | null;
  statusToastTone: "info" | "warning";
  isStatusToastFading: boolean;
  primaryInputRef: React.Ref<HTMLInputElement>;
  extraOneInputRef: React.Ref<HTMLInputElement>;
  extraTwoInputRef: React.Ref<HTMLInputElement>;
  extraThreeInputRef: React.Ref<HTMLInputElement>;
  handlePrimaryFileSelection: React.ChangeEventHandler<HTMLInputElement>;
  handleFileSelection: (
    onImageResolved: (url: string | null) => void
  ) => React.ChangeEventHandler<HTMLInputElement>;
  onExtraImageChange: (index: number, url: string | null) => void;
  isCharacterPickerOpen: boolean;
  characterModeEnabled: boolean;
  isCharacterOptionsLoading: boolean;
  closeCharacterPicker: () => void;
  characterOptions: Array<{
    id: string;
    name: string;
    profileImageUrl: string | null;
  }>;
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

/**
 * Builds the prompt/selectors node and auxiliary surface node for Expert Edit.
 */
export function useExpertEditPanelComposerRuntime({
  isPromptComposerExpanded,
  promptInputShellRef,
  promptHighlightRef,
  promptTextareaRef,
  promptHighlightSegments,
  promptTextValue,
  handlePromptTextChange,
  handlePromptFocus,
  handlePromptKeyDown,
  handlePromptDropWithTokenInsert,
  handlePromptScroll,
  handlePromptBlur,
  promptTokenPickerState,
  hostPrimaryImageUrl,
  populatedPromptTokenSlotIndexes,
  extraImageUrls,
  insertPromptTokenFromPicker,
  promptTokenInlineError,
  handleInlineGenerate,
  inlineGenerateDisabled,
  resolvedInlineGenerateBusy,
  costCredits = null,
  inlineGuardrailReason = null,
  effectiveSelectorModelId,
  isModelPickerLocked,
  isModelModalOpen,
  modelModalAnchor,
  effectiveModelPickerLogoSrc,
  effectiveModelPickerLabel,
  onModelPickerOpen,
  aspect,
  onAspectChange,
  aspectOptionsForModel,
  shouldShowResolutionControl,
  imageResolutionValue,
  imageResolutionOptions,
  onImageResolutionChange,
  statusToastMessage,
  statusToastTone,
  isStatusToastFading,
  primaryInputRef,
  extraOneInputRef,
  extraTwoInputRef,
  extraThreeInputRef,
  handlePrimaryFileSelection,
  handleFileSelection,
  onExtraImageChange,
  isCharacterPickerOpen,
  characterModeEnabled,
  isCharacterOptionsLoading,
  closeCharacterPicker,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: UseExpertEditPanelComposerRuntimeArgs) {
  const handleExtraFileSelection = React.useCallback(
    (index: 0 | 1 | 2) =>
      handleFileSelection((url) => {
        onExtraImageChange(index, url);
      }),
    [handleFileSelection, onExtraImageChange]
  );

  const promptAndSelectors = (
    <ExpertEditPromptSelectorsColumn
      isPromptComposerExpanded={isPromptComposerExpanded}
      promptInputShellRef={promptInputShellRef}
      promptHighlightRef={promptHighlightRef}
      promptTextareaRef={promptTextareaRef}
      promptHighlightSegments={promptHighlightSegments}
      promptTextValue={promptTextValue}
      onPromptTextChange={handlePromptTextChange}
      onPromptFocus={handlePromptFocus}
      onPromptKeyDown={handlePromptKeyDown}
      onPromptDrop={handlePromptDropWithTokenInsert}
      onPromptScroll={handlePromptScroll}
      onPromptBlur={handlePromptBlur}
      promptTokenPickerState={promptTokenPickerState}
      hostPrimaryImageUrl={hostPrimaryImageUrl}
      populatedPromptTokenSlotIndexes={populatedPromptTokenSlotIndexes}
      extraImageUrls={extraImageUrls}
      onInsertPromptTokenFromPicker={insertPromptTokenFromPicker}
      promptTokenInlineError={promptTokenInlineError}
      onGenerate={handleInlineGenerate}
      inlineGenerateDisabled={inlineGenerateDisabled}
      isGenerateBusy={resolvedInlineGenerateBusy}
      costCredits={costCredits}
      inlineGuardrailReason={inlineGuardrailReason}
      modelId={effectiveSelectorModelId}
      isModelPickerLocked={isModelPickerLocked}
      isModelModalOpen={isModelModalOpen}
      modelModalAnchor={modelModalAnchor}
      effectiveModelPickerLogoSrc={effectiveModelPickerLogoSrc}
      effectiveModelPickerLabel={effectiveModelPickerLabel}
      onModelPickerOpen={onModelPickerOpen}
      aspect={aspect}
      onAspectChange={onAspectChange}
      aspectOptionsForModel={aspectOptionsForModel}
      shouldShowResolutionControl={shouldShowResolutionControl}
      imageResolutionValue={imageResolutionValue}
      imageResolutionOptions={imageResolutionOptions}
      onImageResolutionChange={onImageResolutionChange}
    />
  );

  const auxiliary = (
    <ExpertEditPanelAuxiliary
      statusToastMessage={statusToastMessage}
      statusToastTone={statusToastTone}
      isStatusToastFading={isStatusToastFading}
      primaryInputRef={primaryInputRef}
      extraOneInputRef={extraOneInputRef}
      extraTwoInputRef={extraTwoInputRef}
      extraThreeInputRef={extraThreeInputRef}
      handlePrimaryFileSelection={handlePrimaryFileSelection}
      handleExtraFileSelection={handleExtraFileSelection}
      characterPicker={{
        isOpen: isCharacterPickerOpen,
        characterModeEnabled,
        isCharacterOptionsLoading,
        onClose: closeCharacterPicker,
        characterOptions,
        selectedCharacterId,
        onSelectedCharacterIdChange,
        refreshCharacterOptions,
        resolveCharacterAvatarUrlById,
      }}
    />
  );

  return {
    promptAndSelectors,
    auxiliary,
  };
}
