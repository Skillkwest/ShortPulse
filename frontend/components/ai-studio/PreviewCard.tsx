import Link from "next/link";
import React from "react";
import { CloudArrowUp, ImageSquare, UploadSimple } from "phosphor-react";

type PreviewCardProps = {
  eyebrowLabel: string;
  variant?: "default" | "reference-drop" | "empty";
  showMediaButton?: boolean;
  previewImage?: string | null;
  referenceText?: string | null;
  onReferenceDrop?: (url: string) => void;
  onReferenceTextDrop?: (text: string) => void;
  onAddFilesClick?: () => void;
  showHeader?: boolean;
  wrapContainer?: boolean;
};

export function PreviewCard({
  eyebrowLabel,
  variant = "default",
  showMediaButton = false,
  previewImage = null,
  referenceText = null,
  onReferenceDrop,
  onReferenceTextDrop,
  onAddFilesClick,
  showHeader = true,
  wrapContainer = true,
}: PreviewCardProps) {
  const isReferenceDrop = variant === "reference-drop";
  const showSurface = variant !== "empty";
  const activePromptText = referenceText ?? "";

  const handleReferenceDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      return;
    }
    event.preventDefault();
    const url = event.dataTransfer.getData("text/plain");
    if (url && onReferenceDrop) {
      onReferenceDrop(url);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleTextDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      return;
    }
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text && onReferenceTextDrop) {
      onReferenceTextDrop(text);
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onReferenceTextDrop) {
      onReferenceTextDrop(event.target.value);
    }
  };

  const cardBody = (
    <>
      {showHeader ? (
        <div className={`panel-header ${showMediaButton ? "preview-header" : ""}`}>
          <div>
            <p className="eyebrow">{eyebrowLabel}</p>
          </div>
          {showMediaButton ? (
            <div className="preview-header-actions">
              <button type="button" className="ghost-btn mini preview-media-btn" onClick={onAddFilesClick}>
                <UploadSimple size={14} weight="regular" />
                Add files
              </button>
              <Link href="/media-library" className="ghost-btn mini preview-media-btn">
                <CloudArrowUp size={14} weight="regular" />
                Media library
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {isReferenceDrop ? (
        <div className="step-card studio-preview-card">
          <div className="studio-preview-square" onDrop={handleReferenceDrop} onDragOver={handleDragOver}>
            {previewImage ? (
              <div className="studio-preview-square-image" style={{ backgroundImage: `url(${previewImage})` }} />
            ) : (
              <div className="studio-preview-square-empty">
                <ImageSquare size={24} weight="regular" />
                <p className="tiny">Generated images will appear here.</p>
              </div>
            )}
          </div>
          <div
            className={`prompt-preview-card ${activePromptText ? "" : "is-empty"}`}
            onDrop={handleTextDrop}
            onDragOver={handleDragOver}
          >
            <textarea
              className="prompt-preview-input"
              value={activePromptText}
              placeholder="Prompt preview will appear here."
              onChange={handleTextChange}
            />
          </div>
        </div>
      ) : null}
      {showSurface && !isReferenceDrop ? (
        <div className="preview-surface">
          <div className="ai-empty">
            <p className="preview-title">Your preview appears here.</p>
            <p className="subdued tiny">Select Generate from the left to create an image or video.</p>
          </div>
        </div>
      ) : null}
    </>
  );

  if (!wrapContainer) {
    return cardBody;
  }

  return <div className="panel ai-panel ai-preview-panel reference-canvas-panel">{cardBody}</div>;
}
