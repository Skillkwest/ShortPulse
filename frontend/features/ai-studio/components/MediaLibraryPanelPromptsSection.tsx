import React from "react";
import type { PromptRow } from "../logic/mediaLibraryModalModel";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";

type MediaLibraryPanelPromptsSectionProps = {
  showHeading?: boolean;
  visiblePromptRows: PromptRow[];
  promptLoading: boolean;
  promptHasMore: boolean;
  selectedPromptIds: Set<string>;
  canShowFolderItemRemoveAction: boolean;
  canDeleteFromLibrary: boolean;
  onSelectPromptCard: (prompt: PromptRow) => void;
  onPromptDoubleClick: (prompt: PromptRow) => void;
  onPromptDragStart: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onPromptDragEnd: (event: React.DragEvent<HTMLButtonElement>) => void;
  onRemovePromptFromFolder: (prompt: PromptRow) => void;
  onDeletePromptFromLibrary: (prompt: PromptRow) => void;
  loadPromptPage: ({ reset }: { reset: boolean }) => Promise<void>;
};

export const MediaLibraryPanelPromptsSection = React.memo(function MediaLibraryPanelPromptsSection({
  showHeading = true,
  visiblePromptRows,
  promptLoading,
  promptHasMore,
  selectedPromptIds,
  canShowFolderItemRemoveAction,
  canDeleteFromLibrary,
  onSelectPromptCard,
  onPromptDoubleClick,
  onPromptDragStart,
  onPromptDragEnd,
  onRemovePromptFromFolder,
  onDeletePromptFromLibrary,
  loadPromptPage,
}: MediaLibraryPanelPromptsSectionProps) {
  return (
    <section className="media-library-panel-section">
      {showHeading ? (
        <div className="media-library-panel-section-head">
          <p className="tiny subdued">
            Prompts ({visiblePromptRows.length})
            {promptLoading && visiblePromptRows.length > 0 ? " · Refreshing" : ""}
          </p>
        </div>
      ) : null}
      {promptLoading && visiblePromptRows.length === 0 ? (
        <p className="tiny subdued">Loading prompts…</p>
      ) : null}
      {!promptLoading && visiblePromptRows.length === 0 ? (
        <p className="tiny subdued">No prompts found for this folder.</p>
      ) : null}
      <div id="media-library-panel-prompts-section">
        {visiblePromptRows.length > 0 ? (
          <MediaLibraryPromptGrid
            prompts={visiblePromptRows}
            sortedPrompts={visiblePromptRows}
            selectedIds={selectedPromptIds}
            onSelectPromptCard={onSelectPromptCard}
            onPromptDoubleClick={onPromptDoubleClick}
            onPromptDragStart={onPromptDragStart}
            onPromptDragEnd={onPromptDragEnd}
            showRemoveAction={canShowFolderItemRemoveAction}
            showDeleteAction={canDeleteFromLibrary}
            onRemovePromptFromFolder={onRemovePromptFromFolder}
            onDeletePromptFromLibrary={onDeletePromptFromLibrary}
            variant="reference-card"
          />
        ) : null}
        {promptHasMore ? (
          <div className="media-load-more">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void loadPromptPage({ reset: false });
              }}
              disabled={promptLoading}
            >
              {promptLoading ? "Loading more..." : "Load more prompts"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
});
