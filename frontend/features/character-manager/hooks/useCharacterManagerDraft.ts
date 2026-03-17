/**
 * Character Manager draft-state hook.
 * Binds reference intake and draft character state to persisted Supabase records.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createDefaultCharacterSheetPresetDescriptions,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
  createEmptyCharacterSlotMap,
} from "../constants";
import { useCharacterManagerBootstrapController } from "./useCharacterManagerBootstrapController";
import { useCharacterManagerPresetController } from "./useCharacterManagerPresetController";
import {
  clearCharacterManagerProfileImage,
  clearCharacterManagerSlot,
  createCharacterManagerDraft,
  deleteCharacterManagerDraft,
  loadCharacterManagerDraftByCharacterId,
  saveCharacterManagerCharacterSheetPresetAsset,
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import { publishCharacterListChanged } from "../logic/characterListSyncEvents";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetDescriptionMap,
  CharacterSheetPresetId,
  CharacterSheetPresetState,
  CharacterSlotFileMap,
} from "../types";
import type { CharacterManagerListItem } from "../logic/characterManagerPersistence";

type UseCharacterManagerDraftResult = {
  characters: CharacterManagerListItem[];
  selectedCharacterId: string | null;
  characterName: string;
  characterDescription: string;
  characterSheetAssignments: CharacterSheetAssignments;
  activeCharacterSheetPresetId: CharacterSheetPresetId;
  characterSheetPresets: CharacterSheetPresetState["presets"];
  visibleCharacterSheetPresetIds: CharacterSheetPresetState["tabOrder"];
  characterSheetPresetLabels: CharacterSheetPresetState["tabLabels"];
  characterSheetPresetAssignments: CharacterSheetPresetAssignments;
  profileImageUrl: string | null;
  profileImageTransform: CharacterProfileImageTransform;
  slots: CharacterSlotFileMap;
  error: string | null;
  loading: boolean;
  isSavingName: boolean;
  isCreatingCharacter: boolean;
  isDeletingCharacter: boolean;
  isSwitchingCharacter: boolean;
  isSavingProfileImage: boolean;
  isSavingCharacterSheetPreset: boolean;
  setCharacterName: (value: string) => void;
  setCharacterDescription: (value: string) => void;
  setProfileImageFile: (file: File) => Promise<void>;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  clearProfileImage: () => Promise<void>;
  saveCharacterSheetAssignments: (assignments: CharacterSheetAssignments) => Promise<boolean>;
  setActiveCharacterSheetPreset: (presetId: CharacterSheetPresetId) => Promise<boolean>;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<boolean>;
  addCharacterSheetPreset: () => Promise<boolean>;
  renameCharacterSheetPreset: (
    presetId: CharacterSheetPresetId,
    nextLabel: string
  ) => Promise<boolean>;
  deleteCharacterSheetPreset: (presetId: CharacterSheetPresetId) => Promise<boolean>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<boolean>;
  setSlotFile: (slotKey: CharacterReferenceSlotKey, file: File) => Promise<boolean>;
  clearSlot: (slotKey: CharacterReferenceSlotKey) => Promise<void>;
  createCharacter: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<boolean>;
  isSlotBusy: (slotKey: CharacterReferenceSlotKey) => boolean;
  clearMessages: () => void;
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;
const DEFAULT_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};
const CHARACTER_MANAGER_MAX_IMAGE_MB = Math.round(
  CHARACTER_MANAGER_MAX_IMAGE_BYTES / (1024 * 1024)
);
const createPresetRequestCounterMap = (): Record<CharacterSheetPresetId, number> =>
  CHARACTER_SHEET_PRESET_IDS.reduce(
    (acc, presetId) => {
      acc[presetId] = 0;
      return acc;
    },
    {} as Record<CharacterSheetPresetId, number>
  );

/**
 * Manages persisted character draft state and reference uploads.
 */
