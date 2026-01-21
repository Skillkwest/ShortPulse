/**
 * Regenerate/Image-to-video properties panel.
 * Provides reference dropzones, aspect/model selection, and prompt capture for regen flows.
 */
import React, { useRef } from "react";
import { ArrowClockwise, FloppyDisk, Plus, UploadSimple } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption } from "../types";

type RecreatePropertiesPanelProps = {
  title: string;
  subtitle: string;
  aspect: string;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  canSave: boolean;
  saveLabel: string;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onClearImages: () => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
};

const dropHasFile = (event: React.DragEvent<HTMLDivElement>) => {
  const files = event.dataTransfer.files;
  return files && files.length > 0;
};

const getImageFromDrop = (event: React.DragEvent<HTMLDivElement>) => {
  const files = event.dataTransfer.files;
  const textUrl = event.dataTransfer.getData("text/plain");
  if (files && files.length > 0) {
    const imageFile = Array.from(files).find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
  }
  if (textUrl) {
    return textUrl;
  }
  return null;
};

/**
 * Renders reference/image-to-video tool controls.
 */
export function RecreatePropertiesPanel({
  title,
  subtitle,
  aspect,
  modelLabel,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  aspectOptions,
  isModelModalOpen,
  modelModalAnchor,
  canSave,
  saveLabel,
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onClearImages,
  onPromptTextChange,
  onSave,
  onRegenerate,
}: RecreatePropertiesPanelProps) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraTwoInputRef = useRef<HTMLInputElement | null>(null);
  const extraThreeInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelection =
    (setter: (url: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setter(url);
      event.target.value = "";
    };

  const handlePromptDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) {
      onPromptTextChange(text);
    }
  };

  const handleImageDrop = (setter: (url: string | null) => void) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const url = getImageFromDrop(event);
    if (url) {
      setter(url);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (dropHasFile(event)) {
      event.preventDefault();
    }
  };

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
                <button type="button" className="ghost-btn mini" onClick={onClearImages}>
                  Clear
                </button>
              </div>
            </div>
            <div className="drop-image-row">
              <div className="primary-drop">
                <div
                  className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""}`}
                  onDrop={handleImageDrop(onPrimaryImageChange)}
                  onDragOver={handleDragOver}
                  onClick={() => primaryInputRef.current?.click()}
                  style={referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined}
                >
                  {referenceImageUrl ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPrimaryImageChange(null);
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
              {[extraOneInputRef, extraTwoInputRef, extraThreeInputRef].map((inputRef, index) => {
                const previewUrl = extraImageUrls[index];
                return (
                  <div className="secondary-drop" key={`extra-drop-${index}`}>
                    <div
                      className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""}`}
                      onDrop={handleImageDrop((url) => onExtraImageChange(index, url))}
                      onDragOver={handleDragOver}
                      onClick={() => inputRef.current?.click()}
                      style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                    >
                      {previewUrl ? (
                        <button
                          type="button"
                          className="dropzone-clear"
                          onClick={(event) => {
                            event.stopPropagation();
                            onExtraImageChange(index, null);
                          }}
                        >
                          ×
                        </button>
                      ) : (
                        <Plus size={22} weight="regular" />
                      )}
                    </div>
                  </div>
                );
              })}
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
              <AspectDropdown aspect={aspect} onSelect={onAspectChange} options={aspectOptions} />
            </div>
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <button
                type="button"
                className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "recreate-model" ? "is-open" : ""}`}
                data-model-anchor="recreate-model"
                onClick={(event) => onModelPickerOpen("recreate-model", event.currentTarget)}
              >
                <span className="model-picker-title">Select model here</span>
                <span className="model-picker-value">{modelLabel}</span>
              </button>
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
              onDrop={handlePromptDrop}
              onDragOver={(event) => event.preventDefault()}
            >
              <textarea
                className="prompt-drop-input"
                placeholder="Drag and drop a prompt from the Reference Grid or start typing"
                value={referenceText ?? ""}
                onChange={(event) => onPromptTextChange(event.target.value)}
              />
            </div>
            <div className="recreate-actions">
              <button type="button" className="primary-btn" onClick={canSave ? onSave : undefined} disabled={!canSave}>
                <FloppyDisk size={18} weight="bold" /> {saveLabel}
              </button>
              <button type="button" className="ghost-btn" onClick={onRegenerate}>
                <ArrowClockwise size={18} weight="bold" /> Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>
      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection(onPrimaryImageChange)}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(0, url))}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(1, url))}
      />
      <input
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(2, url))}
      />
    </div>
  );
}
