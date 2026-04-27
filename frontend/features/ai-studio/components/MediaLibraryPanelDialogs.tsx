/**
 * Media Library panel dialog stack.
 * Renders the panel-specific delete, move, and folder-move dialogs.
 */
import React from "react";
import { AiStudioModalLayer } from "./modal-layer/AiStudioModalLayer";

type DeleteTarget =
  | {
      kind: "media";
      file: unknown;
    }
  | {
      kind: "prompt";
      prompt: unknown;
    };

type MediaLibraryPanelDialogsProps = {
  pendingBulkDeleteIds: string[] | null;
  deleteConfirmSubmitting: boolean;
  onCloseBulkDeleteConfirm: () => void;
  onConfirmBulkDelete: () => void;
  bulkMoveDialogOpen: boolean;
  selectedVisibleMediaCount: number;
  bulkMoveDestinationOptions: Array<{ id: string; label: string }>;
  onCloseBulkMoveDialog: () => void;
  onMoveSelectedMediaToFolder: (targetFolderId: string) => void;
  pendingLibraryDelete: DeleteTarget | null;
  onCloseDeleteConfirm: () => void;
  onConfirmDeleteFromLibrary: () => void;
  moveFolderPicker: { folderId: string; folderName: string } | null;
  moveFolderCurrentParentLabel: string;
  moveFolderDestinationOptions: Array<{ id: string | null; label: string }>;
  onCloseMoveFolderPicker: () => void;
  onMoveFolderToDestination: (parentFolderId: string | null) => void;
};

/**
 * Returns the modal stack used by the Media Library panel shell.
 */
export const MediaLibraryPanelDialogs = React.memo(function MediaLibraryPanelDialogs({
  pendingBulkDeleteIds,
  deleteConfirmSubmitting,
  onCloseBulkDeleteConfirm,
  onConfirmBulkDelete,
  bulkMoveDialogOpen,
  selectedVisibleMediaCount,
  bulkMoveDestinationOptions,
  onCloseBulkMoveDialog,
  onMoveSelectedMediaToFolder,
  pendingLibraryDelete,
  onCloseDeleteConfirm,
  onConfirmDeleteFromLibrary,
  moveFolderPicker,
  moveFolderCurrentParentLabel,
  moveFolderDestinationOptions,
  onCloseMoveFolderPicker,
  onMoveFolderToDestination,
}: MediaLibraryPanelDialogsProps) {
  return (
    <>
      {pendingBulkDeleteIds ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" onClick={onCloseBulkDeleteConfirm}>
            <div
              className="art-confirm-card"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm bulk delete from All Media"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="art-confirm-title">Delete selected media from All Media?</p>
              <p className="art-confirm-copy">
                This permanently deletes {pendingBulkDeleteIds.length} selected{" "}
                {pendingBulkDeleteIds.length === 1 ? "item" : "items"} from your library.
              </p>
              <div className="art-confirm-actions">
                <button
                  type="button"
                  className="art-action-btn"
                  onClick={onCloseBulkDeleteConfirm}
                  disabled={deleteConfirmSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="art-action-btn art-action-btn-danger"
                  onClick={onConfirmBulkDelete}
                  disabled={deleteConfirmSubmitting}
                >
                  {deleteConfirmSubmitting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}

      {bulkMoveDialogOpen ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" onClick={onCloseBulkMoveDialog}>
            <div
              className="media-library-panel-move-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Move ${selectedVisibleMediaCount} selected media items`}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="media-library-panel-move-dialog-title">Move Selected Media</p>
              <p className="media-library-panel-move-dialog-copy">
                Choose the destination folder for {selectedVisibleMediaCount} selected{" "}
                {selectedVisibleMediaCount === 1 ? "item" : "items"}.
              </p>
              <p className="media-library-panel-move-dialog-label">Available destinations</p>
              <div className="media-library-panel-move-dialog-list" role="list">
                {bulkMoveDestinationOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="media-library-panel-move-dialog-option"
                    onClick={() => onMoveSelectedMediaToFolder(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="art-confirm-actions">
                <button type="button" className="art-action-btn" onClick={onCloseBulkMoveDialog}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}

      {pendingLibraryDelete ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" onClick={onCloseDeleteConfirm}>
            <div
              className="art-confirm-card"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm delete from All Media"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="art-confirm-title">Delete from All Media?</p>
              <p className="art-confirm-copy">
                {pendingLibraryDelete.kind === "media"
                  ? "This permanently deletes the selected media from your library."
                  : "This permanently deletes the selected prompt from your library."}
              </p>
              <div className="art-confirm-actions">
                <button
                  type="button"
                  className="art-action-btn"
                  onClick={onCloseDeleteConfirm}
                  disabled={deleteConfirmSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="art-action-btn art-action-btn-danger"
                  onClick={onConfirmDeleteFromLibrary}
                  disabled={deleteConfirmSubmitting}
                >
                  {deleteConfirmSubmitting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}

      {moveFolderPicker ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" onClick={onCloseMoveFolderPicker}>
            <div
              className="media-library-panel-move-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Move ${moveFolderPicker.folderName}`}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="media-library-panel-move-dialog-title">Move Folder</p>
              <p className="media-library-panel-move-dialog-copy">
                Move &quot;{moveFolderPicker.folderName}&quot; to a new parent folder.
              </p>
              <div className="media-library-panel-move-dialog-current-parent">
                <p className="media-library-panel-move-dialog-label">Current parent</p>
                <p className="media-library-panel-move-dialog-current-parent-value">
                  {moveFolderCurrentParentLabel}
                </p>
              </div>
              <p className="media-library-panel-move-dialog-label">Available destinations</p>
              <div className="media-library-panel-move-dialog-list" role="list">
                {moveFolderDestinationOptions.map((option) => (
                  <button
                    key={option.id ?? "all_items"}
                    type="button"
                    className="media-library-panel-move-dialog-option"
                    onClick={() => onMoveFolderToDestination(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="art-confirm-actions">
                <button type="button" className="art-action-btn" onClick={onCloseMoveFolderPicker}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
    </>
  );
});
