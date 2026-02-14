/**
 * Focused-file modal view for Media Library.
 * Renders preview, rename, move, and destructive actions while delegating behavior to injected handlers.
 */
import { CaretDown, CheckCircle } from "phosphor-react";
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  Ref,
  SetStateAction,
  WheelEvent,
} from "react";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";

type MediaFileModalRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
};

type MediaFileMoveOption = {
  tab: MediaDataTab;
  label: string;
  disabled: boolean;
};

type MediaFileModalProps<TRow extends MediaFileModalRow> = {
  canMoveToAnotherTab: boolean;
  cacheModalImageNaturalSize: (width: number, height: number) => void;
  cacheAspectRatio: (id: string, ratio: number) => void;
  closeModal: () => void;
  downloadFile: (row: TRow) => Promise<void>;
  focusedAspectRatio: number;
  focusedFile: TRow;
  handleMediaPreviewError: (row: TRow) => void;
  handleModalImageClick: (event: MouseEvent<HTMLImageElement>) => void;
  handleModalImageKeyDown: (event: KeyboardEvent<HTMLImageElement>) => void;
  handleModalImagePointerDown: (event: PointerEvent<HTMLImageElement>) => void;
  handleModalImagePointerMove: (event: PointerEvent<HTMLImageElement>) => void;
  handleModalImagePointerUp: (event: PointerEvent<HTMLImageElement>) => void;
  handleModalImageWheel: (event: WheelEvent<HTMLImageElement>) => void;
  handleModalPreviewWheel: (event: WheelEvent<HTMLDivElement>) => void;
  handleRenameInputChange: (nextValue: string) => void;
  isModalImagePanning: boolean;
  isVideoFile: (fileType: string) => boolean;
  modalError: string | null;
  modalImagePan: { x: number; y: number };
  modalImageZoomActive: boolean;
  modalImageZoomScale: number;
  modalMoveTabOptions: MediaFileMoveOption[];
  modalPreviewRef: Ref<HTMLDivElement>;
  moveError: string | null;
  moveFocusedFile: (destinationTab: MediaDataTab) => Promise<void>;
  moveMenuOpen: boolean;
  movingFile: boolean;
  renameSuccess: boolean;
  renameValue: string;
  requestDeleteFile: (row: TRow) => void;
  saveRename: () => Promise<void>;
  savingRename: boolean;
  setMoveMenuOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Renders the focused-file modal UI for preview/edit/move actions.
 * Inputs: focused media row plus callbacks/state for preview interactions and CRUD actions.
 * Output: modal markup bound to provided handlers.
 * Side effects: none.
 */
export function MediaFileModal<TRow extends MediaFileModalRow>({
  canMoveToAnotherTab,
  cacheModalImageNaturalSize,
  cacheAspectRatio,
  closeModal,
  downloadFile,
  focusedAspectRatio,
  focusedFile,
  handleMediaPreviewError,
  handleModalImageClick,
  handleModalImageKeyDown,
  handleModalImagePointerDown,
  handleModalImagePointerMove,
  handleModalImagePointerUp,
  handleModalImageWheel,
  handleModalPreviewWheel,
  handleRenameInputChange,
  isModalImagePanning,
  isVideoFile,
  modalError,
  modalImagePan,
  modalImageZoomActive,
  modalImageZoomScale,
  modalMoveTabOptions,
  modalPreviewRef,
  moveError,
  moveFocusedFile,
  moveMenuOpen,
  movingFile,
  renameSuccess,
  renameValue,
  requestDeleteFile,
  saveRename,
  savingRename,
  setMoveMenuOpen,
}: MediaFileModalProps<TRow>) {
  return (
    <div className="media-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="media-modal-backdrop" onClick={closeModal} />
      <div className="media-modal-content">
        <div className="modal-body">
          <div
            className="modal-preview"
            ref={modalPreviewRef}
            style={
              {
                aspectRatio: focusedAspectRatio,
                "--modal-preview-aspect": String(focusedAspectRatio),
              } as CSSProperties
            }
            onWheel={handleModalPreviewWheel}
          >
            {focusedFile.signedUrl ? (
              isVideoFile(focusedFile.file_type) ? (
                <video
                  src={focusedFile.signedUrl}
                  controls
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (!video.videoWidth || !video.videoHeight) return;
                    cacheAspectRatio(focusedFile.id, video.videoWidth / video.videoHeight);
                  }}
                  onError={() => handleMediaPreviewError(focusedFile)}
                />
              ) : (
                <>
                  {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={focusedFile.signedUrl}
                    alt={focusedFile.filename}
                    className={`modal-zoomable-image ${modalImageZoomActive ? "is-zoom-active" : ""} ${modalImageZoomScale > 1 ? "is-zoomed" : ""} ${isModalImagePanning ? "is-panning" : ""}`}
                    style={{
                      transform: `translate3d(${modalImagePan.x}px, ${modalImagePan.y}px, 0) scale(${modalImageZoomScale})`,
                      transformOrigin: "50% 50%",
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Toggle zoom mode for image preview"
                    onClick={handleModalImageClick}
                    onKeyDown={handleModalImageKeyDown}
                    onWheel={handleModalImageWheel}
                    onPointerDown={handleModalImagePointerDown}
                    onPointerMove={handleModalImagePointerMove}
                    onPointerUp={handleModalImagePointerUp}
                    onPointerCancel={handleModalImagePointerUp}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (!image.naturalWidth || !image.naturalHeight) return;
                      cacheAspectRatio(focusedFile.id, image.naturalWidth / image.naturalHeight);
                      cacheModalImageNaturalSize(image.naturalWidth, image.naturalHeight);
                    }}
                    onError={() => handleMediaPreviewError(focusedFile)}
                  />
                </>
              )
            ) : (
              <div className="placeholder" aria-hidden />
            )}
          </div>
          <div className="modal-meta">
            <div className="modal-top-actions">
              <button
                className="btn-secondary modal-pill-btn"
                type="button"
                onClick={() => void downloadFile(focusedFile)}
              >
                Download
              </button>
              <button
                className="btn-danger modal-delete-btn modal-pill-btn"
                type="button"
                onClick={() => requestDeleteFile(focusedFile)}
              >
                Delete
              </button>
              <button
                className="btn-secondary close-btn modal-pill-btn modal-close-pill"
                type="button"
                onClick={closeModal}
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <label htmlFor="renameInput" id="modal-title" className="eyebrow">
              File name
            </label>
            <input
              id="renameInput"
              type="text"
              value={renameValue}
              onChange={(event) => handleRenameInputChange(event.target.value)}
              className="input"
              aria-label="Enter new filename"
            />
            {modalError ? (
              <div className="auth-error" role="alert" aria-live="assertive">
                {modalError}
              </div>
            ) : null}
            <button
              className="btn-primary"
              type="button"
              onClick={() => void saveRename()}
              disabled={savingRename || !renameValue.trim()}
            >
              {savingRename ? "Renaming..." : "Rename"}
            </button>
            <div className="modal-move">
              <button
                className="btn-secondary modal-move-toggle"
                type="button"
                onClick={() => setMoveMenuOpen((prev) => !prev)}
                disabled={movingFile || !canMoveToAnotherTab}
                aria-haspopup="menu"
                aria-expanded={moveMenuOpen}
              >
                <span>{movingFile ? "Moving..." : "Move"}</span>
                <CaretDown
                  size={14}
                  weight="bold"
                  className={moveMenuOpen ? "is-open" : ""}
                  aria-hidden
                />
              </button>
              {moveMenuOpen ? (
                <div className="modal-move-menu" role="menu" aria-label="Move media to tab">
                  {modalMoveTabOptions.map((option) => (
                    <button
                      key={option.tab}
                      type="button"
                      className="modal-move-option"
                      role="menuitem"
                      disabled={movingFile || option.disabled}
                      onClick={() => {
                        if (option.disabled) return;
                        void moveFocusedFile(option.tab);
                      }}
                      title={option.label}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {moveError ? (
              <div className="auth-error" role="alert" aria-live="assertive">
                {moveError}
              </div>
            ) : null}
            {renameSuccess && !modalError && !savingRename ? (
              <div className="rename-toast" role="status" aria-live="polite">
                <CheckCircle size={16} weight="bold" />
                <span>Saved</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
