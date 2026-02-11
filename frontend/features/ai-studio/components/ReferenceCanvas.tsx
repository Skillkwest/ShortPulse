/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React, { useCallback, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  FloppyDisk,
  Sparkle,
  UploadSimple,
  X,
} from "phosphor-react";
import { PromptLibraryButton } from "./PromptLibraryButton";
import { StudioOutput } from "../types";
import { clearDragState, prepareReferenceDrag } from "../utils/dragDrop";
import type { ToolId } from "../types";

const isVideoUrl = (url: string) =>
  /\.mp4(\?|$)/i.test(url) || url.includes("/video") || url.includes("video=");

export type ReferenceCanvasProps = {
  outputs: StudioOutput[];
  activeOutputId: string | null;
  showHeader?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
  linkedPromptReferenceIds?: string[];
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  selectedTool: ToolId | null;
  disablePromptGenerate?: boolean;
  onDropFiles?: (files: FileList) => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onDescribeImage?: (output: StudioOutput) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  generateCostCredits?: number | null;
  describeCostCredits?: number | null;
};

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceCanvas({
  outputs,
  activeOutputId,
  showHeader = true,
  onOutputMediaLoaded,
  linkedPromptReferenceIds = [],
  onSelectOutput,
  onOpenDetails,
  selectedTool,
  disablePromptGenerate = false,
  onDropFiles,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onDescribeImage,
  onSaveToLibrary,
  onDownload,
  onGeneratePrompt,
  onDeleteOutput,
  generateCostCredits,
  describeCostCredits,
}: ReferenceCanvasProps) {
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const loadedIdsRef = React.useRef<Set<string>>(new Set());
  const linkedPromptReferenceIdSet = React.useMemo(
    () => new Set(linkedPromptReferenceIds),
    [linkedPromptReferenceIds]
  );

  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      setLoadedMap((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: true };
      });
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [onOutputMediaLoaded]
  );

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropFiles) return;
    // Ignore drops that originate from existing reference cards to avoid creating duplicates/empties.
    const internalRefId = event.dataTransfer.getData("text/reference-id");
    if (internalRefId) return;
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    const dt = new DataTransfer();
    imageFiles.forEach((file) => dt.items.add(file));
    onDropFiles(dt.files);
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  };

  const handleCardDragStart = (event: React.DragEvent<HTMLElement>, item: StudioOutput) => {
    prepareReferenceDrag(event, item, { dragImage: event.currentTarget as HTMLElement });
  };

  const handleCardDragEnd = (event: React.DragEvent<HTMLElement>) => {
    clearDragState(event);
  };

  const renderSaveChip = (item: StudioOutput, isSelected: boolean) => {
    if (!item.saveState || item.saveState === "idle") return null;
    const label =
      item.saveState === "saving"
        ? "Saving..."
        : item.saveState === "saved"
          ? "Saved"
          : "Save failed";
    if (item.saveState === "saved") {
      if (!isSelected) return null;
      return (
        <div className={`reference-save-chip is-${item.saveState}`} aria-label="Saved">
          <CheckCircle size={16} weight="fill" aria-hidden />
        </div>
      );
    }
    return (
      <div className={`reference-save-chip is-${item.saveState}`}>
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div
      className="panel ai-panel ai-preview-panel reference-canvas-panel"
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
    >
      {showHeader ? (
        <div className="panel-header preview-header">
          <div>
            <p className="eyebrow">Reference Grid</p>
          </div>
          <div className="preview-header-actions">
            <button
              type="button"
              className="ghost-btn mini preview-media-btn"
              onClick={onTriggerFileSelect}
            >
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <PromptLibraryButton
              onClick={(event) => {
                event.preventDefault();
                onOpenMediaLibrary?.();
              }}
              className="prompt-media-btn preview-media-btn"
              aria-label="Open media library"
              label="Media Library"
              icon={<CloudArrowUp size={16} weight="regular" aria-hidden />}
              tone="library"
            />
          </div>
        </div>
      ) : null}
      <div className="reference-canvas-scroll">
        <div
          className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
        >
          {outputs.length === 0 ? (
            <div className="reference-empty">
              <p className="preview-title">Upload or generate to see your references here.</p>
              <p className="subdued tiny helper-text">
                New text prompts, images, and videos will appear in this grid.
              </p>
            </div>
          ) : (
            outputs.map((item) => {
              const isFailing = item.taskState === "fail";
              const isLoading =
                !isFailing &&
                (item.taskState === "running" ||
                  item.taskState === "pending" ||
                  (item.taskState === "success" && !item.previewUrl && !item.previewText));
              const isLoaded = loadedMap[item.id];
              const showSpinner = !isFailing && (isLoading || (!isLoaded && !item.previewText));

              const isVideoPreview = item.previewUrl ? isVideoUrl(item.previewUrl) : false;
              const isImagePreview = item.previewUrl ? !isVideoPreview : false;
              const isPromptOnly = !item.previewUrl && !!item.previewText;
              const isLinkedPromptReference =
                isPromptOnly && linkedPromptReferenceIdSet.has(item.id);
              const saveDisabled = item.saveState === "saving";
              const saveLabel =
                item.saveState === "failed" ? "Retry save" : "Save to media library";
              const saveIcon =
                item.saveState === "failed" ? (
                  <ArrowClockwise size={16} weight="bold" aria-hidden />
                ) : (
                  <FloppyDisk size={16} weight="bold" aria-hidden />
                );
              return (
                <div
                  key={item.id}
                  className={`reference-card ${item.previewUrl ? "has-preview" : ""} ${isVideoPreview ? "has-video" : ""} ${item.previewText ? "has-text" : ""} ${activeOutputId === item.id ? "is-active" : ""} ${showSpinner ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
                  role="button"
                  aria-busy={showSpinner}
                  data-loading={showSpinner ? "true" : "false"}
                  tabIndex={0}
                  onClick={() => onSelectOutput(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectOutput(item.id);
                    }
                  }}
                  onDoubleClick={() => onOpenDetails(item.id)}
                  draggable={!!item.previewUrl || !!item.previewText}
                  onDragStart={(event) => {
                    handleCardDragStart(event, item);
                  }}
                  onDragEnd={handleCardDragEnd}
                >
                  {isVideoPreview && item.previewUrl ? (
                    <video
                      className="reference-card-video"
                      src={item.previewUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      onLoadedData={() => markLoaded(item.id)}
                    />
                  ) : null}
                  {isImagePreview && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="reference-card-image"
                      loading="lazy"
                      decoding="async"
                      onLoad={() => markLoaded(item.id)}
                      onError={() => markLoaded(item.id, { notifyAutoSave: false })}
                    />
                  ) : null}
                  {isFailing ? (
                    <div className="reference-fail-overlay">
                      <div className="fail-icon" aria-hidden="true">
                        !
                      </div>
                      <div className="fail-title">Generation failed</div>
                      {item.errorMessageShort ? (
                        <div className="fail-subtitle">
                          {item.errorMessageShort.replace(/fal(\.ai)?/gi, "the provider")}
                        </div>
                      ) : item.errorMessage ? (
                        <div className="fail-subtitle">
                          {item.errorMessage.replace(/fal(\.ai)?/gi, "the provider")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {showSpinner ? (
                    <div className="reference-loading">
                      <div className="reference-spinner" />
                    </div>
                  ) : null}
                  {isLinkedPromptReference ? (
                    <span className="reference-card-link-dot" aria-hidden="true" />
                  ) : null}
                  {renderSaveChip(item, activeOutputId === item.id)}
                  {/* Show delete button for error cards when selected */}
                  {isFailing && onDeleteOutput && activeOutputId === item.id ? (
                    <div className="reference-card-actions" aria-label="Reference actions">
                      <button
                        type="button"
                        className="reference-card-action-btn reference-card-action-btn--danger"
                        aria-label="Remove error from grid"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteOutput(item.id);
                        }}
                      >
                        <X size={16} weight="bold" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                  {(onSaveToLibrary && (isImagePreview || isPromptOnly || isVideoPreview)) ||
                  (onDownload && (isImagePreview || isVideoPreview)) ? (
                    <div className="reference-card-actions" aria-label="Reference actions">
                      {onSaveToLibrary ? (
                        <button
                          type="button"
                          className="reference-card-action-btn"
                          aria-label={saveLabel}
                          disabled={saveDisabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectOutput(item.id);
                            onSaveToLibrary(item);
                          }}
                        >
                          {saveIcon}
                        </button>
                      ) : null}
                      {onDownload && (isImagePreview || isVideoPreview) ? (
                        <button
                          type="button"
                          className="reference-card-action-btn"
                          aria-label="Download reference"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectOutput(item.id);
                            onDownload(item);
                          }}
                        >
                          <DownloadSimple size={16} weight="bold" aria-hidden />
                        </button>
                      ) : null}
                      {onDeleteOutput ? (
                        <button
                          type="button"
                          className="reference-card-action-btn reference-card-action-btn--danger"
                          aria-label="Remove reference from grid"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteOutput(item.id);
                          }}
                        >
                          <X size={16} weight="bold" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {item.previewText ? (
                    <div className="reference-card-text">{item.previewText}</div>
                  ) : null}
                  {isImagePreview && onDescribeImage ? (
                    <button
                      type="button"
                      className="reference-describe-pill"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectOutput(item.id);
                        onDescribeImage(item);
                      }}
                    >
                      <span className="reference-pill-label">
                        <Sparkle size={14} weight="fill" aria-hidden />
                        <span>Describe</span>
                        {typeof describeCostCredits === "number" ? (
                          <span className="reference-pill-cost">+{describeCostCredits}</span>
                        ) : null}
                      </span>
                    </button>
                  ) : null}
                  {isPromptOnly &&
                  onGeneratePrompt &&
                  activeOutputId === item.id &&
                  !disablePromptGenerate ? (
                    <button
                      type="button"
                      className="reference-generate-pill agent-generate-prefab"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectOutput(item.id);
                        onGeneratePrompt(item);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <span className="agent-generate-label">Generate</span>
                      <span className="model-chip-pill generate-pill">
                        <span aria-hidden="true" className="model-chip-icon">
                          ✦
                        </span>
                        <span className="model-chip-credits">
                          {generateCostCredits != null ? generateCostCredits : "—"}
                        </span>
                      </span>
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
