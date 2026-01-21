import React from "react";
import { ArrowClockwise, FloppyDisk, Plus, UploadSimple } from "phosphor-react";

import { AspectOption, StudioOutput } from "./types";

type RecreatePropertiesProps = {
  title: string;
  subtitle: string;
  aspect: string;
  model: string;
  referenceImageUrl: string | null;
  extraImageUrlOne: string | null;
  extraImageUrlTwo: string | null;
  extraImageUrlThree: string | null;
  referenceText: string | null;
  saved: boolean;
  activeOutput: StudioOutput | null;
  aspectOptions: AspectOption[];
  modelOptions: { value: string; label: string }[];
  onAspectChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onClearDropImages: () => void;
  onPrimaryDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onExtraOneDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onExtraTwoDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onExtraThreeDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onPrimaryClick: () => void;
  onExtraOneClick: () => void;
  onExtraTwoClick: () => void;
  onExtraThreeClick: () => void;
  onRemovePrimary: () => void;
  onRemoveExtraOne: () => void;
  onRemoveExtraTwo: () => void;
  onRemoveExtraThree: () => void;
  onPromptDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
};

export function RecreateProperties({
  title,
  subtitle,
  aspect,
  model,
  referenceImageUrl,
  extraImageUrlOne,
  extraImageUrlTwo,
  extraImageUrlThree,
  referenceText,
  saved,
  activeOutput,
  aspectOptions,
  modelOptions,
  onAspectChange,
  onModelChange,
  onClearDropImages,
  onPrimaryDrop,
  onExtraOneDrop,
  onExtraTwoDrop,
  onExtraThreeDrop,
  onDragOver,
  onPrimaryClick,
  onExtraOneClick,
  onExtraTwoClick,
  onExtraThreeClick,
  onRemovePrimary,
  onRemoveExtraOne,
  onRemoveExtraTwo,
  onRemoveExtraThree,
  onPromptDrop,
  onPromptTextChange,
  onSave,
  onGenerate,
}: RecreatePropertiesProps) {
  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">{title}</p>
        <p className="subdued tiny">{subtitle}</p>
      </div>
      <div className="reference-drop-layout-inner">
        <div className="reference-dropzone-block image-block">
          <div className="regenerate-step-card">
            <div className="regenerate-step-header">
              <span className="step-badge mini">1</span>
              <div className="regenerate-step-copy">
                <p className="step-title">Add Image</p>
                <span className="step-subtitle tiny">Drag a reference from the canvas or upload one manually.</span>
              </div>
              <div className="reference-drop-header-actions">
                <button type="button" className="ghost-btn mini" onClick={onClearDropImages}>
                  Clear
                </button>
              </div>
            </div>
            <div className="drop-image-row">
              <div className="primary-drop">
                <div
                  className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""}`}
                  onDrop={onPrimaryDrop}
                  onDragOver={onDragOver}
                  onClick={onPrimaryClick}
                  style={referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined}
                >
                  {referenceImageUrl ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemovePrimary();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  <div className="reference-drop-content image-drop-content">
                    <UploadSimple size={22} weight="regular" />
                    <p className="reference-drop-title">Click to upload an image</p>
                  </div>
                </div>
              </div>
              <div className="secondary-drop">
                <div
                  className={`reference-dropzone extra ${extraImageUrlOne ? "has-preview" : ""}`}
                  onDrop={onExtraOneDrop}
                  onDragOver={onDragOver}
                  onClick={onExtraOneClick}
                  style={extraImageUrlOne ? { backgroundImage: `url(${extraImageUrlOne})` } : undefined}
                >
                  {extraImageUrlOne ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveExtraOne();
                      }}
                    >
                      ×
                    </button>
                  ) : (
                    <Plus size={22} weight="regular" />
                  )}
                </div>
              </div>
              <div className="secondary-drop">
                <div
                  className={`reference-dropzone extra ${extraImageUrlTwo ? "has-preview" : ""}`}
                  onDrop={onExtraTwoDrop}
                  onDragOver={onDragOver}
                  onClick={onExtraTwoClick}
                  style={extraImageUrlTwo ? { backgroundImage: `url(${extraImageUrlTwo})` } : undefined}
                >
                  {extraImageUrlTwo ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveExtraTwo();
                      }}
                    >
                      ×
                    </button>
                  ) : (
                    <Plus size={22} weight="regular" />
                  )}
                </div>
              </div>
              <div className="secondary-drop">
                <div
                  className={`reference-dropzone extra ${extraImageUrlThree ? "has-preview" : ""}`}
                  onDrop={onExtraThreeDrop}
                  onDragOver={onDragOver}
                  onClick={onExtraThreeClick}
                  style={extraImageUrlThree ? { backgroundImage: `url(${extraImageUrlThree})` } : undefined}
                >
                  {extraImageUrlThree ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveExtraThree();
                      }}
                    >
                      ×
                    </button>
                  ) : (
                    <Plus size={22} weight="regular" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="step-card recreate-frame-card">
          <div className="step-card-header">
            <span className="step-badge">2</span>
            <div className="step-header-copy">
              <p className="step-title">Choose Frame & Model</p>
              <span className="step-subtitle tiny">Pick the target aspect ratio and AI model before you regenerate.</span>
            </div>
          </div>
          <div className="create-controls dual-controls recreate-frame-controls">
            <div className="control-row compact">
              <label className="input-label">Aspect ratio</label>
              <div className="select-shell fixed-select">
                <select value={aspect} onChange={(event) => onAspectChange(event.target.value)} className="model-select">
                  {aspectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <div className="select-shell fixed-select">
                <select value={model} onChange={(event) => onModelChange(event.target.value)} className="model-select">
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="reference-dropzone-block prompt-block">
          <div className="regenerate-step-card">
            <div className="regenerate-step-header">
              <span className="step-badge mini">3</span>
              <div className="regenerate-step-copy">
                <p className="step-title">Add Prompt</p>
                <span className="step-subtitle tiny">Drop a saved prompt or describe the look you want to recreate.</span>
              </div>
            </div>
            <div
              className={`text-dropzone prompt-text-dropzone ${referenceText ? "has-text" : ""}`}
              onDrop={onPromptDrop}
              onDragOver={onDragOver}
            >
              <textarea
                className="prompt-drop-input"
                placeholder="Drag and drop a prompt from the Reference Canvas or start typing"
                value={referenceText ?? ""}
                onChange={(event) => onPromptTextChange(event.target.value)}
              />
            </div>
            <div className="recreate-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={activeOutput ? onSave : undefined}
                disabled={!activeOutput || saved || activeOutput.status === "saved"}
              >
                <FloppyDisk size={18} weight="bold" /> {activeOutput?.status === "saved" ? "Saved" : "Save"}
              </button>
              <button type="button" className="ghost-btn" onClick={onGenerate}>
                <ArrowClockwise size={18} weight="bold" /> Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
