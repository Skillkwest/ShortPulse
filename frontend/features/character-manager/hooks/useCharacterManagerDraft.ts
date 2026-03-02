/**
 * Character Manager draft-state hook.
 * Binds reference intake and draft character state to persisted Supabase records.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
  createEmptyCharacterSlotMap,
} from "../constants";
import {
  clearCharacterManagerProfileImage,
  clearCharacterManagerSlot,
  createCharacterManagerDraft,
  deleteCharacterManagerDraft,
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
  loadOrCreateCharacterManagerDraft,
  saveCharacterManagerActiveCharacterSheetPreset,
  saveCharacterManagerCharacterSheetPresetAsset,
  saveCharacterManagerCharacterSheetPresetAssignments,
  deleteCharacterManagerCharacterSheetPreset,
  saveCharacterManagerCharacterSheetPresetTabLabel,
  saveCharacterManagerCharacterSheetPresetTabOrder,
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
  updateCharacterManagerDescription,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
import {
  getNextCharacterSheetPresetId,
  sanitizeCharacterSheetPresetTabLabel,
} from "../logic/characterSheetPresetTabs";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
} from "../logic/selectedCharacterPersistence";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
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
  const suppressNextDescriptionPersistRef = useRef(false);
  const namePersistTimerRef = useRef<number | null>(null);
  const descriptionPersistTimerRef = useRef<number | null>(null);
  const lastPersistedNameRef = useRef("New Character");
  const lastPersistedDescriptionRef = useRef("");
  const namePersistRequestRef = useRef(0);
  const descriptionPersistRequestRef = useRef(0);
  const slotsRef = useRef<CharacterSlotFileMap>(createEmptyCharacterSlotMap());
  const characterSheetAssignmentsRef = useRef<CharacterSheetAssignments>(
    createEmptyCharacterSheetAssignments()
  );
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
  const characterSheetPresetAssignmentsRequestRef = useRef(0);
  const characterSheetPresetTabOrderRequestRef = useRef(0);
  const characterSheetPresetTabLabelRequestRef = useRef(0);

  const clearMessages = useCallback(() => {
    setError(null);
  }, []);

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

  const refreshCharacterList = useCallback(async (preferredCharacterId?: string | null) => {
    const items = await listCharacterManagerCharacters();
    setCharacters(items);
    if (!items.length) return null;

    const preferredId = preferredCharacterId?.trim();
    if (preferredId && items.some((item) => item.characterId === preferredId)) {
      return preferredId;
    }
    return items[0]?.characterId ?? null;
  }, []);

  const refreshCharacterListSilently = useCallback(
    async (preferredCharacterId?: string | null) => {
      try {
        await refreshCharacterList(preferredCharacterId);
      } catch {
        // Character rail refresh is best-effort and should not break core draft actions.
      }
    },
    [refreshCharacterList]
  );

  const applySnapshot = useCallback(
    ({
      nextCharacterId,
      nextCharacterSheetId,
      nextCharacterName,
      nextCharacterDescription,
      nextCharacterSheetAssignments,
      nextActiveCharacterSheetPresetId,
      nextCharacterSheetPresets,
      nextVisibleCharacterSheetPresetIds,
      nextCharacterSheetPresetLabels,
      nextCharacterSheetPresetAssignments,
      nextProfileImageUrl,
      nextProfileImageTransform,
      nextSlots,
    }: {
      nextCharacterId: string;
      nextCharacterSheetId: string;
      nextCharacterName: string;
      nextCharacterDescription: string;
      nextCharacterSheetAssignments: CharacterSheetAssignments;
      nextActiveCharacterSheetPresetId: CharacterSheetPresetId;
      nextCharacterSheetPresets: CharacterSheetPresetState["presets"];
      nextVisibleCharacterSheetPresetIds: CharacterSheetPresetState["tabOrder"];
      nextCharacterSheetPresetLabels: CharacterSheetPresetState["tabLabels"];
      nextCharacterSheetPresetAssignments: CharacterSheetPresetAssignments;
      nextProfileImageUrl: string | null;
      nextProfileImageTransform: CharacterProfileImageTransform;
      nextSlots: CharacterSlotFileMap;
    }) => {
      setCharacterId(nextCharacterId);
      persistSelectedCharacterId(nextCharacterId);
      setCharacterSheetId(nextCharacterSheetId);
      suppressNextNamePersistRef.current = true;
      suppressNextDescriptionPersistRef.current = true;
      setCharacterNameState(nextCharacterName);
      setCharacterDescriptionState(nextCharacterDescription);
      setCharacterSheetAssignments(nextCharacterSheetAssignments);
      characterSheetAssignmentsRef.current = nextCharacterSheetAssignments;
      characterSheetAssignmentsRequestRef.current = 0;
      setActiveCharacterSheetPresetIdState(nextActiveCharacterSheetPresetId);
      activeCharacterSheetPresetIdRef.current = nextActiveCharacterSheetPresetId;
      setCharacterSheetPresets(nextCharacterSheetPresets);
      characterSheetPresetsRef.current = nextCharacterSheetPresets;
      setVisibleCharacterSheetPresetIds(nextVisibleCharacterSheetPresetIds);
      visibleCharacterSheetPresetIdsRef.current = nextVisibleCharacterSheetPresetIds;
      setCharacterSheetPresetLabels(nextCharacterSheetPresetLabels);
      characterSheetPresetLabelsRef.current = nextCharacterSheetPresetLabels;
      setCharacterSheetPresetAssignments(nextCharacterSheetPresetAssignments);
      characterSheetPresetAssignmentsRequestRef.current = 0;
      setProfileImageUrl(nextProfileImageUrl);
      setProfileImageTransform(nextProfileImageTransform);
      setSlots(nextSlots);
      slotsRef.current = nextSlots;
      lastPersistedNameRef.current = nextCharacterName.trim();
      lastPersistedDescriptionRef.current = nextCharacterDescription;
      setSlotBusyKeys(new Set());
    },
    []
  );

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        const snapshot = await loadOrCreateCharacterManagerDraft(
          readPersistedSelectedCharacterId()
        );
        if (!active) return;
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
          nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
          nextProfileImageUrl: snapshot.profileImageUrl,
          nextProfileImageTransform: snapshot.profileImageTransform,
          nextSlots: snapshot.slots,
        });
        await refreshCharacterListSilently(snapshot.characterId);
      } catch (nextError) {
        if (!active) return;
        setError(toErrorMessage(nextError, "Failed to load Character Manager draft."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [applySnapshot, refreshCharacterListSilently]);

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

  useEffect(() => {
    if (!characterId) return;
    if (suppressNextDescriptionPersistRef.current) {
      suppressNextDescriptionPersistRef.current = false;
      return;
    }

    const nextDescription = characterDescription.slice(0, 150);
    if (nextDescription === lastPersistedDescriptionRef.current) {
      return;
    }

    if (descriptionPersistTimerRef.current) {
      window.clearTimeout(descriptionPersistTimerRef.current);
    }
    descriptionPersistTimerRef.current = window.setTimeout(() => {
      const requestId = descriptionPersistRequestRef.current + 1;
      descriptionPersistRequestRef.current = requestId;
      void updateCharacterManagerDescription({
        characterId,
        description: nextDescription,
      })
        .then(() => {
          if (descriptionPersistRequestRef.current !== requestId) return;
          lastPersistedDescriptionRef.current = nextDescription;
        })
        .catch((nextError) => {
          if (descriptionPersistRequestRef.current !== requestId) return;
          setError(toErrorMessage(nextError, "Failed to save character description."));
        });
    }, 500);

    return () => {
      if (descriptionPersistTimerRef.current) {
        window.clearTimeout(descriptionPersistTimerRef.current);
      }
    };
  }, [characterDescription, characterId]);

  useEffect(
    () => () => {
      if (namePersistTimerRef.current) {
        window.clearTimeout(namePersistTimerRef.current);
      }
      if (descriptionPersistTimerRef.current) {
        window.clearTimeout(descriptionPersistTimerRef.current);
      }
    },
    []
  );

  const setCharacterName = useCallback((value: string) => {
    setCharacterNameState(value.slice(0, 80));
  }, []);

  const setCharacterDescription = useCallback((value: string) => {
    setCharacterDescriptionState(value.slice(0, 150));
  }, []);

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
        await refreshCharacterListSilently(characterId);
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
      await refreshCharacterListSilently(characterId);
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

  const setActiveCharacterSheetPreset = useCallback(
    async (presetId: CharacterSheetPresetId) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }
      const previousPresetId = activeCharacterSheetPresetIdRef.current;
      const previousAssignments =
        characterSheetPresetsRef.current[previousPresetId] ??
        createEmptyCharacterSheetPresetAssignments();
      setActiveCharacterSheetPresetIdState(presetId);
      activeCharacterSheetPresetIdRef.current = presetId;
      setCharacterSheetPresetAssignments(
        characterSheetPresetsRef.current[presetId] ?? createEmptyCharacterSheetPresetAssignments()
      );
      const requestId = activeCharacterSheetPresetRequestRef.current + 1;
      activeCharacterSheetPresetRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerActiveCharacterSheetPreset({
          characterId,
          presetId,
        });
        if (activeCharacterSheetPresetRequestRef.current !== requestId) {
          return true;
        }
        setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
        activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
        setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
        visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
        setCharacterSheetPresetLabels(persistedState.tabLabels);
        characterSheetPresetLabelsRef.current = persistedState.tabLabels;
        // Keep local preset references stable on tab switches to avoid unnecessary preview URL churn.
        const resolvedPresets = characterSheetPresetsRef.current;
        const resolvedActiveAssignments =
          resolvedPresets[persistedState.activePresetId] ??
          persistedState.presets[persistedState.activePresetId] ??
          createEmptyCharacterSheetPresetAssignments();
        setCharacterSheetPresetAssignments(resolvedActiveAssignments);
        return true;
      } catch (nextError) {
        if (activeCharacterSheetPresetRequestRef.current !== requestId) {
          return false;
        }
        setActiveCharacterSheetPresetIdState(previousPresetId);
        activeCharacterSheetPresetIdRef.current = previousPresetId;
        setCharacterSheetPresetAssignments(previousAssignments);
        setError(toErrorMessage(nextError, "Failed to switch character sheet preset."));
        return false;
      } finally {
        if (activeCharacterSheetPresetRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [characterId, clearMessages]
  );

  const saveCharacterSheetPresetAssignments = useCallback(
    async (assignments: CharacterSheetPresetAssignments) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }

      const activePresetId = activeCharacterSheetPresetIdRef.current;
      const previousPresets = characterSheetPresetsRef.current;
      const previousAssignments =
        previousPresets[activePresetId] ?? createEmptyCharacterSheetPresetAssignments();
      const normalizedAssignments = { ...assignments };
      const optimisticPresets = {
        ...previousPresets,
        [activePresetId]: normalizedAssignments,
      };
      setCharacterSheetPresets(optimisticPresets);
      characterSheetPresetsRef.current = optimisticPresets;
      setCharacterSheetPresetAssignments(normalizedAssignments);

      const requestId = characterSheetPresetAssignmentsRequestRef.current + 1;
      characterSheetPresetAssignmentsRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerCharacterSheetPresetAssignments({
          characterId,
          presetId: activePresetId,
          assignments: normalizedAssignments,
        });
        if (characterSheetPresetAssignmentsRequestRef.current !== requestId) {
          return true;
        }
        setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
        activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
        setCharacterSheetPresets(persistedState.presets);
        characterSheetPresetsRef.current = persistedState.presets;
        setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
        visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
        setCharacterSheetPresetLabels(persistedState.tabLabels);
        characterSheetPresetLabelsRef.current = persistedState.tabLabels;
        setCharacterSheetPresetAssignments(
          persistedState.presets[persistedState.activePresetId] ??
            createEmptyCharacterSheetPresetAssignments()
        );
        return true;
      } catch (nextError) {
        if (characterSheetPresetAssignmentsRequestRef.current !== requestId) {
          return false;
        }
        const revertedPresets = {
          ...previousPresets,
          [activePresetId]: previousAssignments,
        };
        setCharacterSheetPresets(revertedPresets);
        characterSheetPresetsRef.current = revertedPresets;
        setCharacterSheetPresetAssignments(previousAssignments);
        setError(toErrorMessage(nextError, "Failed to save character sheet preset."));
        return false;
      } finally {
        if (characterSheetPresetAssignmentsRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [characterId, clearMessages]
  );

  const addCharacterSheetPreset = useCallback(async () => {
    clearMessages();
    if (!characterId) {
      setError("Character draft is still loading. Try again in a moment.");
      return false;
    }

    const previousPresetId = activeCharacterSheetPresetIdRef.current;
    const previousVisiblePresetIds = [...visibleCharacterSheetPresetIdsRef.current];
    const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
    const previousAssignments =
      characterSheetPresetsRef.current[previousPresetId] ??
      createEmptyCharacterSheetPresetAssignments();
    const nextPresetId = getNextCharacterSheetPresetId(previousVisiblePresetIds);
    if (!nextPresetId) {
      setError("You can create up to 10 preset tabs.");
      return false;
    }

    const optimisticVisiblePresetIds = [...previousVisiblePresetIds, nextPresetId];
    const optimisticLabels = {
      ...previousPresetLabels,
      [nextPresetId]: previousPresetLabels[nextPresetId] ?? nextPresetId,
    };
    setVisibleCharacterSheetPresetIds(optimisticVisiblePresetIds);
    visibleCharacterSheetPresetIdsRef.current = optimisticVisiblePresetIds;
    setCharacterSheetPresetLabels(optimisticLabels);
    characterSheetPresetLabelsRef.current = optimisticLabels;
    setActiveCharacterSheetPresetIdState(nextPresetId);
    activeCharacterSheetPresetIdRef.current = nextPresetId;
    setCharacterSheetPresetAssignments(
      characterSheetPresetsRef.current[nextPresetId] ?? createEmptyCharacterSheetPresetAssignments()
    );

    const requestId = characterSheetPresetTabOrderRequestRef.current + 1;
    characterSheetPresetTabOrderRequestRef.current = requestId;
    setIsSavingCharacterSheetPreset(true);
    try {
      const persistedState = await saveCharacterManagerCharacterSheetPresetTabOrder({
        characterId,
        tabOrder: optimisticVisiblePresetIds,
        activePresetId: nextPresetId,
      });
      if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
        return true;
      }
      setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
      activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
      setCharacterSheetPresets(persistedState.presets);
      characterSheetPresetsRef.current = persistedState.presets;
      setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
      visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
      setCharacterSheetPresetLabels(persistedState.tabLabels);
      characterSheetPresetLabelsRef.current = persistedState.tabLabels;
      setCharacterSheetPresetAssignments(
        persistedState.presets[persistedState.activePresetId] ??
          createEmptyCharacterSheetPresetAssignments()
      );
      return true;
    } catch (nextError) {
      if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
        return false;
      }
      setVisibleCharacterSheetPresetIds(previousVisiblePresetIds);
      visibleCharacterSheetPresetIdsRef.current = previousVisiblePresetIds;
      setCharacterSheetPresetLabels(previousPresetLabels);
      characterSheetPresetLabelsRef.current = previousPresetLabels;
      setActiveCharacterSheetPresetIdState(previousPresetId);
      activeCharacterSheetPresetIdRef.current = previousPresetId;
      setCharacterSheetPresetAssignments(previousAssignments);
      setError(toErrorMessage(nextError, "Failed to add character sheet preset tab."));
      return false;
    } finally {
      if (characterSheetPresetTabOrderRequestRef.current === requestId) {
        setIsSavingCharacterSheetPreset(false);
      }
    }
  }, [characterId, clearMessages]);

  const renameCharacterSheetPreset = useCallback(
    async (presetId: CharacterSheetPresetId, nextLabel: string) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }
      if (!visibleCharacterSheetPresetIdsRef.current.includes(presetId)) {
        return false;
      }

      const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
      const optimisticLabel = sanitizeCharacterSheetPresetTabLabel({
        presetId,
        label: nextLabel,
      });
      const optimisticLabels = {
        ...previousPresetLabels,
        [presetId]: optimisticLabel,
      };
      setCharacterSheetPresetLabels(optimisticLabels);
      characterSheetPresetLabelsRef.current = optimisticLabels;

      const requestId = characterSheetPresetTabLabelRequestRef.current + 1;
      characterSheetPresetTabLabelRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerCharacterSheetPresetTabLabel({
          characterId,
          presetId,
          label: optimisticLabel,
        });
        if (characterSheetPresetTabLabelRequestRef.current !== requestId) {
          return true;
        }
        setCharacterSheetPresets(persistedState.presets);
        characterSheetPresetsRef.current = persistedState.presets;
        setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
        visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
        setCharacterSheetPresetLabels(persistedState.tabLabels);
        characterSheetPresetLabelsRef.current = persistedState.tabLabels;
        setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
        activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
        setCharacterSheetPresetAssignments(
          persistedState.presets[persistedState.activePresetId] ??
            createEmptyCharacterSheetPresetAssignments()
        );
        return true;
      } catch (nextError) {
        if (characterSheetPresetTabLabelRequestRef.current !== requestId) {
          return false;
        }
        setCharacterSheetPresetLabels(previousPresetLabels);
        characterSheetPresetLabelsRef.current = previousPresetLabels;
        setError(toErrorMessage(nextError, "Failed to rename character sheet preset tab."));
        return false;
      } finally {
        if (characterSheetPresetTabLabelRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [characterId, clearMessages]
  );

  const deleteCharacterSheetPreset = useCallback(
    async (presetId: CharacterSheetPresetId) => {
      clearMessages();
      if (!characterId) {
        setError("Character draft is still loading. Try again in a moment.");
        return false;
      }
      if (presetId === "1") {
        setError("Preset tab 1 cannot be deleted.");
        return false;
      }

      const previousPresetId = activeCharacterSheetPresetIdRef.current;
      const previousPresets = characterSheetPresetsRef.current;
      const previousVisiblePresetIds = [...visibleCharacterSheetPresetIdsRef.current];
      const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
      if (!previousVisiblePresetIds.includes(presetId)) {
        return false;
      }

      const optimisticVisiblePresetIds = previousVisiblePresetIds.filter(
        (visiblePresetId) => visiblePresetId !== presetId
      );
      if (!optimisticVisiblePresetIds.length) {
        setError("At least one preset tab must remain visible.");
        return false;
      }

      const nextActivePresetId =
        previousPresetId === presetId ? (optimisticVisiblePresetIds[0] ?? "1") : previousPresetId;
      const optimisticPresets = {
        ...previousPresets,
        [presetId]: createEmptyCharacterSheetPresetAssignments(),
      };
      const optimisticLabels = {
        ...previousPresetLabels,
        [presetId]: presetId,
      };
      const previousActiveAssignments =
        previousPresets[previousPresetId] ?? createEmptyCharacterSheetPresetAssignments();
      const nextActiveAssignments =
        optimisticPresets[nextActivePresetId] ?? createEmptyCharacterSheetPresetAssignments();

      setCharacterSheetPresets(optimisticPresets);
      characterSheetPresetsRef.current = optimisticPresets;
      setVisibleCharacterSheetPresetIds(optimisticVisiblePresetIds);
      visibleCharacterSheetPresetIdsRef.current = optimisticVisiblePresetIds;
      setCharacterSheetPresetLabels(optimisticLabels);
      characterSheetPresetLabelsRef.current = optimisticLabels;
      setActiveCharacterSheetPresetIdState(nextActivePresetId);
      activeCharacterSheetPresetIdRef.current = nextActivePresetId;
      setCharacterSheetPresetAssignments(nextActiveAssignments);

      const requestId = characterSheetPresetTabOrderRequestRef.current + 1;
      characterSheetPresetTabOrderRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await deleteCharacterManagerCharacterSheetPreset({
          characterId,
          presetId,
          nextTabOrder: optimisticVisiblePresetIds,
          nextActivePresetId,
        });
        if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
          return true;
        }
        setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
        activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
        setCharacterSheetPresets(persistedState.presets);
        characterSheetPresetsRef.current = persistedState.presets;
        setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
        visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
        setCharacterSheetPresetLabels(persistedState.tabLabels);
        characterSheetPresetLabelsRef.current = persistedState.tabLabels;
        setCharacterSheetPresetAssignments(
          persistedState.presets[persistedState.activePresetId] ??
            createEmptyCharacterSheetPresetAssignments()
        );
        return true;
      } catch (nextError) {
        if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
          return false;
        }
        setCharacterSheetPresets(previousPresets);
        characterSheetPresetsRef.current = previousPresets;
        setVisibleCharacterSheetPresetIds(previousVisiblePresetIds);
        visibleCharacterSheetPresetIdsRef.current = previousVisiblePresetIds;
        setCharacterSheetPresetLabels(previousPresetLabels);
        characterSheetPresetLabelsRef.current = previousPresetLabels;
        setActiveCharacterSheetPresetIdState(previousPresetId);
        activeCharacterSheetPresetIdRef.current = previousPresetId;
        setCharacterSheetPresetAssignments(previousActiveAssignments);
        setError(toErrorMessage(nextError, "Failed to delete character sheet preset tab."));
        return false;
      } finally {
        if (characterSheetPresetTabOrderRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
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
        nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
        nextProfileImageUrl: snapshot.profileImageUrl,
        nextProfileImageTransform: snapshot.profileImageTransform,
        nextSlots: snapshot.slots,
      });
      await refreshCharacterListSilently(snapshot.characterId);
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
          await refreshCharacterListSilently(characterId);
          return true;
        }

        const nextCharacterId = await refreshCharacterList(null);
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
            nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
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
            nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
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
          nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
          nextProfileImageUrl: snapshot.profileImageUrl,
          nextProfileImageTransform: snapshot.profileImageTransform,
          nextSlots: snapshot.slots,
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
