/**
 * Upload stage panel for Media Library.
 * Renders drag/drop intake, file picker trigger, selected-file preview, and storage usage summary.
 */
import { DownloadSimple } from "phosphor-react";
import type { ChangeEventHandler, DragEventHandler, MutableRefObject } from "react";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";

type MediaUploadTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

export type MediaUploadStageProps = {
  activeTab: MediaUploadTab;
  error: string | null;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  isDragging: boolean;
  planLimitMb: number;
  selectedFiles: File[];
  totalBytes: number;
  uploadCount: number;
  uploading: boolean;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onTriggerFilePicker: () => void;
};

/**
 * Renders upload interaction controls and storage summary.
 * Inputs: upload state, drag/drop handlers, file picker handlers, and storage usage metrics.
 * Output: upload-stage section used by the Media Library page.
 * Side effects: none.
 */
export function MediaUploadStage({
  activeTab,
  error,
  fileInputRef,
  isDragging,
  planLimitMb,
  selectedFiles,
  totalBytes,
  uploadCount,
  uploading,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onTriggerFilePicker,
}: MediaUploadStageProps) {
  const accept = activeTab === "private" ? "image/*" : "image/*,video/*";

  useVisibleErrorTelemetry({
    source: "client.media_library.upload_stage_error",
    scope: "app",
    severity: "medium",
    message: error,
    metadata: {
      active_tab: activeTab,
    },
  });

  return (
    <section
      className="panel media-stage hero-image-card media-panel"
      style={{
        backgroundImage: "none",
      }}
    >
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="region"
        aria-label="File upload area"
      >
        <p className="title">Drag and drop media here</p>
        {uploading ? (
          <div className="subdued tiny" role="status" aria-live="polite">
            Uploading {uploadCount || ""} file{uploadCount === 1 ? "" : "s"}…
          </div>
        ) : null}
        {error ? (
          <div className="auth-error" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}
      </div>

      <div className="upload-side">
        <p className="eyebrow">Add files</p>
        <h3>Browse your computer</h3>
        <button className="btn-primary add-files-cta" type="button" onClick={onTriggerFilePicker}>
          <DownloadSimple size={20} weight="bold" />
          Add Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={onFileChange}
          aria-label="Select media files"
          style={{ display: "none" }}
        />
        {selectedFiles.length > 0 ? (
          <div className="subdued tiny">
            {selectedFiles.length} selected •{" "}
            {selectedFiles
              .map((file) => file.name)
              .slice(0, 3)
              .join(", ")}
            {selectedFiles.length > 3 ? "…" : ""}
          </div>
        ) : null}
        <div className="upload-storage">
          <div>
            <p className="tiny subdued">Storage used</p>
            <strong>{(totalBytes / (1024 * 1024)).toFixed(1)} MB</strong>
            <span className="tiny subdued">of {(planLimitMb / 1024).toFixed(1)} GB</span>
          </div>
          <button type="button" className="btn-secondary upgrade-btn">
            Need more storage?
          </button>
        </div>
      </div>
    </section>
  );
}
