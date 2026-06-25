/**
 * Kling prompt token picker for the Video workflow.
 */
import React from "react";
import {
  getAiStudioKlingElementReferenceUrls,
  type AiStudioKlingElement,
} from "../../logic/klingElements";

type VideoPromptTokenPickerProps = {
  slotIndexes: number[];
  selectedSlotIndex: number | null;
  elements: Array<AiStudioKlingElement | null>;
  resolveDisplayToken: (slotIndex: number) => string | null;
  onInsertToken: (slotIndex: number) => void;
};

/**
 * Renders the selectable Kling element tokens while the parent owns insertion behavior.
 */
export function VideoPromptTokenPicker({
  slotIndexes,
  selectedSlotIndex,
  elements,
  resolveDisplayToken,
  onInsertToken,
}: VideoPromptTokenPickerProps) {
  return (
    <div className="video-kling-prompt-token-picker" role="group" aria-label="Kling element picker">
      <div className="video-kling-prompt-token-picker-header">
        <p className="video-kling-prompt-token-picker-title">Kling Elements</p>
        <p className="video-kling-prompt-token-picker-hint">Type or click to insert.</p>
      </div>
      <div className="video-kling-prompt-token-picker-grid">
        {slotIndexes.map((slotIndex) => {
          const element = elements[slotIndex];
          if (!element) return null;
          const displayToken = resolveDisplayToken(slotIndex);
          const previewUrl =
            element.profileImageUrl?.trim() ||
            element.frontalImageUrl.trim() ||
            getAiStudioKlingElementReferenceUrls(element)[0] ||
            "";
          return (
            <button
              key={`video-kling-token-picker-slot-${slotIndex}`}
              type="button"
              className={`video-kling-prompt-token-picker-option ${
                selectedSlotIndex === slotIndex ? "is-selected" : ""
              }`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsertToken(slotIndex)}
            >
              <span
                className="video-kling-prompt-token-picker-option-thumb"
                aria-hidden="true"
                style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
              />
              <span className="video-kling-prompt-token-picker-option-copy">
                <span className="video-kling-prompt-token-picker-option-label">
                  {element.name?.trim() || `Element ${slotIndex + 1}`}
                </span>
                <span className="video-kling-prompt-token-picker-option-token">{displayToken}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
