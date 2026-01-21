import React from "react";

import { StudioOutput } from "./types";

type DetailModalProps = {
  detailOutput: StudioOutput | null;
  onClose: () => void;
};

export function DetailModal({ detailOutput, onClose }: DetailModalProps) {
  if (!detailOutput) return null;
  const mediaType = detailOutput.mode === "image" ? "Image" : detailOutput.mode === "video" ? "Video" : "Prompt";
  const isPromptOnly = detailOutput.mode === "enhance";

  return (
    <div className="reference-modal-backdrop" onClick={onClose}>
      <div
        className={`reference-modal ${isPromptOnly ? "prompt-only" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Reference details"
        onClick={(event) => event.stopPropagation()}
      >
        {isPromptOnly ? (
          <div className="reference-modal-details prompt-only">
            <div className="reference-modal-header">
              <p className="eyebrow">Media details</p>
              <button type="button" className="reference-modal-close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <div className="reference-detail-row">
              <span className="reference-detail-label">Media type</span>
              <span className="reference-detail-value">{mediaType}</span>
            </div>
            <div className="prompt-only-block">
              <span className="reference-detail-label">Prompt</span>
              <p className="reference-modal-prompt-box">{detailOutput.prompt}</p>
            </div>
            <div className="reference-modal-actions">
              <button type="button" className="primary-btn">
                Save to Media Library
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="reference-modal-media">
              {detailOutput.previewUrl ? (
                <div className="reference-modal-media-frame" style={{ backgroundImage: `url(${detailOutput.previewUrl})` }} />
              ) : (
                <div className="reference-modal-media-frame text-only">
                  <p className="reference-modal-prompt">{detailOutput.previewText ?? detailOutput.prompt}</p>
                </div>
              )}
            </div>
            <div className="reference-modal-details">
              <div className="reference-modal-header">
                <p className="eyebrow">Media details</p>
                <button type="button" className="reference-modal-close" aria-label="Close" onClick={onClose}>
                  ×
                </button>
              </div>
              <div className="reference-detail-grid">
                <div className="reference-detail-row">
                  <span className="reference-detail-label">Media type</span>
                  <span className="reference-detail-value">{mediaType}</span>
                </div>
                <div className="reference-detail-row">
                  <span className="reference-detail-label">Aspect ratio</span>
                  <span className="reference-detail-value">{detailOutput.aspect}</span>
                </div>
                <div className="reference-detail-row">
                  <span className="reference-detail-label">Model</span>
                  <span className="reference-detail-value">{detailOutput.model}</span>
                </div>
                <div className="reference-detail-row column">
                  <span className="reference-detail-label">Prompt</span>
                  <p className="reference-detail-value prompt-block">{detailOutput.prompt}</p>
                </div>
              </div>
              <div className="reference-modal-actions">
                <button type="button" className="primary-btn">
                  Save to Media Library
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
