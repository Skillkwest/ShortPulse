/**
 * Folder-state controller for the AI Studio Media Library panel.
 * Owns folder load/create/rename/select lifecycle with optimistic create behavior.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMediaFolder,
  deleteMediaFolder,
  listMediaFolders,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  renameMediaFolder,
  type MediaFolder,
  type MediaFolderId,
} from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";

const ROOT_FOLDER_LABEL = "All Media";
const FOLDERS_REQUEST_TIMEOUT_MS = 12_000;
const NEW_FOLDER_BASE_NAME = "New Folder";
const MAX_FOLDER_NAME_COLLISION_RETRIES = 8;
const TEMP_FOLDER_ID_PREFIX = "__pending_new_folder__";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string) =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });

const resolveNextFolderNameFromNames = (existingNames: Set<string>): string => {
  if (!existingNames.has(NEW_FOLDER_BASE_NAME.toLocaleLowerCase())) {
    return NEW_FOLDER_BASE_NAME;
  }
  let nextIndex = 2;
  while (existingNames.has(`${NEW_FOLDER_BASE_NAME} ${nextIndex}`.toLocaleLowerCase())) {
    nextIndex += 1;
  }
  return `${NEW_FOLDER_BASE_NAME} ${nextIndex}`;
};

const toNormalizedFolderNames = (rows: MediaFolder[]): Set<string> => {
  const names = new Set<string>();
  for (const row of rows) {
    const normalized = row.name.trim().toLocaleLowerCase();
    if (!normalized) continue;
    names.add(normalized);
  }
  return names;
};

const buildPendingFolderId = () =>
  `${TEMP_FOLDER_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const folderSortKey = (folder: MediaFolder): number => {
  const createdAt = Date.parse(folder.createdAt);
  return Number.isFinite(createdAt) ? createdAt : Number.POSITIVE_INFINITY;
};

const compareFoldersByCreatedAt = (left: MediaFolder, right: MediaFolder): number => {
  const createdDelta = folderSortKey(left) - folderSortKey(right);
  if (createdDelta !== 0) return createdDelta;
  const nameDelta = left.name.localeCompare(right.name, undefined, { sensitivity: "accent" });
  if (nameDelta !== 0) return nameDelta;
  return left.id.localeCompare(right.id, undefined, { sensitivity: "accent" });
};

type UseMediaLibraryFoldersStateResult = {
  folders: MediaFolder[];
  customFolders: MediaFolder[];
  visibleFolders: MediaFolder[];
  ancestorFolders: MediaFolder[];
  activeFolderId: MediaFolderId;
  activeFolderName: string;
  activeFolderParentId: string | null;
  canNavigateUp: boolean;
  setActiveFolderId: (folderId: MediaFolderId) => void;
  folderError: string | null;
  setFolderError: (value: string | null) => void;
  creatingFolder: boolean;
  createFolder: () => Promise<void>;
  editingFolderId: string | null;
  editingFolderName: string;
  setEditingFolderName: (value: string) => void;
  startFolderRename: (folderId: string, currentName: string) => void;
  cancelFolderRename: () => void;
  commitFolderRename: () => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  refreshFolders: () => Promise<void>;
};

/**
 * Encapsulates Media Library folder loading and inline edit/create behavior.
 */
