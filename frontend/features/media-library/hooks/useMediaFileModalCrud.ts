/**
 * File-modal CRUD controller for Media Library.
 * Owns open/close, rename, and single-file delete behavior for the focused media modal.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";

type MediaFileModalRow = {
  id: string;
  filename: string;
  storage_path: string;
  status?: "uploading" | "ready";
};

type MediaDeleteTargetShape = {
  id: string;
  storage_path: string;
  preview_storage_path?: string;
  thumb_variant_path?: string;
  poster_variant_path?: string;
  preview_variant_path?: string;
};

type UseMediaFileModalCrudArgs<TRow extends MediaFileModalRow> = {
  activeMediaTab: MediaDataTab | null;
  collectMediaStoragePathsForDelete: (targets: MediaDeleteTargetShape[]) => Promise<string[]>;
  focusedFile: TRow | null;
  getErrorMessage: (error: unknown, fallback: string) => string;
  logMediaEvent: (
    eventType: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  markInactiveMediaCachesStale: (currentTab: MediaDataTab | null) => void;
  refreshStorageUsageBytes: () => Promise<void>;
  removeStoragePaths: (paths: string[]) => Promise<void>;
  setPageError: (message: string | null) => void;
  setFocusedFile: Dispatch<SetStateAction<TRow | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  updateVisibleRows: (updater: (prev: TRow[]) => TRow[]) => void;
};

/**
 * Creates modal state and handlers for focused file CRUD operations.
 * Inputs: callbacks for cache/storage mutations and UI-reset behavior.
 * Output: modal state plus action handlers for open/close, rename, and delete.
 * Side effects: executes Supabase updates/deletes and triggers provided cache/storage callbacks.
 */
export const useMediaFileModalCrud = <TRow extends MediaFileModalRow>({
  activeMediaTab,
  collectMediaStoragePathsForDelete,
  focusedFile,
  getErrorMessage,
  logMediaEvent,
  markInactiveMediaCachesStale,
  refreshStorageUsageBytes,
  removeStoragePaths,
  setPageError,
  setFocusedFile,
  setSelectedIds,
  updateVisibleRows,
}: UseMediaFileModalCrudArgs<TRow>) => {
  const [deleteTarget, setDeleteTarget] = useState<TRow | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState(false);

  const openModal = useCallback(
    (file: TRow) => {
      setFocusedFile(file);
      setRenameValue(file.filename);
      setModalError(null);
    },
    [setFocusedFile]
  );

  const closeModal = useCallback(() => {
    setFocusedFile(null);
    setRenameValue("");
    setModalError(null);
    setRenameSuccess(false);
  }, [setFocusedFile]);

  const handleRenameInputChange = useCallback((nextValue: string) => {
    setRenameValue(nextValue);
    setRenameSuccess(false);
  }, []);

  const requestDeleteFile = useCallback(
    (file: TRow) => {
      if (file.status === "uploading") return;
      setDeleteTarget(file);
      setPageError(null);
    },
    [setPageError]
  );

  const cancelDeleteFile = useCallback(() => {
    if (deletingSingle) return;
    setDeleteTarget(null);
  }, [deletingSingle]);

  const confirmDeleteFile = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingSingle(true);
    setPageError(null);
    try {
      const supabase = ensureSupabaseClient();
      const deletePaths = await collectMediaStoragePathsForDelete([deleteTarget]);
      await removeStoragePaths(deletePaths);
      const { error: deleteError } = await supabase
        .from("media_files")
        .delete()
        .eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;
      updateVisibleRows((prev) => prev.filter((file) => file.id !== deleteTarget.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setFocusedFile((prev) => (prev && prev.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      markInactiveMediaCachesStale(activeMediaTab);
      void refreshStorageUsageBytes();
      void logMediaEvent("delete", "media_file", deleteTarget.id, {
        storage_path: deleteTarget.storage_path,
      });
    } catch (err: unknown) {
      setPageError(getErrorMessage(err, "Unable to delete file"));
    } finally {
      setDeletingSingle(false);
    }
  }, [
    activeMediaTab,
    collectMediaStoragePathsForDelete,
    deleteTarget,
    getErrorMessage,
    logMediaEvent,
    markInactiveMediaCachesStale,
    refreshStorageUsageBytes,
    removeStoragePaths,
    setPageError,
    setFocusedFile,
    setSelectedIds,
    updateVisibleRows,
  ]);

  const saveRename = useCallback(async () => {
    if (!focusedFile) return;
    setSavingRename(true);
    setModalError(null);
    setRenameSuccess(false);
    try {
      const previousName = focusedFile.filename;
      const nextName = renameValue.trim();
      const supabase = ensureSupabaseClient();
      const { error } = await supabase
        .from("media_files")
        .update({ filename: nextName })
        .eq("id", focusedFile.id);
      if (error) throw error;
      updateVisibleRows((prev) =>
        prev.map((file) => (file.id === focusedFile.id ? { ...file, filename: nextName } : file))
      );
      setFocusedFile((prev) => (prev ? { ...prev, filename: nextName } : prev));
      markInactiveMediaCachesStale(activeMediaTab);
      setRenameSuccess(true);
      window.setTimeout(() => setRenameSuccess(false), 1800);
      void logMediaEvent("rename", "media_file", focusedFile.id, {
        from: previousName,
        to: nextName,
      });
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Unable to rename file"));
    } finally {
      setSavingRename(false);
    }
  }, [
    activeMediaTab,
    focusedFile,
    getErrorMessage,
    logMediaEvent,
    markInactiveMediaCachesStale,
    renameValue,
    setFocusedFile,
    updateVisibleRows,
  ]);

  return {
    cancelDeleteFile,
    closeModal,
    confirmDeleteFile,
    deleteTarget,
    deletingSingle,
    handleRenameInputChange,
    modalError,
    openModal,
    renameSuccess,
    renameValue,
    requestDeleteFile,
    saveRename,
    savingRename,
    setModalError,
  };
};
