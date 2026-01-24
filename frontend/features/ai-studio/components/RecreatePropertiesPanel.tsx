/**
 * Regenerate/Image-to-video properties panel.
 * Provides reference dropzones, aspect/model selection, and prompt capture for regen flows.
 */
import React, { useRef, useState } from "react";
import { CloudArrowUp, FloppyDisk, Plus, Sparkle, UploadSimple } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption } from "../types";
import { extractDragDropPayload, isImageDragTransfer } from "../utils/dragDrop";

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
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onClearImages: () => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
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
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onClearImages,
  onPromptTextChange,
  onSave,
  onRegenerate,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
}: RecreatePropertiesPanelProps) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraTwoInputRef = useRef<HTMLInputElement | null>(null);
  const extraThreeInputRef = useRef<HTMLInputElement | null>(null);
  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false, false]);

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
    const { promptText } = extractDragDropPayload(event.dataTransfer);
    if (promptText) {
      onPromptTextChange(promptText);
    }
  };

  const handleImageDrop = (setter: (url: string | null) => void) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
    let nextUrl = imageUrl;

    // If we only got a blob and we have a reference id, resolve from state.
    if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
      nextUrl = resolvePreviewUrlById(referenceId);
    }

    if (!nextUrl) return;

    const isBlobUrl = nextUrl.startsWith("blob:");
    const canAcceptBlob = fromFile || Boolean(referenceId); // allow reference grid drags that use object URLs

    if (!isBlobUrl || canAcceptBlob) setter(nextUrl);
  };

  const setExtraDragActiveAt = (index: number, value: boolean) => {
    setExtraDragActive((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const allowImageDrag = (event: React.DragEvent<HTMLDivElement>) => {
    if (isImageDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handlePrimaryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setPrimaryDragActive(false);
    handleImageDrop(onPrimaryImageChange)(event);
  };

  const handleExtraDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setExtraDragActiveAt(index, false);
    handleImageDrop((url) => onExtraImageChange(index, url))(event);
  };

  const handlePrimaryDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragLeave = () => {
    setPrimaryDragActive(false);
  };

  const handleExtraDragEnter = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragLeave = (index: number) => () => {
    setExtraDragActiveAt(index, false);
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
                <p className="step-title">Add Reference Image</p>
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
                  className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
                  onDrop={handlePrimaryDrop}
                  onDragEnter={handlePrimaryDragEnter}
                  onDragOver={handlePrimaryDragOver}
                  onDragLeave={handlePrimaryDragLeave}
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
                      className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${extraDragActive[index] ? "is-dragging" : ""}`}
                      onDrop={handleExtraDrop(index)}
                      onDragEnter={handleExtraDragEnter(index)}
                      onDragOver={handleExtraDragOver(index)}
                      onDragLeave={handleExtraDragLeave(index)}
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
                <p className="step-title">Write Your Prompt</p>
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
            <div className="ai-control-strip">
              <div className="ai-control-actions">
                <button type="button" className="ghost-btn mini">
                  <CloudArrowUp size={12} weight="regular" /> Media library
                </button>
                <button type="button" className="ghost-btn mini" onClick={onSave}>
                  <FloppyDisk size={12} weight="regular" /> Save prompt
                </button>
              </div>
              <button
                type="button"
                className="primary-btn primary-btn-wide recreate-generate-btn"
                onClick={onRegenerate}
                disabled={isGenerateDisabled}
              >
                <span className="primary-btn-label">Generate</span>
                <span className="primary-btn-credits">
                  {costCredits != null ? costCredits : "—"} <Sparkle size={18} weight="fill" />
                </span>
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
