/**
 * Detail modal for reference items (prompt/image/video).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloppyDisk, TrashSimple } from "phosphor-react";
import { StudioOutput } from "../types";
import { PromptLibraryButton } from "./PromptLibraryButton";

type DetailModalProps = {
  output: StudioOutput | null;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDownloadReference?: (id: string) => void;
  onSavePrompt?: (promptText: string) => void;
};

/**
 * Renders the detail modal for a selected reference.
 */
export function DetailModal({
  output,
  onClose,
  onUpdatePrompt,
  onDeleteOutput,
  onDownloadReference,
  onSavePrompt,
}: DetailModalProps) {
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOnlyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const mediaType = output?.mode === "image" ? "Image" : output?.mode === "video" ? "Video" : "Prompt";
  const isPromptOnly = output?.mode === "text" && !output.previewUrl;
  const aspectStyle =
    output?.aspect && output.aspect.includes(":")
      ? { aspectRatio: output.aspect.replace(":", " / ") }
      : undefined;
  const [draftPrompt, setDraftPrompt] = useState(output?.prompt ?? "");
  useEffect(() => {
    setDraftPrompt(output?.prompt ?? "");
    setIsDeleteConfirmOpen(false);
  }, [output?.prompt, output?.id]);

  const isPromptEditable = Boolean(isPromptOnly);
  const trimmedPrompt = draftPrompt.trim();
  const hasPromptEdits = trimmedPrompt !== (output?.prompt ?? "").trim();
  const canSave = useMemo(
    () => Boolean(trimmedPrompt) && (Boolean(onSavePrompt) || (isPromptEditable && hasPromptEdits)),
    [hasPromptEdits, isPromptEditable, onSavePrompt, trimmedPrompt],
  );

  const syncTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const minHeight = Number(element.dataset.minHeight || 180);
    const maxHeight = Number(element.dataset.maxHeight || 420);
    element.style.height = "auto";
    const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    element.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    syncTextareaHeight(promptTextareaRef.current);
    syncTextareaHeight(promptOnlyTextareaRef.current);
  }, [draftPrompt, syncTextareaHeight]);

  const filename = useMemo(() => {
    if (!output?.previewUrl) return output?.id;
    try {
      const parsed = new URL(output.previewUrl);
      const trailing = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
      return trailing || output?.id;
    } catch {
      return output?.id;
    }
  }, [output?.id, output?.previewUrl]);

  const formattedTimestamp = useMemo(() => {
    if (!output?.timestamp) return null;
    const date = new Date(output.timestamp);
    if (Number.isNaN(date.getTime())) return output.timestamp;
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }, [output?.timestamp]);

  const statusLabel = useMemo(() => {
    if (!output) return null;
    if (output.taskState === "fail") return "Error";
    if (output.taskState === "running") return "Generating";
    if (output.taskState === "pending") return "Queued";
    if (output.status === "saved") return "Saved";
    return "Ready";
  }, [output]);

  const handleSavePrompt = () => {
    if (!trimmedPrompt) return;
    if (isPromptEditable && output?.id && hasPromptEdits) {
      onUpdatePrompt(output.id, draftPrompt);
    }
    if (onSavePrompt) {
      onSavePrompt(draftPrompt);
    }
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isPromptEditable) return;
    setDraftPrompt(event.target.value);
  };

  const handleCopy = useCallback(
    (text: string | undefined | null, field: string) => {
      if (!text || typeof window === "undefined" || !navigator?.clipboard) return;
      navigator.clipboard
        .writeText(text)
        .then(() => setCopiedField(field))
        .catch(() => setCopiedField(field));
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1200);
    },
    [],
  );

  const handleDownload = useCallback(() => {
    if (output?.id && onDownloadReference) {
      onDownloadReference(output.id);
      return;
    }
    if (!output?.previewUrl || typeof window === "undefined") return;
    const link = document.createElement("a");
    link.href = output.previewUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.download = filename || "media";
    link.click();
  }, [filename, onDownloadReference, output?.id, output?.previewUrl]);

  const handleRequestDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!output?.id) return;
    onDeleteOutput(output.id);
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  if (!output) return null;

  const metaItems = [
    { label: "Type", value: mediaType },
    { label: "Aspect ratio", value: output.aspect },
    { label: "Model", value: output.modelId ?? output.model },
  ].filter((item) => item.value);

  return (
    <div className="reference-modal-backdrop" onClick={onClose}>
      {/* Background blurred reflect */}
      {output.previewUrl && (
        <div
          className="reference-modal-bg-reflect"
          style={{ backgroundImage: `url(${output.previewUrl})` }}
        />
      )}

      <div
        className={`reference-modal-new ${isPromptOnly ? "is-prompt-only" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Reference details"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Floating Top Bar (Controls) */}
        {!isPromptOnly && (
          <div className="art-modal-top-controls">
            <div className="art-modal-meta-pill">
              <span className="art-meta-item">{mediaType}</span>
              {output.aspect && <span className="art-meta-divider">/</span>}
              {output.aspect && <span className="art-meta-item">{output.aspect}</span>}
              {(output.model || output.modelId) && <span className="art-meta-divider">/</span>}
              <span className="art-meta-item truncate-model">{output.model ?? output.modelId}</span>
            </div>

            <div className="art-modal-action-row">
              {output.previewUrl && (
                <button type="button" className="art-action-btn" onClick={handleDownload} title="Download">
                  Download
                </button>
              )}
              <button type="button" className="art-action-btn art-action-btn-danger" onClick={handleRequestDelete}>
                <TrashSimple size={16} weight="bold" aria-hidden />
                Delete
              </button>
              <button
                type="button"
                className="art-action-btn"
                onClick={() => handleCopy(draftPrompt || output.prompt, "prompt")}
              >
                {copiedField === "prompt" ? "Copied!" : "Copy Prompt"}
              </button>
              <PromptLibraryButton
                tone="save"
                label="Save prompt"
                icon={<FloppyDisk size={16} weight="regular" aria-hidden />}
                onClick={handleSavePrompt}
                disabled={!canSave}
                className="prompt-save-modal-btn"
              />
              <button type="button" className="art-close-btn" onClick={onClose}>
                ×
              </button>
            </div>
          </div>
        )}

        {isPromptOnly && (
          <div className="art-prompt-only-header">
            <span className="reference-filename">Prompt</span>
            <div className="art-modal-action-row">
              <button type="button" className="art-action-btn art-action-btn-danger" onClick={handleRequestDelete}>
                <TrashSimple size={16} weight="bold" aria-hidden />
                Delete
              </button>
              <button type="button" className="art-close-btn" onClick={onClose}>×</button>
            </div>
          </div>
        )}

        <div className="art-modal-main-content">
          {isPromptOnly ? (
            <div className="art-prompt-only-container">
              <textarea
                className="art-prompt-textarea large"
                ref={promptOnlyTextareaRef}
                value={draftPrompt}
                onChange={handlePromptChange}
                readOnly={!isPromptEditable}
                rows={12}
                placeholder="Describe your adjustments..."
              />
              <div className="art-modal-footer">
                <button
                  type="button"
                  className="primary-btn wide"
                  onClick={handleSavePrompt}
                  disabled={!canSave || !isPromptEditable}
                >
                  Save & Apply Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="art-image-vessel">
                {output.previewUrl ? (
                  <img className="art-hero-image" src={output.previewUrl} alt={output.prompt} />
                ) : (
                  <div className="art-text-placeholder">
                    <p>{output.previewText ?? output.prompt}</p>
                  </div>
                )}
              </div>

              {/* Floating Prompt Blade */}
              <div className="art-prompt-blade">
                <div className="art-blade-inner">
                  <div className="art-blade-header">
                    <span className="art-label">PROMPT</span>
                    {canSave && (
                      <button type="button" className="art-mini-save" onClick={handleSavePrompt}>
                        Update
                      </button>
                    )}
                  </div>
                  <textarea
                    className="art-blade-textarea"
                    ref={promptTextareaRef}
                    value={draftPrompt}
                    onChange={handlePromptChange}
                    readOnly={!isPromptEditable}
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {isDeleteConfirmOpen ? (
        <div className="art-confirm-backdrop" onClick={handleCancelDelete}>
          <div className="art-confirm-card" onClick={(event) => event.stopPropagation()}>
            <p className="art-confirm-title">Delete this reference?</p>
            <p className="art-confirm-copy">Are you sure you want to delete this? Yes or no?</p>
            <div className="art-confirm-actions">
              <button type="button" className="art-action-btn" onClick={handleCancelDelete}>
                No
              </button>
              <button type="button" className="art-action-btn art-action-btn-danger" onClick={handleConfirmDelete}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
