/**
 * Preview-only modal for AI Studio Media Library panel media cards.
 * Renders image/video detail previews without triggering reference ingest side effects.
 */
import React from "react";
import { X } from "phosphor-react";
import { isVideoFile, type MediaFileRow } from "../../logic/mediaLibraryModalModel";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

type MediaLibraryPanelPreviewModalProps = {
  file: MediaFileRow | null;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

/**
 * Renders a modal preview for a selected media card.
 * Inputs: selected file row, resolved preview URL, loading/error state, and close callback.
 * Output: modal markup when `file` is set.
 * Side effects: closes on Escape key.
 */
export function MediaLibraryPanelPreviewModal({
  file,
  previewUrl,
  isLoading,
  error,
  onClose,
}: MediaLibraryPanelPreviewModalProps) {
  useAiStudioModalActivity("media-library-panel-preview-modal", Boolean(file));
  React.useEffect(() => {
    if (!file || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  const isVideo = isVideoFile(file.file_type);
  const title = (file.filename ?? "").trim() || "Media preview";

  return (
    <AiStudioModalLayer>
      <div
        className="media-library-panel-preview-backdrop"
        onClick={onClose}
        role="presentation"
        data-testid="media-library-panel-preview-backdrop"
      >
        <div
          className="media-library-panel-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="media-library-panel-preview-head">
            <p className="tiny subdued media-library-panel-preview-title">{title}</p>
            <button
              type="button"
              className="reference-card-action-btn media-library-panel-preview-close"
              aria-label="Close media preview"
              onClick={onClose}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          </header>

          <div className="media-library-panel-preview-body">
            {isLoading ? <p className="tiny subdued">Loading preview…</p> : null}
            {!isLoading && !previewUrl ? (
              <p className="tiny subdued">{error || "Preview unavailable."}</p>
            ) : null}
            {!isLoading && previewUrl && isVideo ? (
              <video
                className="media-library-panel-preview-media"
                src={previewUrl}
                controls
                autoPlay
                playsInline
              />
            ) : null}
            {!isLoading && previewUrl && !isVideo ? (
              <>
                {/* Signed URLs are generated dynamically at runtime. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="media-library-panel-preview-media" src={previewUrl} alt={title} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
