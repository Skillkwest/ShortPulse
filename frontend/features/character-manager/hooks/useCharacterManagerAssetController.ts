/**
 * Character Manager asset controller.
 * Owns profile image, preset image, slot persistence, and assignment save flows.
 */
import React from "react";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import {
  clearCharacterManagerProfileImage,
  clearCharacterManagerSlot,
  saveCharacterManagerCharacterSheetPresetAsset,
  saveCharacterManagerCharacterSheetPresetAssignments,
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerSlot,
} from "../logic/characterManagerPersistence";
import {
  publishCharacterListChanged,
  type CharacterListChangeReason,
} from "../logic/characterListSyncEvents";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
  CharacterSheetPresetState,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
} from "../types";

type RefreshCharacterListOptions = {
  publishSyncEvent?: boolean;
  reason?: CharacterListChangeReason;
};

type UseCharacterManagerAssetControllerParams = {
  characterId: string | null;
  characterSheetId: string | null;
  profileImageUrl: string | null;
  clearMessages: () => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSavingProfileImage: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setProfileImageTransform: React.Dispatch<React.SetStateAction<CharacterProfileImageTransform>>;
  profileImageTransform: CharacterProfileImageTransform;
  defaultProfileImageTransform: CharacterProfileImageTransform;
  refreshCharacterListSilently: (
    preferredCharacterId?: string | null,
    options?: RefreshCharacterListOptions
  ) => Promise<void>;
  selectedCharacterStorageScopeRef: React.MutableRefObject<string | null>;
  toErrorMessage: (error: unknown, fallback: string) => string;
  setCharacterSheetAssignments: React.Dispatch<React.SetStateAction<CharacterSheetAssignments>>;
  characterSheetAssignmentsRef: React.MutableRefObject<CharacterSheetAssignments>;
  characterSheetAssignmentsRequestRef: React.MutableRefObject<number>;
  setIsSavingCharacterSheetPreset: React.Dispatch<React.SetStateAction<boolean>>;
  activeCharacterSheetPresetIdRef: React.MutableRefObject<CharacterSheetPresetId>;
  characterSheetPresetsRef: React.MutableRefObject<CharacterSheetPresetState["presets"]>;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<boolean>;
  markSlotBusy: (slotKey: CharacterReferenceSlotKey, busy: boolean) => void;
  slotsRef: React.MutableRefObject<CharacterSlotFileMap>;
  setSlots: React.Dispatch<React.SetStateAction<CharacterSlotFileMap>>;
};

type UseCharacterManagerAssetControllerResult = {
  setProfileImageFile: (file: File) => Promise<void>;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  clearProfileImage: () => Promise<void>;
  saveCharacterSheetAssignments: (assignments: CharacterSheetAssignments) => Promise<boolean>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<boolean>;
  setSlotFile: (slotKey: CharacterReferenceSlotKey, file: File) => Promise<boolean>;
  clearSlot: (slotKey: CharacterReferenceSlotKey) => Promise<void>;
  persistUnsavedDraftAssets: (params: {
    characterId: string;
    characterSheetId: string;
  }) => Promise<void>;
};

const CHARACTER_MANAGER_MAX_IMAGE_MB = Math.round(
  CHARACTER_MANAGER_MAX_IMAGE_BYTES / (1024 * 1024)
);

const createPendingValidationNotes = (file: File): CharacterSlotValidationNotes => ({
  validatorVersion: 1,
  mimeType: file.type || null,
  width: null,
  height: null,
  aspectRatio: null,
  sha256: null,
  hardErrors: [],
  warnings: [],
  evaluatedAt: null,
});

/**
 * Compose Character Manager asset persistence actions behind a stable controller boundary.
 */
