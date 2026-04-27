/**
 * Bulk-delete controller for Media Library selections.
 * Handles prompt/media delete orchestration, confirmation state, and cache/storage reconciliation.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";
import { resolveMediaPreviewStoragePath } from "../logic/mediaPreviewStoragePath";

type BulkDeleteMediaRowBase = {
  id: string;
  storage_path: string;
  file_type: string;
  metadata?: Record<string, unknown> | null;
  preview_storage_path?: string;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

type BulkDeletePromptRowBase = {
  id: string;
};

type MediaDeleteTargetShape = {
  id: string;
  storage_path: string;
  preview_storage_path?: string;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

type MediaDeleteLookupRow = Pick<
  BulkDeleteMediaRowBase,
  | "id"
  | "storage_path"
  | "file_type"
  | "metadata"
  | "thumb_variant_path"
  | "poster_variant_path"
  | "preview_variant_path"
>;

type UseMediaBulkDeleteControllerArgs<
  TMediaRow extends BulkDeleteMediaRowBase,
  TPromptRow extends BulkDeletePromptRowBase,
> = {
  activeTabKey: string;
  activeMediaTab: MediaDataTab | null;
  collectMediaStoragePathsForDelete: (targets: MediaDeleteTargetShape[]) => Promise<string[]>;
  currentUserIdRef: MutableRefObject<string | null>;
  files: TMediaRow[];
  getErrorMessage: (error: unknown, fallback: string) => string;
  isPromptTab: boolean;
  logMediaEvent: (
    eventType: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  markInactiveMediaCachesStale: (currentTab: MediaDataTab | null) => void;
  refreshStorageUsageBytes: () => Promise<void>;
  removeStoragePaths: (paths: string[]) => Promise<void>;
  selectedIds: string[];
  setPageError: Dispatch<SetStateAction<string | null>>;
  setPrompts: Dispatch<SetStateAction<TPromptRow[]>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  updateVisibleRows: (updater: (prev: TMediaRow[]) => TMediaRow[]) => void;
};

/**
 * Creates selection-delete handlers for prompt/media tabs plus confirmation modal state.
 * Inputs: selected ids, tab context, and callbacks for cache/storage and UI state mutations.
 * Output: delete action handlers and confirmation state for selected media rows.
 * Side effects: runs Supabase deletes, storage cleanup, cache invalidation, and usage refresh.
 */
export const useMediaBulkDeleteController = <
  TMediaRow extends BulkDeleteMediaRowBase,
  TPromptRow extends BulkDeletePromptRowBase,
