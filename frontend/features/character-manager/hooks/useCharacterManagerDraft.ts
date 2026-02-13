/**
 * Character Manager draft-state hook.
 * Binds the 10-slot intake UI to persisted Supabase draft records.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHARACTER_MANAGER_SLOT_KEYS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
  createEmptyCharacterSlotMap,
} from "../constants";
import {
  activateCharacterManagerPack,
  clearCharacterManagerProfileImage,
  clearCharacterManagerSlot,
  createCharacterManagerDraft,
  deleteCharacterManagerDraft,
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
  loadOrCreateCharacterManagerDraft,
  revalidateCharacterManagerPack,
  saveCharacterManagerProfileImageAdjustments,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
import { createDefaultCharacterValidationNotes } from "../logic/referenceValidation";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSlotFileMap,
} from "../types";
import type { CharacterManagerListItem } from "../logic/characterManagerPersistence";

type UseCharacterManagerDraftResult = {
  characters: CharacterManagerListItem[];
  selectedCharacterId: string | null;
  characterName: string;
  profileImageUrl: string | null;
  profileImageTransform: CharacterProfileImageTransform;
  slots: CharacterSlotFileMap;
  error: string | null;
  notice: string | null;
  completedCount: number;
  totalCount: number;
  canActivate: boolean;
  loading: boolean;
  isSavingName: boolean;
  isActivating: boolean;
  isCreatingCharacter: boolean;
  isDeletingCharacter: boolean;
  isSwitchingCharacter: boolean;
  isRevalidating: boolean;
  isSavingProfileImage: boolean;
  missingSlotKeys: CharacterReferenceSlotKey[];
  failedSlotKeys: CharacterReferenceSlotKey[];
  setCharacterName: (value: string) => void;
  setProfileImageFile: (file: File) => Promise<void>;
  saveProfileImageTransform: (transform: CharacterProfileImageTransform) => Promise<boolean>;
  clearProfileImage: () => Promise<void>;
  setSlotFile: (slotKey: CharacterReferenceSlotKey, file: File) => Promise<void>;
  clearSlot: (slotKey: CharacterReferenceSlotKey) => Promise<void>;
  activateDraft: () => Promise<void>;
  revalidateCurrentPack: () => Promise<void>;
  createCharacter: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<boolean>;
  isSlotBusy: (slotKey: CharacterReferenceSlotKey) => boolean;
  clearMessages: () => void;
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;
const NOTICE_AUTO_DISMISS_MS = 3500;
const DEFAULT_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

/**
 * Manages persisted character draft state, slot uploads, and activation flow.
 */
