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
  if (mimeType.startsWith("image/") || mimeType.startsWith("audio/")) return "uploaded_images";
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
  projectId?: string | null;
  activeFolderId: string;
  folders: Array<{ id: string; name: string }>;
  refreshActiveRows: () => Promise<void>;
  refreshFolders: () => Promise<void>;
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
  deleteMediaRowsFromLibrary: (rows: MediaFileRow[]) => Promise<boolean>;
  handleRemoveItemFromActiveFolder: (item: {
    kind: "media" | "prompt";
    id: string;
  }) => Promise<void>;
  handleRemoveItemsFromActiveFolder: (items: {
    mediaIds?: string[];
    promptIds?: string[];
  }) => Promise<boolean>;
  handleAssignItemToActiveFolder: (item: {
    kind: "media" | "prompt";
    id: string;
  }) => Promise<boolean>;
  handleMoveItemsToFolder: (items: {
    mediaIds?: string[];
    promptIds?: string[];
    targetFolderId: string;
  }) => Promise<boolean>;
  uploadDroppedFilesToFolder: (params: {
    targetFolderId: string;
    files: FileList | File[];
  }) => Promise<MediaFileRow[]>;
};

export const useMediaLibraryPanelMutationController = ({
  projectId = null,
  activeFolderId,
  folders,
  refreshActiveRows,
  refreshFolders,
  setFolderError,
  setMembershipMessage,
  setMediaRows,
  setPromptRows,
}: UseMediaLibraryPanelMutationControllerParams): UseMediaLibraryPanelMutationControllerResult => {
  const [pendingLibraryDelete, setPendingLibraryDelete] =
    React.useState<PendingLibraryDeleteState | null>(null);
  const [deleteConfirmSubmitting, setDeleteConfirmSubmitting] = React.useState(false);

  const refreshFolderState = React.useCallback(async () => {
    await refreshFolders().catch(() => undefined);
  }, [refreshFolders]);

  const runFolderMembershipBatch = React.useCallback(
    async ({
      action,
      mediaIds = [],
      promptIds = [],
      targetFolderId,
      successMessage,
      sourceFolderId,
    }: {
      action: "assign" | "unassign" | "move";
      mediaIds?: string[];
      promptIds?: string[];
      targetFolderId?: string;
      successMessage: string;
      sourceFolderId?: string;
    }): Promise<boolean> => {
      const normalizedMediaIds = Array.from(
        new Set(mediaIds.map((id) => id.trim()).filter(Boolean))
      );
      const normalizedPromptIds = Array.from(
        new Set(promptIds.map((id) => id.trim()).filter(Boolean))
      );
      if (!normalizedMediaIds.length && !normalizedPromptIds.length) return false;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        if (action === "move") {
          const normalizedTargetFolderId = targetFolderId?.trim() ?? "";
          if (!normalizedTargetFolderId || normalizedTargetFolderId === activeFolderId) {
            return false;
          }
          await applyMediaFolderMembershipBatch(
            {
              action,
              sourceFolderId: sourceFolderId ?? activeFolderId,
              targetFolderId: normalizedTargetFolderId,
              mediaIds: normalizedMediaIds,
              promptIds: normalizedPromptIds,
            },
            projectId
          );
        } else {
          const normalizedFolderId =
            (targetFolderId ?? activeFolderId ?? MEDIA_LIBRARY_ROOT_FOLDER_ID).trim() ||
            MEDIA_LIBRARY_ROOT_FOLDER_ID;
          if (normalizedFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) {
            return false;
          }
          await applyMediaFolderMembershipBatch(
            {
              action,
              folderId: normalizedFolderId,
              mediaIds: normalizedMediaIds,
              promptIds: normalizedPromptIds,
            },
            projectId
          );
        }
        setMembershipMessage(successMessage);
        await Promise.all([refreshActiveRows(), refreshFolderState()]);
        return true;
      } catch (membershipError) {
        setFolderError(
          toMediaLibraryErrorText(membershipError, "Unable to update folder membership.")
        );
        return false;
      }
    },
    [
      activeFolderId,
      projectId,
      refreshActiveRows,
      refreshFolderState,
      setFolderError,
      setMembershipMessage,
    ]
  );

  const handleRemoveItemFromActiveFolder = React.useCallback(
    async (item: { kind: "media" | "prompt"; id: string }) => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch(
          {
            folderId: activeFolderId,
            action: "unassign",
            mediaIds: item.kind === "media" ? [item.id] : [],
            promptIds: item.kind === "prompt" ? [item.id] : [],
          },
          projectId
        );
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
    [activeFolderId, projectId, setFolderError, setMediaRows, setMembershipMessage, setPromptRows]
  );

  const handleRemoveItemsFromActiveFolder = React.useCallback(
    async ({
      mediaIds = [],
      promptIds = [],
    }: {
      mediaIds?: string[];
      promptIds?: string[];
    }): Promise<boolean> => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
      return await runFolderMembershipBatch({
        action: "unassign",
        mediaIds,
        promptIds,
        successMessage: "Removed from this folder.",
      });
    },
    [activeFolderId, runFolderMembershipBatch]
  );

  const handleAssignItemToActiveFolder = React.useCallback(
    async (item: { kind: "media" | "prompt"; id: string }): Promise<boolean> => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch(
          {
            folderId: activeFolderId,
            action: "assign",
            mediaIds: item.kind === "media" ? [item.id] : [],
            promptIds: item.kind === "prompt" ? [item.id] : [],
          },
          projectId
        );
        setMembershipMessage("Added to this folder.");
        await Promise.all([refreshActiveRows(), refreshFolderState()]);
        return true;
      } catch (membershipError) {
        setFolderError(
          toMediaLibraryErrorText(membershipError, "Unable to update folder membership.")
        );
        return false;
      }
    },
    [
      activeFolderId,
      projectId,
      refreshActiveRows,
      refreshFolderState,
      setFolderError,
      setMembershipMessage,
    ]
  );

  const handleMoveItemsToFolder = React.useCallback(
    async ({
      mediaIds = [],
      promptIds = [],
      targetFolderId,
    }: {
      mediaIds?: string[];
      promptIds?: string[];
      targetFolderId: string;
    }): Promise<boolean> => {
      const normalizedTargetFolderId = targetFolderId.trim();
      if (!normalizedTargetFolderId) return false;
      const targetFolderName =
        folders.find((folder) => folder.id === normalizedTargetFolderId)?.name ?? "folder";
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) {
        return await runFolderMembershipBatch({
          action: "assign",
          mediaIds,
          promptIds,
          targetFolderId: normalizedTargetFolderId,
          successMessage: `Added to ${targetFolderName}.`,
        });
      }
      return await runFolderMembershipBatch({
        action: "move",
        mediaIds,
        promptIds,
        sourceFolderId: activeFolderId,
        targetFolderId: normalizedTargetFolderId,
        successMessage: `Moved to ${targetFolderName}.`,
      });
    },
    [activeFolderId, folders, runFolderMembershipBatch]
  );

  const uploadDroppedFilesToFolder = React.useCallback(
    async ({
      targetFolderId,
      files,
    }: {
      targetFolderId: string;
      files: FileList | File[];
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
        throw new Error("Only image, video, and audio files can be dropped here.");
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
        await applyMediaFolderMembershipBatch(
          {
            action: "assign",
            folderId: targetFolderId,
            mediaIds: uploadedRows.map((row) => row.id),
            promptIds: [],
          },
          projectId
        );
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
        await Promise.all([refreshActiveRows(), refreshFolderState()]);
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
    [
      activeFolderId,
      folders,
      projectId,
      refreshActiveRows,
      refreshFolderState,
      setFolderError,
      setMediaRows,
      setMembershipMessage,
    ]
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
        await refreshFolderState();
        void logMediaEvent("delete", "media_file", file.id, {
          storage_path: file.storage_path,
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(toMediaLibraryErrorText(deleteError, "Unable to delete media."));
      }
    },
    [activeFolderId, refreshFolderState, setFolderError, setMediaRows, setMembershipMessage]
  );

  const deleteMediaRowsFromLibrary = React.useCallback(
    async (rows: MediaFileRow[]): Promise<boolean> => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
      const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
      if (!uniqueRows.length) return false;
      setMembershipMessage(null);
      setFolderError(null);
      setDeleteConfirmSubmitting(true);
      const deletedIds: string[] = [];
      let firstError: unknown = null;

      for (const row of uniqueRows) {
        try {
          await deleteMediaFileWithStorage(row);
          deletedIds.push(row.id);
          void logMediaEvent("delete", "media_file", row.id, {
            storage_path: row.storage_path,
            surface: "ai-studio-media-library-panel",
          });
        } catch (deleteError) {
          if (firstError == null) {
            firstError = deleteError;
          }
        }
      }

      if (deletedIds.length) {
        const deletedIdSet = new Set(deletedIds);
        setMediaRows((previous) => previous.filter((row) => !deletedIdSet.has(row.id)));
        await refreshFolderState();
      }

      if (deletedIds.length === uniqueRows.length) {
        setMembershipMessage(
          deletedIds.length === 1
            ? "Deleted 1 item from All Media."
            : `Deleted ${deletedIds.length} items from All Media.`
        );
        setDeleteConfirmSubmitting(false);
        return true;
      }

      if (deletedIds.length > 0) {
        setMembershipMessage(
          deletedIds.length === 1
            ? "Deleted 1 item from All Media."
            : `Deleted ${deletedIds.length} items from All Media.`
        );
      }
      setFolderError(
        toMediaLibraryErrorText(
          firstError,
          deletedIds.length
            ? "Some selected media could not be deleted."
            : "Unable to delete selected media."
        )
      );
      setDeleteConfirmSubmitting(false);
      return false;
    },
    [activeFolderId, refreshFolderState, setFolderError, setMediaRows, setMembershipMessage]
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
        await refreshFolderState();
        void logMediaEvent("delete", "media_prompt", prompt.id, {
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(toMediaLibraryErrorText(deleteError, "Unable to delete prompt."));
      }
    },
    [activeFolderId, refreshFolderState, setFolderError, setMembershipMessage, setPromptRows]
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
    deleteMediaRowsFromLibrary,
    handleRemoveItemFromActiveFolder,
    handleRemoveItemsFromActiveFolder,
    handleAssignItemToActiveFolder,
    handleMoveItemsToFolder,
    uploadDroppedFilesToFolder,
  };
};
