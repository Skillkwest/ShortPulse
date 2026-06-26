/**
 * Folder-drop controller for the AI Studio Media Library panel.
 * Resolves drag payloads and dispatches assign/unassign/move membership operations.
 */
import { useCallback, useState } from "react";
import type { DragEvent } from "react";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";
import { extractInternalReferenceDragPayload } from "../utils/dragDrop";
import {
  applyMediaFolderMembershipBatch,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  type MediaFolder,
  type MediaFolderMembershipBatchResult,
} from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  resolveFolderDropFeedbackMessage,
  resolveFolderDropIntent,
  type FolderDropFeedbackArgs,
  type FolderDropItemKind,
} from "../logic/mediaLibraryFolderDropModel";
import { getMediaLibraryDragTypes } from "../logic/mediaLibraryDragPayload";

type ResolvedFolderDropItem =
  | {
      kind: "media";
      id: string;
      sourceFolderId?: string | null;
      origin: "library" | "internal";
      alreadyInLibrary?: boolean;
    }
  | {
      kind: "prompt";
      id: string;
      sourceFolderId?: string | null;
      origin: "library" | "internal";
      alreadyInLibrary?: boolean;
    }
  | null;

type ResolveInternalDropItem = (payload: InternalReferenceDragPayload) => Promise<{
  kind: FolderDropItemKind;
  id: string;
  alreadyInLibrary?: boolean;
} | null>;

type UseMediaLibraryFolderDropControllerArgs = {
  projectId?: string | null;
  folders: MediaFolder[];
  isStorageQuotaBlocked?: boolean;
  setFolderError: (value: string | null) => void;
  setMembershipMessage: (value: string | null) => void;
  setMembershipPendingMessage: (value: string | null) => void;
  refreshActiveRows: () => Promise<void>;
  refreshFolders: () => Promise<void>;
  resolveInternalDropItem?: ResolveInternalDropItem;
  onDropFilesToFolder?: (folderId: string, files: FileList) => Promise<void>;
};

type UseMediaLibraryFolderDropControllerResult = {
  hoveredFolderId: string | null;
  hoveredContentFolderId: string | null;
  clearHoveredFolderId: () => void;
  clearHoveredContentFolderId: () => void;
  handleFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void;
  handleFolderDragLeave: (folderId: string) => void;
  handleFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => Promise<void>;
  handleFolderContentDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void;
  handleFolderContentDragLeave: (folderId: string) => void;
  handleFolderContentDrop: (folderId: string, event: DragEvent<HTMLElement>) => Promise<void>;
};

const INTERNAL_REFERENCE_TRANSFER_HINT_TYPES = [
  "text/reference-origin",
  "text/reference-output-id",
  "text/reference-id",
  "text/reference-url",
  "text/reference-media-id",
  "text/reference-source-surface",
] as const;

const MEDIA_LIBRARY_FALLBACK_TRANSFER_HINT_TYPES = [
  "text/reference-url",
  "text/uri-list",
  "text/prompt",
  "text/shortpulse-media-library-id",
  "text/shortpulse-media-library-kind",
  "text/shortpulse-media-library-marker",
] as const;

const hasTransferType = (transfer: DataTransfer, type: string): boolean => {
  const rawTypes = transfer.types as unknown;
  if (!rawTypes) return false;
  const typed = rawTypes as { contains?: (value: string) => boolean };
  if (typeof typed.contains === "function") {
    return typed.contains(type);
  }
  return Array.from(rawTypes as ArrayLike<string>).includes(type);
};

const hasMediaLibraryTransferHints = (transfer: DataTransfer): boolean =>
  getMediaLibraryDragTypes().some((type) => hasTransferType(transfer, type)) ||
  MEDIA_LIBRARY_FALLBACK_TRANSFER_HINT_TYPES.some((type) => hasTransferType(transfer, type));

const hasInternalReferenceTransferHints = (transfer: DataTransfer): boolean =>
  INTERNAL_REFERENCE_TRANSFER_HINT_TYPES.some((type) => hasTransferType(transfer, type));

const hasDesktopFileTransferHints = (transfer: DataTransfer): boolean => {
  if (hasTransferType(transfer, "Files")) return true;
  return (transfer.files?.length ?? 0) > 0;
};

