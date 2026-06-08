import React from "react";
import { AgentGenerateButton } from "../../../../prefabs/agent/buttons/AgentGenerateButton";
import {
  buildExpertEditPrimarySlotToken,
  buildExpertEditSecondarySlotToken,
} from "../../logic/expertEditPromptReferences";
import { ComposerPinButton } from "../shared/ComposerPinButton";

type PromptHighlightSegment = {
  kind: string;
  text: string;
};

type PromptTokenPickerState = {
  isOpen: boolean;
  selectedSlotIndex: number | "main" | null;
};

type ExpertEditPromptComposerProps = {
  isExpanded: boolean;
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
  hostPrimaryImageUrl: string | null;
  populatedPromptTokenSlotIndexes: readonly number[];
  extraImageUrls: readonly (string | null)[];
  onInsertPromptTokenFromPicker: (selection: number | "main") => void;
  promptTokenInlineError: string | null;
  onPinPromptReference?: (text: string) => void;
  onGenerate: () => void;
  inlineGenerateDisabled: boolean;
  costCredits?: number | null;
  inlineGuardrailReason?: string | null;
};

export function ExpertEditPromptComposer({
  isExpanded,
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
  hostPrimaryImageUrl,
  populatedPromptTokenSlotIndexes,
  extraImageUrls,
  onInsertPromptTokenFromPicker,
  promptTokenInlineError,
  onPinPromptReference,
  onGenerate,
  inlineGenerateDisabled,
  costCredits = null,
}: ExpertEditPromptComposerProps) {
  return (
    <div className={`edit-expert-bottom-row ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
      <div className="edit-expert-prompt-shell">
        <div className="edit-expert-prompt-row">
          <div className="edit-expert-prompt-input-shell" ref={promptInputShellRef}>
            <div
              ref={promptHighlightRef}
              className="edit-expert-prompt-highlight"
              aria-hidden="true"
            >
              {promptHighlightSegments.map((segment, index) => (
                <span
                  key={`prompt-highlight-${index}-${segment.kind}`}
                  className={`edit-expert-prompt-highlight-segment is-${segment.kind}`}
                >
                  {segment.text}
                </span>
              ))}
              <span className="edit-expert-prompt-highlight-segment edit-expert-prompt-highlight-segment--buffer">
                {"\n"}
              </span>
            </div>
            <textarea
              ref={promptTextareaRef}
              className="prompt-drop-input edit-expert-prompt-input"
              value={promptTextValue}
              onChange={(event) => onPromptTextChange(event.target.value)}
              onFocus={onPromptFocus}
              onKeyDown={onPromptKeyDown}
              onDrop={onPromptDrop}
              onDragOver={(event) => event.preventDefault()}
              onScroll={onPromptScroll}
              onBlur={onPromptBlur}
              placeholder="Write your prompt..."
              aria-label="Edit prompt"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              data-gramm="false"
            />
            <ComposerPinButton
              text={promptTextValue}
              onPinTextReference={onPinPromptReference}
              className="edit-expert-prompt-pin-button"
            />
            {promptTokenPickerState.isOpen ? (
              <div
                className="edit-expert-prompt-token-picker"
                role="group"
                aria-label="Reference image picker"
              >
                <div className="edit-expert-prompt-token-picker-header">
                  <p className="edit-expert-prompt-token-picker-title">Reference Images</p>
                  <p className="edit-expert-prompt-token-picker-hint">
                    Tab to cycle. Enter to insert.
                  </p>
                </div>
                <div className="edit-expert-prompt-token-picker-grid">
                  <button
                    type="button"
                    className={`edit-expert-prompt-token-picker-option ${
                      promptTokenPickerState.selectedSlotIndex === "main" ? "is-selected" : ""
                    }`.trim()}
                    data-slot-index="main"
                    aria-label="Primary edit image"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onInsertPromptTokenFromPicker("main")}
                  >
                    <span
                      className="edit-expert-prompt-token-picker-option-thumb"
                      aria-hidden="true"
                      style={
                        hostPrimaryImageUrl
                          ? { backgroundImage: `url(${hostPrimaryImageUrl})` }
                          : undefined
                      }
                    />
                    <span className="edit-expert-prompt-token-picker-option-copy">
                      <span className="edit-expert-prompt-token-picker-option-label">Primary</span>
                      <span className="edit-expert-prompt-token-picker-option-token">
                        {buildExpertEditPrimarySlotToken()}
                      </span>
                    </span>
                  </button>
                  {populatedPromptTokenSlotIndexes.map((slotIndex) => {
                    const previewUrl = extraImageUrls[slotIndex];
                    return (
                      <button
                        key={`prompt-token-picker-slot-${slotIndex}`}
                        type="button"
                        className={`edit-expert-prompt-token-picker-option ${
                          promptTokenPickerState.selectedSlotIndex === slotIndex
                            ? "is-selected"
                            : ""
                        }`.trim()}
                        data-slot-index={slotIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onInsertPromptTokenFromPicker(slotIndex)}
                      >
                        <span
                          className="edit-expert-prompt-token-picker-option-thumb"
                          aria-hidden="true"
                          style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                        />
                        <span className="edit-expert-prompt-token-picker-option-copy">
                          <span className="edit-expert-prompt-token-picker-option-label">
                            Reference {slotIndex + 1}
                          </span>
                          <span className="edit-expert-prompt-token-picker-option-token">
                            {buildExpertEditSecondarySlotToken(slotIndex)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {promptTokenInlineError ? (
          <p className="edit-expert-prompt-token-error" role="alert">
            {promptTokenInlineError}
          </p>
        ) : null}
      </div>
      <div className="edit-expert-inline-generate edit-expert-inline-generate--outside">
        <AgentGenerateButton
          onClick={onGenerate}
          disabled={inlineGenerateDisabled}
          cost={costCredits != null ? costCredits : "—"}
        />
      </div>
    </div>
  );
}
