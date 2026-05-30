import { useCallback, useState } from "react";
import type { DragEvent } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import {
  getMediaLibraryFolderDragTypes,
  readMediaLibraryFolderDragPayload,
  writeMediaLibraryFolderDragPayload,
} from "../logic/mediaLibraryFolderDragPayload";
import { resolveMediaLibraryFolderReparentIntent } from "../logic/mediaLibraryFolderHierarchy";
import type { MediaFolder } from "../logic/mediaLibraryPanelApi";

type UseMediaLibraryFolderReparentControllerArgs = {
  folders: MediaFolder[];
  moveFolder: (folderId: string, parentFolderId: string | null) => Promise<boolean>;
};

type FolderDragSource = Pick<MediaFolder, "id" | "name"> & {
  parentFolderId?: string | null;
};

type UseMediaLibraryFolderReparentControllerResult = {
  hoveredFolderId: string | null;
  isRootDropHover: boolean;
  handleFolderDragStart: (event: DragEvent<HTMLElement>, folder: FolderDragSource) => void;
  handleFolderDragEnd: (event: DragEvent<HTMLElement>) => void;
  handleFolderDragOver: (folderId: string | null, event: DragEvent<HTMLElement>) => void;
  handleFolderDragLeave: (folderId: string | null) => void;
  handleFolderDrop: (folderId: string | null, event: DragEvent<HTMLElement>) => Promise<boolean>;
};

const hasTransferType = (transfer: DataTransfer, type: string): boolean => {
  const rawTypes = transfer.types as unknown;
  if (!rawTypes) return false;
  const typed = rawTypes as { contains?: (value: string) => boolean };
  if (typeof typed.contains === "function") {
    return typed.contains(type);
  }
  return Array.from(rawTypes as ArrayLike<string>).includes(type);
};

const hasFolderTransferHints = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  return getMediaLibraryFolderDragTypes().some((type) => hasTransferType(transfer, type));
};

/**
 * Owns app-level folder drag/reparent behavior for the Media Library folder strip.
 */
export const useMediaLibraryFolderReparentController = ({
  folders,
  moveFolder,
}: UseMediaLibraryFolderReparentControllerArgs): UseMediaLibraryFolderReparentControllerResult => {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [isRootDropHover, setIsRootDropHover] = useState(false);

  const clearHoverState = useCallback(() => {
    setHoveredFolderId(null);
    setIsRootDropHover(false);
  }, []);

  const handleFolderDragStart = useCallback(
    (event: DragEvent<HTMLElement>, folder: FolderDragSource) => {
      writeMediaLibraryFolderDragPayload(event.dataTransfer, {
        source: "mediaLibraryFolder",
        payload: {
          id: folder.id,
          name: folder.name,
          parentFolderId: folder.parentFolderId ?? null,
        },
      });
      event.dataTransfer.effectAllowed = "move";
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: folder.name,
        detail: "Folder",
        previewKind: "text",
      });
      addBreadcrumb({
        type: "ui",
        message: "media_library_folder_drag_start",
        data: {
          folderId: folder.id,
        },
      });
    },
    []
  );

  const handleFolderDragEnd = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.currentTarget.classList.remove("is-dragging");
      clearHoverState();
      clearMediaLibraryDragGhost(event);
    },
    [clearHoverState]
  );

  const handleFolderDragOver = useCallback(
    (folderId: string | null, event: DragEvent<HTMLElement>) => {
      const transfer = event.dataTransfer;
      if (!hasFolderTransferHints(transfer)) return;
      const payload = readMediaLibraryFolderDragPayload(transfer);
      if (!payload) return;
      const intent = resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: payload.payload.id,
        parentFolderId: folderId,
      });
      if (intent.kind !== "move") {
        clearHoverState();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      transfer.dropEffect = "move";
      setHoveredFolderId(folderId);
      setIsRootDropHover(folderId === null);
    },
    [clearHoverState, folders]
  );

  const handleFolderDragLeave = useCallback((folderId: string | null) => {
    if (folderId === null) {
      setIsRootDropHover(false);
      return;
    }
    setHoveredFolderId((previous) => (previous === folderId ? null : previous));
  }, []);

  const handleFolderDrop = useCallback(
    async (folderId: string | null, event: DragEvent<HTMLElement>): Promise<boolean> => {
      const transfer = event.dataTransfer;
      if (!hasFolderTransferHints(transfer)) return false;
      event.preventDefault();
      event.stopPropagation();
      clearHoverState();
      const payload = readMediaLibraryFolderDragPayload(transfer);
      if (!payload) return false;
      const intent = resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: payload.payload.id,
        parentFolderId: folderId,
      });
      if (intent.kind !== "move") {
        addBreadcrumb({
          type: "ui",
          level: intent.kind === "invalid" ? "warn" : "info",
          message: "media_library_folder_drag_invalid_drop",
          data: {
            folderId: payload.payload.id,
            targetFolderId: folderId,
            reason: intent.reason,
          },
        });
        return true;
      }
      const moved = await moveFolder(payload.payload.id, folderId);
      if (!moved) {
        return true;
      }
      addBreadcrumb({
        type: "ui",
        message: "media_library_folder_drag_move_success",
        data: {
          folderId: payload.payload.id,
          targetFolderId: folderId,
        },
      });
      return true;
    },
    [clearHoverState, folders, moveFolder]
  );

  return {
    hoveredFolderId,
    isRootDropHover,
    handleFolderDragStart,
    handleFolderDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
  };
};
