/**
 * Detail modal for reference items (prompt/image/video).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrashSimple } from "phosphor-react";
import { StudioOutput } from "../types";
import { isVideoUrl, resolveModelLabel } from "../logic/stateParsers";
import { resolveReferenceCardUrls } from "../logic/referenceGridMedia";
import { logAdaptiveDetailFullQualityUsed } from "../../../lib/adaptive-media";

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
  const promptLibrarySavedTimerRef = useRef<number | null>(null);
  const [deleteConfirmOutputId, setDeleteConfirmOutputId] = useState<string | null>(null);
  const [draftPromptsById, setDraftPromptsById] = useState<Record<string, string>>({});
  const [promptOnlySavedOutputId, setPromptOnlySavedOutputId] = useState<string | null>(null);
  const [promptLibrarySavedOutputId, setPromptLibrarySavedOutputId] = useState<string | null>(null);
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
  const [previewCandidateByOutput, setPreviewCandidateByOutput] = useState<{
    outputId: string;
    index: number;
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

  const outputId = output?.id ?? null;
  const preferredDetailMediaUrl = useMemo(() => {
    if (!output) return null;
    const resolved = resolveReferenceCardUrls(
      {
        previewStoragePath: output.previewStoragePath,
        fullStoragePath: output.fullStoragePath,
        previewUrl: output.previewUrl,
        resultUrls: output.resultUrls,
      },
      {
        strictPreviewLadder: true,
        adaptivePreviewQuality: false,
        surface: "detail-modal",
      }
    );
    return resolved.fullUrl ?? resolved.previewUrl ?? null;
  }, [output]);

  useEffect(() => {
    if (!output || !preferredDetailMediaUrl) return;
    logAdaptiveDetailFullQualityUsed({
      surface: "detail-modal",
      mediaKind: output.mode === "video" ? "video" : "image",
    });
  }, [output, preferredDetailMediaUrl]);
  const previewCandidates = useMemo(() => {
    const uniqueUrls = new Set<string>();
    const maybeUrls = [preferredDetailMediaUrl, output?.previewUrl, ...(output?.resultUrls ?? [])];
    maybeUrls.forEach((url) => {
      const trimmed = url?.trim();
      if (!trimmed) return;
      uniqueUrls.add(trimmed);
    });
    return Array.from(uniqueUrls);
  }, [output?.previewUrl, output?.resultUrls, preferredDetailMediaUrl]);
  const activePreviewCandidateIndex =
    previewCandidateByOutput && outputId && previewCandidateByOutput.outputId === outputId
      ? Math.min(previewCandidateByOutput.index, Math.max(0, previewCandidates.length - 1))
      : 0;
  const displayPreviewUrl =
    previewCandidates.length > 0 ? (previewCandidates[activePreviewCandidateIndex] ?? null) : null;
  const isVideoOutput = Boolean(
    output?.mode === "video" ||
    (output?.mode !== "image" && displayPreviewUrl && isVideoUrl(displayPreviewUrl))
  );
  const isImageOutput = Boolean(displayPreviewUrl) && !isVideoOutput;
  const mediaType = displayPreviewUrl ? (isVideoOutput ? "Video" : "Image") : "Prompt";
  const isPromptOnly = output?.mode === "text" && !displayPreviewUrl;
  const characterContext = output?.characterContext;
  const hasCharacterContext = Boolean(characterContext?.applied);
  const characterName =
    characterContext?.characterName?.trim() ||
    characterContext?.characterId?.trim() ||
    "Selected Character";
  const styleContext = output?.styleContext;
  const hasStyleContext = Boolean(styleContext?.applied);
  const styleName =
    styleContext?.styleName?.trim() ||
    styleContext?.styleId?.trim() ||
    styleContext?.stylePrompt?.trim() ||
    "Selected Style";
  const characterInitials = useMemo(() => {
    const trimmed = characterName.trim();
    if (!trimmed) return "PC";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }, [characterName]);
  const styleInitials = useMemo(() => {
    const trimmed = styleName.trim();
    if (!trimmed) return "ST";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }, [styleName]);
  const isUploadedReference = useMemo(() => {
    if (!displayPreviewUrl) return false;
    if (output?.id?.startsWith("upload-")) return true;
    if (output?.timestamp === "Dropped") return true;
    return false;
  }, [displayPreviewUrl, output?.id, output?.timestamp]);
  const isNonGeneratedLoadedMedia = useMemo(() => {
    if (!displayPreviewUrl || !output) return false;
    if (output.id.startsWith("library-")) return true;
    if (output.mediaSource) {
      return output.mediaSource !== "generated";
    }
    if (output.id.startsWith("upload-")) return true;
    if (output.id.startsWith("media-paste-")) return true;
    if (output.timestamp === "Dropped" || output.timestamp === "Library") return true;
    if (output.timestamp === "Clipboard") return true;
    return false;
  }, [displayPreviewUrl, output]);
  const aspectStyle =
    output?.aspect && output.aspect.includes(":")
      ? { aspectRatio: output.aspect.replace(":", " / ") }
      : undefined;
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
  const isPromptLibrarySaved = Boolean(outputId && promptLibrarySavedOutputId === outputId);

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

  const tryAdvancePreviewCandidate = useCallback(() => {
    if (!outputId) return false;
    const nextIndex = activePreviewCandidateIndex + 1;
    if (nextIndex >= previewCandidates.length) return false;
    setPreviewCandidateByOutput({ outputId, index: nextIndex });
    return true;
  }, [activePreviewCandidateIndex, outputId, previewCandidates.length]);

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

  const clearPromptLibrarySavedTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (promptLibrarySavedTimerRef.current == null) return;
    window.clearTimeout(promptLibrarySavedTimerRef.current);
    promptLibrarySavedTimerRef.current = null;
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
      clearPromptLibrarySavedTimer();
    };
  }, [clearPromptLibrarySavedTimer, clearPromptOnlyCloseTimer]);

  const handleCloseModal = useCallback(() => {
    clearPromptOnlyCloseTimer();
    clearPromptLibrarySavedTimer();
    setPromptOnlySavedOutputId(null);
    setPromptLibrarySavedOutputId(null);
    setDeleteConfirmOutputId(null);
    setImageZoomScaleByOutput(null);
    setImagePanByOutput(null);
    setImagePanningByOutput(null);
    setLoadedImageNaturalSize(null);
    setPreviewCandidateByOutput(null);
    imagePanDragRef.current = null;
    onClose();
  }, [clearPromptLibrarySavedTimer, clearPromptOnlyCloseTimer, onClose]);

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
    if (!displayPreviewUrl) return null;
    try {
      const parsed = new URL(displayPreviewUrl);
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
  const displayModelLabel = useMemo(() => {
    if (isUploadedReference) return null;
    const modelLabelFromId = output?.modelId ? resolveModelLabel(output.modelId) : null;
    if (hasCharacterContext) {
      return modelLabelFromId ?? output?.model ?? output?.modelId ?? null;
    }
    return output?.model ?? modelLabelFromId ?? output?.modelId ?? null;
  }, [hasCharacterContext, isUploadedReference, output?.model, output?.modelId]);

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

  const handleSavePromptToLibrary = () => {
    if (!trimmedPrompt || !onSavePrompt) return;
    onSavePrompt(draftPrompt);
    if (!outputId) return;
    setPromptLibrarySavedOutputId(outputId);
    if (typeof window === "undefined") return;
    clearPromptLibrarySavedTimer();
    promptLibrarySavedTimerRef.current = window.setTimeout(() => {
      setPromptLibrarySavedOutputId((current) => (current === outputId ? null : current));
      promptLibrarySavedTimerRef.current = null;
    }, 1400);
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
    setPromptLibrarySavedOutputId(null);
    clearPromptLibrarySavedTimer();
    setDraftPromptsById((prev) => ({
      ...prev,
      [outputId]: nextValue,
    }));
  };

  const handleDownload = () => {
    if (output?.id && onDownloadReference) {
      onDownloadReference(output.id);
      return;
    }
    if (!displayPreviewUrl || typeof window === "undefined") return;
    const link = document.createElement("a");
    link.href = displayPreviewUrl;
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
      if (
        outputAspectRatio &&
        previewCandidates.length > 1 &&
        Math.abs(naturalWidth / naturalHeight - outputAspectRatio) > 0.1 &&
        tryAdvancePreviewCandidate()
      ) {
        return;
      }
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
      outputAspectRatio,
      previewCandidates.length,
      setImagePanForOutput,
      setImageZoomScaleForOutput,
      setIsImagePanningForOutput,
      tryAdvancePreviewCandidate,
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
      if (event.nativeEvent.cancelable) {
        event.preventDefault();
      }

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
      if (imageZoomScale <= 1) return;
      const rect = event.currentTarget.getBoundingClientRect();
      applyZoomAtPoint(event.currentTarget, event.clientX - rect.left, event.clientY - rect.top, 1);
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
      {displayPreviewUrl && (
        <div
          className="reference-modal-bg-reflect"
          style={{ backgroundImage: `url(${displayPreviewUrl})` }}
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
              {!isNonGeneratedLoadedMedia && output.aspect && (
                <span className="art-meta-divider">/</span>
              )}
              {!isNonGeneratedLoadedMedia && output.aspect && (
                <span className="art-meta-item">{output.aspect}</span>
              )}
              {!isNonGeneratedLoadedMedia && uploadedHeaderFilename && (
                <span className="art-meta-divider">/</span>
              )}
              {!isNonGeneratedLoadedMedia && uploadedHeaderFilename && (
                <span className="art-meta-item art-meta-filename" title={uploadedHeaderFilename}>
                  {uploadedHeaderFilename}
                </span>
              )}
              {!isNonGeneratedLoadedMedia && !isUploadedReference && displayModelLabel && (
                <span className="art-meta-divider">/</span>
              )}
              {!isNonGeneratedLoadedMedia && !isUploadedReference && (
                <span className="art-meta-item truncate-model">{displayModelLabel}</span>
              )}
            </div>

            <div className="art-modal-action-row">
              {displayPreviewUrl && (
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
              {onSavePrompt ? (
                <button
                  type="button"
                  className={`art-action-btn prompt-save-modal-btn ${isPromptLibrarySaved ? "is-saved" : ""}`}
                  onClick={handleSavePromptToLibrary}
                  disabled={!trimmedPrompt || isPromptLibrarySaved}
                >
                  {isPromptLibrarySaved ? "Saved" : "Save Prompt"}
                </button>
              ) : null}
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
                {displayPreviewUrl ? (
                  isVideoOutput ? (
                    <video
                      className="art-hero-image"
                      src={displayPreviewUrl}
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
                        src={displayPreviewUrl}
                        alt={output.prompt}
                        style={imageStyle}
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        onLoad={handleImageLoad}
                        onError={() => {
                          void tryAdvancePreviewCandidate();
                        }}
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
                  {hasCharacterContext ? (
                    <div className="art-character-chip" aria-label="Character used for generation">
                      {characterContext?.characterProfileImageUrl ? (
                        // Character profile URLs can be signed/external and are not guaranteed to be allowlisted.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="art-character-chip-avatar"
                          src={characterContext.characterProfileImageUrl}
                          alt={`${characterName} profile`}
                        />
                      ) : (
                        <span className="art-character-chip-avatar art-character-chip-avatar--fallback">
                          {characterInitials}
                        </span>
                      )}
                      <div className="art-character-chip-copy">
                        <span className="art-character-chip-label">Character</span>
                        <span className="art-character-chip-name">{characterName}</span>
                      </div>
                    </div>
                  ) : null}
                  {hasStyleContext ? (
                    <div className="art-character-chip" aria-label="Style used for generation">
                      <span className="art-character-chip-avatar art-character-chip-avatar--fallback art-character-chip-avatar--style">
                        {styleInitials}
                      </span>
                      <div className="art-character-chip-copy">
                        <span className="art-character-chip-label">Style</span>
                        <span className="art-character-chip-name">{styleName}</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="art-blade-header">
                    <span className="art-label">PROMPT</span>
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
