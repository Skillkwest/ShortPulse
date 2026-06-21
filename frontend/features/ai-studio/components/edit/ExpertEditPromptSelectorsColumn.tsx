import React from "react";

import type { AspectOption } from "../../types";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { ExpertEditPromptComposer } from "./ExpertEditPromptComposer";
import { ExpertEditSelectorControls } from "./ExpertEditReferenceControls";

type PromptHighlightSegment = {
  kind: string;
  text: string;
};

type PromptTokenPickerState = {
  isOpen: boolean;
  selectedSlotIndex: number | "main" | null;
};

type ExpertEditPromptSelectorsColumnProps = {
  isPromptComposerExpanded: boolean;
  promptInputShellRef: React.Ref<HTMLDivElement>;
  promptHighlightRef: React.Ref<HTMLDivElement>;
  promptTextareaRef: React.Ref<HTMLTextAreaElement>;
  promptHighlightSegments: readonly PromptHighlightSegment[];
  promptTextValue: string;
  onPromptTextChange: (value: string) => void;
  onPromptFocus: React.FocusEventHandler<HTMLTextAreaElement>;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPromptDrop: React.DragEventHandler<HTMLTextAreaElement>;
  onPromptScroll: React.UIEventHandler<HTMLTextAreaElement>;
  onPromptBlur: React.FocusEventHandler<HTMLTextAreaElement>;
  promptTokenPickerState: PromptTokenPickerState;
  isCanvasTearOutActive?: boolean;
  hostPrimaryImageUrl: string | null;
  populatedPromptTokenSlotIndexes: readonly number[];
  extraImageUrls: readonly (string | null)[];
  onInsertPromptTokenFromPicker: (selection: number | "main") => void;
  promptTokenInlineError: string | null;
  onPinPromptReference?: (text: string) => void;
  onGenerate: () => void;
  inlineGenerateDisabled: boolean;
  costCredits?: number | null;
  modelId: string | null;
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
  imageResolutionOptions: React.ComponentProps<typeof ResolutionDropdown>["options"];
  onImageResolutionChange?: (value: string) => void;
};

export function ExpertEditPromptSelectorsColumn({
  isPromptComposerExpanded,
  promptInputShellRef,
  promptHighlightRef,
  promptTextareaRef,
  promptHighlightSegments,
  promptTextValue,
  onPromptTextChange,
  onPromptFocus,
  onPromptKeyDown,
  onPromptDrop,
  onPromptScroll,
  onPromptBlur,
  promptTokenPickerState,
  isCanvasTearOutActive = false,
  hostPrimaryImageUrl,
  populatedPromptTokenSlotIndexes,
  extraImageUrls,
  onInsertPromptTokenFromPicker,
  promptTokenInlineError,
  onPinPromptReference,
  onGenerate,
  inlineGenerateDisabled,
  costCredits = null,
  modelId,
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
}: ExpertEditPromptSelectorsColumnProps) {
  return (
    <>
      <ExpertEditPromptComposer
        isExpanded={isPromptComposerExpanded}
        promptInputShellRef={promptInputShellRef}
        promptHighlightRef={promptHighlightRef}
        promptTextareaRef={promptTextareaRef}
        promptHighlightSegments={promptHighlightSegments}
        promptTextValue={promptTextValue}
        onPromptTextChange={onPromptTextChange}
        onPromptFocus={onPromptFocus}
        onPromptKeyDown={onPromptKeyDown}
        onPromptDrop={onPromptDrop}
        onPromptScroll={onPromptScroll}
        onPromptBlur={onPromptBlur}
        promptTokenPickerState={promptTokenPickerState}
        isCanvasTearOutActive={isCanvasTearOutActive}
        hostPrimaryImageUrl={hostPrimaryImageUrl}
        populatedPromptTokenSlotIndexes={populatedPromptTokenSlotIndexes}
        extraImageUrls={extraImageUrls}
        onInsertPromptTokenFromPicker={onInsertPromptTokenFromPicker}
        promptTokenInlineError={promptTokenInlineError}
        onPinPromptReference={onPinPromptReference}
        onGenerate={onGenerate}
        inlineGenerateDisabled={inlineGenerateDisabled}
        costCredits={costCredits}
      />
      <ExpertEditSelectorControls
        modelId={modelId}
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
    </>
  );
}
