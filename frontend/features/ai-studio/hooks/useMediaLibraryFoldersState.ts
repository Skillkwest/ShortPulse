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

const ROOT_FOLDER_LABEL = "All Media";
const FOLDERS_REQUEST_TIMEOUT_MS = 12_000;
const NEW_FOLDER_BASE_NAME = "New Folder";
const MAX_FOLDER_NAME_COLLISION_RETRIES = 8;
const TEMP_FOLDER_ID_PREFIX = "__pending_new_folder__";

const ROOT_FOLDER: MediaFolder = {
  id: MEDIA_LIBRARY_ROOT_FOLDER_ID,
  name: ROOT_FOLDER_LABEL,
  createdAt: "",
  updatedAt: "",
};

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

type UseMediaLibraryFoldersStateResult = {
  folders: MediaFolder[];
  customFolders: MediaFolder[];
  orderedFolders: MediaFolder[];
  activeFolderId: MediaFolderId;
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

  const customFolders = useMemo(
    () =>
      [...folders].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "accent" })
      ),
    [folders]
  );
  const orderedFolders = useMemo(() => [ROOT_FOLDER, ...customFolders], [customFolders]);

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
      setFolderError(loadError instanceof Error ? loadError.message : "Unable to load folders.");
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
    const knownFolderNames = toNormalizedFolderNames(folders);
    let nextName = resolveNextFolderNameFromNames(knownFolderNames);
    setFolders((previous) => [
      ...previous,
      {
        id: pendingFolderId,
        name: nextName,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    try {
      for (let attempt = 0; attempt <= MAX_FOLDER_NAME_COLLISION_RETRIES; attempt += 1) {
        try {
          const folder = await createMediaFolder(nextName);
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
      setFolderError(
        createError instanceof Error ? createError.message : "Unable to create folder."
      );
    } finally {
      setCreatingFolder(false);
      creatingFolderInFlightRef.current = false;
    }
  }, [folders]);

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
      setFolderError(
        renameError instanceof Error ? renameError.message : "Unable to rename folder."
      );
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
        setFolderError(
          deleteError instanceof Error ? deleteError.message : "Unable to delete folder."
        );
      }
    },
    [editingFolderId]
  );

  return {
    folders,
    customFolders,
    orderedFolders,
    activeFolderId,
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
