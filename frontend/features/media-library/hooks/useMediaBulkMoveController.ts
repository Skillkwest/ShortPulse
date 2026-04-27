/**
 * Bulk-move controller for Media Library selections.
 * Handles destination eligibility, move-batch orchestration, cache/state reconciliation, and feedback.
 */
import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import {
  getSignedMediaUrlsBatch,
  invalidateSignedMediaUrl,
} from "../../../lib/mediaSignedUrlCache";
import { buildBulkMoveFeedback } from "../logic/bulkMoveFeedback";
import { resolveMediaPreviewStoragePath } from "../logic/mediaPreviewStoragePath";
import { buildBulkMoveTabOptions, getMoveTabLabel, type MediaTab } from "../logic/mediaMoveRouting";
import {
  BUCKET,
  getMediaDataTabForRow,
  mergePageRows,
  type MediaDataTab,
} from "../logic/mediaLibraryPageHelpers";

type BulkMoveMediaRowBase = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string | null;
  status?: "uploading" | "ready";
  preview_storage_path?: string;
  signedUrl?: string;
};

type MoveMediaBatchResponse<TRow extends BulkMoveMediaRowBase> = {
  destinationTab: MediaDataTab;
  moved: Array<{
    fileId: string;
    file: TRow;
    fromTab: MediaDataTab;
    toTab: MediaDataTab;
    previousStoragePath: string;
    nextStoragePath: string;
  }>;
  failed: Array<{
    fileId: string;
    error: string;
    details?: string;
  }>;
};

const MOVE_BATCH_REQUEST_SIZE = 100;

const chunkIds = (ids: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size));
  }
  return chunks;
};

type UseMediaBulkMoveControllerArgs<TRow extends BulkMoveMediaRowBase> = {
  activeMediaTab: MediaDataTab | null;
  activeTabRef: MutableRefObject<MediaTab>;
  applyMovedFilesToCaches: (movedFiles: TRow[], destinationTab: MediaDataTab) => void;
  bulkDeleting: boolean;
  bulkMoving: boolean;
  currentUserIdRef: MutableRefObject<string | null>;
  files: TRow[];
  getErrorMessage: (error: unknown, fallback: string) => string;
  selectedIds: string[];
  setActiveTab: Dispatch<SetStateAction<MediaTab>>;
  setBulkMoveError: Dispatch<SetStateAction<string | null>>;
  setBulkMoveMenuOpen: Dispatch<SetStateAction<boolean>>;
  setBulkMoveNotice: Dispatch<SetStateAction<string | null>>;
  setBulkMoving: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setFocusedFile: Dispatch<SetStateAction<TRow | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
};

/**
 * Creates derived selection state and bulk-move handlers for Media Library.
 * Inputs: current rows/selection plus state mutators and cache reconciliation hooks.
 * Output: selected row set, move-tab options, eligibility flag, and destination move action.
 * Side effects: issues `/api/media/move-batch`, updates signed-url cache, and logs perf telemetry.
 */
