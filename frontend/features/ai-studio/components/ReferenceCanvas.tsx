/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import Link from "next/link";
import React from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { StudioOutput } from "../types";

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
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0 && onDropFiles) {
      onDropFiles(event.dataTransfer.files);
    }
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
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
            outputs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`reference-card ${item.previewUrl ? "has-preview" : ""} ${item.previewText ? "has-text" : ""} ${activeOutputId === item.id ? "is-active" : ""}`}
                style={item.previewUrl ? { backgroundImage: `url(${item.previewUrl})` } : undefined}
                onClick={() => onSelectOutput(item.id)}
                onDoubleClick={() => onOpenDetails(item.id)}
                draggable={!!item.previewUrl || !!item.previewText}
                onDragStart={(event) => {
                  if (item.previewUrl) {
                    event.dataTransfer.setData("text/plain", item.previewUrl);
                  }
                  if (item.previewText) {
                    event.dataTransfer.setData("text/plain", item.previewText);
                  }
                }}
              >
                {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
