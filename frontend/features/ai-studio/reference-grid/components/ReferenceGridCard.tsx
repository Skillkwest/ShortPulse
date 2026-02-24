/**
 * Presentational card for a single reference-grid item.
 * Keeps render and card-level interaction wiring isolated from ReferenceGrid orchestration.
 */
import React from "react";
import { ArrowClockwise, CheckCircle, DownloadSimple, FloppyDisk, X } from "phosphor-react";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";

export type ReferenceGridCardProps = {
  item: StudioOutput;
  dragSourceSurface: ReferenceDragSourceSurface;
  videoNodeKey: string;
  activeOutputId: string | null;
  isLoading: boolean;
  loadingVisual: "none" | "spinner";
  cardPreviewUrl: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  canAutoplayVideo: boolean;
  isPromptOnly: boolean;
  isLinkedPromptReference: boolean;
  canRetryStatus: boolean;
  showPromptGenerate: boolean;
  disablePromptGenerate: boolean;
  generateCostCredits: number | null | undefined;
  imageSrc: string | undefined;
  imageLoading: "eager" | "lazy";
  imageFetchPriority: "high" | "low";
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface
  ) => void;
  onCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onCardDragOver?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDrop?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragEnter?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragLeave?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onKeyboardReorderCurated?: (id: string, direction: "up" | "down") => void;
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
  onAutoplayStarted: (id: string) => void;
  onAutoplayStopped: (id: string) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  showCuratedRemoveAction?: boolean;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
  hideReferenceActions?: boolean;
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

/**
 * Renders one reference item card and forwards interaction events to parent handlers.
 */
export const ReferenceGridCard = React.memo(function ReferenceGridCard({
  item,
  dragSourceSurface,
  videoNodeKey,
  activeOutputId,
  isLoading,
  loadingVisual,
  cardPreviewUrl,
  isVideoPreview,
  isImagePreview,
  canAutoplayVideo,
  isPromptOnly,
  isLinkedPromptReference,
  canRetryStatus,
  showPromptGenerate,
  disablePromptGenerate,
  generateCostCredits,
  imageSrc,
  imageLoading,
  imageFetchPriority,
  onSelectOutput,
  onOpenDetails,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onCardDragEnter,
  onCardDragLeave,
  onKeyboardReorderCurated,
  registerVideoNode,
  markLoaded,
  onAutoplayStarted,
  onAutoplayStopped,
  onRetryStatus,
  onDeleteOutput,
  onRemoveCuratedReference,
  showCuratedRemoveAction = false,
  onSaveToLibrary,
  onDownload,
  onGeneratePrompt,
  hideReferenceActions = false,
}: ReferenceGridCardProps) {
  const isFailing = item.taskState === "fail";
  const isSelected = activeOutputId === item.id;
  const saveDisabled = item.saveState === "saving";
  const saveLabel = item.saveState === "failed" ? "Retry save" : "Save to media library";
  const isGeneratedReference =
    item.mediaSource === "generated" || Boolean(item.generationId || item.taskId);
  const shouldShowSaveAction = Boolean(
    onSaveToLibrary &&
    item.saveState !== "saved" &&
    (isPromptOnly || isImagePreview || (isVideoPreview && !isGeneratedReference))
  );
  const saveIcon =
    item.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
    );

  return (
    <div
      className={`reference-card ${cardPreviewUrl ? "has-preview" : ""} ${isVideoPreview ? "has-video" : ""} ${item.previewText ? "has-text" : ""} ${isSelected ? "is-active" : ""} ${isLoading ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
      role="button"
      aria-busy={isLoading}
      data-loading={isLoading ? "true" : "false"}
      tabIndex={0}
      onClick={() => onSelectOutput(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectOutput(item.id);
          return;
        }
        if (!onKeyboardReorderCurated) return;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onKeyboardReorderCurated(item.id, event.key === "ArrowUp" ? "up" : "down");
        }
      }}
      onDoubleClick={() => onOpenDetails(item.id)}
      draggable={!!cardPreviewUrl || !!item.previewText}
      onDragStart={(event) => {
        onCardDragStart(event, item, dragSourceSurface);
      }}
      onDragEnd={onCardDragEnd}
      onDragOver={onCardDragOver ? (event) => onCardDragOver(event, item) : undefined}
      onDrop={onCardDrop ? (event) => onCardDrop(event, item) : undefined}
      onDragEnter={onCardDragEnter ? (event) => onCardDragEnter(event, item) : undefined}
      onDragLeave={onCardDragLeave ? (event) => onCardDragLeave(event, item) : undefined}
    >
      {isVideoPreview && cardPreviewUrl ? (
        <video
          className="reference-card-video"
          ref={(node) => registerVideoNode(videoNodeKey, item.id, node)}
          src={canAutoplayVideo ? cardPreviewUrl : undefined}
          autoPlay={canAutoplayVideo}
          muted
          loop
          playsInline
          preload={canAutoplayVideo ? "metadata" : "none"}
          onLoadedData={() => markLoaded(item.id)}
          onPlay={() => onAutoplayStarted(item.id)}
          onPause={() => onAutoplayStopped(item.id)}
        />
      ) : null}
      {isImagePreview && cardPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          data-src={cardPreviewUrl}
          alt=""
          className="reference-card-image"
          loading={imageLoading}
          decoding="async"
          {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
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
          {canRetryStatus && isSelected ? (
            <button
              type="button"
              className="reference-status-retry-btn"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onRetryStatus?.(item);
              }}
            >
              Retry status
            </button>
          ) : null}
        </div>
      ) : null}
      {loadingVisual !== "none" ? (
        <div className="reference-loading">
          <div className="reference-spinner" />
        </div>
      ) : null}
      {isLoading && canRetryStatus && isSelected ? (
        <button
          type="button"
          className="reference-status-retry-btn reference-status-retry-btn--loading"
          onClick={(event) => {
            event.stopPropagation();
            onSelectOutput(item.id);
            onRetryStatus?.(item);
          }}
        >
          Retry status
        </button>
      ) : null}
      {isLinkedPromptReference ? (
        <span className="reference-card-link-dot" aria-hidden="true" />
      ) : null}
      {renderSaveChip(item, isSelected)}
      {isFailing && onDeleteOutput && isSelected ? (
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
      {showCuratedRemoveAction && onRemoveCuratedReference && isSelected ? (
        <div className="reference-card-actions" aria-label="Curated actions">
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove from curated"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveCuratedReference(item.id);
            }}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {!hideReferenceActions &&
      (shouldShowSaveAction || (onDownload && (isImagePreview || isVideoPreview))) ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          {shouldShowSaveAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label={saveLabel}
              disabled={saveDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onSaveToLibrary?.(item);
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
      {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
      {isPromptOnly && onGeneratePrompt && isSelected && showPromptGenerate ? (
        <button
          type="button"
          className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill"
          disabled={disablePromptGenerate}
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
});

/**
 * @deprecated Use `ReferenceGridCardProps`.
 */
export type ReferenceCanvasCardProps = ReferenceGridCardProps;

/**
 * @deprecated Use `ReferenceGridCard`.
 */
export const ReferenceCanvasCard = ReferenceGridCard;
