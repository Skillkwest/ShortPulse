/**
 * Owns folder-menu, move-picker, delete-confirm, and open-animation UI state for MediaLibraryPanel.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collectMediaLibraryFolderDescendantIds } from "../logic/mediaLibraryFolderHierarchy";
import {
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  type MediaFolder,
  type MediaFolderId,
} from "../logic/mediaLibraryPanelApi";

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type MoveFolderPickerState = {
  folderId: string;
  folderName: string;
};

type FolderOpenGhostState = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type UseMediaLibraryPanelFolderUiControllerParams = {
  folders: MediaFolder[];
  foldersById: Map<string, MediaFolder>;
  activeFolderParentId: string | null;
  canNavigateUp: boolean;
  setActiveFolderId: (folderId: MediaFolderId) => void;
  createFolder: (parentFolderId?: string | null) => Promise<void>;
  startFolderRename: (
    folderId: string,
    currentName: string,
    options?: { clearInput?: boolean }
  ) => void;
  deleteFolder: (folderId: string) => Promise<void>;
  moveFolder: (folderId: string, parentFolderId: string | null) => Promise<boolean>;
  buildFolderPathLabel: (targetFolderId: string | null) => string;
};

type UseMediaLibraryPanelFolderUiControllerResult = {
  folderContextMenu: FolderContextMenuState | null;
  folderContextMenuRef: React.Ref<HTMLDivElement>;
  folderOpenGhost: FolderOpenGhostState | null;
  openingFolderId: string | null;
  pendingFolderDelete: { folderId: string; folderName: string } | null;
  moveFolderPicker: MoveFolderPickerState | null;
  moveFolderDestinationOptions: Array<{ id: string | null; label: string }>;
  moveFolderCurrentParentLabel: string;
  canOpenMovePicker: boolean;
  openFolderContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    folder: Pick<MediaFolder, "id" | "name">,
    isRoot: boolean
  ) => void;
  handleContextRename: () => void;
  handleContextCreateSubfolder: () => Promise<void>;
  handleContextDelete: () => Promise<void>;
  closeFolderDeleteConfirm: () => void;
  confirmFolderDelete: () => Promise<void>;
  handleOpenMovePicker: () => void;
  closeMoveFolderPicker: () => void;
  handleMoveFolderToDestination: (parentFolderId: string | null) => Promise<void>;
  handleNavigateUp: () => void;
  handleNavigateToRoot: () => void;
  handleNavigateToFolder: (folderId: string) => void;
  handleOpenFolderWithAnimation: (folderId: string, sourceElement: HTMLElement) => void;
};

const FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX = 10;
const FOLDER_OPEN_GHOST_DURATION_MS = 220;
const FOLDER_OPEN_NAVIGATION_DELAY_MS = 70;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps folder-only UI orchestration out of the main Media Library panel component.
 */