export const useMediaBulkMoveController = <TRow extends BulkMoveMediaRowBase>({
  activeMediaTab,
  activeTabRef,
  applyMovedFilesToCaches,
  bulkDeleting,
  bulkMoving,
  currentUserIdRef,
  files,
  getErrorMessage,
  selectedIds,
  setActiveTab,
  setBulkMoveError,
  setBulkMoveMenuOpen,
  setBulkMoveNotice,
  setBulkMoving,
  setError,
  setFiles,
  setFocusedFile,
  setSelectedIds,
}: UseMediaBulkMoveControllerArgs<TRow>) => {
  const selectedMediaRows = useMemo(() => {
    if (activeMediaTab == null || !selectedIds.length) return [];
    const selectedIdSet = new Set(selectedIds);
    return files.filter(
      (file) =>
        selectedIdSet.has(file.id) &&
        file.status !== "uploading" &&
        getMediaDataTabForRow(file) === activeMediaTab
    );
  }, [activeMediaTab, files, selectedIds]);

  const bulkMoveTabOptions = useMemo(
    () => buildBulkMoveTabOptions(selectedMediaRows),
    [selectedMediaRows]
  );

  const canBulkMove = useMemo(
    () => bulkMoveTabOptions.some((option) => !option.disabled),
    [bulkMoveTabOptions]
  );

  const moveSelectedFiles = useCallback(
    async (destinationTab: MediaDataTab) => {
      if (!selectedMediaRows.length || bulkMoving || bulkDeleting) return;
      const selectedCount = selectedMediaRows.length;
      const destinationOption = bulkMoveTabOptions.find((option) => option.tab === destinationTab);
      if (!destinationOption || destinationOption.disabled) return;
      const finishBulkMove = createMediaPerfTimer({
        surface: "media-library-route",
        tab: activeTabRef.current,
        destination_tab: destinationTab,
        selected_count: selectedCount,
      });

      setBulkMoving(true);
      setBulkMoveError(null);
      setBulkMoveNotice(null);
      setBulkMoveMenuOpen(false);
      setError(null);
      try {
        const selectedById = new Map(selectedMediaRows.map((row) => [row.id, row]));
        const requestedFileIds = selectedMediaRows.map((row) => row.id);
        const payloads: MoveMediaBatchResponse<TRow>[] = [];
        for (const fileIdChunk of chunkIds(requestedFileIds, MOVE_BATCH_REQUEST_SIZE)) {
          const response = await fetchWithAuth("/api/media/move-batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileIds: fileIdChunk,
              destinationTab,
            }),
            shortpulseLogScope: "app",
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
              details?: string;
            } | null;
            throw new Error(
              payload?.details ??
                payload?.error ??
                `Unable to move selected files (${response.status})`
            );
          }
          payloads.push((await response.json()) as MoveMediaBatchResponse<TRow>);
        }
        const payload = {
          destinationTab,
          moved: payloads.flatMap((item) => item.moved),
          failed: payloads.flatMap((item) => item.failed),
        } satisfies Pick<MoveMediaBatchResponse<TRow>, "destinationTab" | "moved" | "failed">;

        for (const movedItem of payload.moved) {
          const previousRow = selectedById.get(movedItem.fileId);
          const previousSignPaths = previousRow
            ? resolveMediaSigningStoragePaths(previousRow, currentUserIdRef.current)
            : [];
          const pathsToInvalidate = new Set([...previousSignPaths, movedItem.previousStoragePath]);
          for (const path of pathsToInvalidate) {
            if (!path) continue;
            invalidateSignedMediaUrl(BUCKET, path);
          }
        }

        const movedRowsRaw = payload.moved.map((item) => item.file);
        const previewPathById = new Map<string, string>();
        const previewPaths: string[] = [];
        for (const row of movedRowsRaw) {
          const previewPath = resolveMediaPreviewStoragePath(row, currentUserIdRef.current);
          previewPathById.set(row.id, previewPath);
          previewPaths.push(previewPath);
        }

        const signedByPath = await getSignedMediaUrlsBatch({
          bucket: BUCKET,
          storagePaths: previewPaths,
          expiresInSeconds: 3600,
          forceRefresh: true,
        });

        const movedRows: TRow[] = movedRowsRaw.map((row) => {
          const previewPath = previewPathById.get(row.id) ?? row.storage_path;
          const signedUrl = signedByPath.get(previewPath);
          return {
            ...row,
            preview_storage_path: previewPath,
            signedUrl: signedUrl ?? undefined,
            status: "ready",
          } as TRow;
        });

        const moveFailures = payload.failed.map((failure) => {
          const filename = selectedById.get(failure.fileId)?.filename?.trim() || "Unnamed file";
          return `${filename}: ${failure.details ?? failure.error}`;
        });

        const movedIdSet = new Set(movedRows.map((row) => row.id));
        if (movedRows.length) {
          applyMovedFilesToCaches(movedRows, destinationTab);
          setFiles((prev) => {
            const rowsWithoutMoved = prev.filter((row) => !movedIdSet.has(row.id));
            if (activeTabRef.current !== destinationTab) return rowsWithoutMoved;
            return mergePageRows(rowsWithoutMoved, movedRows).filter(
              (row) => getMediaDataTabForRow(row) === destinationTab
            );
          });
          setSelectedIds((prev) => prev.filter((id) => !movedIdSet.has(id)));
          setFocusedFile((prev) => {
            if (!prev || !movedIdSet.has(prev.id)) return prev;
            return movedRows.find((row) => row.id === prev.id) ?? prev;
          });
        }

        const destinationLabel = getMoveTabLabel(destinationTab);
        const feedback = buildBulkMoveFeedback({
          movedCount: movedRows.length,
          requestedCount: selectedCount,
          failedCount: moveFailures.length,
          destinationLabel,
          firstFailureMessage: moveFailures[0] ?? null,
        });

        setBulkMoveNotice(feedback.notice);
        setBulkMoveError(feedback.error);
        if (
          movedRows.length &&
          feedback.shouldSwitchTab &&
          activeTabRef.current !== destinationTab
        ) {
          setActiveTab(destinationTab);
        }

        finishBulkMove("media.move.bulk.completed", {
          moved_count: movedRows.length,
          failed_count: moveFailures.length,
        });
        if (moveFailures.length) {
          logMediaPerf("media.move.bulk.failed", {
            surface: "media-library-route",
            tab: activeTabRef.current,
            destination_tab: destinationTab,
            selected_count: selectedCount,
            moved_count: movedRows.length,
            failed_count: moveFailures.length,
          });
        }
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Unable to move selected files");
        setBulkMoveError(message);
        setBulkMoveNotice(null);
        finishBulkMove("media.move.bulk.failed", {
          moved_count: 0,
          failed_count: selectedCount,
          error_kind: "request_failed",
        });
        logMediaPerf("media.move.bulk.failed", {
          surface: "media-library-route",
          tab: activeTabRef.current,
          destination_tab: destinationTab,
          selected_count: selectedCount,
          moved_count: 0,
          failed_count: selectedCount,
        });
      } finally {
        setBulkMoving(false);
      }
    },
    [
      activeTabRef,
      applyMovedFilesToCaches,
      bulkDeleting,
      bulkMoveTabOptions,
      bulkMoving,
      currentUserIdRef,
      selectedMediaRows,
      getErrorMessage,
      setActiveTab,
      setBulkMoveError,
      setBulkMoveMenuOpen,
      setBulkMoveNotice,
      setBulkMoving,
      setError,
      setFiles,
      setFocusedFile,
      setSelectedIds,
    ]
  );

  return {
    bulkMoveTabOptions,
    canBulkMove,
    moveSelectedFiles,
    selectedMediaRows,
  };
};
