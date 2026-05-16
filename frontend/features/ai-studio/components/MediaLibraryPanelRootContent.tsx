/**
 * Media Library panel root-folder content.
 * Renders the All Media tab chrome, root dropzone sections, and root paginator.
 */
import React from "react";
import { ArrowsInCardinal, ArrowsOutSimple, UploadSimple } from "phosphor-react";

type RootMediaLibraryTab = "all" | "images" | "videos" | "audio" | "prompts";

type MediaLibraryPanelRootContentProps = {
  rootTab: RootMediaLibraryTab;
  setRootTab: React.Dispatch<React.SetStateAction<RootMediaLibraryTab>>;
  libraryTotalCount: number | null;
  isMediaLibraryPanelExpanded?: boolean;
  onExpandMediaLibraryPanel?: () => void;
  onCollapseMediaLibraryPanel?: () => void;
  showExpandCollapseButton?: boolean;
  onOpenRootUploadPicker: () => void;
  disableUploads?: boolean;
  bulkActions: React.ReactNode;
  selectedVisibleMediaCount: number;
  itemType: RootMediaLibraryTab;
  isRootFolderDropHover: boolean;
  rootFolderDropZoneProps: React.HTMLAttributes<HTMLElement> | null;
  mediaLoading: boolean;
  mediaRowsLength: number;
  promptLoading: boolean;
  visiblePromptRowsLength: number;
  visibleImageRowsLength: number;
  visibleVideoRowsLength: number;
  visibleAudioRowsLength: number;
  renderAllItemsGrid: () => React.ReactNode;
  renderImageGrid: () => React.ReactNode;
  renderVideoGrid: () => React.ReactNode;
  renderAudioGrid: () => React.ReactNode;
  renderPromptsSection: () => React.ReactNode;
  mediaHasMore: boolean;
  loadMediaPage: ({ reset }: { reset: boolean }) => Promise<void>;
};

/**
 * Returns the root-folder Media Library browse surface for the panel shell.
 */