export const useMediaLibraryPanelFolderUiController = ({
  folders,
  foldersById,
  activeFolderParentId,
  canNavigateUp,
  setActiveFolderId,
  createFolder,
  startFolderRename,
  deleteFolder,
  moveFolder,
  buildFolderPathLabel,
}: UseMediaLibraryPanelFolderUiControllerParams): UseMediaLibraryPanelFolderUiControllerResult => {
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);
  const [folderOpenGhost, setFolderOpenGhost] = useState<FolderOpenGhostState | null>(null);
  const [openingFolderId, setOpeningFolderId] = useState<string | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    folderId: string;
    folderName: string;
  } | null>(null);
  const [moveFolderPicker, setMoveFolderPicker] = useState<MoveFolderPickerState | null>(null);
  const folderContextMenuRef = useRef<HTMLDivElement>(null);
  const folderOpenGhostTimeoutRef = useRef<number | null>(null);
  const folderOpenNavigationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (folderOpenGhostTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenGhostTimeoutRef.current);
      }
      if (folderOpenNavigationTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenNavigationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!folderContextMenu) return;
    const dismissContextMenu = () => {
      setFolderContextMenu(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        dismissContextMenu();
        return;
      }
      if (folderContextMenuRef.current?.contains(target)) return;
      dismissContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissContextMenu();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", dismissContextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", dismissContextMenu, true);
    };
  }, [folderContextMenu]);

  useIsomorphicLayoutEffect(() => {
    if (!folderContextMenu) return;
    const frameId = window.requestAnimationFrame(() => {
      const menuNode = folderContextMenuRef.current;
      if (!menuNode) return;
      const { height, width } = menuNode.getBoundingClientRect();
      if (!(height > 0) || !(width > 0)) return;
      const nextX = Math.min(
        Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, folderContextMenu.x),
        Math.max(
          FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerWidth - width - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      const nextY = Math.min(
        Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, folderContextMenu.y),
        Math.max(
          FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerHeight - height - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      if (nextX === folderContextMenu.x && nextY === folderContextMenu.y) return;
      setFolderContextMenu((previous) => {
        if (!previous) return previous;
        if (previous.x === nextX && previous.y === nextY) return previous;
        return {
          ...previous,
          x: nextX,
          y: nextY,
        };
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [folderContextMenu]);

  const openFolderContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      folder: Pick<MediaFolder, "id" | "name">,
      isRoot: boolean
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (isRoot) {
        setFolderContextMenu(null);
        return;
      }
      setFolderContextMenu({
        folderId: folder.id,
        folderName: folder.name,
        x: Math.min(
          Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientX),
          window.innerWidth - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        ),
        y: Math.min(
          Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientY),
          window.innerHeight - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
        ),
      });
    },
    []
  );

  const handleContextRename = useCallback(() => {
    if (!folderContextMenu) return;
    startFolderRename(folderContextMenu.folderId, folderContextMenu.folderName);
    setFolderContextMenu(null);
  }, [folderContextMenu, startFolderRename]);

  const handleContextCreateSubfolder = useCallback(async () => {
    if (!folderContextMenu) return;
    const parentFolderId = folderContextMenu.folderId;
    setFolderContextMenu(null);
    setActiveFolderId(parentFolderId);
    await createFolder(parentFolderId);
  }, [createFolder, folderContextMenu, setActiveFolderId]);

  const handleContextDelete = useCallback(async () => {
    if (!folderContextMenu) return;
    const { folderId, folderName } = folderContextMenu;
    setFolderContextMenu(null);
    setPendingFolderDelete({ folderId, folderName });
  }, [folderContextMenu]);

  const closeFolderDeleteConfirm = useCallback(() => {
    setPendingFolderDelete(null);
  }, []);

  const confirmFolderDelete = useCallback(async () => {
    const target = pendingFolderDelete;
    if (!target) return;
    setPendingFolderDelete(null);
    await deleteFolder(target.folderId);
  }, [deleteFolder, pendingFolderDelete]);

  const resolveMoveFolderDestinationOptions = useCallback(
    (folderId: string) => {
      const movingFolder = foldersById.get(folderId);
      if (!movingFolder) return [] as Array<{ id: string | null; label: string }>;
      const excludedIds = collectMediaLibraryFolderDescendantIds(folders, movingFolder.id);
      excludedIds.add(movingFolder.id);
      const options: Array<{ id: string | null; label: string }> = [];
      if (movingFolder.parentFolderId !== null) {
        options.push({ id: null, label: "All Media" });
      }
      for (const folder of folders) {
        if (excludedIds.has(folder.id)) continue;
        if (folder.id === movingFolder.parentFolderId) continue;
        options.push({
          id: folder.id,
          label: buildFolderPathLabel(folder.id),
        });
      }
      if (options.length <= 1) return options;
      const [rootOption, ...folderOptions] = options;
      if (rootOption?.id !== null) {
        return [...options].sort((left, right) => left.label.localeCompare(right.label));
      }
      return [
        rootOption,
        ...folderOptions.sort((left, right) => left.label.localeCompare(right.label)),
      ];
    },
    [buildFolderPathLabel, folders, foldersById]
  );

  const moveFolderDestinationOptions = useMemo(() => {
    if (!moveFolderPicker) return [];
    return resolveMoveFolderDestinationOptions(moveFolderPicker.folderId);
  }, [moveFolderPicker, resolveMoveFolderDestinationOptions]);

  const moveFolderCurrentParentLabel = useMemo(() => {
    if (!moveFolderPicker) return "All Media";
    const movingFolder = foldersById.get(moveFolderPicker.folderId);
    if (!movingFolder || movingFolder.parentFolderId === null) return "All Media";
    return buildFolderPathLabel(movingFolder.parentFolderId);
  }, [buildFolderPathLabel, foldersById, moveFolderPicker]);

  const canOpenMovePicker = useMemo(() => {
    if (!folderContextMenu) return false;
    return resolveMoveFolderDestinationOptions(folderContextMenu.folderId).length > 0;
  }, [folderContextMenu, resolveMoveFolderDestinationOptions]);

  const handleOpenMovePicker = useCallback(() => {
    if (!folderContextMenu) return;
    setMoveFolderPicker({
      folderId: folderContextMenu.folderId,
      folderName: folderContextMenu.folderName,
    });
    setFolderContextMenu(null);
  }, [folderContextMenu]);

  const closeMoveFolderPicker = useCallback(() => {
    setMoveFolderPicker(null);
  }, []);

  const handleMoveFolderToDestination = useCallback(
    async (parentFolderId: string | null) => {
      if (!moveFolderPicker) return;
      const folderId = moveFolderPicker.folderId;
      setMoveFolderPicker(null);
      await moveFolder(folderId, parentFolderId);
    },
    [moveFolder, moveFolderPicker]
  );

  const handleNavigateUp = useCallback(() => {
    if (!canNavigateUp) return;
    setActiveFolderId(activeFolderParentId ?? MEDIA_LIBRARY_ROOT_FOLDER_ID);
  }, [activeFolderParentId, canNavigateUp, setActiveFolderId]);

  const handleNavigateToRoot = useCallback(() => {
    setActiveFolderId(MEDIA_LIBRARY_ROOT_FOLDER_ID);
  }, [setActiveFolderId]);

  const handleNavigateToFolder = useCallback(
    (folderId: string) => {
      setActiveFolderId(folderId || MEDIA_LIBRARY_ROOT_FOLDER_ID);
    },
    [setActiveFolderId]
  );

  const handleOpenFolderWithAnimation = useCallback(
    (folderId: string, sourceElement: HTMLElement) => {
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const rect = sourceElement.getBoundingClientRect();

      if (folderOpenGhostTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenGhostTimeoutRef.current);
        folderOpenGhostTimeoutRef.current = null;
      }
      if (folderOpenNavigationTimeoutRef.current !== null) {
        window.clearTimeout(folderOpenNavigationTimeoutRef.current);
        folderOpenNavigationTimeoutRef.current = null;
      }

      if (!prefersReducedMotion && rect.width > 0 && rect.height > 0) {
        setFolderOpenGhost({
          key: `${folderId}:${Date.now()}`,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
        setOpeningFolderId(folderId);
        folderOpenNavigationTimeoutRef.current = window.setTimeout(() => {
          setActiveFolderId(folderId || MEDIA_LIBRARY_ROOT_FOLDER_ID);
          folderOpenNavigationTimeoutRef.current = null;
        }, FOLDER_OPEN_NAVIGATION_DELAY_MS);
        folderOpenGhostTimeoutRef.current = window.setTimeout(() => {
          setFolderOpenGhost(null);
          setOpeningFolderId(null);
          folderOpenGhostTimeoutRef.current = null;
        }, FOLDER_OPEN_GHOST_DURATION_MS);
      } else {
        setFolderOpenGhost(null);
        setOpeningFolderId(null);
        setActiveFolderId(folderId || MEDIA_LIBRARY_ROOT_FOLDER_ID);
      }
    },
    [setActiveFolderId]
  );

  return {
    folderContextMenu,
    folderContextMenuRef,
    folderOpenGhost,
    openingFolderId,
    pendingFolderDelete,
    moveFolderPicker,
    moveFolderDestinationOptions,
    moveFolderCurrentParentLabel,
    canOpenMovePicker,
    openFolderContextMenu,
    handleContextRename,
    handleContextCreateSubfolder,
    handleContextDelete,
    closeFolderDeleteConfirm,
    confirmFolderDelete,
    handleOpenMovePicker,
    closeMoveFolderPicker,
    handleMoveFolderToDestination,
    handleNavigateUp,
    handleNavigateToRoot,
    handleNavigateToFolder,
    handleOpenFolderWithAnimation,
  };
};
