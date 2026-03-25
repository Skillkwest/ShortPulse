/**
 * Studio Preview column.
 * Shows the latest output or reference drop plus a prompt preview input for regen flows.
 */
import React from "react";
import { ArrowClockwise, CloudArrowUp, ImageSquare, UploadSimple } from "phosphor-react";
import { StudioOutput } from "../types";
import { isVideoUrl } from "../logic/stateParsers";

type StudioPreviewProps = {
  activeOutput: StudioOutput | null;
  activeOutputPreviewUrl?: string | null;
  referenceImageUrl: string | null;
  referenceText: string | null;
  onReferenceImageChange: (url: string | null) => void;
  onReferenceTextChange: (text: string) => void;
  onRegenerate: () => void;
  onTriggerFileSelect?: () => void;
  onDropFiles?: (files: FileList) => void;
  onOpenMediaLibrary?: () => void;
};

const preventFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    return true;
  }
  return false;
};

/**
 * Renders the preview dropzones and regen CTA.
 */
function StudioPreviewComponent({
  activeOutput,
  activeOutputPreviewUrl = null,
  referenceImageUrl,
  referenceText,
  onReferenceImageChange,
  onReferenceTextChange,
  onRegenerate,
  onTriggerFileSelect,
  onDropFiles,
  onOpenMediaLibrary,
}: StudioPreviewProps) {
  const previewMedia = activeOutputPreviewUrl || referenceImageUrl;
  const isVideoPreview = Boolean(
    previewMedia && activeOutput?.mode !== "image" && isVideoUrl(previewMedia)
  );
  const taskState = activeOutput?.taskState;
  const errorMessage = activeOutput?.errorMessageShort ?? activeOutput?.errorMessage;
  const handleReferenceDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (preventFileDrop(event)) {
      const files = event.dataTransfer.files;
      if (files?.length && onDropFiles) {
        event.preventDefault();
        onDropFiles(files);
      }
      return;
    }
    event.preventDefault();
    const url = event.dataTransfer.getData("text/plain");
    if (url) {
      onReferenceImageChange(url);
    }
  };
  const handleTextDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (preventFileDrop(event)) {
      return;
    }
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) {
      onReferenceTextChange(text);
    }
  };

  return (
    <div className="ai-preview-column studio-column">
      <div className="studio-preview-header-row">
        <p className="eyebrow">Studio Preview</p>
      </div>
      <div className="panel ai-panel ai-preview-panel reference-canvas-panel">
        <div className="panel-header preview-header">
          <div>
            <p className="eyebrow">Studio Preview</p>
          </div>
          <div className="preview-header-actions">
            <button
              type="button"
              className="ghost-btn mini preview-media-btn"
              onClick={onTriggerFileSelect}
            >
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <button
              type="button"
              className="ghost-btn mini preview-media-btn"
              onClick={onOpenMediaLibrary}
            >
              <CloudArrowUp size={14} weight="regular" />
              Media library
            </button>
          </div>
        </div>
        <div className="step-card studio-preview-card">
          <div
            className="studio-preview-square"
            onDrop={handleReferenceDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            {previewMedia ? (
              isVideoPreview ? (
                <video
                  className="studio-preview-video"
                  src={previewMedia}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <div
                  className="studio-preview-square-image"
                  style={{ backgroundImage: `url(${previewMedia})` }}
                />
              )
            ) : (
              <div className="studio-preview-square-empty">
                <ImageSquare size={24} weight="regular" />
                <p className="tiny helper-text">Generated images will appear here.</p>
              </div>
            )}
          </div>
          <div
            className={`prompt-preview-card ${referenceText ? "" : "is-empty"}`}
            onDrop={handleTextDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            <textarea
              className="prompt-preview-input"
              value={referenceText ?? ""}
              placeholder="Prompt preview will appear here."
              onChange={(event) => onReferenceTextChange(event.target.value)}
            />
          </div>
        </div>
        <div className="step-card regenerate-card">
          <div className="preview-card-actions">
            {taskState ? (
              <div className={`status-chip ${taskState === "fail" ? "is-fail" : "is-running"}`}>
                {taskState === "fail" ? "Failed" : "Processing"}
              </div>
            ) : null}
            {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
            <button type="button" className="ghost-btn" onClick={onRegenerate}>
              <ArrowClockwise size={18} weight="bold" /> Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const StudioPreview = React.memo(StudioPreviewComponent);
