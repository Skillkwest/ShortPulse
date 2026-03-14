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
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  resolveFolderDropFeedbackMessage,
  resolveFolderDropIntent,
  type FolderDropFeedbackArgs,
  type FolderDropItemKind,
} from "../logic/mediaLibraryFolderDropModel";
import { getMediaLibraryDragTypes } from "../logic/mediaLibraryDragPayload";

type ResolvedFolderDropItem =
  | { kind: "media"; id: string; sourceFolderId?: string | null }
  | { kind: "prompt"; id: string; sourceFolderId?: string | null }
  | null;

type ResolveInternalDropItem = (payload: InternalReferenceDragPayload) => Promise<{
  kind: FolderDropItemKind;
  id: string;
} | null>;

type UseMediaLibraryFolderDropControllerArgs = {
  folders: MediaFolder[];
  setFolderError: (value: string | null) => void;
  setMembershipMessage: (value: string | null) => void;
  refreshActiveRows: () => Promise<void>;
  resolveInternalDropItem?: ResolveInternalDropItem;
  onDropFilesToFolder?: (folderId: string, files: FileList) => Promise<void>;
};

type UseMediaLibraryFolderDropControllerResult = {
  hoveredFolderId: string | null;
  clearHoveredFolderId: () => void;
  handleFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void;
  handleFolderDragLeave: (folderId: string) => void;
  handleFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => Promise<void>;
};

const INTERNAL_REFERENCE_TRANSFER_HINT_TYPES = [
  "text/reference-origin",
  "text/reference-output-id",
  "text/reference-id",
  "text/reference-url",
  "text/reference-media-id",
  "text/reference-source-surface",
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
  getMediaLibraryDragTypes().some((type) => hasTransferType(transfer, type));

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
 * Handles folder tile drop interactions and applies assign/unassign/move membership operations.
 */
export const useMediaLibraryFolderDropController = ({
  folders,
  setFolderError,
  setMembershipMessage,
  refreshActiveRows,
  resolveInternalDropItem,
  onDropFilesToFolder,
}: UseMediaLibraryFolderDropControllerArgs): UseMediaLibraryFolderDropControllerResult => {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);

  const resolveDropItem = useCallback(
    async (transfer: DataTransfer): Promise<ResolvedFolderDropItem> => {
      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (mediaLibraryPayload?.kind === "libraryMedia") {
        return {
          kind: "media",
          id: mediaLibraryPayload.payload.id,
          sourceFolderId: mediaLibraryPayload.payload.originFolderId ?? null,
        };
      }
      if (mediaLibraryPayload?.kind === "libraryPrompt") {
        return {
          kind: "prompt",
          id: mediaLibraryPayload.payload.id,
          sourceFolderId: mediaLibraryPayload.payload.originFolderId ?? null,
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
      };
    },
    [resolveInternalDropItem]
  );

  const handleFolderDragOver = useCallback(
    (folderId: string, event: DragEvent<HTMLElement>) => {
      const transfer = event.dataTransfer;
      if (!transfer) return;
      const maybeLibraryPayload =
        hasMediaLibraryTransferHints(transfer) || readMediaLibraryDragPayload(transfer);
      const maybeInternalPayload =
        hasInternalReferenceTransferHints(transfer) ||
        extractInternalReferenceDragPayload(transfer);
      const maybeDesktopFiles =
        hasDesktopFileTransferHints(transfer) && Boolean(onDropFilesToFolder);
      if (!maybeLibraryPayload && !maybeInternalPayload && !maybeDesktopFiles) return;
      event.preventDefault();
      event.stopPropagation();
      transfer.dropEffect = "copy";
      setHoveredFolderId(folderId);
    },
    [onDropFilesToFolder]
  );

  const handleFolderDragLeave = useCallback((folderId: string) => {
    setHoveredFolderId((previous) => (previous === folderId ? null : previous));
  }, []);

  const clearHoveredFolderId = useCallback(() => {
    setHoveredFolderId(null);
  }, []);

  const handleFolderDrop = useCallback(
    async (folderId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setHoveredFolderId(null);
      setFolderError(null);
      setMembershipMessage(null);

      const transfer = event.dataTransfer;
      if (!transfer) return;
      let resolvedItem: ResolvedFolderDropItem = null;
      try {
        resolvedItem = await resolveDropItem(transfer);
      } catch {
        setFolderError("Unable to resolve dropped reference.");
        return;
      }
      if (resolvedItem) {
        const intent = resolveFolderDropIntent({
          sourceFolderId: resolvedItem.sourceFolderId ?? null,
          targetFolderId: folderId,
        });
        if (intent.kind === "noop") return;

        const sourceFolderName =
          intent.kind === "move" || intent.kind === "unassign"
            ? (folders.find((folder) => folder.id === intent.sourceFolderId)?.name ?? null)
            : null;
        const targetFolderName =
          intent.kind === "assign" || intent.kind === "move"
            ? (folders.find((folder) => folder.id === intent.targetFolderId)?.name ?? null)
            : null;

        try {
          let result: MediaFolderMembershipBatchResult;
          if (intent.kind === "assign") {
            result = await applyMediaFolderMembershipBatch({
              action: "assign",
              folderId: intent.targetFolderId,
              mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
              promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
            });
          } else if (intent.kind === "unassign") {
            result = await applyMediaFolderMembershipBatch({
              action: "unassign",
              folderId: intent.sourceFolderId,
              mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
              promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
            });
          } else {
            result = await applyMediaFolderMembershipBatch({
              action: "move",
              sourceFolderId: intent.sourceFolderId,
              targetFolderId: intent.targetFolderId,
              mediaIds: resolvedItem.kind === "media" ? [resolvedItem.id] : [],
              promptIds: resolvedItem.kind === "prompt" ? [resolvedItem.id] : [],
            });
          }
          const message = resolveFolderDropFeedbackMessage(
            buildFeedbackArgs({
              intentKind: intent.kind,
              itemKind: resolvedItem.kind,
              result,
              sourceFolderName,
              targetFolderName,
            })
          );
          if (message) {
            setMembershipMessage(message);
          }
          const sourceFolderId = (resolvedItem.sourceFolderId ?? "").trim();
          const skipActiveRowsRefresh =
            intent.kind === "assign" && sourceFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
          if (!skipActiveRowsRefresh) {
            await refreshActiveRows();
          }
        } catch (error) {
          setFolderError(
            error instanceof Error ? error.message : "Unable to update folder membership."
          );
        }
        return;
      }
      const droppedFiles = transfer.files;
      if (droppedFiles && droppedFiles.length > 0) {
        if (!onDropFilesToFolder) {
          setFolderError("Unable to resolve dropped reference.");
          return;
        }
        try {
          await onDropFilesToFolder(folderId, droppedFiles);
        } catch (uploadError) {
          setFolderError(
            uploadError instanceof Error ? uploadError.message : "Unable to process dropped files."
          );
        }
        return;
      }
      if (!resolvedItem) {
        setFolderError("Unable to resolve dropped reference.");
        return;
      }
    },
    [
      folders,
      onDropFilesToFolder,
      refreshActiveRows,
      resolveDropItem,
      setFolderError,
      setMembershipMessage,
    ]
  );

  return {
    hoveredFolderId,
    clearHoveredFolderId,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
  };
};
