/**
 * Modal stack for Media Library.
 * Orchestrates delete confirmation dialogs and focused file/prompt modal composition.
 */
import { MediaDeleteConfirmModal } from "./MediaDeleteConfirmModal";
import { MediaFileModal, type MediaFileModalProps, type MediaFileModalRow } from "./MediaFileModal";
import {
  MediaPromptModal,
  type MediaPromptModalProps,
  type MediaPromptModalRow,
} from "./MediaPromptModal";

type MediaDeleteTarget = {
  filename: string;
};

type MediaLibraryModalStackProps<
  TFileRow extends MediaFileModalRow,
  TPromptRow extends MediaPromptModalRow,
> = {
  bulkDeleting: boolean;
  confirmDeleteIds: string[] | null;
  deleteTarget: MediaDeleteTarget | null;
  deletingSingle: boolean;
  fileModal: Omit<MediaFileModalProps<TFileRow>, "focusedFile"> & { focusedFile: TFileRow | null };
  onCancelDeleteFile: () => void;
  onCancelDeleteSelected: () => void;
  onConfirmDeleteFile: () => void | Promise<void>;
  onConfirmDeleteSelected: () => void | Promise<void>;
  promptModal: Omit<MediaPromptModalProps<TPromptRow>, "focusedPrompt"> & {
    focusedPrompt: TPromptRow | null;
  };
};

/**
 * Renders the bottom-of-page modal stack for Media Library flows.
 * Inputs: delete confirmation state plus focused file/prompt modal props.
 * Output: conditional modal/dialog markup.
 * Side effects: none.
 */
export function MediaLibraryModalStack<
  TFileRow extends MediaFileModalRow,
  TPromptRow extends MediaPromptModalRow,
>({
  bulkDeleting,
  confirmDeleteIds,
  deleteTarget,
  deletingSingle,
  fileModal,
  onCancelDeleteFile,
  onCancelDeleteSelected,
  onConfirmDeleteFile,
  onConfirmDeleteSelected,
  promptModal,
}: MediaLibraryModalStackProps<TFileRow, TPromptRow>) {
  const { focusedFile, ...fileModalRest } = fileModal;
  const { focusedPrompt, ...promptModalRest } = promptModal;

  return (
    <>
      {deleteTarget ? (
        <MediaDeleteConfirmModal
          body={
            <>
              This will permanently remove <strong>{deleteTarget.filename}</strong> from your Media
              Library and private storage. This action cannot be undone.
            </>
          }
          cancelDisabled={deletingSingle}
          confirmDisabled={deletingSingle}
          confirmLabel={deletingSingle ? "Deleting..." : "Yes, delete file"}
          confirmTitleId="delete-file-title"
          onCancel={onCancelDeleteFile}
          onConfirm={() => {
            void onConfirmDeleteFile();
          }}
          title="Delete this file from your library?"
        />
      ) : null}

      {confirmDeleteIds?.length ? (
        <MediaDeleteConfirmModal
          body={
            <>
              This will permanently remove{" "}
              <strong>{confirmDeleteIds.length} selected file(s)</strong> from your Media Library
              and private storage. This action cannot be undone.
            </>
          }
          cancelDisabled={bulkDeleting}
          confirmDisabled={bulkDeleting}
          confirmLabel={bulkDeleting ? "Deleting..." : "Yes, delete selected"}
          confirmTitleId="delete-selected-title"
          onCancel={onCancelDeleteSelected}
          onConfirm={() => {
            void onConfirmDeleteSelected();
          }}
          title="Delete selected file(s) from your library?"
        />
      ) : null}

      {focusedFile ? <MediaFileModal {...fileModalRest} focusedFile={focusedFile} /> : null}

      {focusedPrompt ? (
        <MediaPromptModal {...promptModalRest} focusedPrompt={focusedPrompt} />
      ) : null}
    </>
  );
}
