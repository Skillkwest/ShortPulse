import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CharacterSheetDropZoneKey, CharacterProfileImageTransform } from "../types";

type UseCharacterManagerShellActionHandlersParams = {
  pageBusy: boolean;
  quickSwapMutating: boolean;
  isDropResolutionBusy: boolean;
  clearAllMessages: () => void;
  appendQuickSwapFiles: (files: File[]) => Promise<unknown>;
  setPendingCharacterSheetUploadZoneKey: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  characterSheetFileInputRef: RefObject<HTMLInputElement | null>;
  profileFileInputRef: RefObject<HTMLInputElement | null>;
  simpleFileInputRef: RefObject<HTMLInputElement | null>;
  profileImageUrl: string | null;
  isProfileAdjusterVisible: boolean;
  profileImageTransform: CharacterProfileImageTransform;
  setProfileAdjustDraft: Dispatch<SetStateAction<CharacterProfileImageTransform | null>>;
  setIsProfileAdjusterVisible: Dispatch<SetStateAction<boolean>>;
  setProfileImageFile: (file: File) => Promise<unknown>;
  clearProfileImage: () => Promise<unknown>;
  createCharacter: () => Promise<unknown>;
  setActiveTab: (tab: "create" | "manage") => void;
  characterNameInputRef: RefObject<HTMLInputElement | null>;
  profileImageVisibleTransform: CharacterProfileImageTransform;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  defaultProfileImageTransform: CharacterProfileImageTransform;
};

type UseCharacterManagerShellActionHandlersResult = {
  uploadSimpleFiles: (incomingFiles: FileList | File[]) => Promise<void>;
  handleSimpleFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  openCharacterSheetPicker: (dropZoneKey: CharacterSheetDropZoneKey) => void;
  openProfilePicker: () => void;
  openQuickSwapUploadPicker: () => void;
  handleProfileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  clearProfilePreview: () => void;
  handleCreateNewCharacter: () => void;
  saveProfileAdjustments: () => Promise<void>;
};

export const useCharacterManagerShellActionHandlers = ({
  pageBusy,
  quickSwapMutating,
  isDropResolutionBusy,
  clearAllMessages,
  appendQuickSwapFiles,
  setPendingCharacterSheetUploadZoneKey,
  characterSheetFileInputRef,
  profileFileInputRef,
  simpleFileInputRef,
  profileImageUrl,
  isProfileAdjusterVisible,
  profileImageTransform,
  setProfileAdjustDraft,
  setIsProfileAdjusterVisible,
  setProfileImageFile,
  clearProfileImage,
  createCharacter,
  setActiveTab,
  characterNameInputRef,
  profileImageVisibleTransform,
  saveProfileImageTransform,
  defaultProfileImageTransform,
}: UseCharacterManagerShellActionHandlersParams): UseCharacterManagerShellActionHandlersResult => {
  const uploadSimpleFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      const files = Array.from(incomingFiles);
      if (!files.length || pageBusy || quickSwapMutating || isDropResolutionBusy) return;
      clearAllMessages();
      await appendQuickSwapFiles(files);
    },
    [appendQuickSwapFiles, clearAllMessages, isDropResolutionBusy, pageBusy, quickSwapMutating]
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

  const openProfilePicker = useCallback(() => {
    if (pageBusy) return;
    if (profileImageUrl && !isProfileAdjusterVisible) {
      setProfileAdjustDraft(profileImageTransform);
      setIsProfileAdjusterVisible(true);
      return;
    }
    clearAllMessages();
    profileFileInputRef.current?.click();
  }, [
    clearAllMessages,
    isProfileAdjusterVisible,
    pageBusy,
    profileFileInputRef,
    profileImageTransform,
    profileImageUrl,
    setIsProfileAdjusterVisible,
    setProfileAdjustDraft,
  ]);

  const openQuickSwapUploadPicker = useCallback(() => {
    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
    clearAllMessages();
    simpleFileInputRef.current?.click();
  }, [clearAllMessages, isDropResolutionBusy, pageBusy, quickSwapMutating, simpleFileInputRef]);

  const handleProfileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || pageBusy) return;
      void setProfileImageFile(file);
      setProfileAdjustDraft(defaultProfileImageTransform);
      setIsProfileAdjusterVisible(true);
    },
    [
      defaultProfileImageTransform,
      pageBusy,
      setIsProfileAdjusterVisible,
      setProfileAdjustDraft,
      setProfileImageFile,
    ]
  );

  const clearProfilePreview = useCallback(() => {
    void clearProfileImage();
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = "";
    }
  }, [clearProfileImage, profileFileInputRef, setIsProfileAdjusterVisible, setProfileAdjustDraft]);

  const handleCreateNewCharacter = useCallback(() => {
    setActiveTab("create");
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);

    void createCharacter().finally(() => {
      setActiveTab("create");
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
      });
    });
  }, [
    characterNameInputRef,
    createCharacter,
    setActiveTab,
    setIsProfileAdjusterVisible,
    setProfileAdjustDraft,
  ]);

  const saveProfileAdjustments = useCallback(async () => {
    if (!profileImageUrl) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
      return;
    }

    const didSave = await saveProfileImageTransform({
      zoom: profileImageVisibleTransform.zoom,
      offsetX: profileImageVisibleTransform.offsetX,
      offsetY: profileImageVisibleTransform.offsetY,
    });
    if (didSave) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
    }
  }, [
    profileImageUrl,
    profileImageVisibleTransform,
    saveProfileImageTransform,
    setIsProfileAdjusterVisible,
    setProfileAdjustDraft,
  ]);

  return {
    uploadSimpleFiles,
    handleSimpleFileSelection,
    openCharacterSheetPicker,
    openProfilePicker,
    openQuickSwapUploadPicker,
    handleProfileSelection,
    clearProfilePreview,
    handleCreateNewCharacter,
    saveProfileAdjustments,
  };
};