export const useMediaLibraryFoldersState = (): UseMediaLibraryFoldersStateResult => {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<MediaFolderId>(MEDIA_LIBRARY_ROOT_FOLDER_ID);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [savingFolderEdit, setSavingFolderEdit] = useState(false);
  const foldersRequestTokenRef = useRef(0);
  const creatingFolderInFlightRef = useRef(false);

  const customFolders = useMemo(() => [...folders].sort(compareFoldersByCreatedAt), [folders]);
  const foldersById = useMemo(
    () => new Map(customFolders.map((folder) => [folder.id, folder])),
    [customFolders]
  );
  const activeFolder = useMemo(
    () =>
      activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID
        ? null
        : (foldersById.get(activeFolderId) ?? null),
    [activeFolderId, foldersById]
  );
  const activeFolderParentId = activeFolder?.parentFolderId ?? null;
  const canNavigateUp = activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const activeFolderName = activeFolder?.name ?? ROOT_FOLDER_LABEL;
  const ancestorFolders = useMemo(() => {
    if (!activeFolder) return [];
    const chain: MediaFolder[] = [];
    const seen = new Set<string>();
    let cursor: MediaFolder | null = activeFolder;
    while (cursor && !seen.has(cursor.id)) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.parentFolderId ? (foldersById.get(cursor.parentFolderId) ?? null) : null;
    }
    return chain;
  }, [activeFolder, foldersById]);
  const visibleFolders = useMemo(() => {
    // When the active folder is being renamed, keep showing its sibling strip so the inline editor
    // remains visible instead of switching immediately to the active folder's child scope.
    const isEditingActiveFolder =
      editingFolderId !== null &&
      activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID &&
      editingFolderId === activeFolderId;
    const currentParentId =
      activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID
        ? null
        : isEditingActiveFolder
          ? activeFolderParentId
          : activeFolderId;
    return customFolders.filter((folder) => folder.parentFolderId === currentParentId);
  }, [activeFolderId, activeFolderParentId, customFolders, editingFolderId]);

  const refreshFolders = useCallback(async () => {
    const requestToken = foldersRequestTokenRef.current + 1;
    foldersRequestTokenRef.current = requestToken;
    try {
      const nextFolders = await withTimeout(
        listMediaFolders(),
        FOLDERS_REQUEST_TIMEOUT_MS,
        "Unable to load folders."
      );
      if (foldersRequestTokenRef.current !== requestToken) return;
      setFolderError(null);
      setFolders(nextFolders);
      setActiveFolderId((previous) => {
        if (previous === MEDIA_LIBRARY_ROOT_FOLDER_ID) return previous;
        return nextFolders.some((folder) => folder.id === previous)
          ? previous
          : MEDIA_LIBRARY_ROOT_FOLDER_ID;
      });
    } catch (loadError) {
      if (foldersRequestTokenRef.current !== requestToken) return;
      setFolderError(toMediaLibraryErrorText(loadError, "Unable to load folders."));
    }
  }, []);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  const createFolder = useCallback(async () => {
    if (creatingFolderInFlightRef.current) return;
    creatingFolderInFlightRef.current = true;
    setFolderError(null);
    setCreatingFolder(true);
    const pendingFolderId = buildPendingFolderId();
    const nextParentFolderId =
      activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID ? null : activeFolderId;
    const knownFolderNames = toNormalizedFolderNames(
      folders.filter((folder) => folder.parentFolderId === nextParentFolderId)
    );
    let nextName = resolveNextFolderNameFromNames(knownFolderNames);
    setFolders((previous) => [
      ...previous,
      {
        id: pendingFolderId,
        name: nextName,
        parentFolderId: nextParentFolderId,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    try {
      for (let attempt = 0; attempt <= MAX_FOLDER_NAME_COLLISION_RETRIES; attempt += 1) {
        try {
          const folder = await createMediaFolder(nextName, nextParentFolderId);
          setFolders((previous) => {
            const withoutPending = previous.filter(
              (row) => row.id !== pendingFolderId && row.id !== folder.id
            );
            return [...withoutPending, folder];
          });
          setActiveFolderId(folder.id);
          setEditingFolderId(folder.id);
          setEditingFolderName(folder.name);
          return;
        } catch (createError) {
          const isNameCollision =
            createError instanceof Error && createError.message === "Folder name already exists";
          if (!isNameCollision) {
            throw createError;
          }
          knownFolderNames.add(nextName.toLocaleLowerCase());
          nextName = resolveNextFolderNameFromNames(knownFolderNames);
          setFolders((previous) =>
            previous.map((row) => (row.id === pendingFolderId ? { ...row, name: nextName } : row))
          );
        }
      }
      throw new Error("Unable to allocate an available folder name.");
    } catch (createError) {
      setFolders((previous) => previous.filter((row) => row.id !== pendingFolderId));
      setFolderError(toMediaLibraryErrorText(createError, "Unable to create folder."));
    } finally {
      setCreatingFolder(false);
      creatingFolderInFlightRef.current = false;
    }
  }, [activeFolderId, folders]);

  const startFolderRename = useCallback((folderId: string, currentName: string) => {
    setFolderError(null);
    setActiveFolderId(folderId);
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  }, []);

  const cancelFolderRename = useCallback(() => {
    setEditingFolderId(null);
    setEditingFolderName("");
  }, []);

  const commitFolderRename = useCallback(async () => {
    const folderId = editingFolderId;
    const nextName = editingFolderName.trim();
    if (!folderId || !nextName || savingFolderEdit) return;
    setSavingFolderEdit(true);
    setFolderError(null);
    try {
      const renamed = await renameMediaFolder({ folderId, name: nextName });
      setFolders((previous) =>
        previous.map((folder) =>
          folder.id === folderId ? { ...folder, name: renamed.name } : folder
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
    } catch (renameError) {
      setFolderError(toMediaLibraryErrorText(renameError, "Unable to rename folder."));
    } finally {
      setSavingFolderEdit(false);
    }
  }, [editingFolderId, editingFolderName, savingFolderEdit]);

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const normalizedFolderId = folderId.trim();
      if (!normalizedFolderId || normalizedFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setFolderError(null);
      try {
        await deleteMediaFolder(normalizedFolderId);
        setFolders((previous) => previous.filter((folder) => folder.id !== normalizedFolderId));
        setActiveFolderId((previous) =>
          previous === normalizedFolderId ? MEDIA_LIBRARY_ROOT_FOLDER_ID : previous
        );
        setEditingFolderId((previous) => (previous === normalizedFolderId ? null : previous));
        if (editingFolderId === normalizedFolderId) {
          setEditingFolderName("");
        }
      } catch (deleteError) {
        setFolderError(toMediaLibraryErrorText(deleteError, "Unable to delete folder."));
      }
    },
    [editingFolderId]
  );

  return {
    folders,
    customFolders,
    visibleFolders,
    ancestorFolders,
    activeFolderId,
    activeFolderName,
    activeFolderParentId,
    canNavigateUp,
    setActiveFolderId,
    folderError,
    setFolderError,
    creatingFolder,
    createFolder,
    editingFolderId,
    editingFolderName,
    setEditingFolderName,
    startFolderRename,
    cancelFolderRename,
    commitFolderRename,
    deleteFolder,
    refreshFolders,
  };
};
