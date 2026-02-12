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
  const imageVesselRef = useRef<HTMLDivElement | null>(null);
  const imagePanDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOnlyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOnlyCloseTimerRef = useRef<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteConfirmOutputId, setDeleteConfirmOutputId] = useState<string | null>(null);
  const [draftPromptsById, setDraftPromptsById] = useState<Record<string, string>>({});
  const [promptOnlySavedOutputId, setPromptOnlySavedOutputId] = useState<string | null>(null);
  const [loadedPreviewAspect, setLoadedPreviewAspect] = useState<{
    outputId: string;
    ratio: number;
  } | null>(null);
  const [loadedImageNaturalSize, setLoadedImageNaturalSize] = useState<{
    outputId: string;
    width: number;
    height: number;
  } | null>(null);
  const [imageZoomScaleByOutput, setImageZoomScaleByOutput] = useState<{
    outputId: string;
    value: number;
  } | null>(null);
  const [imagePanByOutput, setImagePanByOutput] = useState<{
    outputId: string;
    x: number;
    y: number;
  } | null>(null);
  const [imagePanningByOutput, setImagePanningByOutput] = useState<{
    outputId: string;
    value: boolean;
  } | null>(null);

  const parseAspectRatio = useCallback((value?: string | null): number | null => {
    if (!value || !value.includes(":")) return null;
    const [wRaw, hRaw] = value.split(":");
    const width = Number(wRaw);
    const height = Number(hRaw);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return width / height;
  }, []);

  const isVideoOutput = Boolean(output?.previewUrl && looksLikeVideoUrl(output.previewUrl));
  const isImageOutput = Boolean(output?.previewUrl) && !isVideoOutput;
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
  const imageNaturalSize =
    loadedImageNaturalSize && outputId && loadedImageNaturalSize.outputId === outputId
      ? loadedImageNaturalSize
      : null;
  const imageZoomScale =
    imageZoomScaleByOutput && outputId && imageZoomScaleByOutput.outputId === outputId
      ? imageZoomScaleByOutput.value
      : 1;
  const imagePan =
    imagePanByOutput && outputId && imagePanByOutput.outputId === outputId
      ? { x: imagePanByOutput.x, y: imagePanByOutput.y }
      : { x: 0, y: 0 };
  const isImagePanning =
    imagePanningByOutput && outputId && imagePanningByOutput.outputId === outputId
      ? imagePanningByOutput.value
      : false;
  const outputAspectRatio = parseAspectRatio(output?.aspect);
  const previewAspectRatio =
    loadedPreviewAspect && outputId && loadedPreviewAspect.outputId === outputId
      ? loadedPreviewAspect.ratio
      : outputAspectRatio;
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
  const detailModalStyle = useMemo(() => {
    if (isPromptOnly) return undefined;
    if (!previewAspectRatio || !Number.isFinite(previewAspectRatio)) return undefined;
    return {
      "--detail-preview-aspect": String(previewAspectRatio),
    } as React.CSSProperties;
  }, [isPromptOnly, previewAspectRatio]);
  const isImageZoomed = imageZoomScale > 1.001;

  const clampImagePan = useCallback(
    (nextX: number, nextY: number, scale: number) => {
      const vessel = imageVesselRef.current;
      if (!vessel || !imageNaturalSize || scale <= 1) return { x: 0, y: 0 };

      const vesselWidth = vessel.clientWidth;
      const vesselHeight = vessel.clientHeight;
      if (vesselWidth <= 0 || vesselHeight <= 0) return { x: 0, y: 0 };

      const fitScale = Math.min(
        vesselWidth / imageNaturalSize.width,
        vesselHeight / imageNaturalSize.height
      );
      const fittedWidth = imageNaturalSize.width * fitScale;
      const fittedHeight = imageNaturalSize.height * fitScale;
      const zoomedWidth = fittedWidth * scale;
      const zoomedHeight = fittedHeight * scale;

      const maxPanX = Math.max(0, (zoomedWidth - vesselWidth) / 2);
      const maxPanY = Math.max(0, (zoomedHeight - vesselHeight) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, nextX)),
        y: Math.min(maxPanY, Math.max(-maxPanY, nextY)),
      };
    },
    [imageNaturalSize]
  );

  const setImageZoomScaleForOutput = useCallback(
    (nextScale: number) => {
      if (!outputId) return;
      setImageZoomScaleByOutput({ outputId, value: nextScale });
    },
    [outputId]
  );

  const setIsImagePanningForOutput = useCallback(
    (isPanning: boolean) => {
      if (!outputId) return;
      setImagePanningByOutput({ outputId, value: isPanning });
    },
    [outputId]
  );

  const setImagePanForOutput = useCallback(
    (
      next:
        | { x: number; y: number }
        | ((prev: { x: number; y: number }) => { x: number; y: number })
    ) => {
      if (!outputId) return;
      setImagePanByOutput((prev) => {
        const current =
          prev && prev.outputId === outputId ? { x: prev.x, y: prev.y } : { x: 0, y: 0 };
        const resolved = typeof next === "function" ? next(current) : next;
        return { outputId, x: resolved.x, y: resolved.y };
      });
    },
    [outputId]
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
    if (!isImageOutput) return;
    const handleResize = () => {
      setImagePanForOutput((prev) => {
        const clamped = clampImagePan(prev.x, prev.y, imageZoomScale);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampImagePan, imageZoomScale, isImageOutput, setImagePanForOutput]);

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

  const looksLikeFilename = (value?: string | null) => {
    const candidate = value?.trim();
    if (!candidate) return false;
    if (candidate.length > 180) return false;
    if (/^data:/i.test(candidate) || /^blob:/i.test(candidate) || /^https?:\/\//i.test(candidate)) {
      return false;
    }
    if (/[\\/]/.test(candidate)) return false;
    return /\.[a-z0-9]{2,10}$/i.test(candidate);
  };

  const filenameFromUrl = (() => {
    if (!output?.previewUrl) return null;
    try {
      const parsed = new URL(output.previewUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      const trailing = decodeURIComponent(
        parsed.pathname.split("/").filter(Boolean).pop() ?? ""
      ).trim();
      return looksLikeFilename(trailing) ? trailing : null;
    } catch {
      return null;
    }
  })();

  const outputPrompt = output?.prompt?.trim() ?? null;
  const promptFilename = looksLikeFilename(outputPrompt) ? outputPrompt : null;
  const uploadedHeaderFilename = isUploadedReference ? (promptFilename ?? filenameFromUrl) : null;
  const downloadFilename = uploadedHeaderFilename ?? filenameFromUrl ?? output?.id ?? "media";
  const normalizedFilename = uploadedHeaderFilename?.toLowerCase() ?? "";
  const normalizedDraftPrompt = draftPrompt.trim().toLowerCase();
  const isUploadedFilenamePrompt =
    isUploadedReference &&
    Boolean(normalizedFilename) &&
    normalizedDraftPrompt === normalizedFilename;
  const uploadedPromptLabel = isUploadedReference && !isVideoOutput ? "(Uploaded Image)" : null;
  const promptBladeValue = uploadedPromptLabel ?? (isUploadedFilenamePrompt ? "" : draftPrompt);

  const handleSavePrompt = () => {
    if (!trimmedPrompt) return;
    if (isPromptEditable && output?.id && hasPromptEdits) {
      onUpdatePrompt(output.id, draftPrompt);
      return;
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
    link.download = downloadFilename;
    link.click();
  };

  const handlePreviewAspectLoad = useCallback(
    (width: number, height: number) => {
      if (!outputId) return;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      setLoadedPreviewAspect({ outputId, ratio: width / height });
    },
    [outputId]
  );

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!outputId) return;
      const { naturalWidth, naturalHeight } = event.currentTarget;
      handlePreviewAspectLoad(naturalWidth, naturalHeight);
      setLoadedImageNaturalSize({
        outputId,
        width: naturalWidth,
        height: naturalHeight,
      });
      setImageZoomScaleForOutput(1);
      setImagePanForOutput({ x: 0, y: 0 });
      setIsImagePanningForOutput(false);
      imagePanDragRef.current = null;
    },
    [
      handlePreviewAspectLoad,
      outputId,
      setImagePanForOutput,
      setImageZoomScaleForOutput,
      setIsImagePanningForOutput,
    ]
  );

  const applyZoomAtPoint = useCallback(
    (container: HTMLDivElement, cursorX: number, cursorY: number, nextScale: number) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const focalX = (cursorX - centerX - imagePan.x) / imageZoomScale;
      const focalY = (cursorY - centerY - imagePan.y) / imageZoomScale;
      const nextPanX = cursorX - centerX - focalX * nextScale;
      const nextPanY = cursorY - centerY - focalY * nextScale;
      const clamped = clampImagePan(nextPanX, nextPanY, nextScale);
      setImageZoomScaleForOutput(nextScale);
      setImagePanForOutput(clamped);
      if (nextScale <= 1) {
        setIsImagePanningForOutput(false);
        imagePanDragRef.current = null;
      }
    },
    [
      clampImagePan,
      imagePan.x,
      imagePan.y,
      imageZoomScale,
      setImagePanForOutput,
      setImageZoomScaleForOutput,
      setIsImagePanningForOutput,
    ]
  );

  const handleImageWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isImageOutput) return;
      event.preventDefault();

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(6, Math.max(1, imageZoomScale * zoomFactor));
      if (Math.abs(nextScale - imageZoomScale) < 0.0001) return;

      const rect = event.currentTarget.getBoundingClientRect();
      applyZoomAtPoint(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
        nextScale
      );
    },
    [applyZoomAtPoint, imageZoomScale, isImageOutput]
  );

  const handleImageDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isImageOutput) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const targetScale = imageZoomScale > 1 ? 1 : 2;
      applyZoomAtPoint(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
        targetScale
      );
    },
    [applyZoomAtPoint, imageZoomScale, isImageOutput]
  );

  const handleImagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isImageOutput || imageZoomScale <= 1) return;
      if (event.button !== 0) return;
      imagePanDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: imagePan.x,
        startPanY: imagePan.y,
      };
      setIsImagePanningForOutput(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [imagePan.x, imagePan.y, imageZoomScale, isImageOutput, setIsImagePanningForOutput]
  );

  const handleImagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = imagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const clamped = clampImagePan(
        dragState.startPanX + deltaX,
        dragState.startPanY + deltaY,
        imageZoomScale
      );
      setImagePanForOutput(clamped);
    },
    [clampImagePan, imageZoomScale, setImagePanForOutput]
  );

  const handleImagePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = imagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      imagePanDragRef.current = null;
      setIsImagePanningForOutput(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [setIsImagePanningForOutput]
  );

  const imageVesselClassName = [
    "art-image-vessel",
    isImageOutput ? "is-zoomable" : "",
    isImageZoomed ? "is-zoomed" : "",
    isImagePanning ? "is-panning" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const imageStyle = isImageOutput
    ? ({
        transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoomScale})`,
        transition: isImagePanning ? "none" : "transform 0.1s ease-out",
      } as React.CSSProperties)
    : undefined;

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
        style={detailModalStyle}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Floating Top Bar (Controls) */}
        {!isPromptOnly && (
          <div className="art-modal-top-controls">
            <div className="art-modal-meta-pill">
              <span className="art-meta-item">{mediaType}</span>
              {output.aspect && <span className="art-meta-divider">/</span>}
              {output.aspect && <span className="art-meta-item">{output.aspect}</span>}
              {uploadedHeaderFilename && <span className="art-meta-divider">/</span>}
              {uploadedHeaderFilename && (
                <span className="art-meta-item art-meta-filename" title={uploadedHeaderFilename}>
                  {uploadedHeaderFilename}
                </span>
              )}
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
              <div
                ref={imageVesselRef}
                className={imageVesselClassName}
                onWheel={isImageOutput ? handleImageWheel : undefined}
                onDoubleClick={isImageOutput ? handleImageDoubleClick : undefined}
                onPointerDown={isImageOutput ? handleImagePointerDown : undefined}
                onPointerMove={isImageOutput ? handleImagePointerMove : undefined}
                onPointerUp={isImageOutput ? handleImagePointerUp : undefined}
                onPointerCancel={isImageOutput ? handleImagePointerUp : undefined}
              >
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
                      onLoadedMetadata={(event) => {
                        handlePreviewAspectLoad(
                          event.currentTarget.videoWidth,
                          event.currentTarget.videoHeight
                        );
                      }}
                    />
                  ) : (
                    <>
                      {/* Generated media URL can be provider-specific and not allowlisted. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="art-hero-image"
                        src={output.previewUrl}
                        alt={output.prompt}
                        style={imageStyle}
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        onLoad={handleImageLoad}
                      />
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
                    value={promptBladeValue}
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