export const useCharacterManagerAssetController = ({
  characterId,
  characterSheetId,
  profileImageUrl,
  clearMessages,
  setError,
  setIsSavingProfileImage,
  setProfileImageUrl,
  setProfileImageTransform,
  profileImageTransform,
  defaultProfileImageTransform,
  refreshCharacterListSilently,
  selectedCharacterStorageScopeRef,
  toErrorMessage,
  setCharacterSheetAssignments,
  characterSheetAssignmentsRef,
  characterSheetAssignmentsRequestRef,
  setIsSavingCharacterSheetPreset,
  activeCharacterSheetPresetIdRef,
  characterSheetPresetsRef,
  saveCharacterSheetPresetAssignments,
  markSlotBusy,
  slotsRef,
  setSlots,
}: UseCharacterManagerAssetControllerParams): UseCharacterManagerAssetControllerResult => {
  const stagedProfileImageFileRef = React.useRef<File | null>(null);
  const stagedProfileImagePreviewUrlRef = React.useRef<string | null>(null);
  const stagedPresetFilesRef = React.useRef<
    Partial<Record<CharacterSheetPresetId, Partial<Record<CharacterSheetDropZoneKey, File>>>>
  >({});
  const stagedSlotFilesRef = React.useRef<Partial<Record<CharacterReferenceSlotKey, File>>>({});
  const revokeObjectUrl = React.useCallback((value: string | null | undefined) => {
    if (!value?.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(value);
    } catch {
      // Ignore draft preview URLs that are already revoked.
    }
  }, []);

  const setProfileImageFile = React.useCallback(
    async (file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return;
      }
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError(`Image is too large. Maximum file size is ${CHARACTER_MANAGER_MAX_IMAGE_MB}MB.`);
        return;
      }
      if (!characterId) {
        revokeObjectUrl(stagedProfileImagePreviewUrlRef.current);
        const previewUrl = URL.createObjectURL(file);
        stagedProfileImageFileRef.current = file;
        stagedProfileImagePreviewUrlRef.current = previewUrl;
        setProfileImageUrl(previewUrl);
        setProfileImageTransform(defaultProfileImageTransform);
        return;
      }

      setIsSavingProfileImage(true);
      try {
        const signedUrl = await saveCharacterManagerProfileImage({
          characterId,
          file,
        });
        setProfileImageUrl(signedUrl);
        setProfileImageTransform(defaultProfileImageTransform);
        await refreshCharacterListSilently(characterId, {
          publishSyncEvent: true,
          reason: "profile_image",
        });
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save profile image."));
      } finally {
        setIsSavingProfileImage(false);
      }
    },
    [
      characterId,
      clearMessages,
      defaultProfileImageTransform,
      refreshCharacterListSilently,
      revokeObjectUrl,
      setError,
      setIsSavingProfileImage,
      setProfileImageTransform,
      setProfileImageUrl,
      toErrorMessage,
    ]
  );

  const saveProfileImageTransform = React.useCallback(
    async (transform: CharacterProfileImageTransform) => {
      clearMessages();
      if (!characterId) {
        if (!profileImageUrl) {
          setError("Upload a profile image before saving adjustments.");
          return false;
        }
        setProfileImageTransform(transform);
        return true;
      }
      if (!profileImageUrl) {
        setError("Upload a profile image before saving adjustments.");
        return false;
      }

      setIsSavingProfileImage(true);
      try {
        const persistedTransform = await saveCharacterManagerProfileImageAdjustments({
          characterId,
          zoom: transform.zoom,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
        });
        setProfileImageTransform(persistedTransform);
        publishCharacterListChanged({
          userId: selectedCharacterStorageScopeRef.current,
          reason: "profile_image",
        });
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save profile image adjustments."));
        return false;
      } finally {
        setIsSavingProfileImage(false);
      }
    },
    [
      characterId,
      clearMessages,
      profileImageUrl,
      selectedCharacterStorageScopeRef,
      setError,
      setIsSavingProfileImage,
      setProfileImageTransform,
      toErrorMessage,
    ]
  );

  const clearProfileImage = React.useCallback(async () => {
    clearMessages();
    if (!characterId) {
      stagedProfileImageFileRef.current = null;
      revokeObjectUrl(stagedProfileImagePreviewUrlRef.current);
      stagedProfileImagePreviewUrlRef.current = null;
      setProfileImageUrl(null);
      setProfileImageTransform(defaultProfileImageTransform);
      return;
    }

    setIsSavingProfileImage(true);
    try {
      await clearCharacterManagerProfileImage({
        characterId,
      });
      setProfileImageUrl(null);
      setProfileImageTransform(defaultProfileImageTransform);
      await refreshCharacterListSilently(characterId, {
        publishSyncEvent: true,
        reason: "profile_image",
      });
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to remove profile image."));
    } finally {
      setIsSavingProfileImage(false);
    }
  }, [
    characterId,
    clearMessages,
    defaultProfileImageTransform,
    refreshCharacterListSilently,
    revokeObjectUrl,
    setError,
    setIsSavingProfileImage,
    setProfileImageTransform,
    setProfileImageUrl,
    toErrorMessage,
  ]);

  const saveCharacterSheetAssignments = React.useCallback(
    async (assignments: CharacterSheetAssignments) => {
      clearMessages();
      if (!characterId) {
        const nextAssignments = {
          ...assignments,
        };
        setCharacterSheetAssignments(nextAssignments);
        characterSheetAssignmentsRef.current = nextAssignments;
        return true;
      }

      const previousAssignments = {
        ...characterSheetAssignmentsRef.current,
      };
      const nextAssignments = {
        ...assignments,
      };
      setCharacterSheetAssignments(nextAssignments);
      characterSheetAssignmentsRef.current = nextAssignments;

      const requestId = characterSheetAssignmentsRequestRef.current + 1;
      characterSheetAssignmentsRequestRef.current = requestId;
      try {
        const persistedAssignments = await saveCharacterManagerCharacterSheetAssignments({
          characterId,
          assignments: nextAssignments,
        });
        if (characterSheetAssignmentsRequestRef.current !== requestId) {
          return true;
        }
        setCharacterSheetAssignments(persistedAssignments);
        characterSheetAssignmentsRef.current = persistedAssignments;
        return true;
      } catch (nextError) {
        if (characterSheetAssignmentsRequestRef.current !== requestId) {
          return false;
        }
        setCharacterSheetAssignments(previousAssignments);
        characterSheetAssignmentsRef.current = previousAssignments;
        setError(toErrorMessage(nextError, "Failed to save character sheet assignments."));
        return false;
      }
    },
    [
      characterId,
      characterSheetAssignmentsRef,
      characterSheetAssignmentsRequestRef,
      clearMessages,
      setCharacterSheetAssignments,
      setError,
      toErrorMessage,
    ]
  );

  const setCharacterSheetPresetFile = React.useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return false;
      }
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError(`Image is too large. Maximum file size is ${CHARACTER_MANAGER_MAX_IMAGE_MB}MB.`);
        return false;
      }
      if (!characterId) {
        const activePresetId = activeCharacterSheetPresetIdRef.current;
        const currentAssignments =
          characterSheetPresetsRef.current[activePresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        revokeObjectUrl(currentAssignments[zoneKey]?.previewUrl ?? null);
        const previewUrl = URL.createObjectURL(file);
        stagedPresetFilesRef.current = {
          ...stagedPresetFilesRef.current,
          [activePresetId]: {
            ...(stagedPresetFilesRef.current[activePresetId] ?? {}),
            [zoneKey]: file,
          },
        };
        return await saveCharacterSheetPresetAssignments({
          ...currentAssignments,
          [zoneKey]: {
            mediaFileId: `local-${activePresetId}-${zoneKey}`,
            storagePath: "",
            previewUrl,
          },
        });
      }

      setIsSavingCharacterSheetPreset(true);
      try {
        const uploadedAsset = await saveCharacterManagerCharacterSheetPresetAsset({
          characterId,
          file,
        });
        const activePresetId = activeCharacterSheetPresetIdRef.current;
        const currentAssignments =
          characterSheetPresetsRef.current[activePresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        const nextAssignments = {
          ...currentAssignments,
          [zoneKey]: uploadedAsset,
        };
        return await saveCharacterSheetPresetAssignments(nextAssignments);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to upload character preset image."));
        return false;
      } finally {
        setIsSavingCharacterSheetPreset(false);
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      characterId,
      characterSheetPresetsRef,
      clearMessages,
      revokeObjectUrl,
      saveCharacterSheetPresetAssignments,
      setError,
      setIsSavingCharacterSheetPreset,
      toErrorMessage,
    ]
  );

  const setSlotFile = React.useCallback(
    async (slotKey: CharacterReferenceSlotKey, file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return false;
      }
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError(`Image is too large. Maximum file size is ${CHARACTER_MANAGER_MAX_IMAGE_MB}MB.`);
        return false;
      }

      markSlotBusy(slotKey, true);
      try {
        const validation = await validateCharacterReferenceFile({
          slotKey,
          file,
          existingSlots: slotsRef.current,
        });
        if (!characterId || !characterSheetId) {
          revokeObjectUrl(slotsRef.current[slotKey]?.previewUrl ?? null);
          stagedSlotFilesRef.current = {
            ...stagedSlotFilesRef.current,
            [slotKey]: file,
          };
          setSlots((prev) => {
            const next = {
              ...prev,
              [slotKey]: {
                mediaFileId: `local-${slotKey}`,
                storagePath: "",
                validationStatus: validation.status,
                validationNotes: validation.notes,
                name: file.name,
                size: file.size,
                type: file.type,
                previewUrl: URL.createObjectURL(file),
                updatedAt: new Date().toISOString(),
              },
            };
            slotsRef.current = next;
            return next;
          });
          return true;
        }
        const persistedSlot = await saveCharacterManagerSlot({
          characterId,
          characterSheetId,
          slotKey,
          file,
          validationStatus: validation.status,
          validationNotes: validation.notes,
        });
        setSlots((prev) => {
          const next = {
            ...prev,
            [slotKey]: persistedSlot,
          };
          slotsRef.current = next;
          return next;
        });
        await refreshCharacterListSilently(characterId);
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save this shot."));
        return false;
      } finally {
        markSlotBusy(slotKey, false);
      }
    },
    [
      characterId,
      characterSheetId,
      clearMessages,
      markSlotBusy,
      refreshCharacterListSilently,
      revokeObjectUrl,
      setError,
      setSlots,
      slotsRef,
      toErrorMessage,
    ]
  );

  const clearSlot = React.useCallback(
    async (slotKey: CharacterReferenceSlotKey) => {
      clearMessages();
      if (!characterSheetId) {
        revokeObjectUrl(slotsRef.current[slotKey]?.previewUrl ?? null);
        delete stagedSlotFilesRef.current[slotKey];
        setSlots((prev) => {
          const next = {
            ...prev,
            [slotKey]: null,
          };
          slotsRef.current = next;
          return next;
        });
        return;
      }

      markSlotBusy(slotKey, true);
      try {
        await clearCharacterManagerSlot({
          characterSheetId,
          slotKey,
        });
        setSlots((prev) => {
          const next = {
            ...prev,
            [slotKey]: null,
          };
          slotsRef.current = next;
          return next;
        });
        await refreshCharacterListSilently(characterId);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to remove this shot."));
      } finally {
        markSlotBusy(slotKey, false);
      }
    },
    [
      characterId,
      characterSheetId,
      clearMessages,
      markSlotBusy,
      refreshCharacterListSilently,
      revokeObjectUrl,
      setError,
      setSlots,
      slotsRef,
      toErrorMessage,
    ]
  );

  const persistUnsavedDraftAssets = React.useCallback(
    async ({
      characterId: persistedCharacterId,
      characterSheetId: persistedCharacterSheetId,
    }: {
      characterId: string;
      characterSheetId: string;
    }) => {
      if (stagedProfileImageFileRef.current) {
        await saveCharacterManagerProfileImage({
          characterId: persistedCharacterId,
          file: stagedProfileImageFileRef.current,
        });
        const hasCustomTransform =
          profileImageTransform.zoom !== defaultProfileImageTransform.zoom ||
          profileImageTransform.offsetX !== defaultProfileImageTransform.offsetX ||
          profileImageTransform.offsetY !== defaultProfileImageTransform.offsetY;
        if (hasCustomTransform) {
          await saveCharacterManagerProfileImageAdjustments({
            characterId: persistedCharacterId,
            zoom: profileImageTransform.zoom,
            offsetX: profileImageTransform.offsetX,
            offsetY: profileImageTransform.offsetY,
          });
        }
      }

      const stagedPresetEntries = Object.entries(stagedPresetFilesRef.current) as Array<
        [CharacterSheetPresetId, Partial<Record<CharacterSheetDropZoneKey, File>>]
      >;
      for (const [presetId, stagedFiles] of stagedPresetEntries) {
        const currentAssignments =
          characterSheetPresetsRef.current[presetId] ??
          createEmptyCharacterSheetPresetAssignments();
        let nextAssignments = currentAssignments;
        let hasPresetUploads = false;
        for (const [zoneKey, stagedFile] of Object.entries(stagedFiles) as Array<
          [CharacterSheetDropZoneKey, File | undefined]
        >) {
          if (!stagedFile) continue;
          const uploadedAsset = await saveCharacterManagerCharacterSheetPresetAsset({
            characterId: persistedCharacterId,
            file: stagedFile,
          });
          nextAssignments = {
            ...nextAssignments,
            [zoneKey]: uploadedAsset,
          };
          hasPresetUploads = true;
        }
        if (hasPresetUploads) {
          await saveCharacterManagerCharacterSheetPresetAssignments({
            characterId: persistedCharacterId,
            presetId,
            assignments: nextAssignments,
          });
        }
        for (const assignment of Object.values(currentAssignments)) {
          revokeObjectUrl(assignment?.previewUrl ?? null);
        }
      }

      const stagedSlotEntries = Object.entries(stagedSlotFilesRef.current) as Array<
        [CharacterReferenceSlotKey, File | undefined]
      >;
      for (const [slotKey, stagedFile] of stagedSlotEntries) {
        if (!stagedFile) continue;
        const currentSlot = slotsRef.current[slotKey];
        await saveCharacterManagerSlot({
          characterId: persistedCharacterId,
          characterSheetId: persistedCharacterSheetId,
          slotKey,
          file: stagedFile,
          validationStatus: currentSlot?.validationStatus ?? "pending",
          validationNotes: currentSlot?.validationNotes ?? createPendingValidationNotes(stagedFile),
        });
        revokeObjectUrl(currentSlot?.previewUrl ?? null);
      }

      await saveCharacterManagerCharacterSheetAssignments({
        characterId: persistedCharacterId,
        assignments: characterSheetAssignmentsRef.current,
      });

      stagedProfileImageFileRef.current = null;
      revokeObjectUrl(stagedProfileImagePreviewUrlRef.current);
      stagedProfileImagePreviewUrlRef.current = null;
      stagedPresetFilesRef.current = {};
      stagedSlotFilesRef.current = {};
    },
    [
      characterSheetAssignmentsRef,
      characterSheetPresetsRef,
      defaultProfileImageTransform,
      profileImageTransform,
      revokeObjectUrl,
      slotsRef,
    ]
  );

  return {
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    saveCharacterSheetAssignments,
    setCharacterSheetPresetFile,
    setSlotFile,
    clearSlot,
    persistUnsavedDraftAssets,
  };
};
