/**
 * Media Library panel dialog stack.
 * Renders the panel-specific delete, move, and folder-move dialogs.
 */
import React from "react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
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

type FolderDeleteTarget = {
  folderId: string;
  folderName: string;
};

type MediaLibraryPanelDialogsProps = {
  pendingBulkDeleteIds: string[] | null;
  bulkDeleteSubmitting?: boolean;
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
  pendingFolderDelete: FolderDeleteTarget | null;
  onCloseFolderDeleteConfirm: () => void;
  onConfirmFolderDelete: () => void;
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
  bulkDeleteSubmitting = false,
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
  pendingFolderDelete,
  onCloseFolderDeleteConfirm,
  onConfirmFolderDelete,
  moveFolderPicker,
  moveFolderCurrentParentLabel,
  moveFolderDestinationOptions,
  onCloseMoveFolderPicker,
  onMoveFolderToDestination,
}: MediaLibraryPanelDialogsProps) {
  const bulkMoveBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onCloseBulkMoveDialog);
  const moveFolderBackdropDismiss =
    useGuardedBackdropDismiss<HTMLDivElement>(onCloseMoveFolderPicker);

  return (
    <>
      {pendingBulkDeleteIds ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Delete selected items?"
            body={
              <>
                <p>
                  {pendingBulkDeleteIds.length} selected{" "}
                  {pendingBulkDeleteIds.length === 1 ? "item" : "items"} will be removed permanently
                  from your library.
                </p>
                {bulkDeleteSubmitting ? (
                  <p
                    className="media-library-panel-delete-progress"
                    role="status"
                    aria-live="polite"
                  >
                    Deleting selected items...
                  </p>
                ) : null}
              </>
            }
            confirmLabel="Delete"
            confirmBusyLabel="Deleting..."
            confirmDisabled={bulkDeleteSubmitting}
            cancelDisabled={bulkDeleteSubmitting}
            closeOnEscape={!bulkDeleteSubmitting}
            onCancel={onCloseBulkDeleteConfirm}
            onConfirm={onConfirmBulkDelete}
          />
        </AiStudioModalLayer>
      ) : null}

      {bulkMoveDialogOpen ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" {...bulkMoveBackdropDismiss}>
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
          <ConfirmationModal
            title={
              pendingLibraryDelete.kind === "media" ? "Delete this media?" : "Delete this prompt?"
            }
            body={
              <p>
                {pendingLibraryDelete.kind === "media"
                  ? "This item will be removed permanently from your library."
                  : "This prompt will be removed permanently from your library."}
              </p>
            }
            confirmLabel="Delete"
            onCancel={onCloseDeleteConfirm}
            onConfirm={onConfirmDeleteFromLibrary}
          />
        </AiStudioModalLayer>
      ) : null}

      {pendingFolderDelete ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Delete this folder?"
            body={
              <p>
                &quot;{pendingFolderDelete.folderName}&quot;, any subfolders, and folder memberships
                will be removed. Media and prompts stay saved in All Media.
              </p>
            }
            confirmLabel="Delete folder"
            onCancel={onCloseFolderDeleteConfirm}
            onConfirm={onConfirmFolderDelete}
          />
        </AiStudioModalLayer>
      ) : null}

      {moveFolderPicker ? (
        <AiStudioModalLayer>
          <div className="art-confirm-backdrop" {...moveFolderBackdropDismiss}>
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
