/**
 * Detail modal for reference items (prompt/image/video).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloppyDisk, TrashSimple } from "phosphor-react";
import { StudioOutput } from "../types";
import { PromptLibraryButton } from "./PromptLibraryButton";
import { looksLikeVideoUrl } from "../utils/dragDrop";

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
  const promptOnlyCloseTimerRef = useRef<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteConfirmOutputId, setDeleteConfirmOutputId] = useState<string | null>(null);
  const [draftPromptsById, setDraftPromptsById] = useState<Record<string, string>>({});
  const [promptOnlySavedOutputId, setPromptOnlySavedOutputId] = useState<string | null>(null);

  const isVideoOutput = Boolean(output?.previewUrl && looksLikeVideoUrl(output.previewUrl));
  const mediaType = output?.previewUrl ? (isVideoOutput ? "Video" : "Image") : "Prompt";
  const isPromptOnly = output?.mode === "text" && !output.previewUrl;
  const isUploadedReference = useMemo(() => {
    if (!output?.previewUrl) return false;
    if (output?.id?.startsWith("upload-")) return true;
    if (output?.timestamp === "Dropped") return true;
    return false;
  }, [output?.id, output?.previewUrl, output?.timestamp]);
  const aspectStyle =
    output?.aspect && output.aspect.includes(":")
      ? { aspectRatio: output.aspect.replace(":", " / ") }
      : undefined;
  const outputId = output?.id ?? null;
  const draftPrompt =
    outputId && output
      ? (draftPromptsById[outputId] ?? output.prompt ?? "")
      : (output?.prompt ?? "");
  const isDeleteConfirmOpen = Boolean(outputId && deleteConfirmOutputId === outputId);
  const isPromptOnlySaved = Boolean(outputId && promptOnlySavedOutputId === outputId);

  const isPromptEditable = Boolean(isPromptOnly);
  const trimmedPrompt = draftPrompt.trim();
  const hasPromptEdits = trimmedPrompt !== (output?.prompt ?? "").trim();
  const canSave = useMemo(
    () => Boolean(trimmedPrompt) && (Boolean(onSavePrompt) || (isPromptEditable && hasPromptEdits)),
    [hasPromptEdits, isPromptEditable, onSavePrompt, trimmedPrompt]
  );

  const syncTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const minHeight = Number(element.dataset.minHeight || 180);
    const maxHeight = Number(element.dataset.maxHeight || 420);
    element.style.height = "auto";
    const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    element.style.height = `${nextHeight}px`;
  }, []);

  const clearPromptOnlyCloseTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (promptOnlyCloseTimerRef.current == null) return;
    window.clearTimeout(promptOnlyCloseTimerRef.current);
    promptOnlyCloseTimerRef.current = null;
  }, []);

  useEffect(() => {
    syncTextareaHeight(promptTextareaRef.current);
    syncTextareaHeight(promptOnlyTextareaRef.current);
  }, [draftPrompt, syncTextareaHeight]);

  useEffect(() => {
    return () => {
      clearPromptOnlyCloseTimer();
    };
  }, [clearPromptOnlyCloseTimer]);

  const handleCloseModal = useCallback(() => {
    clearPromptOnlyCloseTimer();
    setPromptOnlySavedOutputId(null);
    setDeleteConfirmOutputId(null);
    onClose();
  }, [clearPromptOnlyCloseTimer, onClose]);

  const filename = (() => {
    if (!output?.previewUrl) return output?.id;
    try {
      const parsed = new URL(output.previewUrl);
      const trailing = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
      return trailing || output?.id;
    } catch {
      return output?.id;
    }
  })();

  const handleSavePrompt = () => {
    if (!trimmedPrompt) return;
    if (isPromptEditable && output?.id && hasPromptEdits) {
      onUpdatePrompt(output.id, draftPrompt);
    }
    if (onSavePrompt) {
      onSavePrompt(draftPrompt);
    }
  };

  const handlePromptOnlySaveAndClose = () => {
    if (!canSave || !isPromptEditable || isPromptOnlySaved) return;

    handleSavePrompt();
    if (outputId) {
      setPromptOnlySavedOutputId(outputId);
    }

    if (typeof window === "undefined") {
      handleCloseModal();
      return;
    }

    clearPromptOnlyCloseTimer();
    promptOnlyCloseTimerRef.current = window.setTimeout(() => {
      handleCloseModal();
    }, 900);
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isPromptEditable || !outputId) return;
    const nextValue = event.target.value;
    setPromptOnlySavedOutputId(null);
    setDraftPromptsById((prev) => ({
      ...prev,
      [outputId]: nextValue,
    }));
  };

  const handleCopy = useCallback((text: string | undefined | null, field: string) => {
    if (!text || typeof window === "undefined" || !navigator?.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => setCopiedField(field))
      .catch(() => setCopiedField(field));
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 1200);
  }, []);

  const handleDownload = () => {
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
  };

  const handleRequestDelete = () => {
    setDeleteConfirmOutputId(outputId);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOutputId(null);
  };

  const handleConfirmDelete = () => {
    if (!output?.id) return;
    onDeleteOutput(output.id);
    setDeleteConfirmOutputId(null);
    handleCloseModal();
  };

  if (!output) return null;

  return (
    <div className="reference-modal-backdrop" onClick={handleCloseModal}>
      {/* Background blurred reflect */}
      {output.previewUrl && (
        <div
          className="reference-modal-bg-reflect"
          style={{ backgroundImage: `url(${output.previewUrl})` }}
        />
      )}

      <div
        className={`reference-modal-new ${isPromptOnly ? "is-prompt-only" : ""} ${isUploadedReference ? "is-uploaded" : ""}`}
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
              {!isUploadedReference && (output.model || output.modelId) && (
                <span className="art-meta-divider">/</span>
              )}
              {!isUploadedReference && (
                <span className="art-meta-item truncate-model">
                  {output.model ?? output.modelId}
                </span>
              )}
            </div>

            <div className="art-modal-action-row">
              {output.previewUrl && (
                <button
                  type="button"
                  className="art-action-btn"
                  onClick={handleDownload}
                  title="Download"
                >
                  Download
                </button>
              )}
              <button
                type="button"
                className="art-action-btn art-action-btn-danger"
                onClick={handleRequestDelete}
              >
                <TrashSimple size={16} weight="bold" aria-hidden />
                Delete
              </button>
              {!isUploadedReference ? (
                <button
                  type="button"
                  className="art-action-btn"
                  onClick={() => handleCopy(draftPrompt || output.prompt, "prompt")}
                >
                  {copiedField === "prompt" ? "Copied!" : "Copy Prompt"}
                </button>
              ) : null}
              {!isUploadedReference ? (
                <PromptLibraryButton
                  tone="save"
                  label="Save prompt"
                  icon={<FloppyDisk size={16} weight="regular" aria-hidden />}
                  onClick={handleSavePrompt}
                  disabled={!canSave}
                  className="prompt-save-modal-btn"
                />
              ) : null}
              <button type="button" className="art-close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
          </div>
        )}

        {isPromptOnly && (
          <div className="art-prompt-only-header">
            <span className="reference-filename">Prompt</span>
            <div className="art-modal-action-row">
              <button
                type="button"
                className="art-action-btn art-action-btn-danger"
                onClick={handleRequestDelete}
              >
                <TrashSimple size={16} weight="bold" aria-hidden />
                Delete
              </button>
              <button type="button" className="art-close-btn" onClick={handleCloseModal}>
                ×
              </button>
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
                  className={`primary-btn wide art-prompt-save-btn ${isPromptOnlySaved ? "is-saved" : ""}`}
                  onClick={handlePromptOnlySaveAndClose}
                  disabled={!canSave || !isPromptEditable || isPromptOnlySaved}
                >
                  {isPromptOnlySaved ? "Saved. Closing..." : "Save & Apply Changes"}
                </button>
                {isPromptOnlySaved ? (
                  <p className="art-save-feedback" role="status" aria-live="polite">
                    Changes saved successfully.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="art-image-vessel">
                {output.previewUrl ? (
                  isVideoOutput ? (
                    <video
                      className="art-hero-image"
                      src={output.previewUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={aspectStyle}
                    />
                  ) : (
                    <>
                      {/* Generated media URL can be provider-specific and not allowlisted. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="art-hero-image" src={output.previewUrl} alt={output.prompt} />
                    </>
                  )
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
                    {canSave && !isUploadedReference && (
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
              <button
                type="button"
                className="art-action-btn art-action-btn-danger"
                onClick={handleConfirmDelete}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
