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
    selectedSlotIndex: number | "main" | null;
  };
  isPromptCanvasTearOutActive?: boolean;
  hostPrimaryImageUrl: string | null;
  populatedPromptTokenSlotIndexes: readonly number[];
  extraImageUrls: readonly (string | null)[];
  insertPromptTokenFromPicker: (selection: number | "main") => void;
  promptTokenInlineError: string | null;
  onPinPromptReference?: (text: string) => void;
  handleInlineGenerate: () => void;
  inlineGenerateDisabled: boolean;
  costCredits?: number | null;
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
  inputRefs: readonly React.RefObject<HTMLInputElement | null>[];
  handlePrimaryFileSelection: React.ChangeEventHandler<HTMLInputElement>;
  handleFileSelection: (
    onImageResolved: (url: string | null) => void
  ) => React.ChangeEventHandler<HTMLInputElement>;
  handleExtraFileSelection?: (index: number) => React.ChangeEventHandler<HTMLInputElement>;
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
  isPromptCanvasTearOutActive = false,
  hostPrimaryImageUrl,
  populatedPromptTokenSlotIndexes,
  extraImageUrls,
  insertPromptTokenFromPicker,
  promptTokenInlineError,
  onPinPromptReference,
  handleInlineGenerate,
  inlineGenerateDisabled,
  costCredits = null,
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
  inputRefs,
  handlePrimaryFileSelection,
  handleFileSelection,
  handleExtraFileSelection: resolvedHandleExtraFileSelection,
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
    (index: number) => {
      if (resolvedHandleExtraFileSelection) {
        return resolvedHandleExtraFileSelection(index);
      }
      return handleFileSelection((url) => {
        onExtraImageChange(index, url);
      });
    },
    [handleFileSelection, onExtraImageChange, resolvedHandleExtraFileSelection]
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
      isCanvasTearOutActive={isPromptCanvasTearOutActive}
      hostPrimaryImageUrl={hostPrimaryImageUrl}
      populatedPromptTokenSlotIndexes={populatedPromptTokenSlotIndexes}
      extraImageUrls={extraImageUrls}
      onInsertPromptTokenFromPicker={insertPromptTokenFromPicker}
      promptTokenInlineError={promptTokenInlineError}
      onPinPromptReference={onPinPromptReference}
      onGenerate={handleInlineGenerate}
      inlineGenerateDisabled={inlineGenerateDisabled}
      costCredits={costCredits}
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
      inputRefs={inputRefs}
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