const buildFeedbackArgs = ({
  intentKind,
  itemKind,
  result,
  sourceFolderName,
  targetFolderName,
}: {
  intentKind: FolderDropFeedbackArgs["intent"]["kind"];
  itemKind: FolderDropItemKind;
  result: MediaFolderMembershipBatchResult;
  sourceFolderName?: string | null;
  targetFolderName?: string | null;
}): FolderDropFeedbackArgs => {
  if (intentKind === "assign") {
    return {
      intent: { kind: "assign", targetFolderId: result.targetFolderId ?? result.folderId ?? "" },
      result,
      itemKind,
      sourceFolderName,
      targetFolderName,
    };
  }
  if (intentKind === "save") {
    return {
      intent: { kind: "save", targetFolderId: result?.targetFolderId ?? result?.folderId ?? "" },
      result,
      itemKind,
      sourceFolderName,
      targetFolderName,
    };
  }
  if (intentKind === "unassign") {
    return {
      intent: { kind: "unassign", sourceFolderId: result.sourceFolderId ?? result.folderId ?? "" },
      result,
      itemKind,
      sourceFolderName,
      targetFolderName,
    };
  }
  if (intentKind === "move") {
    return {
      intent: {
        kind: "move",
        sourceFolderId: result.sourceFolderId ?? "",
        targetFolderId: result.targetFolderId ?? "",
      },
      result,
      itemKind,
      sourceFolderName,
      targetFolderName,
    };
  }
  return { intent: { kind: "noop" }, result, itemKind, sourceFolderName, targetFolderName };
};

/**
 * Handles folder tile and active-folder content drop interactions and applies
 * assign/unassign/move membership operations.
 */
