import React from "react";
import {
  deleteMediaFileWithStorage,
  deleteMediaPromptById,
  logMediaEvent,
} from "../../media-library/logic/mediaLibraryDataEffects";
import {
  applyMediaFolderMembershipBatch,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  uploadMediaFile,
  type MediaUploadDestinationTab,
} from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import type { MediaFileRow, PromptRow } from "../logic/mediaLibraryModalModel";

const ROOT_FOLDER_LABEL = "All Media";

const resolveUploadDestinationTabForFile = (file: File): MediaUploadDestinationTab | null => {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("video/")) return "uploaded_videos";
  if (mimeType.startsWith("image/")) return "uploaded_images";
  return null;
};

const createdAtTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export type PendingLibraryDeleteState =
  | {
      kind: "media";
      file: MediaFileRow;
    }
  | {
      kind: "prompt";
      prompt: PromptRow;
    };

type UseMediaLibraryPanelMutationControllerParams = {
  activeFolderId: string;
  folders: Array<{ id: string; name: string }>;
  refreshActiveRows: () => Promise<void>;
  setFolderError: (value: string | null) => void;
  setMembershipMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setMediaRows: React.Dispatch<React.SetStateAction<MediaFileRow[]>>;
  setPromptRows: React.Dispatch<React.SetStateAction<PromptRow[]>>;
};

type UseMediaLibraryPanelMutationControllerResult = {
  pendingLibraryDelete: PendingLibraryDeleteState | null;
  setPendingLibraryDelete: React.Dispatch<React.SetStateAction<PendingLibraryDeleteState | null>>;
  deleteConfirmSubmitting: boolean;
  resetDeleteConfirmState: () => void;
  closeDeleteConfirm: () => void;
  confirmDeleteFromLibrary: () => Promise<void>;
  handleRemoveItemFromActiveFolder: (item: {
    kind: "media" | "prompt";
    id: string;
  }) => Promise<void>;
  handleAssignItemToActiveFolder: (item: {
    kind: "media" | "prompt";
    id: string;
  }) => Promise<boolean>;
  uploadDroppedFilesToFolder: (params: {
    targetFolderId: string;
    files: FileList;
  }) => Promise<MediaFileRow[]>;
};

