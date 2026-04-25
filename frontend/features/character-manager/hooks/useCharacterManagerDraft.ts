/**
 * Character Manager draft-state hook.
 * Binds reference intake and draft character state to persisted Supabase records.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createDefaultCharacterSheetPresetDescriptions,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSlotMap,
} from "../constants";
import { useCharacterManagerAssetController } from "./useCharacterManagerAssetController";
import { useCharacterManagerBootstrapController } from "./useCharacterManagerBootstrapController";
import { useCharacterManagerPresetController } from "./useCharacterManagerPresetController";
import {
  deleteCharacterManagerDraft,
  loadCharacterManagerDraftByCharacterId,
  saveCharacterManagerDraft,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
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
  isSavingCharacter: boolean;
  isDeletingCharacter: boolean;
  isSwitchingCharacter: boolean;
  isSavingProfileImage: boolean;
  isSavingCharacterSheetPreset: boolean;
  hasUnsavedCharacterDraft: boolean;
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
  saveCharacter: () => Promise<boolean>;
  selectCharacter: (characterId: string) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<boolean>;
  isSlotBusy: (slotKey: CharacterReferenceSlotKey) => boolean;
  clearMessages: () => void;
  setErrorMessage: (message: string | null) => void;
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;
const DEFAULT_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};
const createPresetRequestCounterMap = (): Record<CharacterSheetPresetId, number> =>
  CHARACTER_SHEET_PRESET_IDS.reduce(
    (acc, presetId) => {
      acc[presetId] = 0;
      return acc;
    },
    {} as Record<CharacterSheetPresetId, number>
  );

const sortCharacterListItems = (items: CharacterManagerListItem[]): CharacterManagerListItem[] =>
  [...items].sort((left, right) => {
    const updatedDiff = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return right.characterId.localeCompare(left.characterId);
  });

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
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
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
  const charactersRef = useRef<CharacterManagerListItem[]>([]);
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
    charactersRef.current = characters;
  }, [characters]);

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

  const { applySnapshot, applyLocalDraft } = useCharacterManagerBootstrapController({
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

  const upsertCharacterListItem = useCallback((item: CharacterManagerListItem) => {
    setCharacters((previous) => {
      const next = sortCharacterListItems([
        ...previous.filter((entry) => entry.characterId !== item.characterId),
        item,
      ]);
      charactersRef.current = next;
      return next;
    });
  }, []);

  const patchCharacterListItem = useCallback(
    (
      targetCharacterId: string,
      updateItem: (item: CharacterManagerListItem) => CharacterManagerListItem
    ) => {
      setCharacters((previous) => {
        let found = false;
        const next = previous.map((item) => {
          if (item.characterId !== targetCharacterId) {
            return item;
          }
          found = true;
          return updateItem(item);
        });
        if (!found && characterSheetId) {
          next.push(
            updateItem({
              characterId: targetCharacterId,
              characterName,
              characterStatus: "draft",
              characterSheetId,
              profileImageUrl,
              profileImageTransform: profileImageUrl ? profileImageTransform : null,
              characterSheetStatus: "ready",
              updatedAt: new Date().toISOString(),
            })
          );
        }
        const sortedNext = sortCharacterListItems(next);
        charactersRef.current = sortedNext;
        return sortedNext;
      });
    },
    [characterName, characterSheetId, profileImageTransform, profileImageUrl]
  );

  const removeCharacterListItem = useCallback((targetCharacterId: string) => {
    setCharacters((previous) => {
      const next = previous.filter((item) => item.characterId !== targetCharacterId);
      charactersRef.current = next;
      return next;
    });
  }, []);

  const applyLoadedCharacterSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>) => {
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
    },
    [applySnapshot]
  );

  const loadAndApplyCharacterSnapshot = useCallback(
    async (nextCharacterId: string) => {
      const snapshot = await loadCharacterManagerDraftByCharacterId(nextCharacterId);
      applyLoadedCharacterSnapshot(snapshot);
      return snapshot;
    },
    [applyLoadedCharacterSnapshot]
  );

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

  const {
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    saveCharacterSheetAssignments,
    setCharacterSheetPresetFile,
    setSlotFile,
    clearSlot,
    persistUnsavedDraftAssets,
  } = useCharacterManagerAssetController({
    characterId,
    characterSheetId,
    profileImageUrl,
    clearMessages,
    setError,
    setIsSavingProfileImage,
    setProfileImageUrl,
    setProfileImageTransform,
    profileImageTransform,
    defaultProfileImageTransform: DEFAULT_PROFILE_IMAGE_TRANSFORM,
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
    patchCharacterListItem,
  });

  const createCharacter = useCallback(async () => {
    clearMessages();
    setIsCreatingCharacter(true);
    try {
      applyLocalDraft({
        nextUserId: selectedCharacterStorageScopeRef.current,
      });
    } finally {
      setIsCreatingCharacter(false);
    }
  }, [applyLocalDraft, clearMessages]);

  const saveCharacter = useCallback(async () => {
    if (characterId) {
      return true;
    }

    clearMessages();
    setIsSavingCharacter(true);
    try {
      const initialSnapshot = await saveCharacterManagerDraft({
        name: characterName,
        activeCharacterSheetPresetId: activeCharacterSheetPresetIdRef.current,
        visibleCharacterSheetPresetIds: visibleCharacterSheetPresetIdsRef.current,
        characterSheetPresetLabels: characterSheetPresetLabelsRef.current,
        characterSheetPresetDescriptions: characterSheetPresetDescriptionsRef.current,
      });
      await persistUnsavedDraftAssets({
        characterId: initialSnapshot.characterId,
        characterSheetId: initialSnapshot.characterSheetId,
      });
      const snapshot = await loadAndApplyCharacterSnapshot(initialSnapshot.characterId);
      upsertCharacterListItem({
        characterId: snapshot.characterId,
        characterName: snapshot.characterName,
        characterStatus: "draft",
        characterSheetId: snapshot.characterSheetId,
        profileImageUrl: snapshot.profileImageUrl,
        profileImageTransform: snapshot.profileImageUrl ? snapshot.profileImageTransform : null,
        characterSheetStatus: "ready",
        updatedAt: new Date().toISOString(),
      });
      publishCharacterListChanged({
        userId: selectedCharacterStorageScopeRef.current,
        reason: "create",
      });
      return true;
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to save character."));
      return false;
    } finally {
      setIsSavingCharacter(false);
    }
  }, [
    characterId,
    characterName,
    clearMessages,
    loadAndApplyCharacterSnapshot,
    persistUnsavedDraftAssets,
    upsertCharacterListItem,
  ]);

  const deleteCharacter = useCallback(
    async (targetCharacterId: string) => {
      const trimmedId = targetCharacterId.trim();
      if (!trimmedId) return false;

      clearMessages();
      setIsDeletingCharacter(true);
      try {
        await deleteCharacterManagerDraft({ characterId: trimmedId });

        if (characterId && characterId !== trimmedId) {
          removeCharacterListItem(trimmedId);
          publishCharacterListChanged({
            userId: selectedCharacterStorageScopeRef.current,
            reason: "delete",
          });
          return true;
        }

        const remainingCharacters = charactersRef.current.filter(
          (item) => item.characterId !== trimmedId
        );
        removeCharacterListItem(trimmedId);
        publishCharacterListChanged({
          userId: selectedCharacterStorageScopeRef.current,
          reason: "delete",
        });
        const nextCharacterId = remainingCharacters[0]?.characterId ?? null;
        if (nextCharacterId) {
          await loadAndApplyCharacterSnapshot(nextCharacterId);
        } else {
          applyLocalDraft({
            nextUserId: selectedCharacterStorageScopeRef.current,
          });
        }

        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to delete character."));
        return false;
      } finally {
        setIsDeletingCharacter(false);
      }
    },
    [
      applyLocalDraft,
      characterId,
      clearMessages,
      charactersRef,
      loadAndApplyCharacterSnapshot,
      removeCharacterListItem,
      selectedCharacterStorageScopeRef,
    ]
  );

  const selectCharacter = useCallback(
    async (nextCharacterId: string) => {
      if (!nextCharacterId || nextCharacterId === characterId) return;
      clearMessages();
      setIsSwitchingCharacter(true);
      try {
        await loadAndApplyCharacterSnapshot(nextCharacterId);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to switch character."));
      } finally {
        setIsSwitchingCharacter(false);
      }
    },
    [characterId, clearMessages, loadAndApplyCharacterSnapshot]
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
    isSavingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingProfileImage,
    isSavingCharacterSheetPreset,
    hasUnsavedCharacterDraft: !characterId,
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
    saveCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
    setErrorMessage: setError,
  };
};
