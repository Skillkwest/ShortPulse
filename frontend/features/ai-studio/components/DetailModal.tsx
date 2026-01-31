/**
 * Detail modal for reference items (prompt/image/video).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOnlyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const mediaType = output?.mode === "image" ? "Image" : output?.mode === "video" ? "Video" : "Prompt";
  const isPromptOnly = output?.mode === "enhance";
  const aspectStyle =
    output?.aspect && output.aspect.includes(":")
      ? { aspectRatio: output.aspect.replace(":", " / ") }
      : undefined;
  const [draftPrompt, setDraftPrompt] = useState(output?.prompt ?? "");
  useEffect(() => {
    setDraftPrompt(output?.prompt ?? "");
  }, [output?.prompt, output?.id]);

  const canSave = useMemo(
    () => draftPrompt.trim().length > 0 && draftPrompt.trim() !== (output?.prompt ?? "").trim(),
    [draftPrompt, output?.prompt],
  );

  const isPromptEditable = Boolean(isPromptOnly);

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
    if (!isPromptEditable || !output?.id || !draftPrompt.trim()) return;
    onUpdatePrompt(output.id, draftPrompt);
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
    if (!output?.previewUrl || typeof window === "undefined") return;
    const link = document.createElement("a");
    link.href = output.previewUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.download = filename || "media";
    link.click();
  }, [filename, output?.previewUrl]);

  if (!output) return null;

  const metaItems = [
    { label: "Type", value: mediaType },
    { label: "Aspect ratio", value: output.aspect },
    { label: "Model", value: output.modelId ?? output.model },
  ].filter((item) => item.value);

  return (
    <div className="reference-modal-backdrop" onClick={onClose}>
      <div
        className={`reference-modal ${isPromptOnly ? "prompt-only" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Reference details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reference-modal-topbar">
          <div>
            <p className="reference-filename">{isPromptOnly ? "Prompt" : "Media preview"}</p>
            {isPromptOnly ? (
              <span className="reference-subtitle tiny helper-text">Edit and save back to your references.</span>
            ) : null}
          </div>
          <div className="reference-topbar-actions">
            {!isPromptOnly && output.previewUrl ? (
              <button type="button" className="reference-icon-btn" onClick={handleDownload}>
                Download
              </button>
            ) : null}
            {!isPromptOnly ? (
              <button
                type="button"
                className="reference-icon-btn"
                onClick={() => handleCopy(draftPrompt || output.prompt, "prompt")}
                disabled={!draftPrompt && !output.prompt}
              >
                {copiedField === "prompt" ? "Copied" : "Copy prompt"}
              </button>
            ) : null}
            {!isPromptOnly && output.model ? (
              <button type="button" className="reference-icon-btn" onClick={() => handleCopy(output.model, "model")}>
                {copiedField === "model" ? "Copied" : "Copy model"}
              </button>
            ) : null}
            <button type="button" className="reference-modal-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className={`reference-modal-body ${isPromptOnly ? "prompt-only" : ""}`}>
          {isPromptOnly ? (
            <div className="prompt-only-body">
              <textarea
                className="prompt-only-textarea"
                ref={promptOnlyTextareaRef}
                data-min-height="220"
                data-max-height="620"
                value={draftPrompt}
                onChange={handlePromptChange}
                readOnly={!isPromptEditable}
                aria-readonly={!isPromptEditable}
                rows={8}
              />
              <div className="reference-modal-actions prompt-only-actions">
                <button type="button" className="ghost-btn" onClick={handleSavePrompt} disabled={!canSave || !isPromptEditable}>
                  Save changes
                </button>
                <button type="button" className="primary-btn">Save to Media Library</button>
              </div>
            </div>
          ) : (
            <>
              {output.previewUrl ? (
                <div className="reference-modal-media" style={aspectStyle}>
                  <img className="reference-modal-media-image" src={output.previewUrl} alt={output.prompt} />
                </div>
              ) : (
                <div className="reference-modal-media text-only">
                  <p className="reference-modal-prompt">{output.previewText ?? output.prompt}</p>
                </div>
              )}
              <div className="reference-meta-panel">
                <div className="reference-meta-grid">
                  {metaItems.map((item) => (
                    <div key={item.label} className="reference-meta-card">
                      <span className="reference-detail-label">{item.label}</span>
                      <span className="reference-detail-value mono">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="reference-prompt-card">
                  <div className="reference-card-head">
                    <span className="reference-detail-label">Prompt</span>
                    <div className="reference-card-actions">
                      <button
                        type="button"
                        className="reference-icon-btn"
                        onClick={() => handleCopy(draftPrompt || output.prompt, "prompt")}
                        disabled={!draftPrompt && !output.prompt}
                      >
                        {copiedField === "prompt" ? "Copied" : "Copy prompt"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="reference-detail-value prompt-block editable"
                    ref={promptTextareaRef}
                    data-min-height="200"
                    data-max-height="420"
                    value={draftPrompt}
                    onChange={handlePromptChange}
                    readOnly={!isPromptEditable}
                    aria-readonly={!isPromptEditable}
                    rows={6}
                  />
                </div>
                <div className="reference-modal-actions floating">
                  <button type="button" className="ghost-btn" onClick={handleSavePrompt} disabled={!canSave || !isPromptEditable}>
                    Save changes
                  </button>
                  <button type="button" className="primary-btn">Save to Media Library</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
