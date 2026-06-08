/**
 * Character Manager asset controller.
 * Owns profile image, look image, slot persistence, and assignment save flows.
 */
import React from "react";
import { maybePreprocessLocalImageFileForUpload } from "../../../lib/adaptive-media/localTranscode";
import { createEmptyCharacterSheetPresetAssignments } from "../constants";
import {
  cleanupCharacterManagerMediaReference,
  clearCharacterManagerProfileImage,
  clearCharacterManagerSlot,
  type CharacterManagerListItem,
  saveCharacterManagerCharacterSheetPresetAsset,
  saveCharacterManagerCharacterSheetPresetAssignments,
  saveCharacterManagerCharacterSheetPresetStorageAsset,
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerSlot,
} from "../logic/characterManagerPersistence";
import { publishCharacterListChanged } from "../logic/characterListSyncEvents";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetMediaReference,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
  CharacterSheetPresetState,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
} from "../types";

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
  selectedCharacterStorageScopeRef: React.MutableRefObject<string | null>;
  toErrorMessage: (error: unknown, fallback: string) => string;
  setCharacterSheetAssignments: React.Dispatch<React.SetStateAction<CharacterSheetAssignments>>;
  characterSheetAssignmentsRef: React.MutableRefObject<CharacterSheetAssignments>;
  characterSheetAssignmentsRequestRef: React.MutableRefObject<number>;
  beginCharacterSheetPresetMutation: () => void;
  endCharacterSheetPresetMutation: () => void;
  activeCharacterSheetPresetIdRef: React.MutableRefObject<CharacterSheetPresetId>;
  characterSheetPresetsRef: React.MutableRefObject<CharacterSheetPresetState["presets"]>;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<boolean>;
  saveCharacterSheetPresetAssignmentsForPreset: (
    presetId: CharacterSheetPresetId,
    assignments: CharacterSheetPresetAssignments
  ) => Promise<boolean>;
  markSlotBusy: (slotKey: CharacterReferenceSlotKey, busy: boolean) => void;
  slotsRef: React.MutableRefObject<CharacterSlotFileMap>;
  setSlots: React.Dispatch<React.SetStateAction<CharacterSlotFileMap>>;
  patchCharacterListItem: (
    targetCharacterId: string,
    updateItem: (item: CharacterManagerListItem) => CharacterManagerListItem
  ) => void;
};

type UseCharacterManagerAssetControllerResult = {
  setProfileImageFile: (file: File) => Promise<void>;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  clearProfileImage: () => Promise<void>;
  saveCharacterSheetAssignments: (assignments: CharacterSheetAssignments) => Promise<boolean>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<boolean>;
  setCharacterSheetPresetStorageReference: (
    zoneKey: CharacterSheetDropZoneKey,
    reference: {
      storagePath: string;
      previewUrl: string | null;
      filename?: string | null;
      mimeType?: string | null;
    }
  ) => Promise<boolean>;
  setSlotFile: (slotKey: CharacterReferenceSlotKey, file: File) => Promise<boolean>;
  clearSlot: (slotKey: CharacterReferenceSlotKey) => Promise<void>;
  clearUnsavedDraftAssets: () => void;
  persistUnsavedDraftAssets: (params: {
    characterId: string;
    characterSheetId: string;
  }) => Promise<{ persistedAssetCount: number }>;
};

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

