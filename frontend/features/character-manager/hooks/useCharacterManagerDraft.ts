/**
 * Character Manager draft-state hook.
 * Binds reference intake and draft character state to persisted Supabase records.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  createEmptyCharacterSheetAssignments,
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
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
  updateCharacterManagerDescription,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSlotFileMap,
} from "../types";
import type { CharacterManagerListItem } from "../logic/characterManagerPersistence";

type UseCharacterManagerDraftResult = {
  characters: CharacterManagerListItem[];
  selectedCharacterId: string | null;
  characterName: string;
  characterDescription: string;
  characterSheetAssignments: CharacterSheetAssignments;
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
  setCharacterName: (value: string) => void;
  setCharacterDescription: (value: string) => void;
  setProfileImageFile: (file: File) => Promise<void>;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  clearProfileImage: () => Promise<void>;
  saveCharacterSheetAssignments: (assignments: CharacterSheetAssignments) => Promise<boolean>;
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

  const clearMessages = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    characterSheetAssignmentsRef.current = characterSheetAssignments;
  }, [characterSheetAssignments]);

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
      nextProfileImageUrl,
      nextProfileImageTransform,
      nextSlots,
    }: {
      nextCharacterId: string;
      nextCharacterSheetId: string;
      nextCharacterName: string;
      nextCharacterDescription: string;
      nextCharacterSheetAssignments: CharacterSheetAssignments;
      nextProfileImageUrl: string | null;
      nextProfileImageTransform: CharacterProfileImageTransform;
      nextSlots: CharacterSlotFileMap;
    }) => {
      setCharacterId(nextCharacterId);
      setCharacterSheetId(nextCharacterSheetId);
      suppressNextNamePersistRef.current = true;
      suppressNextDescriptionPersistRef.current = true;
      setCharacterNameState(nextCharacterName);
      setCharacterDescriptionState(nextCharacterDescription);
      setCharacterSheetAssignments(nextCharacterSheetAssignments);
      characterSheetAssignmentsRef.current = nextCharacterSheetAssignments;
      characterSheetAssignmentsRequestRef.current = 0;
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
        const snapshot = await loadOrCreateCharacterManagerDraft();
        if (!active) return;
        applySnapshot({
          nextCharacterId: snapshot.characterId,
          nextCharacterSheetId: snapshot.characterSheetId,
          nextCharacterName: snapshot.characterName,
          nextCharacterDescription: snapshot.characterDescription,
          nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
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
    setCharacterName,
    setCharacterDescription,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    saveCharacterSheetAssignments,
    setSlotFile,
    clearSlot,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
  };
};
