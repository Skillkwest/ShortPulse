/**
 * Detail modal for reference items (prompt/image/video).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useEffect, useMemo, useState } from "react";
import { StudioOutput } from "../types";

type DetailModalProps = {
  output: StudioOutput | null;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
};

/**
 * Renders the detail modal for a selected reference.
 */
export function DetailModal({ output, onClose, onUpdatePrompt }: DetailModalProps) {
  if (!output) return null;
  const mediaType = output.mode === "image" ? "Image" : output.mode === "video" ? "Video" : "Prompt";
  const isPromptOnly = output.mode === "enhance";
  const aspectStyle =
    output.aspect && output.aspect.includes(":")
      ? { aspectRatio: output.aspect.replace(":", " / ") }
      : undefined;
  const [draftPrompt, setDraftPrompt] = useState(output.prompt ?? "");
  useEffect(() => {
    setDraftPrompt(output.prompt ?? "");
  }, [output.prompt, output.id]);

  const canSave = useMemo(() => draftPrompt.trim().length > 0 && draftPrompt.trim() !== (output.prompt ?? "").trim(), [draftPrompt, output.prompt]);

  const handleSavePrompt = () => {
    if (!output.id || !draftPrompt.trim()) return;
    onUpdatePrompt(output.id, draftPrompt);
  };

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
              <textarea
                className="reference-modal-prompt-box editable"
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
                rows={6}
              />
            </div>
            <div className="reference-modal-actions">
              <button type="button" className="ghost-btn" onClick={handleSavePrompt} disabled={!canSave}>
                Save changes
              </button>
              <button type="button" className="primary-btn">Save to Media Library</button>
            </div>
          </div>
        ) : (
          <>
            <div className="reference-modal-media">
              {output.previewUrl ? (
                <div className="reference-modal-media-frame" style={aspectStyle}>
                  <img className="reference-modal-media-image" src={output.previewUrl} alt={output.prompt} />
                </div>
              ) : (
                <div className="reference-modal-media-frame text-only">
                  <p className="reference-modal-prompt">{output.previewText ?? output.prompt}</p>
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
                  <span className="reference-detail-value">{output.aspect}</span>
                </div>
                <div className="reference-detail-row">
                  <span className="reference-detail-label">Model</span>
                  <span className="reference-detail-value">{output.model}</span>
                </div>
                <div className="reference-detail-row column">
                  <span className="reference-detail-label">Prompt</span>
                  <textarea
                    className="reference-detail-value prompt-block editable"
                    value={draftPrompt}
                    onChange={(event) => setDraftPrompt(event.target.value)}
                    rows={6}
                  />
                </div>
              </div>
              <div className="reference-modal-actions">
                <button type="button" className="ghost-btn" onClick={handleSavePrompt} disabled={!canSave}>
                  Save changes
                </button>
                <button type="button" className="primary-btn">Save to Media Library</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
