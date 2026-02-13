/**
 * Character Manager draft-state hook.
 * Binds the 10-slot intake UI to persisted Supabase draft records.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHARACTER_MANAGER_MAX_IMAGE_BYTES,
  CHARACTER_MANAGER_SLOT_KEYS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
  createEmptyCharacterSlotMap,
} from "../constants";
import {
  activateCharacterManagerPack,
  clearCharacterManagerSlot,
  createCharacterManagerDraft,
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
  loadOrCreateCharacterManagerDraft,
  revalidateCharacterManagerPack,
  saveCharacterManagerSlot,
  updateCharacterManagerName,
} from "../logic/characterManagerPersistence";
import { validateCharacterReferenceFile } from "../logic/referenceValidation";
import type { CharacterReferenceSlotKey, CharacterSlotFileMap } from "../types";
import type { CharacterManagerListItem } from "../logic/characterManagerPersistence";

type UseCharacterManagerDraftResult = {
  characters: CharacterManagerListItem[];
  selectedCharacterId: string | null;
  characterName: string;
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
  isSwitchingCharacter: boolean;
  isRevalidating: boolean;
  missingSlotKeys: CharacterReferenceSlotKey[];
  failedSlotKeys: CharacterReferenceSlotKey[];
  setCharacterName: (value: string) => void;
  setSlotFile: (slotKey: CharacterReferenceSlotKey, file: File) => Promise<void>;
  clearSlot: (slotKey: CharacterReferenceSlotKey) => Promise<void>;
  activateDraft: () => Promise<void>;
  revalidateCurrentPack: () => Promise<void>;
  createCharacter: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<void>;
  isSlotBusy: (slotKey: CharacterReferenceSlotKey) => boolean;
  clearMessages: () => void;
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

/**
 * Manages persisted character draft state, slot uploads, and activation flow.
 */
export const useCharacterManagerDraft = (): UseCharacterManagerDraftResult => {
  const [characters, setCharacters] = useState<CharacterManagerListItem[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [referencePackId, setReferencePackId] = useState<string | null>(null);
  const [characterName, setCharacterNameState] = useState("New Character");
  const [slots, setSlots] = useState<CharacterSlotFileMap>(() => createEmptyCharacterSlotMap());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [slotBusyKeys, setSlotBusyKeys] = useState<Set<CharacterReferenceSlotKey>>(() => new Set());

  const suppressNextNamePersistRef = useRef(false);
  const namePersistTimerRef = useRef<number | null>(null);
  const lastPersistedNameRef = useRef("New Character");
  const namePersistRequestRef = useRef(0);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

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
      nextSlots,
    }: {
      nextCharacterId: string;
      nextReferencePackId: string;
      nextCharacterName: string;
      nextSlots: CharacterSlotFileMap;
    }) => {
      setCharacterId(nextCharacterId);
      setReferencePackId(nextReferencePackId);
      suppressNextNamePersistRef.current = true;
      setCharacterNameState(nextCharacterName);
      setSlots(nextSlots);
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
      if (file.size > CHARACTER_MANAGER_MAX_IMAGE_BYTES) {
        setError("This image is too large. Use files under 20 MB.");
        return;
      }

      markSlotBusy(slotKey, true);
      try {
        const validation = await validateCharacterReferenceFile({
          slotKey,
          file,
          existingSlots: slots,
        });
        const persistedSlot = await saveCharacterManagerSlot({
          characterId,
          referencePackId,
          slotKey,
          file,
          validationStatus: validation.status,
          validationNotes: validation.notes,
        });
        setSlots((prev) => ({
          ...prev,
          [slotKey]: persistedSlot,
        }));
        await refreshCharacterListSilently(characterId);
        if (validation.status === "fail") {
          const reason = validation.notes.hardErrors[0] ?? "Fix this shot before activation.";
          setError(`${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]} needs attention: ${reason}`);
        } else if (validation.status === "warn") {
          const warning = validation.notes.warnings[0] ?? "Quality warning detected.";
          setNotice(
            `Updated ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]} (warning: ${warning})`
          );
        } else {
          setNotice(`Updated ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]}.`);
        }
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save this shot."));
      } finally {
        markSlotBusy(slotKey, false);
      }
    },
    [characterId, clearMessages, markSlotBusy, referencePackId, refreshCharacterListSilently, slots]
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
        setSlots((prev) => ({
          ...prev,
          [slotKey]: null,
        }));
        await refreshCharacterListSilently(characterId);
        setNotice(`Removed ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]}.`);
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
      isSwitchingCharacter ||
      isRevalidating ||
      isActivating ||
      slotBusyKeys.has(slotKey),
    [isActivating, isCreatingCharacter, isRevalidating, isSwitchingCharacter, loading, slotBusyKeys]
  );

  return {
    characters,
    selectedCharacterId: characterId,
    characterName,
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
    isSwitchingCharacter,
    isRevalidating,
    missingSlotKeys,
    failedSlotKeys,
    setCharacterName,
    setSlotFile,
    clearSlot,
    activateDraft,
    revalidateCurrentPack,
    createCharacter,
    selectCharacter,
    isSlotBusy,
    clearMessages,
  };
};