export const MediaLibraryPanelRootContent = React.memo(function MediaLibraryPanelRootContent({
  rootTab,
  setRootTab,
  libraryTotalCount,
  isMediaLibraryPanelExpanded = false,
  onExpandMediaLibraryPanel,
  onCollapseMediaLibraryPanel,
  showExpandCollapseButton = true,
  onOpenRootUploadPicker,
  disableUploads = false,
  bulkActions,
  selectedVisibleMediaCount,
  itemType,
  isRootFolderDropHover,
  rootFolderDropZoneProps,
  mediaLoading,
  mediaRowsLength,
  promptLoading,
  visiblePromptRowsLength,
  visibleImageRowsLength,
  visibleVideoRowsLength,
  visibleAudioRowsLength,
  renderAllItemsGrid,
  renderImageGrid,
  renderVideoGrid,
  renderAudioGrid,
  renderPromptsSection,
  mediaHasMore,
  loadMediaPage,
}: MediaLibraryPanelRootContentProps) {
  return (
    <>
      <div
        className={`media-library-panel-root-sticky-chrome${
          selectedVisibleMediaCount > 0 ? " has-bulk-actions" : ""
        }`}
      >
        <div className="media-library-panel-root-tabs-row">
          <div
            className="media-library-panel-root-tabs"
            role="tablist"
            aria-label="All Media type tabs"
          >
            <button
              type="button"
              role="tab"
              className={`media-library-panel-root-tab${rootTab === "all" ? " is-active" : ""}`}
              aria-selected={rootTab === "all"}
              aria-controls="media-library-panel-all-media-section"
              onClick={() => setRootTab("all")}
            >
              All Media
            </button>
            <button
              type="button"
              role="tab"
              className={`media-library-panel-root-tab${rootTab === "images" ? " is-active" : ""}`}
              aria-selected={rootTab === "images"}
              aria-controls="media-library-panel-images-section"
              onClick={() => setRootTab("images")}
            >
              Images
            </button>
            <button
              type="button"
              role="tab"
              className={`media-library-panel-root-tab${rootTab === "videos" ? " is-active" : ""}`}
              aria-selected={rootTab === "videos"}
              aria-controls="media-library-panel-videos-section"
              onClick={() => setRootTab("videos")}
            >
              Videos
            </button>
            <button
              type="button"
              role="tab"
              className={`media-library-panel-root-tab${rootTab === "audio" ? " is-active" : ""}`}
              aria-selected={rootTab === "audio"}
              aria-controls="media-library-panel-audio-section"
              onClick={() => setRootTab("audio")}
            >
              Audio
            </button>
            <button
              type="button"
              role="tab"
              className={`media-library-panel-root-tab${rootTab === "prompts" ? " is-active" : ""}`}
              aria-selected={rootTab === "prompts"}
              aria-controls="media-library-panel-prompts-section"
              onClick={() => setRootTab("prompts")}
            >
              Prompts
            </button>
          </div>
          <div className="media-library-panel-root-count-group">
            <button
              type="button"
              className="media-library-panel-root-upload-button"
              onClick={onOpenRootUploadPicker}
              disabled={disableUploads}
            >
              <UploadSimple size={14} weight="bold" aria-hidden />
              <span>Add files</span>
            </button>
            {libraryTotalCount !== null ? (
              <div
                className="media-library-panel-root-count"
                aria-label={`${libraryTotalCount} saved media items`}
              >
                <span className="media-library-panel-root-count-value">{libraryTotalCount}</span>
                <span className="media-library-panel-root-count-label">saved</span>
              </div>
            ) : null}
            {showExpandCollapseButton ? (
              isMediaLibraryPanelExpanded ? (
                <button
                  type="button"
                  className="media-library-panel-root-expand-button"
                  aria-label="Collapse media library panel"
                  onClick={onCollapseMediaLibraryPanel}
                >
                  <ArrowsInCardinal size={14} weight="bold" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="media-library-panel-root-expand-button"
                  aria-label="Expand media library panel"
                  onClick={onExpandMediaLibraryPanel}
                >
                  <ArrowsOutSimple size={14} weight="bold" aria-hidden />
                </button>
              )
            ) : null}
          </div>
        </div>
        {bulkActions}
      </div>

      {itemType === "all" ? (
        <section
          className={`media-library-panel-section${
            isRootFolderDropHover ? " is-root-drop-hover" : ""
          }`}
          data-testid="media-library-panel-root-dropzone"
          {...(rootFolderDropZoneProps ?? {})}
        >
          {mediaLoading &&
          mediaRowsLength === 0 &&
          promptLoading &&
          visiblePromptRowsLength === 0 ? (
            <p className="tiny subdued">Loading saved items…</p>
          ) : null}
          {!mediaLoading &&
          mediaRowsLength === 0 &&
          !promptLoading &&
          visiblePromptRowsLength === 0 ? (
            <p className="tiny subdued">No saved items found for this folder.</p>
          ) : null}
          <div id="media-library-panel-all-media-section">
            {mediaRowsLength > 0 || visiblePromptRowsLength > 0 ? renderAllItemsGrid() : null}
          </div>
        </section>
      ) : null}

      {itemType === "images" ? (
        <section
          className={`media-library-panel-section${
            isRootFolderDropHover ? " is-root-drop-hover" : ""
          }`}
          data-testid="media-library-panel-root-dropzone"
          {...(rootFolderDropZoneProps ?? {})}
        >
          {mediaLoading && mediaRowsLength === 0 ? (
            <p className="tiny subdued">Loading images…</p>
          ) : null}
          {!mediaLoading && visibleImageRowsLength === 0 ? (
            <p className="tiny subdued">No images found for this folder.</p>
          ) : null}
          <div id="media-library-panel-images-section">
            {visibleImageRowsLength > 0 ? renderImageGrid() : null}
          </div>
        </section>
      ) : null}

      {itemType === "videos" ? (
        <section
          className={`media-library-panel-section${
            isRootFolderDropHover ? " is-root-drop-hover" : ""
          }`}
          data-testid="media-library-panel-root-dropzone"
          {...(rootFolderDropZoneProps ?? {})}
        >
          {mediaLoading && mediaRowsLength === 0 ? (
            <p className="tiny subdued">Loading videos…</p>
          ) : null}
          {!mediaLoading && visibleVideoRowsLength === 0 ? (
            <p className="tiny subdued">No videos found for this folder.</p>
          ) : null}
          <div id="media-library-panel-videos-section">
            {visibleVideoRowsLength > 0 ? renderVideoGrid() : null}
          </div>
        </section>
      ) : null}

      {itemType === "audio" ? (
        <section
          className={`media-library-panel-section${
            isRootFolderDropHover ? " is-root-drop-hover" : ""
          }`}
          data-testid="media-library-panel-root-dropzone"
          {...(rootFolderDropZoneProps ?? {})}
        >
          {mediaLoading && mediaRowsLength === 0 ? (
            <p className="tiny subdued">Loading audio…</p>
          ) : null}
          {!mediaLoading && visibleAudioRowsLength === 0 ? (
            <p className="tiny subdued">No audio found for this folder.</p>
          ) : null}
          <div id="media-library-panel-audio-section">
            {visibleAudioRowsLength > 0 ? renderAudioGrid() : null}
          </div>
        </section>
      ) : null}

      {itemType === "prompts" ? renderPromptsSection() : null}

      {itemType !== "prompts" ? (
        <section
          className="media-library-panel-section media-library-panel-root-paginator"
          data-testid="media-library-panel-root-media-paginator"
        >
          <div className="media-load-more media-load-more-inline">
            <p className="tiny subdued">
              Loaded {mediaRowsLength} {mediaRowsLength === 1 ? "media item" : "media items"}
              {mediaHasMore ? "." : " (all loaded)."}
            </p>
            {mediaHasMore ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void loadMediaPage({ reset: false });
                }}
                disabled={mediaLoading}
              >
                {mediaLoading ? "Loading more..." : "Load more media"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
});