export const useMediaLibraryPanelMutationController = ({
  activeFolderId,
  folders,
  refreshActiveRows,
  setFolderError,
  setMembershipMessage,
  setMediaRows,
  setPromptRows,
}: UseMediaLibraryPanelMutationControllerParams): UseMediaLibraryPanelMutationControllerResult => {
  const [pendingLibraryDelete, setPendingLibraryDelete] =
    React.useState<PendingLibraryDeleteState | null>(null);
  const [deleteConfirmSubmitting, setDeleteConfirmSubmitting] = React.useState(false);

  const handleRemoveItemFromActiveFolder = React.useCallback(
    async (item: { kind: "media" | "prompt"; id: string }) => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch({
          folderId: activeFolderId,
          action: "unassign",
          mediaIds: item.kind === "media" ? [item.id] : [],
          promptIds: item.kind === "prompt" ? [item.id] : [],
        });
        setMembershipMessage("Removed from this folder.");
        if (item.kind === "media") {
          setMediaRows((previous) => previous.filter((row) => row.id !== item.id));
        } else {
          setPromptRows((previous) => previous.filter((row) => row.id !== item.id));
        }
      } catch (membershipError) {
        setFolderError(
          toMediaLibraryErrorText(membershipError, "Unable to update folder membership.")
        );
      }
    },
    [activeFolderId, setFolderError, setMediaRows, setMembershipMessage, setPromptRows]
  );

  const handleAssignItemToActiveFolder = React.useCallback(
    async (item: { kind: "media" | "prompt"; id: string }): Promise<boolean> => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch({
          folderId: activeFolderId,
          action: "assign",
          mediaIds: item.kind === "media" ? [item.id] : [],
          promptIds: item.kind === "prompt" ? [item.id] : [],
        });
        setMembershipMessage("Added to this folder.");
        await refreshActiveRows();
        return true;
      } catch (membershipError) {
        setFolderError(
          toMediaLibraryErrorText(membershipError, "Unable to update folder membership.")
        );
        return false;
      }
    },
    [activeFolderId, refreshActiveRows, setFolderError, setMembershipMessage]
  );

  const uploadDroppedFilesToFolder = React.useCallback(
    async ({
      targetFolderId,
      files,
    }: {
      targetFolderId: string;
      files: FileList;
    }): Promise<MediaFileRow[]> => {
      const droppedFiles = Array.from(files);
      if (!droppedFiles.length) return [];

      setFolderError(null);
      setMembershipMessage(null);

      const uploadCandidates = droppedFiles
        .map((file) => ({
          file,
          destinationTab: resolveUploadDestinationTabForFile(file),
        }))
        .filter(
          (candidate): candidate is { file: File; destinationTab: MediaUploadDestinationTab } =>
            candidate.destinationTab !== null
        );
      if (!uploadCandidates.length) {
        throw new Error("Only image and video files can be dropped here.");
      }

      const uploadedRows: MediaFileRow[] = [];
      for (const candidate of uploadCandidates) {
        const uploaded = await uploadMediaFile({
          file: candidate.file,
          destinationTab: candidate.destinationTab,
        });
        uploadedRows.push({
          id: uploaded.id,
          filename: uploaded.filename,
          storage_path: uploaded.storage_path,
          preview_storage_path: uploaded.preview_storage_path,
          file_type: uploaded.file_type,
          source: uploaded.source,
          created_at: uploaded.created_at,
          metadata: null,
          signedUrl: uploaded.signedUrl,
        });
      }

      if (targetFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID && uploadedRows.length > 0) {
        await applyMediaFolderMembershipBatch({
          action: "assign",
          folderId: targetFolderId,
          mediaIds: uploadedRows.map((row) => row.id),
          promptIds: [],
        });
      }

      const targetFolderName =
        targetFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID
          ? ROOT_FOLDER_LABEL
          : (folders.find((folder) => folder.id === targetFolderId)?.name ?? "folder");
      const uploadedCount = uploadedRows.length;
      const skippedCount = Math.max(0, droppedFiles.length - uploadedCount);
      setMembershipMessage(
        skippedCount > 0
          ? `Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"} to ${targetFolderName}. Skipped ${skippedCount} unsupported file${skippedCount === 1 ? "" : "s"}.`
          : `Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"} to ${targetFolderName}.`
      );

      if (targetFolderId === activeFolderId && uploadedRows.length > 0) {
        setMediaRows((previous) => {
          const byId = new Map(previous.map((row) => [row.id, row]));
          uploadedRows.forEach((row) => {
            byId.set(row.id, row);
          });
          const nextRows = Array.from(byId.values());
          nextRows.sort((left, right) => {
            const createdDelta = createdAtTime(right.created_at) - createdAtTime(left.created_at);
            if (createdDelta !== 0) return createdDelta;
            return right.id.localeCompare(left.id);
          });
          return nextRows;
        });
      }

      try {
        await refreshActiveRows();
      } catch (refreshError) {
        setFolderError(
          toMediaLibraryErrorText(
            refreshError,
            "Uploaded media, but failed to refresh folder contents."
          )
        );
      }
      return uploadedRows;
    },
    [activeFolderId, folders, refreshActiveRows, setFolderError, setMediaRows, setMembershipMessage]
  );

  const handleDeleteMediaFromLibrary = React.useCallback(
    async (file: MediaFileRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await deleteMediaFileWithStorage(file);
        setMediaRows((previous) => previous.filter((row) => row.id !== file.id));
        setMembershipMessage("Deleted from All Media.");
        void logMediaEvent("delete", "media_file", file.id, {
          storage_path: file.storage_path,
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(toMediaLibraryErrorText(deleteError, "Unable to delete media."));
      }
    },
    [activeFolderId, setFolderError, setMediaRows, setMembershipMessage]
  );

  const handleDeletePromptFromLibrary = React.useCallback(
    async (prompt: PromptRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await deleteMediaPromptById(prompt.id);
        setPromptRows((previous) => previous.filter((row) => row.id !== prompt.id));
        setMembershipMessage("Deleted from All Media.");
        void logMediaEvent("delete", "media_prompt", prompt.id, {
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(toMediaLibraryErrorText(deleteError, "Unable to delete prompt."));
      }
    },
    [activeFolderId, setFolderError, setMembershipMessage, setPromptRows]
  );

  const resetDeleteConfirmState = React.useCallback(() => {
    setPendingLibraryDelete(null);
    setDeleteConfirmSubmitting(false);
  }, []);

  const closeDeleteConfirm = React.useCallback(() => {
    if (deleteConfirmSubmitting) return;
    setPendingLibraryDelete(null);
  }, [deleteConfirmSubmitting]);

  const confirmDeleteFromLibrary = React.useCallback(async () => {
    if (!pendingLibraryDelete) return;
    if (deleteConfirmSubmitting) return;
    setDeleteConfirmSubmitting(true);
    try {
      if (pendingLibraryDelete.kind === "media") {
        await handleDeleteMediaFromLibrary(pendingLibraryDelete.file);
      } else {
        await handleDeletePromptFromLibrary(pendingLibraryDelete.prompt);
      }
      setPendingLibraryDelete(null);
    } finally {
      setDeleteConfirmSubmitting(false);
    }
  }, [
    deleteConfirmSubmitting,
    handleDeleteMediaFromLibrary,
    handleDeletePromptFromLibrary,
    pendingLibraryDelete,
  ]);

  return {
    pendingLibraryDelete,
    setPendingLibraryDelete,
    deleteConfirmSubmitting,
    resetDeleteConfirmState,
    closeDeleteConfirm,
    confirmDeleteFromLibrary,
    handleRemoveItemFromActiveFolder,
    handleAssignItemToActiveFolder,
    uploadDroppedFilesToFolder,
  };
};
