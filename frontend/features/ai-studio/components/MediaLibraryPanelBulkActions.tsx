import React from "react";
import { ArrowsClockwise, Trash, X } from "phosphor-react";

type MediaLibraryPanelBulkActionsProps = {
  canDeleteFromLibrary: boolean;
  canMoveToFolder: boolean;
  canRemoveFromFolder: boolean;
  disabled?: boolean;
  onClearSelection: () => void;
  onMoveToFolder: () => void;
  onDeleteFromLibrary: () => void;
  onRemoveFromFolder: () => void;
  selectedCount: number;
};

export function MediaLibraryPanelBulkActions({
  canDeleteFromLibrary,
  canMoveToFolder,
  canRemoveFromFolder,
  disabled = false,
  onClearSelection,
  onMoveToFolder,
  onDeleteFromLibrary,
  onRemoveFromFolder,
  selectedCount,
}: MediaLibraryPanelBulkActionsProps) {
  if (!selectedCount) return null;

  return (
    <section
      className="media-library-panel-bulk-actions"
      aria-label={`Bulk media actions for ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`}
    >
      <div className="media-library-panel-bulk-actions-copy">
        <strong>{selectedCount}</strong>
        <span>{selectedCount === 1 ? " item selected" : " items selected"}</span>
      </div>
      <div className="media-library-panel-bulk-actions-buttons">
        <button
          type="button"
          className="media-library-panel-bulk-btn"
          onClick={onClearSelection}
          disabled={disabled}
        >
          <X size={14} weight="bold" aria-hidden />
          <span>Clear</span>
        </button>
        {canMoveToFolder ? (
          <button
            type="button"
            className="media-library-panel-bulk-btn"
            onClick={onMoveToFolder}
            disabled={disabled}
          >
            <ArrowsClockwise size={14} weight="bold" aria-hidden />
            <span>Move to folder</span>
          </button>
        ) : null}
        {canRemoveFromFolder ? (
          <button
            type="button"
            className="media-library-panel-bulk-btn"
            onClick={onRemoveFromFolder}
            disabled={disabled}
          >
            <X size={14} weight="bold" aria-hidden />
            <span>Remove from folder</span>
          </button>
        ) : null}
        {canDeleteFromLibrary ? (
          <button
            type="button"
            className="media-library-panel-bulk-btn is-danger"
            onClick={onDeleteFromLibrary}
            disabled={disabled}
          >
            <Trash size={14} weight="bold" aria-hidden />
            <span>Delete from library</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
