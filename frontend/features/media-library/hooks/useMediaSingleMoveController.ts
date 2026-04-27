/**
 * Single-file move controller for Media Library modals.
 * Handles move request orchestration, cache/state reconciliation, and move menu/error state.
 */
import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { invalidateSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { buildModalMoveTabOptions, type MediaTab } from "../logic/mediaMoveRouting";
import { applyMovedRowsToMediaTabCache } from "../logic/mediaMoveCache";
import { resolveMediaPreviewStoragePath } from "../logic/mediaPreviewStoragePath";
import {
  BUCKET,
  getMediaDataTabForRow,
  mergePageRows,
  type MediaDataTab,
  type MediaTabCache,
} from "../logic/mediaLibraryPageHelpers";

type SingleMoveRowBase = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  source?: string | null;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type MoveMediaResponse<TRow extends SingleMoveRowBase> = {
  file: TRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
};

type MoveFileResult<TRow extends SingleMoveRowBase> = {
  nextFile: TRow;
  toTab: MediaDataTab;
  previousSignPaths: string[];
};

type UseMediaSingleMoveControllerArgs<TRow extends SingleMoveRowBase> = {
  activeTabRef: MutableRefObject<MediaTab>;
  currentUserIdRef: MutableRefObject<string | null>;
  focusedFile: TRow | null;
  getErrorMessage: (error: unknown, fallback: string) => string;
  setActiveTab: Dispatch<SetStateAction<MediaTab>>;
  setFiles: Dispatch<SetStateAction<TRow[]>>;
  setFocusedFile: Dispatch<SetStateAction<TRow | null>>;
  setMediaTabCache: Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TRow>>>>;
  setModalError: Dispatch<SetStateAction<string | null>>;
  setPageError: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean }
  ) => Promise<string | null>;
};

/**
 * Creates move handlers/state for the focused-file modal.
 * Inputs: focused row context plus page-level cache and state mutators.
 * Output: move UI state, tab options, single-file move action, and shared cache apply helper.
 * Side effects: calls `/api/media/move`, refreshes signed URL cache, and mutates page/cache state.
 */
export const useMediaSingleMoveController = <TRow extends SingleMoveRowBase>({
  activeTabRef,
  currentUserIdRef,
  focusedFile,
  getErrorMessage,
  setActiveTab,
  setFiles,
  setFocusedFile,
  setMediaTabCache,
  setModalError,
  setPageError,
  setSelectedIds,
  signStoragePath,
}: UseMediaSingleMoveControllerArgs<TRow>) => {
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [movingFile, setMovingFile] = useState(false);

  const applyMovedFilesToCaches = useCallback(
    (movedFiles: TRow[], destinationTab: MediaDataTab) => {
      if (!movedFiles.length) return;
      setMediaTabCache((prev) =>
        applyMovedRowsToMediaTabCache({
          cacheState: prev,
          movedRows: movedFiles,
          destinationTab,
        })
      );
    },
    [setMediaTabCache]
  );

  const requestMoveFileToTab = useCallback(
    async (file: TRow, destinationTab: MediaDataTab): Promise<MoveFileResult<TRow>> => {
      const response = await fetchWithAuth("/api/media/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: file.id,
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
          payload?.details ?? payload?.error ?? `Unable to move file (${response.status})`
        );
      }

      const payload = (await response.json()) as MoveMediaResponse<TRow>;
      const movedFile = payload.file;
      const previewStoragePath = resolveMediaPreviewStoragePath(
        movedFile,
        currentUserIdRef.current
      );
      const signedUrl = await signStoragePath(previewStoragePath, { forceRefresh: true });

      return {
        nextFile: {
          ...movedFile,
          preview_storage_path: previewStoragePath,
          signedUrl: signedUrl ?? undefined,
          status: "ready",
        } as TRow,
        toTab: payload.toTab,
        previousSignPaths: resolveMediaSigningStoragePaths(file, currentUserIdRef.current),
      };
    },
    [currentUserIdRef, signStoragePath]
  );

  const moveFocusedFile = useCallback(
    async (destinationTab: MediaDataTab) => {
      if (!focusedFile || movingFile) return;
      setMovingFile(true);
      setMoveError(null);
      setModalError(null);
      setPageError(null);
      const previousFile = focusedFile;

      try {
        const result = await requestMoveFileToTab(previousFile, destinationTab);
        const nextFocusedFile = result.nextFile;
        for (const path of result.previousSignPaths) {
          invalidateSignedMediaUrl(BUCKET, path);
        }

        applyMovedFilesToCaches([nextFocusedFile], result.toTab);
        setFiles((prev) => {
          const rowsWithoutFile = prev.filter((row) => row.id !== nextFocusedFile.id);
          if (activeTabRef.current !== result.toTab) return rowsWithoutFile;
          return mergePageRows(rowsWithoutFile, [nextFocusedFile]).filter(
            (row) => getMediaDataTabForRow(row) === result.toTab
          );
        });
        setFocusedFile(nextFocusedFile);
        setSelectedIds((prev) => prev.filter((id) => id !== nextFocusedFile.id));
        setMoveMenuOpen(false);
        if (activeTabRef.current !== result.toTab) {
          setActiveTab(result.toTab);
        }
      } catch (err: unknown) {
        setMoveError(getErrorMessage(err, "Unable to move file"));
      } finally {
        setMovingFile(false);
      }
    },
    [
      activeTabRef,
      applyMovedFilesToCaches,
      focusedFile,
      getErrorMessage,
      movingFile,
      requestMoveFileToTab,
      setActiveTab,
      setFiles,
      setFocusedFile,
      setModalError,
      setPageError,
      setSelectedIds,
    ]
  );

  const modalMoveTabOptions = useMemo(() => buildModalMoveTabOptions(focusedFile), [focusedFile]);
  const canMoveToAnotherTab = useMemo(
    () => modalMoveTabOptions.some((option) => !option.disabled),
    [modalMoveTabOptions]
  );

  const clearMoveState = useCallback(() => {
    setMoveError(null);
    setMoveMenuOpen(false);
  }, []);

  return {
    applyMovedFilesToCaches,
    canMoveToAnotherTab,
    clearMoveState,
    modalMoveTabOptions,
    moveError,
    moveFocusedFile,
    moveMenuOpen,
    movingFile,
    setMoveMenuOpen,
  };
};
