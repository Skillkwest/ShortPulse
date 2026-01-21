/**
 * Create properties panel for AI Studio.
 * Handles mode selection, aspect/model choices, and prompt entry for generation.
 */
import React from "react";
import { CloudArrowUp, FloppyDisk, ImageSquare, MagicWand, Sparkle, VideoCamera } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { StudioMode } from "../types";

type CreatePropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelLabel: string;
  prompt: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  useReferenceImageIndicator: boolean;
  hasReferencePreview: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onModeChange: (mode: StudioMode) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  onToggleReferenceIndicator: () => void;
};

const modeIconMap: Record<StudioMode, React.ComponentType<any>> = {
  enhance: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};

/**
 * Renders the Create tool controls.
 */
export function CreatePropertiesPanel({
  mode,
  aspect,
  modelLabel,
  prompt,
  promptRef,
  useReferenceImageIndicator,
  hasReferencePreview,
  isModelModalOpen,
  modelModalAnchor,
  onModeChange,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
  onGenerate,
  onSavePrompt,
  onToggleReferenceIndicator,
}: CreatePropertiesPanelProps) {
  const isEnhanceMode = mode === "enhance";
  const promptStepNumber = "3";

  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">Create</p>
        <p className="subdued tiny">Generate new content using text input.</p>
      </div>
      <div className="step-card">
        <div className="step-card-header">
          <span className="step-badge">1</span>
          <div className="step-header-copy">
            <p className="step-title">Select Generation Mode</p>
            <span className="step-subtitle tiny">Select the output type you want to generate. </span>
          </div>
        </div>
        <div className="create-controls top-row mode-toggle-row" role="group" aria-label="Select generation mode">
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "enhance" ? "is-active" : ""}`}
            aria-pressed={mode === "enhance"}
            onClick={() => onModeChange("enhance")}
          >
            Text
          </button>
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "image" ? "is-active" : ""}`}
            aria-pressed={mode === "image"}
            onClick={() => onModeChange("image")}
          >
            Image
          </button>
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "video" ? "is-active" : ""}`}
            aria-pressed={mode === "video"}
            onClick={() => onModeChange("video")}
          >
            Video
          </button>
        </div>
      </div>
      {isEnhanceMode ? (
        <div className="step-card">
          <div className="step-card-header">
            <span className="step-badge">2</span>
            <div className="step-header-copy">
              <p className="step-title">Describe Image Mode (Optional)</p>
              <span className="step-subtitle tiny">Select a reference to generate a description of the image →</span>
            </div>
            <div className="step-header-actions">
              <button
                type="button"
                className={`reference-toggle ${useReferenceImageIndicator ? "is-active" : ""}`}
                onClick={onToggleReferenceIndicator}
                disabled={!hasReferencePreview}
                aria-pressed={useReferenceImageIndicator}
                aria-label={
                  useReferenceImageIndicator
                    ? "Reference linked; click to unlink"
                    : hasReferencePreview
                      ? "Link selected reference"
                      : "No image selected"
                }
              >
                <span className="reference-toggle-track">
                  <span className="reference-toggle-dot" aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="step-card">
          <div className="step-card-header">
            <span className="step-badge">2</span>
            <div className="step-header-copy">
              <p className="step-title">Choose frame & model</p>
              <span className="step-subtitle tiny">Set the aspect ratio, then select the model.</span>
            </div>
          </div>
          <div className="create-controls dual-controls">
            <div className="control-row compact">
              <label className="input-label">Aspect ratio</label>
              <AspectDropdown aspect={aspect} onSelect={onAspectChange} />
            </div>
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <button
                type="button"
                className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""}`}
                data-model-anchor="create-model"
                onClick={(event) => onModelPickerOpen("create-model", event.currentTarget)}
              >
                <span className="model-picker-title">Select model here</span>
                <span className="model-picker-value">{modelLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="step-card prompt-step">
        <div className="step-card-header">
          <span className="step-badge">{promptStepNumber}</span>
          <div className="step-header-copy">
            <p className="step-title">Write Your Prompt</p>
            <span className="step-subtitle tiny">Describe what you want to create, then click Generate.</span>
          </div>
        </div>
        <textarea
          ref={promptRef}
          className="prompt-input"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={8}
          placeholder={
            mode === "enhance"
              ? "Type a simple prompt you want enhanced."
              : "Describe the image or video you want to create."
          }
        />
        <div className="ai-control-strip">
          <div className="ai-control-actions">
            <button type="button" className="ghost-btn mini">
              <CloudArrowUp size={12} weight="regular" /> Media library
            </button>
            <button type="button" className="ghost-btn mini" onClick={onSavePrompt}>
              <FloppyDisk size={12} weight="regular" /> Save prompt
            </button>
          </div>
          <button type="button" className="primary-btn" onClick={onGenerate}>
            {modeIconMap[mode] ? (
              React.createElement(modeIconMap[mode], { size: 18, weight: "fill" })
            ) : (
              <Sparkle size={18} weight="fill" />
            )}{" "}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