export const useMediaLibraryFolderDropController = ({
  projectId = null,
  folders,
  isStorageQuotaBlocked = false,
  setFolderError,
  setMembershipMessage,
  setMembershipPendingMessage,
  refreshActiveRows,
  refreshFolders,
  resolveInternalDropItem,
  onDropFilesToFolder,
}: UseMediaLibraryFolderDropControllerArgs): UseMediaLibraryFolderDropControllerResult => {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredContentFolderId, setHoveredContentFolderId] = useState<string | null>(null);

  const refreshFolderState = useCallback(async () => {
    await refreshFolders().catch(() => undefined);
  }, [refreshFolders]);

  const resolveDropItem = useCallback(
    async (transfer: DataTransfer): Promise<ResolvedFolderDropItem> => {
      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (mediaLibraryPayload?.kind === "libraryMedia") {
        return {
          kind: "media",
          id: mediaLibraryPayload.payload.id,
          sourceFolderId: mediaLibraryPayload.payload.originFolderId ?? null,
          origin: "library",
        };
      }
      if (mediaLibraryPayload?.kind === "libraryPrompt") {
        return {
          kind: "prompt",
          id: mediaLibraryPayload.payload.id,
          sourceFolderId: mediaLibraryPayload.payload.originFolderId ?? null,
          origin: "library",
        };
      }
      const internalPayload = extractInternalReferenceDragPayload(transfer);
      if (!internalPayload || !resolveInternalDropItem) return null;
      const resolved = await resolveInternalDropItem(internalPayload);
      if (!resolved) return null;
      return {
        kind: resolved.kind,
        id: resolved.id,
        sourceFolderId: null,
        origin: "internal",
        alreadyInLibrary: resolved.alreadyInLibrary === true,
      };
    },
    [resolveInternalDropItem]
  );

  const canAcceptTransfer = useCallback(
    (transfer: DataTransfer | null | undefined): boolean => {
      if (!transfer) return false;
      const maybeLibraryPayload =
        hasMediaLibraryTransferHints(transfer) || readMediaLibraryDragPayload(transfer);
      const maybeInternalPayload = extractInternalReferenceDragPayload(transfer);
      const hasInternalPayloadHints = hasInternalReferenceTransferHints(transfer);
      const canAcceptInternalPayload = (() => {
        if (!hasInternalPayloadHints && !maybeInternalPayload) return false;
        if (!isStorageQuotaBlocked) return true;
        return (
          maybeInternalPayload?.mediaKind === "text" ||
          Boolean(maybeInternalPayload?.mediaId?.trim())
        );
      })();
      const maybeDesktopFiles =
        hasDesktopFileTransferHints(transfer) &&
        Boolean(onDropFilesToFolder) &&
        !isStorageQuotaBlocked;
      return Boolean(maybeLibraryPayload || canAcceptInternalPayload || maybeDesktopFiles);
    },
    [isStorageQuotaBlocked, onDropFilesToFolder]
  );

  const handleFolderDragOver = useCallback(
    (folderId: string, event: DragEvent<HTMLElement>) => {
      const transfer = event.dataTransfer;
      if (!canAcceptTransfer(transfer)) return;
      event.preventDefault();
      event.stopPropagation();
      transfer.dropEffect = "copy";
      setHoveredFolderId(folderId);
    },
    [canAcceptTransfer]
  );

  const handleFolderDragLeave = useCallback((folderId: string) => {
    setHoveredFolderId((previous) => (previous === folderId ? null : previous));
  }, []);

  const clearHoveredFolderId = useCallback(() => {
    setHoveredFolderId(null);
  }, []);

  const handleFolderContentDragOver = useCallback(
    (folderId: string, event: DragEvent<HTMLElement>) => {
      const transfer = event.dataTransfer;
      if (!canAcceptTransfer(transfer)) return;
      event.preventDefault();
      event.stopPropagation();
      transfer.dropEffect = "copy";
      setHoveredContentFolderId(folderId);
    },
    [canAcceptTransfer]
  );

  const handleFolderContentDragLeave = useCallback((folderId: string) => {
    setHoveredContentFolderId((previous) => (previous === folderId ? null : previous));
  }, []);

  const clearHoveredContentFolderId = useCallback(() => {
    setHoveredContentFolderId(null);
  }, []);

  const handleResolvedDrop = useCallback(
    async (
      folderId: string,
      transfer: DataTransfer,
      options?: {
        forceRefreshActiveRows?: boolean;
      }
    ) => {
      const targetFolderName = folders.find((folder) => folder.id === folderId)?.name ?? null;
      const internalPayload = extractInternalReferenceDragPayload(transfer);
      const droppedFiles = transfer.files;
      setFolderError(null);
      setMembershipMessage(null);
      if (
        isStorageQuotaBlocked &&
        internalPayload &&
        internalPayload.mediaKind !== "text" &&
        !(internalPayload.mediaId?.trim() ?? "")
      ) {
        return;
      }
      if (isStorageQuotaBlocked && droppedFiles && droppedFiles.length > 0) {
        return;
      }
      setMembershipPendingMessage(
        targetFolderName ? `Adding to ${targetFolderName}...` : "Saving..."
      );
      let resolvedItem: ResolvedFolderDropItem = null;
      try {
        resolvedItem = await resolveDropItem(transfer);
      } catch {
        setMembershipPendingMessage(null);
        setFolderError("Unable to resolve dropped reference.");
        return;
      }
      if (resolvedItem) {
        const intent = resolveFolderDropIntent({
          sourceFolderId: resolvedItem.sourceFolderId ?? null,
          targetFolderId: folderId,
          allowRootSave: resolvedItem.origin === "internal",
          alreadyInLibrary: resolvedItem.alreadyInLibrary === true,
        });
        if (intent.kind === "noop") {
          setMembershipPendingMessage(null);
          return;
        }

        const sourceFolderName =
          intent.kind === "move" || intent.kind === "unassign"
            ? (folders.find((folder) => folder.id === intent.sourceFolderId)?.name ?? null)
            : null;
        const resolvedTargetFolderName =
          intent.kind === "assign" || intent.kind === "move" || intent.kind === "save"
            ? intent.targetFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID
              ? "All Media"
              : (folders.find((folder) => folder.id === intent.targetFolderId)?.name ?? null)
            : null;

        if (intent.kind === "already_exists") {
          const message = resolveFolderDropFeedbackMessage({
            intent,
            result: null,
            itemKind: resolvedItem.kind,
            sourceFolderName,
            targetFolderName: resolvedTargetFolderName,
          });
          setMembershipPendingMessage(null);
          if (message) {
            setMembershipMessage(message);
          }
          return;
        }

        if (intent.kind === "save") {
          try {
            await Promise.all([refreshActiveRows(), refreshFolderState()]);
            const message = resolveFolderDropFeedbackMessage({
              intent,
              result: null,
              itemKind: resolvedItem.kind,
              sourceFolderName,
              targetFolderName: resolvedTargetFolderName,
            });
            setMembershipPendingMessage(null);
            if (message) {
              setMembershipMessage(message);
            }
          } catch (error) {
            setMembershipPendingMessage(null);
            setFolderError(toMediaLibraryErrorText(error, "Unable to refresh saved media."));
          }
          return;
        }

        try {
          let result: MediaFolderMembershipBatchResult;
          if (intent.kind === "assign") {
            result = await applyMediaFolderMembershipBatch(
              {
                action: "assign",
                folderId: intent.targetFolderId,
                mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
                promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
              },
              projectId
            );
          } else if (intent.kind === "unassign") {
            result = await applyMediaFolderMembershipBatch(
              {
                action: "unassign",
                folderId: intent.sourceFolderId,
                mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
                promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
              },
              projectId
            );
          } else {
            result = await applyMediaFolderMembershipBatch(
              {
                action: "move",
                sourceFolderId: intent.sourceFolderId,
                targetFolderId: intent.targetFolderId,
                mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
                promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
              },
              projectId
            );
          }
          const message = resolveFolderDropFeedbackMessage(
            buildFeedbackArgs({
              intentKind: intent.kind,
              itemKind: resolvedItem.kind,
              result,
              sourceFolderName,
              targetFolderName: resolvedTargetFolderName,
            })
          );
          setMembershipPendingMessage(null);
          if (message) {
            setMembershipMessage(message);
          }
          const sourceFolderId = (resolvedItem.sourceFolderId ?? "").trim();
          const skipActiveRowsRefresh =
            !options?.forceRefreshActiveRows &&
            intent.kind === "assign" &&
            sourceFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
          if (skipActiveRowsRefresh) {
            await refreshFolderState();
          } else {
            await Promise.all([refreshActiveRows(), refreshFolderState()]);
          }
        } catch (error) {
          setMembershipPendingMessage(null);
          setFolderError(toMediaLibraryErrorText(error, "Unable to update folder membership."));
        }
        return;
      }
      if (droppedFiles && droppedFiles.length > 0) {
        if (isStorageQuotaBlocked) {
          setMembershipPendingMessage(null);
          return;
        }
        if (!onDropFilesToFolder) {
          setMembershipPendingMessage(null);
          setFolderError("Unable to resolve dropped reference.");
          return;
        }
        try {
          await onDropFilesToFolder(folderId, droppedFiles);
          setMembershipPendingMessage(null);
        } catch (uploadError) {
          setMembershipPendingMessage(null);
          setFolderError(toMediaLibraryErrorText(uploadError, "Unable to process dropped files."));
        }
        return;
      }
      if (!resolvedItem) {
        setMembershipPendingMessage(null);
        setFolderError("Unable to resolve dropped reference.");
        return;
      }
    },
    [
      folders,
      isStorageQuotaBlocked,
      onDropFilesToFolder,
      projectId,
      refreshActiveRows,
      refreshFolderState,
      resolveDropItem,
      setFolderError,
      setMembershipMessage,
      setMembershipPendingMessage,
    ]
  );

  const handleFolderDrop = useCallback(
    async (folderId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setHoveredFolderId(null);
      setHoveredContentFolderId(null);
      const transfer = event.dataTransfer;
      if (!transfer) return;
      await handleResolvedDrop(folderId, transfer);
    },
    [handleResolvedDrop]
  );

  const handleFolderContentDrop = useCallback(
    async (folderId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setHoveredContentFolderId(null);
      setHoveredFolderId(null);
      const transfer = event.dataTransfer;
      if (!transfer) return;
      await handleResolvedDrop(folderId, transfer, { forceRefreshActiveRows: true });
    },
    [handleResolvedDrop]
  );

  return {
    hoveredFolderId,
    hoveredContentFolderId,
    clearHoveredFolderId,
    clearHoveredContentFolderId,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    handleFolderContentDragOver,
    handleFolderContentDragLeave,
    handleFolderContentDrop,
  };
};
