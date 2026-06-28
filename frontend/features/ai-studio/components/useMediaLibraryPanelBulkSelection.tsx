/**
 * Media Library panel bulk-selection controls.
 * Keeps multi-select delete/move state out of the panel shell while preserving
 * the existing toolbar and dialog behavior.
 */
import React, { useCallback, useMemo, useState } from "react";

import type { MediaFileRow } from "../logic/mediaLibraryModalModel";
import { MediaLibraryPanelBulkActions } from "./MediaLibraryPanelBulkActions";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";

type BulkMoveDestinationOption = {
  id: string;
  label: string;
};

type UseMediaLibraryPanelBulkSelectionArgs = {
  activeFolderGridMediaRows: MediaFileRow[];
  bulkMoveDestinationOptions: BulkMoveDestinationOption[];
  clearSelections: () => void;
  deleteConfirmSubmitting: boolean;
  deleteMediaRowsFromLibrary: (rows: MediaFileRow[]) => Promise<unknown>;
  handleMoveItemsToFolder: (options: {
    mediaIds: string[];
    targetFolderId: string;
  }) => Promise<boolean>;
  handleRemoveItemsFromActiveFolder: (options: { mediaIds: string[] }) => Promise<boolean>;
  isRootFolderSelected: boolean;
  itemType: MediaLibraryPanelItemType;
  mediaRows: MediaFileRow[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  shouldShowMedia: boolean;
  visibleAudioRows: MediaFileRow[];
  visibleImageRows: MediaFileRow[];
  visibleVideoRows: MediaFileRow[];
};

/**
 * Owns Media Library panel bulk-selection state and action rendering.
 * Inputs are current visible media sets plus the canonical mutation callbacks.
 */
export const useMediaLibraryPanelBulkSelection = ({
  activeFolderGridMediaRows,
  bulkMoveDestinationOptions,
  clearSelections,
  deleteConfirmSubmitting,
  deleteMediaRowsFromLibrary,
  handleMoveItemsToFolder,
  handleRemoveItemsFromActiveFolder,
  isRootFolderSelected,
  itemType,
  mediaRows,
  selectedIds,
  setSelectedIds,
  shouldShowMedia,
  visibleAudioRows,
  visibleImageRows,
  visibleVideoRows,
}: UseMediaLibraryPanelBulkSelectionArgs) => {
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkMoveDialogSelectionKey, setBulkMoveDialogSelectionKey] = useState<string | null>(null);

  const bulkVisibleMediaRows = useMemo(() => {
    if (!shouldShowMedia) return [] as MediaFileRow[];
    if (!isRootFolderSelected) {
      return activeFolderGridMediaRows;
    }
    if (itemType === "images") return visibleImageRows;
    if (itemType === "videos") return visibleVideoRows;
    if (itemType === "audio") return visibleAudioRows;
    if (itemType === "all") return mediaRows;
    return [];
  }, [
    activeFolderGridMediaRows,
    isRootFolderSelected,
    itemType,
    mediaRows,
    shouldShowMedia,
    visibleAudioRows,
    visibleImageRows,
    visibleVideoRows,
  ]);

  const selectedVisibleMediaRows = useMemo(() => {
    if (!selectedIds.size) return [] as MediaFileRow[];
    return bulkVisibleMediaRows.filter((row) => selectedIds.has(row.id));
  }, [bulkVisibleMediaRows, selectedIds]);

  const selectedVisibleMediaIds = useMemo(
    () => selectedVisibleMediaRows.map((row) => row.id),
    [selectedVisibleMediaRows]
  );

  const selectedVisibleMediaKey = useMemo(
    () => selectedVisibleMediaIds.slice().sort().join("|"),
    [selectedVisibleMediaIds]
  );

  const activePendingBulkDeleteIds = useMemo(() => {
    if (!pendingBulkDeleteIds?.length || !selectedVisibleMediaIds.length) return null;
    const selectedIdSet = new Set(selectedVisibleMediaIds);
    return pendingBulkDeleteIds.every((id) => selectedIdSet.has(id)) ? pendingBulkDeleteIds : null;
  }, [pendingBulkDeleteIds, selectedVisibleMediaIds]);

  const bulkMoveDialogOpen =
    selectedVisibleMediaKey.length > 0 && bulkMoveDialogSelectionKey === selectedVisibleMediaKey;

  const handleCloseBulkDeleteConfirm = useCallback(() => {
    setPendingBulkDeleteIds(null);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    const nextPendingBulkDeleteIds = activePendingBulkDeleteIds
      ? [...activePendingBulkDeleteIds]
      : null;
    if (!nextPendingBulkDeleteIds?.length) return;
    setPendingBulkDeleteIds(null);
    const selectedIdSet = new Set(nextPendingBulkDeleteIds);
    const selectedRows = mediaRows.filter((row) => selectedIdSet.has(row.id));
    const deleted = await deleteMediaRowsFromLibrary(selectedRows);
    if (deleted) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of nextPendingBulkDeleteIds) {
        if (!mediaRows.some((row) => row.id === id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [activePendingBulkDeleteIds, deleteMediaRowsFromLibrary, mediaRows, setSelectedIds]);

  const handleOpenBulkDeleteConfirm = useCallback(() => {
    if (!selectedVisibleMediaRows.length || !isRootFolderSelected) return;
    setBulkMoveDialogSelectionKey(null);
    setPendingBulkDeleteIds(selectedVisibleMediaRows.map((row) => row.id));
  }, [isRootFolderSelected, selectedVisibleMediaRows]);

  const canMoveSelectedMediaToFolder = bulkMoveDestinationOptions.length > 0;
  const handleOpenBulkMoveDialog = useCallback(() => {
    if (!selectedVisibleMediaRows.length || !canMoveSelectedMediaToFolder) return;
    setPendingBulkDeleteIds(null);
    setBulkMoveDialogSelectionKey(selectedVisibleMediaKey);
  }, [canMoveSelectedMediaToFolder, selectedVisibleMediaKey, selectedVisibleMediaRows.length]);

  const handleCloseBulkMoveDialog = useCallback(() => setBulkMoveDialogSelectionKey(null), []);

  const handleMoveSelectedMediaToFolder = useCallback(
    async (targetFolderId: string) => {
      if (!selectedVisibleMediaRows.length) return;
      const moved = await handleMoveItemsToFolder({
        mediaIds: selectedVisibleMediaRows.map((row) => row.id),
        targetFolderId,
      });
      if (!moved) return;
      setBulkMoveDialogSelectionKey(null);
      setSelectedIds(new Set());
    },
    [handleMoveItemsToFolder, selectedVisibleMediaRows, setSelectedIds]
  );

  const handleRemoveSelectedMediaFromFolder = useCallback(async () => {
    if (!selectedVisibleMediaRows.length || isRootFolderSelected) return;
    const removed = await handleRemoveItemsFromActiveFolder({
      mediaIds: selectedVisibleMediaRows.map((row) => row.id),
    });
    if (!removed) return;
    setSelectedIds(new Set());
  }, [
    handleRemoveItemsFromActiveFolder,
    isRootFolderSelected,
    selectedVisibleMediaRows,
    setSelectedIds,
  ]);

  const bulkActions = useMemo(
    () => (
      <MediaLibraryPanelBulkActions
        canDeleteFromLibrary={isRootFolderSelected}
        canMoveToFolder={canMoveSelectedMediaToFolder}
        canRemoveFromFolder={!isRootFolderSelected}
        disabled={deleteConfirmSubmitting}
        onClearSelection={clearSelections}
        onMoveToFolder={handleOpenBulkMoveDialog}
        onDeleteFromLibrary={handleOpenBulkDeleteConfirm}
        onRemoveFromFolder={() => {
          void handleRemoveSelectedMediaFromFolder();
        }}
        selectedCount={selectedVisibleMediaRows.length}
      />
    ),
    [
      canMoveSelectedMediaToFolder,
      clearSelections,
      deleteConfirmSubmitting,
      handleOpenBulkDeleteConfirm,
      handleOpenBulkMoveDialog,
      handleRemoveSelectedMediaFromFolder,
      isRootFolderSelected,
      selectedVisibleMediaRows.length,
    ]
  );

  return {
    bulkActions,
    bulkMoveDialogOpen,
    bulkVisibleMediaRows,
    handleCloseBulkDeleteConfirm,
    handleCloseBulkMoveDialog,
    handleConfirmBulkDelete,
    handleMoveSelectedMediaToFolder,
    pendingBulkDeleteIds: activePendingBulkDeleteIds,
    selectedVisibleMediaRows,
  };
};