type StagedCharacterSheetPresetAsset =
  | {
      kind: "file";
      file: File;
    }
  | {
      kind: "storage_reference";
      storagePath: string;
      filename: string | null;
      mimeType: string | null;
    };

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
  selectedCharacterStorageScopeRef,
  toErrorMessage,
  setCharacterSheetAssignments,
  characterSheetAssignmentsRef,
  characterSheetAssignmentsRequestRef,
  beginCharacterSheetPresetMutation,
  endCharacterSheetPresetMutation,
  activeCharacterSheetPresetIdRef,
  characterSheetPresetsRef,
  saveCharacterSheetPresetAssignments,
  saveCharacterSheetPresetAssignmentsForPreset,
  markSlotBusy,
  slotsRef,
  setSlots,
  patchCharacterListItem,
}: UseCharacterManagerAssetControllerParams): UseCharacterManagerAssetControllerResult => {
  const stagedProfileImageFileRef = React.useRef<File | null>(null);
  const stagedProfileImagePreviewUrlRef = React.useRef<string | null>(null);
  const stagedPresetAssetsRef = React.useRef<
    Partial<
      Record<
        CharacterSheetPresetId,
        Partial<Record<CharacterSheetDropZoneKey, StagedCharacterSheetPresetAsset>>
      >
    >
  >({});
  const stagedSlotFilesRef = React.useRef<Partial<Record<CharacterReferenceSlotKey, File>>>({});
  const publishCharacterRefresh = React.useCallback(() => {
    publishCharacterListChanged({
      userId: selectedCharacterStorageScopeRef.current,
      reason: "refresh",
    });
  }, [selectedCharacterStorageScopeRef]);
  const revokeObjectUrl = React.useCallback((value: string | null | undefined) => {
    if (!value?.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(value);
    } catch {
      // Ignore draft preview URLs that are already revoked.
    }
  }, []);
  const clearUnsavedDraftAssets = React.useCallback(() => {
    stagedProfileImageFileRef.current = null;
    revokeObjectUrl(stagedProfileImagePreviewUrlRef.current);
    stagedProfileImagePreviewUrlRef.current = null;

    const stagedPresetEntries = Object.entries(stagedPresetAssetsRef.current) as Array<
      [
        CharacterSheetPresetId,
        Partial<Record<CharacterSheetDropZoneKey, StagedCharacterSheetPresetAsset>>,
      ]
    >;
    for (const [presetId, stagedAssets] of stagedPresetEntries) {
      const currentAssignments =
        characterSheetPresetsRef.current[presetId] ?? createEmptyCharacterSheetPresetAssignments();
      for (const zoneKey of Object.keys(stagedAssets) as CharacterSheetDropZoneKey[]) {
        revokeObjectUrl(currentAssignments[zoneKey]?.previewUrl ?? null);
      }
    }

    for (const slotKey of Object.keys(stagedSlotFilesRef.current) as CharacterReferenceSlotKey[]) {
      revokeObjectUrl(slotsRef.current[slotKey]?.previewUrl ?? null);
    }

    stagedPresetAssetsRef.current = {};
    stagedSlotFilesRef.current = {};
  }, [characterSheetPresetsRef, revokeObjectUrl, slotsRef]);

  const setProfileImageFile = React.useCallback(
    async (file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported for AI Studio Characters.");
        return;
      }
      const preparedFile = await maybePreprocessLocalImageFileForUpload(file);
      if (!characterId) {
        revokeObjectUrl(stagedProfileImagePreviewUrlRef.current);
        const previewUrl = URL.createObjectURL(preparedFile);
        stagedProfileImageFileRef.current = preparedFile;
        stagedProfileImagePreviewUrlRef.current = previewUrl;
        setProfileImageUrl(previewUrl);
        setProfileImageTransform(defaultProfileImageTransform);
        return;
      }

      setIsSavingProfileImage(true);
      try {
        const savedProfileImage = await saveCharacterManagerProfileImage({
          characterId,
          file: preparedFile,
        });
        setProfileImageUrl(savedProfileImage.signedUrl);
        setProfileImageTransform(defaultProfileImageTransform);
        patchCharacterListItem(characterId, (item) => ({
          ...item,
          profileImageUrl: savedProfileImage.signedUrl,
          profileImageCharacterMediaId: savedProfileImage.characterMediaId,
          profileImagePreviewStoragePath: savedProfileImage.previewStoragePath,
          profileImageStoragePath: savedProfileImage.storagePath,
          profileImageTransform: defaultProfileImageTransform,
          updatedAt: new Date().toISOString(),
        }));
        publishCharacterListChanged({
          userId: selectedCharacterStorageScopeRef.current,
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
      patchCharacterListItem,
      revokeObjectUrl,
      selectedCharacterStorageScopeRef,
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
        patchCharacterListItem(characterId, (item) => ({
          ...item,
          profileImageTransform: persistedTransform,
        }));
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
      patchCharacterListItem,
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
      patchCharacterListItem(characterId, (item) => ({
        ...item,
        profileImageUrl: null,
        profileImageTransform: null,
        updatedAt: new Date().toISOString(),
      }));
      publishCharacterListChanged({
        userId: selectedCharacterStorageScopeRef.current,
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
    patchCharacterListItem,
    revokeObjectUrl,
    selectedCharacterStorageScopeRef,
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
        publishCharacterRefresh();
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
      publishCharacterRefresh,
      setCharacterSheetAssignments,
      setError,
      toErrorMessage,
    ]
  );

  const setCharacterSheetPresetFile = React.useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported for AI Studio Characters.");
        return false;
      }
      const preparedFile = await maybePreprocessLocalImageFileForUpload(file);
      if (!characterId) {
        const activePresetId = activeCharacterSheetPresetIdRef.current;
        const currentAssignments =
          characterSheetPresetsRef.current[activePresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        revokeObjectUrl(currentAssignments[zoneKey]?.previewUrl ?? null);
        const previewUrl = URL.createObjectURL(preparedFile);
        stagedPresetAssetsRef.current = {
          ...stagedPresetAssetsRef.current,
          [activePresetId]: {
            ...(stagedPresetAssetsRef.current[activePresetId] ?? {}),
            [zoneKey]: {
              kind: "file",
              file: preparedFile,
            },
          },
        };
        return await saveCharacterSheetPresetAssignments({
          ...currentAssignments,
          [zoneKey]: {
            characterMediaId: `local-${activePresetId}-${zoneKey}`,
            storagePath: "",
            previewUrl,
          },
        });
      }

      const targetPresetId = activeCharacterSheetPresetIdRef.current;
      beginCharacterSheetPresetMutation();
      try {
        const uploadedAsset = await saveCharacterManagerCharacterSheetPresetAsset({
          characterId,
          file: preparedFile,
        });
        const currentAssignments =
          characterSheetPresetsRef.current[targetPresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        const nextAssignments = {
          ...currentAssignments,
          [zoneKey]: uploadedAsset,
        };
        return await saveCharacterSheetPresetAssignmentsForPreset(targetPresetId, nextAssignments);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to upload character look image."));
        return false;
      } finally {
        endCharacterSheetPresetMutation();
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      beginCharacterSheetPresetMutation,
      characterId,
      characterSheetPresetsRef,
      clearMessages,
      endCharacterSheetPresetMutation,
      revokeObjectUrl,
      saveCharacterSheetPresetAssignments,
      saveCharacterSheetPresetAssignmentsForPreset,
      setError,
      toErrorMessage,
    ]
  );

  const setCharacterSheetPresetStorageReference = React.useCallback(
    async (
      zoneKey: CharacterSheetDropZoneKey,
      reference: {
        storagePath: string;
        previewUrl: string | null;
        filename?: string | null;
        mimeType?: string | null;
      }
    ) => {
      clearMessages();
      const sourceStoragePath = reference.storagePath.trim();
      if (!sourceStoragePath) {
        setError("Character reference is missing storage authority.");
        return false;
      }
      if (!characterId) {
        const activePresetId = activeCharacterSheetPresetIdRef.current;
        const currentAssignments =
          characterSheetPresetsRef.current[activePresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        revokeObjectUrl(currentAssignments[zoneKey]?.previewUrl ?? null);
        stagedPresetAssetsRef.current = {
          ...stagedPresetAssetsRef.current,
          [activePresetId]: {
            ...(stagedPresetAssetsRef.current[activePresetId] ?? {}),
            [zoneKey]: {
              kind: "storage_reference",
              storagePath: sourceStoragePath,
              filename: reference.filename?.trim() || null,
              mimeType: reference.mimeType?.trim() || null,
            },
          },
        };
        return await saveCharacterSheetPresetAssignments({
          ...currentAssignments,
          [zoneKey]: {
            characterMediaId: `storage-${activePresetId}-${zoneKey}`,
            storagePath: sourceStoragePath,
            previewUrl: reference.previewUrl,
          },
        });
      }

      const targetPresetId = activeCharacterSheetPresetIdRef.current;
      beginCharacterSheetPresetMutation();
      try {
        const uploadedAsset = await saveCharacterManagerCharacterSheetPresetStorageAsset({
          characterId,
          sourceStoragePath,
          filename: reference.filename ?? null,
          mimeType: reference.mimeType ?? null,
        });
        const currentAssignments =
          characterSheetPresetsRef.current[targetPresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        const nextAssignments = {
          ...currentAssignments,
          [zoneKey]: uploadedAsset,
        };
        return await saveCharacterSheetPresetAssignmentsForPreset(targetPresetId, nextAssignments);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save character look image."));
        return false;
      } finally {
        endCharacterSheetPresetMutation();
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      beginCharacterSheetPresetMutation,
      characterId,
      characterSheetPresetsRef,
      clearMessages,
      endCharacterSheetPresetMutation,
      revokeObjectUrl,
      saveCharacterSheetPresetAssignments,
      saveCharacterSheetPresetAssignmentsForPreset,
      setError,
      toErrorMessage,
    ]
  );

  const setSlotFile = React.useCallback(
    async (slotKey: CharacterReferenceSlotKey, file: File) => {
      clearMessages();
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported for AI Studio Characters.");
        return false;
      }
      const preparedFile = await maybePreprocessLocalImageFileForUpload(file);

      markSlotBusy(slotKey, true);
      try {
        const validation = await validateCharacterReferenceFile({
          slotKey,
          file: preparedFile,
          existingSlots: slotsRef.current,
        });
        if (!characterId || !characterSheetId) {
          revokeObjectUrl(slotsRef.current[slotKey]?.previewUrl ?? null);
          stagedSlotFilesRef.current = {
            ...stagedSlotFilesRef.current,
            [slotKey]: preparedFile,
          };
          setSlots((prev) => {
            const next = {
              ...prev,
              [slotKey]: {
                characterMediaId: `local-${slotKey}`,
                storagePath: "",
                validationStatus: validation.status,
                validationNotes: validation.notes,
                name: preparedFile.name,
                size: preparedFile.size,
                type: preparedFile.type,
                previewUrl: URL.createObjectURL(preparedFile),
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
          file: preparedFile,
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
        patchCharacterListItem(characterId, (item) => ({
          ...item,
          updatedAt: new Date().toISOString(),
        }));
        publishCharacterRefresh();
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
      patchCharacterListItem,
      publishCharacterRefresh,
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
        if (characterId) {
          patchCharacterListItem(characterId, (item) => ({
            ...item,
            updatedAt: new Date().toISOString(),
          }));
        }
        publishCharacterRefresh();
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
      patchCharacterListItem,
      publishCharacterRefresh,
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
      let persistedAssetCount = 0;
      if (stagedProfileImageFileRef.current) {
        await saveCharacterManagerProfileImage({
          characterId: persistedCharacterId,
          file: stagedProfileImageFileRef.current,
        });
        persistedAssetCount += 1;
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

      const stagedPresetEntries = Object.entries(stagedPresetAssetsRef.current) as Array<
        [
          CharacterSheetPresetId,
          Partial<Record<CharacterSheetDropZoneKey, StagedCharacterSheetPresetAsset>>,
        ]
      >;
      for (const [presetId, stagedAssets] of stagedPresetEntries) {
        const currentAssignments =
          characterSheetPresetsRef.current[presetId] ??
          createEmptyCharacterSheetPresetAssignments();
        const stagedUploads = (
          Object.entries(stagedAssets) as Array<
            [CharacterSheetDropZoneKey, StagedCharacterSheetPresetAsset | undefined]
          >
        ).filter((entry): entry is [CharacterSheetDropZoneKey, StagedCharacterSheetPresetAsset] =>
          Boolean(entry[1])
        );
        const uploadedAssets: Array<
          [CharacterSheetDropZoneKey, CharacterSheetPresetMediaReference]
        > = [];
        try {
          for (const [zoneKey, stagedAsset] of stagedUploads) {
            const uploadedAsset =
              stagedAsset.kind === "file"
                ? await saveCharacterManagerCharacterSheetPresetAsset({
                    characterId: persistedCharacterId,
                    file: stagedAsset.file,
                  })
                : await saveCharacterManagerCharacterSheetPresetStorageAsset({
                    characterId: persistedCharacterId,
                    sourceStoragePath: stagedAsset.storagePath,
                    filename: stagedAsset.filename,
                    mimeType: stagedAsset.mimeType,
                  });
            uploadedAssets.push([zoneKey, uploadedAsset]);
          }
        } catch (error) {
          await Promise.allSettled(
            uploadedAssets.map(([, uploadedAsset]) =>
              uploadedAsset
                ? cleanupCharacterManagerMediaReference(uploadedAsset)
                : Promise.resolve()
            )
          );
          throw error;
        }
        persistedAssetCount += uploadedAssets.length;
        let nextAssignments = currentAssignments;
        for (const [zoneKey, uploadedAsset] of uploadedAssets) {
          nextAssignments = {
            ...nextAssignments,
            [zoneKey]: uploadedAsset,
          };
        }
        if (uploadedAssets.length > 0) {
          try {
            await saveCharacterManagerCharacterSheetPresetAssignments({
              characterId: persistedCharacterId,
              presetId,
              assignments: nextAssignments,
            });
          } catch (error) {
            await Promise.allSettled(
              uploadedAssets.map(([, uploadedAsset]) =>
                cleanupCharacterManagerMediaReference(uploadedAsset)
              )
            );
            throw error;
          }
        }
        for (const assignment of Object.values(currentAssignments)) {
          revokeObjectUrl(assignment?.previewUrl ?? null);
        }
      }

      const stagedSlotEntries = Object.entries(stagedSlotFilesRef.current) as Array<
        [CharacterReferenceSlotKey, File | undefined]
      >;
      const savedSlotUploads = await Promise.all(
        stagedSlotEntries
          .filter((entry): entry is [CharacterReferenceSlotKey, File] => Boolean(entry[1]))
          .map(async ([slotKey, stagedFile]) => {
            const currentSlot = slotsRef.current[slotKey];
            await saveCharacterManagerSlot({
              characterId: persistedCharacterId,
              characterSheetId: persistedCharacterSheetId,
              slotKey,
              file: stagedFile,
              validationStatus: currentSlot?.validationStatus ?? "pending",
              validationNotes:
                currentSlot?.validationNotes ?? createPendingValidationNotes(stagedFile),
            });
            return currentSlot;
          })
      );
      persistedAssetCount += savedSlotUploads.length;
      for (const currentSlot of savedSlotUploads) {
        revokeObjectUrl(currentSlot?.previewUrl ?? null);
      }

      await saveCharacterManagerCharacterSheetAssignments({
        characterId: persistedCharacterId,
        assignments: characterSheetAssignmentsRef.current,
      });

      clearUnsavedDraftAssets();
      return { persistedAssetCount };
    },
    [
      clearUnsavedDraftAssets,
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
    setCharacterSheetPresetStorageReference,
    setSlotFile,
    clearSlot,
    clearUnsavedDraftAssets,
    persistUnsavedDraftAssets,
  };
};