export const useCharacterManagerDraft = (): UseCharacterManagerDraftResult => {
  const [characters, setCharacters] = useState<CharacterManagerListItem[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [referencePackId, setReferencePackId] = useState<string | null>(null);
  const [characterName, setCharacterNameState] = useState("New Character");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileImageTransform, setProfileImageTransform] =
    useState<CharacterProfileImageTransform>(DEFAULT_PROFILE_IMAGE_TRANSFORM);
  const [slots, setSlots] = useState<CharacterSlotFileMap>(() => createEmptyCharacterSlotMap());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isDeletingCharacter, setIsDeletingCharacter] = useState(false);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isSavingProfileImage, setIsSavingProfileImage] = useState(false);
  const [slotBusyKeys, setSlotBusyKeys] = useState<Set<CharacterReferenceSlotKey>>(() => new Set());

  const suppressNextNamePersistRef = useRef(false);
  const namePersistTimerRef = useRef<number | null>(null);
  const lastPersistedNameRef = useRef("New Character");
  const namePersistRequestRef = useRef(0);
  const slotsRef = useRef<CharacterSlotFileMap>(createEmptyCharacterSlotMap());

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const activeNotice = notice;
    const timer = window.setTimeout(() => {
      setNotice((current) => (current === activeNotice ? null : current));
    }, NOTICE_AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

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
      nextReferencePackId,
      nextCharacterName,
      nextProfileImageUrl,
      nextProfileImageTransform,
      nextSlots,
    }: {
      nextCharacterId: string;
      nextReferencePackId: string;
      nextCharacterName: string;
      nextProfileImageUrl: string | null;
      nextProfileImageTransform: CharacterProfileImageTransform;
      nextSlots: CharacterSlotFileMap;
    }) => {
      setCharacterId(nextCharacterId);
      setReferencePackId(nextReferencePackId);
      suppressNextNamePersistRef.current = true;
      setCharacterNameState(nextCharacterName);
      setProfileImageUrl(nextProfileImageUrl);
      setProfileImageTransform(nextProfileImageTransform);
      setSlots(nextSlots);
      slotsRef.current = nextSlots;
      lastPersistedNameRef.current = nextCharacterName.trim();
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
          nextReferencePackId: snapshot.referencePackId,
          nextCharacterName: snapshot.characterName,
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

  useEffect(
    () => () => {
      if (namePersistTimerRef.current) {
        window.clearTimeout(namePersistTimerRef.current);
      }
    },
    []
  );

  const setCharacterName = useCallback((value: string) => {
    setCharacterNameState(value.slice(0, 80));
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

      setIsSavingProfileImage(true);
      try {
        const signedUrl = await saveCharacterManagerProfileImage({
          characterId,
          file,
        });
        setProfileImageUrl(signedUrl);
        setProfileImageTransform(DEFAULT_PROFILE_IMAGE_TRANSFORM);
        await refreshCharacterListSilently(characterId);
        setNotice("Updated character profile image.");
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
        setNotice("Saved profile image adjustments.");
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
      setNotice("Removed character profile image.");
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to remove profile image."));
    } finally {
      setIsSavingProfileImage(false);
    }
  }, [characterId, clearMessages, refreshCharacterListSilently]);

  const setSlotFile = useCallback(
    async (slotKey: CharacterReferenceSlotKey, file: File) => {
      clearMessages();
      if (!characterId || !referencePackId) {
        setError("Character draft is still loading. Try again in a moment.");
        return;
      }
      if (!file.type.toLowerCase().startsWith("image/")) {
        setError("Only image files are supported in Character Manager.");
        return;
      }

      markSlotBusy(slotKey, true);
      try {
        const validationNotes = createDefaultCharacterValidationNotes();
        validationNotes.mimeType = file.type || null;
        validationNotes.evaluatedAt = new Date().toISOString();
        const persistedSlot = await saveCharacterManagerSlot({
          characterId,
          referencePackId,
          slotKey,
          file,
          validationStatus: "pass",
          validationNotes,
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
        setNotice(`Updated ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]}.`);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save this shot."));
      } finally {
        markSlotBusy(slotKey, false);
      }
    },
    [characterId, clearMessages, markSlotBusy, referencePackId, refreshCharacterListSilently]
  );

  const clearSlot = useCallback(
    async (slotKey: CharacterReferenceSlotKey) => {
      clearMessages();
      if (!referencePackId) {
        setError("Character draft is still loading. Try again in a moment.");
        return;
      }

      markSlotBusy(slotKey, true);
      try {
        await clearCharacterManagerSlot({
          referencePackId,
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
    [characterId, clearMessages, markSlotBusy, referencePackId, refreshCharacterListSilently]
  );

  const createCharacter = useCallback(async () => {
    clearMessages();
    setIsCreatingCharacter(true);
    try {
      const snapshot = await createCharacterManagerDraft("New Character");
      applySnapshot({
        nextCharacterId: snapshot.characterId,
        nextReferencePackId: snapshot.referencePackId,
        nextCharacterName: snapshot.characterName,
        nextProfileImageUrl: snapshot.profileImageUrl,
        nextProfileImageTransform: snapshot.profileImageTransform,
        nextSlots: snapshot.slots,
      });
      await refreshCharacterListSilently(snapshot.characterId);
      setNotice("New character draft created.");
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
          setNotice("Character deleted.");
          return true;
        }

        const nextCharacterId = await refreshCharacterList(null);
        if (nextCharacterId) {
          const snapshot = await loadCharacterManagerDraftByCharacterId(nextCharacterId);
          applySnapshot({
            nextCharacterId: snapshot.characterId,
            nextReferencePackId: snapshot.referencePackId,
            nextCharacterName: snapshot.characterName,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
          });
          await refreshCharacterListSilently(snapshot.characterId);
        } else {
          const snapshot = await createCharacterManagerDraft();
          applySnapshot({
            nextCharacterId: snapshot.characterId,
            nextReferencePackId: snapshot.referencePackId,
            nextCharacterName: snapshot.characterName,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
          });
          await refreshCharacterListSilently(snapshot.characterId);
        }

        setNotice("Character deleted.");
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

  const revalidateCurrentPack = useCallback(async () => {
    clearMessages();
    if (!characterId || !referencePackId) {
      setError("Character draft is still loading. Try again in a moment.");
      return;
    }

    setIsRevalidating(true);
    try {
      const summary = await revalidateCharacterManagerPack({
        referencePackId,
      });
      const snapshot = await loadCharacterManagerDraftByCharacterId(characterId);
      applySnapshot({
        nextCharacterId: snapshot.characterId,
        nextReferencePackId: snapshot.referencePackId,
        nextCharacterName: snapshot.characterName,
        nextProfileImageUrl: snapshot.profileImageUrl,
        nextProfileImageTransform: snapshot.profileImageTransform,
        nextSlots: snapshot.slots,
      });
      await refreshCharacterListSilently(snapshot.characterId);
      if (summary.failCount > 0) {
        setError(
          `Revalidation complete: ${summary.failCount} shot(s) require fixes (${summary.failedLabels.join(", ")}).`
        );
      } else if (summary.warnCount > 0) {
        setNotice(
          `Revalidation complete: ${summary.passCount} pass, ${summary.warnCount} warning shot(s).`
        );
      } else {
        setNotice("Revalidation complete: all shots pass deterministic checks.");
      }
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to revalidate this reference pack."));
    } finally {
      setIsRevalidating(false);
    }
  }, [applySnapshot, characterId, clearMessages, referencePackId, refreshCharacterListSilently]);

  const selectCharacter = useCallback(
    async (nextCharacterId: string) => {
      if (!nextCharacterId || nextCharacterId === characterId) return;
      clearMessages();
      setIsSwitchingCharacter(true);
      try {
        const snapshot = await loadCharacterManagerDraftByCharacterId(nextCharacterId);
        applySnapshot({
          nextCharacterId: snapshot.characterId,
          nextReferencePackId: snapshot.referencePackId,
          nextCharacterName: snapshot.characterName,
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

  const completedCount = useMemo(
    () => CHARACTER_MANAGER_SLOT_KEYS.filter((slotKey) => Boolean(slots[slotKey])).length,
    [slots]
  );
  const totalCount = CHARACTER_MANAGER_SLOT_KEYS.length;
  const missingSlotKeys = useMemo(
    () => CHARACTER_MANAGER_SLOT_KEYS.filter((slotKey) => !slots[slotKey]),
    [slots]
  );
  const failedSlotKeys = useMemo(
    () =>
      CHARACTER_MANAGER_SLOT_KEYS.filter((slotKey) => slots[slotKey]?.validationStatus === "fail"),
    [slots]
  );
  const canActivate =
    completedCount === totalCount && characterName.trim().length > 1 && failedSlotKeys.length === 0;

  const activateDraft = useCallback(async () => {
    clearMessages();
    const trimmedName = characterName.trim();
    if (!characterId || !referencePackId) {
      setError("Character draft is still loading. Try again in a moment.");
      return;
    }
    if (trimmedName.length < 2) {
      setError("Add a character name before activation.");
      return;
    }
    if (!canActivate) {
      if (failedSlotKeys.length > 0) {
        setError("Fix failed shots before activation.");
        return;
      }
      setError("Complete all 10 required shots before activation.");
      return;
    }

    setIsActivating(true);
    try {
      if (trimmedName !== lastPersistedNameRef.current) {
        await updateCharacterManagerName({
          characterId,
          name: trimmedName,
        });
        lastPersistedNameRef.current = trimmedName;
      }
      await activateCharacterManagerPack({
        characterId,
        referencePackId,
        characterName: trimmedName,
      });
      await refreshCharacterListSilently(characterId);
      setNotice("Reference pack activated. You can now generate directly in Character Manager.");
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to activate character reference pack."));
    } finally {
      setIsActivating(false);
    }
  }, [
    canActivate,
    characterId,
    characterName,
    clearMessages,
    failedSlotKeys.length,
    referencePackId,
    refreshCharacterListSilently,
  ]);

  const isSlotBusy = useCallback(
    (slotKey: CharacterReferenceSlotKey) =>
      loading ||
      isCreatingCharacter ||
      isDeletingCharacter ||
      isSwitchingCharacter ||
      isRevalidating ||
      isActivating ||
      slotBusyKeys.has(slotKey),
    [
      isActivating,
      isCreatingCharacter,
      isDeletingCharacter,
      isRevalidating,
      isSwitchingCharacter,
      loading,
      slotBusyKeys,
    ]
  );

  return {
    characters,
    selectedCharacterId: characterId,
    characterName,
    profileImageUrl,
    profileImageTransform,
    slots,
    error,
    notice,
    completedCount,
    totalCount,
    canActivate,
    loading,
    isSavingName,
    isActivating,
    isCreatingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isRevalidating,
    isSavingProfileImage,
    missingSlotKeys,
    failedSlotKeys,
    setCharacterName,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    setSlotFile,
    clearSlot,
    activateDraft,
    revalidateCurrentPack,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
  };
};