export const useCharacterManagerDraft = (): UseCharacterManagerDraftResult => {
  const [characters, setCharacters] = useState<CharacterManagerListItem[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [characterSheetId, setCharacterSheetId] = useState<string | null>(null);
  const [characterName, setCharacterNameState] = useState("New Character");
  const [characterDescription, setCharacterDescriptionState] = useState("");
  const [characterSheetAssignments, setCharacterSheetAssignments] =
    useState<CharacterSheetAssignments>(() => createEmptyCharacterSheetAssignments());
  const [activeCharacterSheetPresetId, setActiveCharacterSheetPresetIdState] =
    useState<CharacterSheetPresetId>("1");
  const [characterSheetPresets, setCharacterSheetPresets] = useState<
    CharacterSheetPresetState["presets"]
  >(() => createDefaultCharacterSheetPresetState().presets);
  const [visibleCharacterSheetPresetIds, setVisibleCharacterSheetPresetIds] = useState<
    CharacterSheetPresetState["tabOrder"]
  >(() => createDefaultCharacterSheetPresetState().tabOrder);
  const [characterSheetPresetLabels, setCharacterSheetPresetLabels] = useState<
    CharacterSheetPresetState["tabLabels"]
  >(() => createDefaultCharacterSheetPresetState().tabLabels);
  const [characterSheetPresetDescriptions, setCharacterSheetPresetDescriptions] =
    useState<CharacterSheetPresetDescriptionMap>(() =>
      createDefaultCharacterSheetPresetDescriptions()
    );
  const [characterSheetPresetAssignments, setCharacterSheetPresetAssignments] =
    useState<CharacterSheetPresetAssignments>(
      () => createDefaultCharacterSheetPresetState().presets["1"]
    );
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileImageTransform, setProfileImageTransform] =
    useState<CharacterProfileImageTransform>(DEFAULT_PROFILE_IMAGE_TRANSFORM);
  const [slots, setSlots] = useState<CharacterSlotFileMap>(() => createEmptyCharacterSlotMap());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isDeletingCharacter, setIsDeletingCharacter] = useState(false);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [isSavingProfileImage, setIsSavingProfileImage] = useState(false);
  const [isSavingCharacterSheetPreset, setIsSavingCharacterSheetPreset] = useState(false);
  const [slotBusyKeys, setSlotBusyKeys] = useState<Set<CharacterReferenceSlotKey>>(() => new Set());

  const suppressNextNamePersistRef = useRef(false);
  const characterIdRef = useRef<string | null>(null);
  const namePersistTimerRef = useRef<number | null>(null);
  const descriptionPersistTimerRefs = useRef<Record<CharacterSheetPresetId, number | null>>({
    "1": null,
    "2": null,
    "3": null,
    "4": null,
    "5": null,
    "6": null,
    "7": null,
    "8": null,
    "9": null,
    "10": null,
  });
  const lastPersistedNameRef = useRef("New Character");
  const lastPersistedDescriptionMapRef = useRef<CharacterSheetPresetDescriptionMap>(
    createDefaultCharacterSheetPresetDescriptions()
  );
  const namePersistRequestRef = useRef(0);
  const descriptionPersistRequestRef = useRef<Record<CharacterSheetPresetId, number>>(
    createPresetRequestCounterMap()
  );
  const slotsRef = useRef<CharacterSlotFileMap>(createEmptyCharacterSlotMap());
  const characterSheetAssignmentsRef = useRef<CharacterSheetAssignments>(
    createEmptyCharacterSheetAssignments()
  );
  const selectedCharacterStorageScopeRef = useRef<string | null>(null);
  const characterSheetAssignmentsRequestRef = useRef(0);
  const activeCharacterSheetPresetIdRef = useRef<CharacterSheetPresetId>("1");
  const activeCharacterSheetPresetRequestRef = useRef(0);
  const characterSheetPresetsRef = useRef<CharacterSheetPresetState["presets"]>(
    createDefaultCharacterSheetPresetState().presets
  );
  const visibleCharacterSheetPresetIdsRef = useRef<CharacterSheetPresetState["tabOrder"]>(
    createDefaultCharacterSheetPresetState().tabOrder
  );
  const characterSheetPresetLabelsRef = useRef<CharacterSheetPresetState["tabLabels"]>(
    createDefaultCharacterSheetPresetState().tabLabels
  );
  const characterSheetPresetDescriptionsRef = useRef<CharacterSheetPresetDescriptionMap>(
    createDefaultCharacterSheetPresetDescriptions()
  );
  const characterSheetPresetAssignmentsRequestRef = useRef(0);
  const characterSheetPresetTabOrderRequestRef = useRef(0);
  const characterSheetPresetTabLabelRequestRef = useRef(0);

  const clearMessages = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    characterIdRef.current = characterId;
  }, [characterId]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    characterSheetAssignmentsRef.current = characterSheetAssignments;
  }, [characterSheetAssignments]);

  useEffect(() => {
    activeCharacterSheetPresetIdRef.current = activeCharacterSheetPresetId;
  }, [activeCharacterSheetPresetId]);

  useEffect(() => {
    characterSheetPresetsRef.current = characterSheetPresets;
  }, [characterSheetPresets]);

  useEffect(() => {
    visibleCharacterSheetPresetIdsRef.current = visibleCharacterSheetPresetIds;
  }, [visibleCharacterSheetPresetIds]);

  useEffect(() => {
    characterSheetPresetLabelsRef.current = characterSheetPresetLabels;
  }, [characterSheetPresetLabels]);

  useEffect(() => {
    characterSheetPresetDescriptionsRef.current = characterSheetPresetDescriptions;
  }, [characterSheetPresetDescriptions]);

  const { applySnapshot, refreshCharacterList, refreshCharacterListSilently } =
    useCharacterManagerBootstrapController({
      setCharacters,
      setCharacterId,
      setCharacterSheetId,
      setCharacterNameState,
      setCharacterDescriptionState,
      setCharacterSheetAssignments,
      setActiveCharacterSheetPresetIdState,
      setCharacterSheetPresets,
      setVisibleCharacterSheetPresetIds,
      setCharacterSheetPresetLabels,
      setCharacterSheetPresetDescriptions,
      setCharacterSheetPresetAssignments,
      setProfileImageUrl,
      setProfileImageTransform,
      setSlots,
      setError,
      setLoading,
      setSlotBusyKeys,
      suppressNextNamePersistRef,
      selectedCharacterStorageScopeRef,
      characterSheetAssignmentsRef,
      characterSheetAssignmentsRequestRef,
      activeCharacterSheetPresetIdRef,
      characterSheetPresetsRef,
      visibleCharacterSheetPresetIdsRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetAssignmentsRequestRef,
      lastPersistedNameRef,
      lastPersistedDescriptionMapRef,
      descriptionPersistRequestRef,
      descriptionPersistTimerRefs,
      createPresetRequestCounterMap,
      slotsRef,
      toErrorMessage,
    });

  const markSlotBusy = useCallback((slotKey: CharacterReferenceSlotKey, busy: boolean) => {
    setSlotBusyKeys((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(slotKey);
      } else {
        next.delete(slotKey);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!characterId) return;
    if (suppressNextNamePersistRef.current) {
      suppressNextNamePersistRef.current = false;
      return;
    }

    const trimmed = characterName.trim();
    if (trimmed.length < 2 || trimmed === lastPersistedNameRef.current) {
      return;
    }

    if (namePersistTimerRef.current) {
      window.clearTimeout(namePersistTimerRef.current);
    }
    namePersistTimerRef.current = window.setTimeout(() => {
      const requestId = namePersistRequestRef.current + 1;
      namePersistRequestRef.current = requestId;
      setIsSavingName(true);
      void updateCharacterManagerName({
        characterId,
        name: trimmed,
      })
        .then(() => {
          if (namePersistRequestRef.current !== requestId) return;
          lastPersistedNameRef.current = trimmed;
          setCharacters((prev) =>
            prev.map((item) =>
              item.characterId === characterId ? { ...item, characterName: trimmed } : item
            )
          );
          publishCharacterListChanged({
            userId: selectedCharacterStorageScopeRef.current,
            reason: "rename",
          });
        })
        .catch((nextError) => {
          if (namePersistRequestRef.current !== requestId) return;
          setError(toErrorMessage(nextError, "Failed to save character name."));
        })
        .finally(() => {
          if (namePersistRequestRef.current === requestId) {
            setIsSavingName(false);
          }
        });
    }, 500);

    return () => {
      if (namePersistTimerRef.current) {
        window.clearTimeout(namePersistTimerRef.current);
      }
    };
  }, [characterId, characterName]);

  useEffect(
    () => () => {
      if (namePersistTimerRef.current) {
        window.clearTimeout(namePersistTimerRef.current);
      }
      for (const presetId of CHARACTER_SHEET_PRESET_IDS) {
        const timerId = descriptionPersistTimerRefs.current[presetId];
        if (timerId) {
          window.clearTimeout(timerId);
          descriptionPersistTimerRefs.current[presetId] = null;
        }
      }
    },
    []
  );

  const setCharacterName = useCallback((value: string) => {
    setCharacterNameState(value.slice(0, 80));
  }, []);

  const {
    setCharacterDescription,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
  } = useCharacterManagerPresetController({
    characterId,
    clearMessages,
    setError,
    setIsSavingCharacterSheetPreset,
    activeCharacterSheetPresetIdRef,
    activeCharacterSheetPresetRequestRef,
    characterSheetPresetsRef,
    visibleCharacterSheetPresetIdsRef,
    characterSheetPresetLabelsRef,
    characterSheetPresetDescriptionsRef,
    lastPersistedDescriptionMapRef,
    descriptionPersistTimerRefs,
    descriptionPersistRequestRef,
    characterSheetPresetAssignmentsRequestRef,
    characterSheetPresetTabOrderRequestRef,
    characterSheetPresetTabLabelRequestRef,
    setActiveCharacterSheetPresetIdState,
    setCharacterSheetPresets,
    setVisibleCharacterSheetPresetIds,
    setCharacterSheetPresetLabels,
    setCharacterSheetPresetDescriptions,
    setCharacterSheetPresetAssignments,
    setCharacterDescriptionState,
    toErrorMessage,
  });

  const setProfileImageFile = useCallback(
    async (file: File) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return;
      }
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return;
      }
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError(`Image is too large. Maximum file size is ${CHARACTER_MANAGER_MAX_IMAGE_MB}MB.`);
        return;
      }

      setIsSavingProfileImage(true);
      try {
        const signedUrl = await saveCharacterManagerProfileImage({
          characterId,
          file,
        });
        setProfileImageUrl(signedUrl);
        setProfileImageTransform(DEFAULT_PROFILE_IMAGE_TRANSFORM);
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
    [characterId, clearMessages, refreshCharacterListSilently]
  );

  const saveProfileImageTransform = useCallback(
    async (transform: CharacterProfileImageTransform) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
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
    [characterId, clearMessages, profileImageUrl]
  );

  const clearProfileImage = useCallback(async () => {
    clearMessages();
    if (!characterId) {
      setError("Character draft is still loading. Try again in a moment.");
      return;
    }

    setIsSavingProfileImage(true);
    try {
      await clearCharacterManagerProfileImage({
        characterId,
      });
      setProfileImageUrl(null);
      setProfileImageTransform(DEFAULT_PROFILE_IMAGE_TRANSFORM);
      await refreshCharacterListSilently(characterId, {
        publishSyncEvent: true,
        reason: "profile_image",
      });
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to remove profile image."));
    } finally {
      setIsSavingProfileImage(false);
    }
  }, [characterId, clearMessages, refreshCharacterListSilently]);

  const saveCharacterSheetAssignments = useCallback(
    async (assignments: CharacterSheetAssignments) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
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
    [characterId, clearMessages]
  );

  const setCharacterSheetPresetFile = useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, file: File) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return false;
      }
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError(`Image is too large. Maximum file size is ${CHARACTER_MANAGER_MAX_IMAGE_MB}MB.`);
        return false;
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
        const didPersist = await saveCharacterSheetPresetAssignments(nextAssignments);
        if (!didPersist) {
          return false;
        }
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to upload character preset image."));
        return false;
      } finally {
        setIsSavingCharacterSheetPreset(false);
      }
    },
    [characterId, clearMessages, saveCharacterSheetPresetAssignments]
  );

  const setSlotFile = useCallback(
    async (slotKey: CharacterReferenceSlotKey, file: File) => {
      clearMessages();
      if (!characterId || !characterSheetId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }
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
    [characterId, clearMessages, markSlotBusy, characterSheetId, refreshCharacterListSilently]
  );

  const clearSlot = useCallback(
    async (slotKey: CharacterReferenceSlotKey) => {
      clearMessages();
      if (!characterSheetId) {
        setError("Character draft is still loading. Try again in a moment.");
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
    [characterId, clearMessages, markSlotBusy, characterSheetId, refreshCharacterListSilently]
  );

  const createCharacter = useCallback(async () => {
    clearMessages();
    setIsCreatingCharacter(true);
    try {
      const snapshot = await createCharacterManagerDraft("New Character");
      applySnapshot({
        nextCharacterId: snapshot.characterId,
        nextCharacterSheetId: snapshot.characterSheetId,
        nextCharacterName: snapshot.characterName,
        nextCharacterDescription: snapshot.characterDescription,
        nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
        nextActiveCharacterSheetPresetId: snapshot.activeCharacterSheetPresetId,
        nextCharacterSheetPresets: snapshot.characterSheetPresets,
        nextVisibleCharacterSheetPresetIds: snapshot.visibleCharacterSheetPresetIds,
        nextCharacterSheetPresetLabels: snapshot.characterSheetPresetLabels,
        nextCharacterSheetPresetDescriptions: snapshot.characterSheetPresetDescriptions,
        nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
        nextProfileImageUrl: snapshot.profileImageUrl,
        nextProfileImageTransform: snapshot.profileImageTransform,
        nextSlots: snapshot.slots,
        nextUserId: snapshot.userId,
      });
      await refreshCharacterListSilently(snapshot.characterId, {
        publishSyncEvent: true,
        reason: "create",
      });
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to create a new character draft."));
    } finally {
      setIsCreatingCharacter(false);
    }
  }, [applySnapshot, clearMessages, refreshCharacterListSilently]);

  const deleteCharacter = useCallback(
    async (targetCharacterId: string) => {
      const trimmedId = targetCharacterId.trim();
      if (!trimmedId) return false;

      clearMessages();
      setIsDeletingCharacter(true);
      try {
        await deleteCharacterManagerDraft({ characterId: trimmedId });

        if (characterId && characterId !== trimmedId) {
          await refreshCharacterListSilently(characterId, {
            publishSyncEvent: true,
            reason: "delete",
          });
          return true;
        }

        const nextCharacterId = await refreshCharacterList(null, {
          publishSyncEvent: true,
          reason: "delete",
        });
        if (nextCharacterId) {
          const snapshot = await loadCharacterManagerDraftByCharacterId(nextCharacterId);
          applySnapshot({
            nextCharacterId: snapshot.characterId,
            nextCharacterSheetId: snapshot.characterSheetId,
            nextCharacterName: snapshot.characterName,
            nextCharacterDescription: snapshot.characterDescription,
            nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
            nextActiveCharacterSheetPresetId: snapshot.activeCharacterSheetPresetId,
            nextCharacterSheetPresets: snapshot.characterSheetPresets,
            nextVisibleCharacterSheetPresetIds: snapshot.visibleCharacterSheetPresetIds,
            nextCharacterSheetPresetLabels: snapshot.characterSheetPresetLabels,
            nextCharacterSheetPresetDescriptions: snapshot.characterSheetPresetDescriptions,
            nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
            nextUserId: snapshot.userId,
          });
          await refreshCharacterListSilently(snapshot.characterId);
        } else {
          const snapshot = await createCharacterManagerDraft();
          applySnapshot({
            nextCharacterId: snapshot.characterId,
            nextCharacterSheetId: snapshot.characterSheetId,
            nextCharacterName: snapshot.characterName,
            nextCharacterDescription: snapshot.characterDescription,
            nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
            nextActiveCharacterSheetPresetId: snapshot.activeCharacterSheetPresetId,
            nextCharacterSheetPresets: snapshot.characterSheetPresets,
            nextVisibleCharacterSheetPresetIds: snapshot.visibleCharacterSheetPresetIds,
            nextCharacterSheetPresetLabels: snapshot.characterSheetPresetLabels,
            nextCharacterSheetPresetDescriptions: snapshot.characterSheetPresetDescriptions,
            nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
            nextUserId: snapshot.userId,
          });
          await refreshCharacterListSilently(snapshot.characterId);
        }

        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to delete character."));
        return false;
      } finally {
        setIsDeletingCharacter(false);
      }
    },
    [applySnapshot, characterId, clearMessages, refreshCharacterList, refreshCharacterListSilently]
  );

  const selectCharacter = useCallback(
    async (nextCharacterId: string) => {
      if (!nextCharacterId || nextCharacterId === characterId) return;
      clearMessages();
      setIsSwitchingCharacter(true);
      try {
        const snapshot = await loadCharacterManagerDraftByCharacterId(nextCharacterId);
        applySnapshot({
          nextCharacterId: snapshot.characterId,
          nextCharacterSheetId: snapshot.characterSheetId,
          nextCharacterName: snapshot.characterName,
          nextCharacterDescription: snapshot.characterDescription,
          nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
          nextActiveCharacterSheetPresetId: snapshot.activeCharacterSheetPresetId,
          nextCharacterSheetPresets: snapshot.characterSheetPresets,
          nextVisibleCharacterSheetPresetIds: snapshot.visibleCharacterSheetPresetIds,
          nextCharacterSheetPresetLabels: snapshot.characterSheetPresetLabels,
          nextCharacterSheetPresetDescriptions: snapshot.characterSheetPresetDescriptions,
          nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
          nextProfileImageUrl: snapshot.profileImageUrl,
          nextProfileImageTransform: snapshot.profileImageTransform,
          nextSlots: snapshot.slots,
          nextUserId: snapshot.userId,
        });
        await refreshCharacterListSilently(snapshot.characterId);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to switch character."));
      } finally {
        setIsSwitchingCharacter(false);
      }
    },
    [applySnapshot, characterId, clearMessages, refreshCharacterListSilently]
  );

  const isSlotBusy = useCallback(
    (slotKey: CharacterReferenceSlotKey) =>
      loading ||
      isCreatingCharacter ||
      isDeletingCharacter ||
      isSwitchingCharacter ||
      slotBusyKeys.has(slotKey),
    [isCreatingCharacter, isDeletingCharacter, isSwitchingCharacter, loading, slotBusyKeys]
  );

  return {
    characters,
    selectedCharacterId: characterId,
    characterName,
    characterDescription,
    characterSheetAssignments,
    activeCharacterSheetPresetId,
    characterSheetPresets,
    visibleCharacterSheetPresetIds,
    characterSheetPresetLabels,
    characterSheetPresetAssignments,
    profileImageUrl,
    profileImageTransform,
    slots,
    error,
    loading,
    isSavingName,
    isCreatingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingProfileImage,
    isSavingCharacterSheetPreset,
    setCharacterName,
    setCharacterDescription,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    saveCharacterSheetAssignments,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
    setCharacterSheetPresetFile,
    setSlotFile,
    clearSlot,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
  };
};
