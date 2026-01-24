/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import Link from "next/link";
import React from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { StudioOutput } from "../types";
import { clearDragState, prepareReferenceDrag } from "../utils/dragDrop";

const isVideoUrl = (url: string) => /\.mp4(\?|$)/i.test(url) || url.includes("/video") || url.includes("video=");

type ReferenceCanvasProps = {
  outputs: StudioOutput[];
  activeOutputId: string | null;
  showHeader?: boolean;
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onDropFiles?: (files: FileList) => void;
  onTriggerFileSelect?: () => void;
};

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceCanvas({
  outputs,
  activeOutputId,
  showHeader = true,
  onSelectOutput,
  onOpenDetails,
  onDropFiles,
  onTriggerFileSelect,
}: ReferenceCanvasProps) {
  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropFiles) return;
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

  const handleCardDragStart = (event: React.DragEvent<HTMLButtonElement>, item: StudioOutput) => {
    prepareReferenceDrag(event, item, { dragImage: event.currentTarget as HTMLElement });
  };

  const handleCardDragEnd = (event: React.DragEvent<HTMLButtonElement>) => {
    clearDragState(event);
  };

  const renderStatusChip = (item: StudioOutput) => {
    const state = item.taskState;
    if (!state) return null;
    if (state === "fail") {
      return (
        <span className="reference-status-chip is-fail" title={item.errorMessage ?? undefined}>
          Failed
        </span>
      );
    }
    return null;
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
            <button type="button" className="ghost-btn mini preview-media-btn" onClick={onTriggerFileSelect}>
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <Link href="/media-library" className="ghost-btn mini preview-media-btn">
              <CloudArrowUp size={14} weight="regular" />
              Media library
            </Link>
          </div>
        </div>
      ) : null}
      <div className="reference-canvas-scroll">
        <div className="reference-canvas-grid">
          {outputs.length === 0 ? (
            <div className="reference-empty">
              <p className="preview-title">Upload or generate to see your media here.</p>
              <p className="subdued tiny">New prompts, images, and videos will appear in this grid.</p>
            </div>
          ) : (
            outputs.map((item) => {
              const isLoading =
                item.taskState === "running" ||
                item.taskState === "pending" ||
                (item.taskState === "success" && !item.previewUrl && !item.previewText);

              const isVideoPreview = item.previewUrl ? isVideoUrl(item.previewUrl) : false;
              const cardStyle = !isVideoPreview && item.previewUrl ? { backgroundImage: `url(${item.previewUrl})` } : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`reference-card ${item.previewUrl ? "has-preview" : ""} ${isVideoPreview ? "has-video" : ""} ${item.previewText ? "has-text" : ""} ${activeOutputId === item.id ? "is-active" : ""}`}
                  style={cardStyle}
                  onClick={() => onSelectOutput(item.id)}
                  onDoubleClick={() => onOpenDetails(item.id)}
                  draggable={!!item.previewUrl || !!item.previewText}
                  onDragStart={(event) => {
                    handleCardDragStart(event, item);
                  }}
                  onDragEnd={handleCardDragEnd}
                >
                  {isVideoPreview && item.previewUrl ? (
                    <video className="reference-card-video" src={item.previewUrl} autoPlay muted loop playsInline />
                  ) : null}
                  {renderStatusChip(item)}
                  {isLoading ? (
                    <div className="reference-loading">
                      <div className="reference-spinner" />
                    </div>
                  ) : null}
                  {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
