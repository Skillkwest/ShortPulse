/**
 * Minimal, glassmorphic preview modal for reference grid images and videos.
 * Replaces the old full-screen DetailModal with a cleaner, centered card design.
 */
import React, { useState } from "react";
import { StudioOutput } from "../types";
import { looksLikeVideoUrl } from "../utils/dragDrop";

type MediaPreviewModalProps = {
  isOpen: boolean;
  output: StudioOutput | null;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
};

export function MediaPreviewModal({
  isOpen,
  output,
  onClose,
  onUpdatePrompt,
  onDelete,
  onDownload,
}: MediaPreviewModalProps) {
  if (!isOpen || !output) return null;

  const modalKey = `${output.id}:${output.previewUrl ?? "prompt"}`;

  return (
    <MediaPreviewModalContent
      key={modalKey}
      output={output}
      onClose={onClose}
      onUpdatePrompt={onUpdatePrompt}
      onDelete={onDelete}
      onDownload={onDownload}
    />
  );
}

type MediaPreviewModalContentProps = {
  output: StudioOutput;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
};

function MediaPreviewModalContent({
  output,
  onClose,
  onUpdatePrompt,
  onDelete,
  onDownload,
}: MediaPreviewModalContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(output.prompt);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(output.previewUrl));

  const isVideo = output.mode === "video" || looksLikeVideoUrl(output.previewUrl);
  const hasMedia = Boolean(output.previewUrl);

  const handlePromptBlur = () => {
    if (editedPrompt !== output.prompt) {
      onUpdatePrompt(output.id, editedPrompt);
    }
    setIsEditing(false);
  };

  return (
    <div className="media-preview-backdrop" onClick={onClose}>
      <div
        className="media-preview-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-preview-title"
      >
        {/* Close button */}
        <button className="media-preview-close" onClick={onClose} aria-label="Close preview">
          ×
        </button>

        {/* Media container */}
        <div className="media-preview-container">
          {isLoading && hasMedia && !imageError && (
            <div className="media-preview-spinner" aria-label="Loading media" />
          )}

          {imageError && (
            <div className="media-preview-error" role="alert">
              <p>Failed to load media</p>
            </div>
          )}

          {hasMedia &&
            !imageError &&
            (isVideo ? (
              <video
                className="media-preview-content"
                src={output.previewUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                onLoadedData={() => setIsLoading(false)}
                onError={() => {
                  setImageError(true);
                  setIsLoading(false);
                }}
              />
            ) : (
              <>
                {/* Preview URL may come from dynamic provider output or local draft blob URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="media-preview-content"
                  src={output.previewUrl}
                  alt={output.prompt}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setIsLoading(false);
                  }}
                />
              </>
            ))}

          {!hasMedia && (
            <div className="media-preview-placeholder">
              <p>{output.prompt}</p>
            </div>
          )}
        </div>

        {/* Meta pills */}
        <div className="media-preview-meta">
          <span className="media-meta-pill">{isVideo ? "Video" : "Image"}</span>
          <span className="media-meta-pill">{output.aspect}</span>
          {output.timestamp !== "Dropped" && (
            <span className="media-meta-pill">{output.timestamp}</span>
          )}
        </div>

        {/* Prompt editor */}
        <div className="media-preview-prompt">
          {isEditing ? (
            <textarea
              className="media-prompt-textarea"
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              onBlur={handlePromptBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditedPrompt(output.prompt);
                  setIsEditing(false);
                }
              }}
              autoFocus
              aria-label="Edit prompt"
            />
          ) : (
            <p
              id="media-preview-title"
              className="media-prompt-text"
              onClick={() => setIsEditing(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsEditing(true);
                }
              }}
            >
              {output.prompt}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="media-preview-actions">
          <button className="media-action-btn" onClick={() => onDownload(output.id)}>
            Download
          </button>
          <button
            className="media-action-btn media-action-danger"
            onClick={() => onDelete(output.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