>({
  activeTabKey,
  activeMediaTab,
  collectMediaStoragePathsForDelete,
  currentUserIdRef,
  files,
  getErrorMessage,
  isPromptTab,
  logMediaEvent,
  markInactiveMediaCachesStale,
  refreshStorageUsageBytes,
  removeStoragePaths,
  selectedIds,
  setPageError,
  setPrompts,
  setSelectedIds,
  updateVisibleRows,
}: UseMediaBulkDeleteControllerArgs<TMediaRow, TPromptRow>) => {
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const bulkDeleteInFlightRef = useRef(false);

  useEffect(() => {
    setConfirmDeleteIds(null);
  }, [activeTabKey]);

  useEffect(() => {
    if (selectedIds.length) return;
    setConfirmDeleteIds(null);
  }, [selectedIds.length]);

  const deleteSelected = useCallback(
    async (idsOverride?: string[]): Promise<boolean> => {
      const idsToDelete = [...(idsOverride ?? selectedIds)];
      if (!idsToDelete.length || bulkDeleteInFlightRef.current) return false;
      bulkDeleteInFlightRef.current = true;
      setBulkDeleting(true);
      setPageError(null);

      try {
        const supabase = ensureSupabaseQueryClient();
        if (isPromptTab) {
          const { error: deleteError } = await supabase
            .from("media_prompts")
            .delete()
            .in("id", idsToDelete);
          if (deleteError) throw deleteError;
          setPrompts((prev) => prev.filter((prompt) => !idsToDelete.includes(prompt.id)));
          setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
          idsToDelete.forEach((promptId) => {
            void logMediaEvent("delete", "media_prompt", promptId);
          });
        } else {
          let targets: MediaDeleteTargetShape[] = files
            .filter((file) => idsToDelete.includes(file.id))
            .map((file) => ({
              id: file.id,
              storage_path: file.storage_path,
              preview_storage_path: file.preview_storage_path,
              thumb_variant_path: file.thumb_variant_path,
              poster_variant_path: file.poster_variant_path,
              preview_variant_path: file.preview_variant_path,
            }));

          if (targets.length < idsToDelete.length) {
            const targetIdSet = new Set(targets.map((target) => target.id));
            const missingIds = idsToDelete.filter((id) => !targetIdSet.has(id));
            if (missingIds.length) {
              const { data: missingRows, error: missingRowsError } = await supabase
                .from("media_files")
                .select(
                  "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
                )
                .in("id", missingIds);
              if (missingRowsError) throw missingRowsError;

              const supplementalTargets = ((missingRows ?? []) as MediaDeleteLookupRow[]).map(
                (row) => ({
                  id: row.id,
                  storage_path: row.storage_path,
                  preview_storage_path: resolveMediaPreviewStoragePath(
                    row,
                    currentUserIdRef.current
                  ),
                  thumb_variant_path: row.thumb_variant_path,
                  poster_variant_path: row.poster_variant_path,
                  preview_variant_path: row.preview_variant_path,
                })
              );
              targets = [...targets, ...supplementalTargets];
            }
          }

          const paths = await collectMediaStoragePathsForDelete(targets);
          const { error: deleteError } = await supabase
            .from("media_files")
            .delete()
            .in("id", idsToDelete);
          if (deleteError) throw deleteError;

          updateVisibleRows((prev) => prev.filter((file) => !idsToDelete.includes(file.id)));
          setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
          targets.forEach((target) => {
            void logMediaEvent("delete", "media_file", target.id, {
              storage_path: target.storage_path,
            });
          });
          markInactiveMediaCachesStale(activeMediaTab);
          void refreshStorageUsageBytes();
          try {
            await removeStoragePaths(paths);
          } catch (storageError) {
            console.warn("Bulk media storage cleanup failed after DB delete", storageError);
          }
        }

        return true;
      } catch (err: unknown) {
        setPageError(
          getErrorMessage(err, `Unable to delete selected ${isPromptTab ? "prompts" : "media"}`)
        );
        return false;
      } finally {
        bulkDeleteInFlightRef.current = false;
        setBulkDeleting(false);
      }
    },
    [
      activeMediaTab,
      collectMediaStoragePathsForDelete,
      currentUserIdRef,
      files,
      getErrorMessage,
      isPromptTab,
      logMediaEvent,
      markInactiveMediaCachesStale,
      refreshStorageUsageBytes,
      removeStoragePaths,
      selectedIds,
      setPageError,
      setPrompts,
      setSelectedIds,
      updateVisibleRows,
    ]
  );

  const requestDeleteSelected = useCallback(() => {
    if (!selectedIds.length || bulkDeleting) return;
    if (isPromptTab) {
      void deleteSelected();
      return;
    }
    setConfirmDeleteIds([...selectedIds]);
    setPageError(null);
  }, [bulkDeleting, deleteSelected, isPromptTab, selectedIds, setPageError]);

  const cancelDeleteSelected = useCallback(() => {
    setConfirmDeleteIds(null);
  }, []);

  const confirmDeleteSelected = useCallback(async () => {
    const nextConfirmDeleteIds = confirmDeleteIds ? [...confirmDeleteIds] : null;
    if (!nextConfirmDeleteIds?.length) return;
    setConfirmDeleteIds(null);
    await deleteSelected(nextConfirmDeleteIds);
  }, [confirmDeleteIds, deleteSelected]);

  return {
    bulkDeleting,
    cancelDeleteSelected,
    confirmDeleteIds,
    confirmDeleteSelected,
    requestDeleteSelected,
  };
};
