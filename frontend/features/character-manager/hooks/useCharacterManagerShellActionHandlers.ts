import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CharacterSheetDropZoneKey } from "../types";

type UseCharacterManagerShellActionHandlersParams = {
  pageBusy: boolean;
  hasPersistedCharacter: boolean;
  quickSwapMutating: boolean;
  isDropResolutionBusy: boolean;
  clearAllMessages: () => void;
  setError: (message: string | null) => void;
  appendQuickSwapFiles: (files: File[]) => Promise<unknown>;
  setPendingCharacterSheetUploadZoneKey: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  characterSheetFileInputRef: RefObject<HTMLInputElement | null>;
  simpleFileInputRef: RefObject<HTMLInputElement | null>;
  createCharacter: () => Promise<unknown>;
  setActiveTab: (tab: "create" | "manage") => void;
  characterNameInputRef: RefObject<HTMLInputElement | null>;
};

type UseCharacterManagerShellActionHandlersResult = {
  uploadSimpleFiles: (incomingFiles: FileList | File[]) => Promise<void>;
  handleSimpleFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  openCharacterSheetPicker: (dropZoneKey: CharacterSheetDropZoneKey) => void;
  openQuickSwapUploadPicker: () => void;
  handleCreateNewCharacter: () => void;
};

export const useCharacterManagerShellActionHandlers = ({
  pageBusy,
  hasPersistedCharacter,
  quickSwapMutating,
  isDropResolutionBusy,
  clearAllMessages,
  setError,
  appendQuickSwapFiles,
  setPendingCharacterSheetUploadZoneKey,
  characterSheetFileInputRef,
  simpleFileInputRef,
  createCharacter,
  setActiveTab,
  characterNameInputRef,
}: UseCharacterManagerShellActionHandlersParams): UseCharacterManagerShellActionHandlersResult => {
  const uploadSimpleFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      const files = Array.from(incomingFiles);
      if (!files.length || pageBusy || quickSwapMutating || isDropResolutionBusy) return;
      if (!hasPersistedCharacter) {
        clearAllMessages();
        setError("Save this character before uploading QuickSwap references.");
        return;
      }
      clearAllMessages();
      await appendQuickSwapFiles(files);
    },
    [
      appendQuickSwapFiles,
      clearAllMessages,
      hasPersistedCharacter,
      isDropResolutionBusy,
      pageBusy,
      quickSwapMutating,
      setError,
    ]
  );

  const handleSimpleFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";
      if (!files.length) return;
      void uploadSimpleFiles(files);
    },
    [uploadSimpleFiles]
  );

  const openCharacterSheetPicker = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => {
      if (pageBusy || isDropResolutionBusy) return;
      clearAllMessages();
      setPendingCharacterSheetUploadZoneKey(dropZoneKey);
      characterSheetFileInputRef.current?.click();
    },
    [
      characterSheetFileInputRef,
      clearAllMessages,
      isDropResolutionBusy,
      pageBusy,
      setPendingCharacterSheetUploadZoneKey,
    ]
  );

  const openQuickSwapUploadPicker = useCallback(() => {
    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
    if (!hasPersistedCharacter) {
      clearAllMessages();
      setError("Save this character before uploading QuickSwap references.");
      return;
    }
    clearAllMessages();
    simpleFileInputRef.current?.click();
  }, [
    clearAllMessages,
    hasPersistedCharacter,
    isDropResolutionBusy,
    pageBusy,
    quickSwapMutating,
    setError,
    simpleFileInputRef,
  ]);

  const handleCreateNewCharacter = useCallback(() => {
    setActiveTab("create");

    void createCharacter().finally(() => {
      setActiveTab("create");
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
      });
    });
  }, [characterNameInputRef, createCharacter, setActiveTab]);

  return {
    uploadSimpleFiles,
    handleSimpleFileSelection,
    openCharacterSheetPicker,
    openQuickSwapUploadPicker,
    handleCreateNewCharacter,
  };
};
