/**
 * Media Library panel custom-folder content.
 * Renders the active custom-folder upload/dropzone surface and unified item grid.
 */
import React from "react";
import { UploadSimple } from "phosphor-react";
import type { MediaFileRow, PromptRow } from "../logic/mediaLibraryModalModel";

type MediaLibraryPanelFolderContentProps = {
  activeFolderId: string;
  activeFolderName: string;
  isActiveFolderDropHover: boolean;
  activeFolderDropZoneProps: React.HTMLAttributes<HTMLElement> | null;
  onOpenRootUploadPicker: () => void;
  showCustomFolderEmptyState: boolean;
  showActiveFolderUnifiedGrid: boolean;
  promptLoading: boolean;
  mediaLoading: boolean;
  shouldShowPrompts: boolean;
  shouldShowMedia: boolean;
  activeFolderGridMediaRows: MediaFileRow[];
  activeFolderGridPromptRows: PromptRow[];
  renderAllItemsGrid: (args: {
    gridMediaRows: MediaFileRow[];
    gridPromptRows: PromptRow[];
  }) => React.ReactNode;
  promptHasMore: boolean;
  mediaHasMore: boolean;
  loadPromptPage: ({ reset }: { reset: boolean }) => Promise<void>;
  loadMediaPage: ({ reset }: { reset: boolean }) => Promise<void>;
  visiblePromptRowsLength: number;
  mediaRowsLength: number;
  bulkActions: React.ReactNode;
};

/**
 * Returns the custom-folder browse surface for the Media Library panel shell.
 */
export const MediaLibraryPanelFolderContent = React.memo(function MediaLibraryPanelFolderContent({
  activeFolderId,
  activeFolderName,
  isActiveFolderDropHover,
  activeFolderDropZoneProps,
  onOpenRootUploadPicker,
  showCustomFolderEmptyState,
  showActiveFolderUnifiedGrid,
  promptLoading,
  mediaLoading,
  shouldShowPrompts,
  shouldShowMedia,
  activeFolderGridMediaRows,
  activeFolderGridPromptRows,
  renderAllItemsGrid,
  promptHasMore,
  mediaHasMore,
  loadPromptPage,
  loadMediaPage,
  visiblePromptRowsLength,
  mediaRowsLength,
  bulkActions,
}: MediaLibraryPanelFolderContentProps) {
  return (
    <>
      {bulkActions}
      <div className="media-library-panel-folder-actions-row">
        <button
          type="button"
          className="media-library-panel-root-upload-button"
          onClick={onOpenRootUploadPicker}
        >
          <UploadSimple size={14} weight="bold" aria-hidden />
          <span>Add files</span>
        </button>
      </div>
      <div
        key={activeFolderId}
        className={`media-library-panel-active-folder-dropzone${
          isActiveFolderDropHover ? " is-drop-hover" : ""
        }`}
        data-testid="media-library-panel-active-folder-dropzone"
        {...(activeFolderDropZoneProps ?? {})}
      >
        {showCustomFolderEmptyState ? (
          <section className="media-library-panel-empty-folder-state">
            <p className="media-library-panel-empty-folder-title">
              No media to display in "{activeFolderName}."
            </p>
          </section>
        ) : null}

        {!showCustomFolderEmptyState && !showActiveFolderUnifiedGrid ? (
          <section className="media-library-panel-section">
            {promptLoading || mediaLoading ? (
              <p className="tiny subdued">Loading folder items…</p>
            ) : null}
            {!promptLoading && !mediaLoading ? (
              <p className="tiny subdued">No items found for this folder.</p>
            ) : null}
          </section>
        ) : null}

        {showActiveFolderUnifiedGrid ? (
          <section className="media-library-panel-section">
            <div id="media-library-panel-folder-items-section">
              {renderAllItemsGrid({
                gridMediaRows: activeFolderGridMediaRows,
                gridPromptRows: activeFolderGridPromptRows,
              })}
            </div>
            {promptHasMore || mediaHasMore ? (
              <div className="media-load-more media-load-more-inline">
                <p className="tiny subdued">
                  Loaded {activeFolderGridPromptRows.length + activeFolderGridMediaRows.length}{" "}
                  {activeFolderGridPromptRows.length + activeFolderGridMediaRows.length === 1
                    ? "item"
                    : "items"}
                  {promptHasMore || mediaHasMore ? "." : " (all loaded)."}
                </p>
                {promptHasMore ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      void loadPromptPage({ reset: false });
                    }}
                    disabled={promptLoading}
                  >
                    {promptLoading ? "Loading prompts..." : "Load more prompts"}
                  </button>
                ) : null}
                {mediaHasMore ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      void loadMediaPage({ reset: false });
                    }}
                    disabled={mediaLoading}
                  >
                    {mediaLoading ? "Loading media..." : "Load more media"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!showCustomFolderEmptyState &&
        !showActiveFolderUnifiedGrid &&
        shouldShowPrompts &&
        !shouldShowMedia ? (
          <section className="media-library-panel-section">
            {promptLoading && visiblePromptRowsLength === 0 ? (
              <p className="tiny subdued">Loading prompts…</p>
            ) : null}
            {!promptLoading && visiblePromptRowsLength === 0 ? (
              <p className="tiny subdued">No prompts found for this folder.</p>
            ) : null}
          </section>
        ) : null}

        {!showCustomFolderEmptyState &&
        !showActiveFolderUnifiedGrid &&
        shouldShowMedia &&
        !shouldShowPrompts ? (
          <section className="media-library-panel-section">
            {mediaLoading && mediaRowsLength === 0 ? (
              <p className="tiny subdued">Loading media…</p>
            ) : null}
            {!mediaLoading && mediaRowsLength === 0 ? (
              <p className="tiny subdued">No media found for this folder.</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
});
