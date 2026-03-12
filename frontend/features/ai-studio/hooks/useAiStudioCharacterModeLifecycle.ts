/**
 * Character Mode lifecycle hook for AI Studio page orchestration.
 * Owns character list loading and selected-character bundle loading.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
} from "../../character-manager/logic/characterManagerPersistence";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
  subscribeToSelectedCharacterId,
} from "../../character-manager/logic/selectedCharacterPersistence";
import {
  resolveCharacterSheetPresetReferenceStoragePaths,
  resolveCharacterSheetPresetReferenceUrls,
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "../logic/characterModePayload";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

export type CharacterSelectOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

const CHARACTER_OPTIONS_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

type UseAiStudioCharacterModeLifecycleParams = {
  setUiError: Dispatch<SetStateAction<string | null>>;
  setCharacterModeInjectionBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>>;
  setIsCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
};

/**
 * Returns Character Mode list selection state and keeps bundle side effects in sync.
 */
export const useAiStudioCharacterModeLifecycle = ({
  setUiError,
  setCharacterModeInjectionBundle,
  setIsCharacterBundleLoading,
}: UseAiStudioCharacterModeLifecycleParams) => {
  const [characterOptions, setCharacterOptions] = useState<CharacterSelectOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedCharacterStorageScope, setSelectedCharacterStorageScope] = useState<
    string | null | undefined
  >(undefined);
  const [isCharacterOptionsLoading, setIsCharacterOptionsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const applyCharacterOptions = useCallback(
    (items: Awaited<ReturnType<typeof listCharacterManagerCharacters>>) => {
      if (!isMountedRef.current) return;
      const mappedOptions = items.map((item) => ({
        id: item.characterId,
        name: item.characterName,
        profileImageUrl: item.profileImageUrl,
      }));
      setCharacterOptions(mappedOptions);
      setSelectedCharacterId((current) =>
        mappedOptions.some((option) => option.id === current) ? current : ""
      );
    },
    []
  );
  const refreshCharacterOptions = useCallback(async () => {
    const items = await listCharacterManagerCharacters();
    applyCharacterOptions(items);
    return items.map((item) => ({
      id: item.characterId,
      name: item.characterName,
      profileImageUrl: item.profileImageUrl,
    })) as CharacterSelectOption[];
  }, [applyCharacterOptions]);
  const characterOptionsById = useMemo<ReadonlyMap<string, CharacterSelectOption>>(
    () => new Map(characterOptions.map((option) => [option.id, option])),
    [characterOptions]
  );
  const resolveCharacterOptionById = useCallback(
    (characterId: string | null | undefined): CharacterSelectOption | null => {
      const normalizedCharacterId = characterId?.trim() ?? "";
      if (!normalizedCharacterId) return null;
      return characterOptionsById.get(normalizedCharacterId) ?? null;
    },
    [characterOptionsById]
  );

  useEffect(() => {
    let active = true;
    void ensureSupabaseClient()
      .auth.getSession()
      .then(({ data, error }) => {
        if (!active || error) return;
        const resolvedScope = data.session?.user?.id?.trim() ?? null;
        setSelectedCharacterStorageScope(resolvedScope);
        if (!resolvedScope) return;
        const persistedId = readPersistedSelectedCharacterId({ userId: resolvedScope });
        if (!persistedId) return;
        setSelectedCharacterId((current) => (current.trim().length > 0 ? current : persistedId));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void refreshCharacterOptions()
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to load Character Manager profiles.";
        const normalized = message.toLowerCase();
        const isSessionTransitionError =
          normalized.includes("no active session") || normalized.includes("not authenticated");
        if (!isSessionTransitionError) {
          setUiError(message);
        }
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshCharacterOptions, setUiError]);

  useEffect(() => {
    const refreshCharacterOptionsSilently = () => {
      void refreshCharacterOptions().catch(() => {
        // Silent refresh is best-effort to keep signed avatar URLs fresh in long-running sessions.
      });
    };
    const handleWindowFocus = () => {
      refreshCharacterOptionsSilently();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshCharacterOptionsSilently();
      }
    };
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const refreshIntervalId = window.setInterval(
      refreshCharacterOptionsSilently,
      CHARACTER_OPTIONS_REFRESH_INTERVAL_MS
    );
    return () => {
      window.clearInterval(refreshIntervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshCharacterOptions]);

  useEffect(() => {
    if (selectedCharacterStorageScope === undefined) return;
    persistSelectedCharacterId(selectedCharacterId || null, {
      userId: selectedCharacterStorageScope,
    });
  }, [selectedCharacterId, selectedCharacterStorageScope]);

  useEffect(() => {
    if (selectedCharacterStorageScope === undefined) {
      return () => {};
    }
    const unsubscribe = subscribeToSelectedCharacterId(
      (nextCharacterId) => {
        setSelectedCharacterId((current) => {
          const normalized = nextCharacterId ?? "";
          return current === normalized ? current : normalized;
        });
      },
      {
        userId: selectedCharacterStorageScope,
      }
    );
    return unsubscribe;
  }, [selectedCharacterStorageScope]);

  useEffect(() => {
    let active = true;
    if (!selectedCharacterId) {
      setCharacterModeInjectionBundle(null);
      setIsCharacterBundleLoading(false);
      return () => {
        active = false;
      };
    }

    setIsCharacterBundleLoading(true);
    setCharacterModeInjectionBundle(null);
    void loadCharacterManagerDraftByCharacterId(selectedCharacterId)
      .then((snapshot) => {
        if (!active) return;
        const presetReferenceStoragePaths = resolveCharacterSheetPresetReferenceStoragePaths(
          snapshot.characterSheetPresetAssignments
        );
        const presetReferenceUrls = resolveCharacterSheetPresetReferenceUrls(
          snapshot.characterSheetPresetAssignments
        );
        const fallbackStoragePaths = resolveCharacterSheetReferenceStoragePaths(
          snapshot.characterSheetAssignments,
          snapshot.slots
        );
        const fallbackUrls = resolveCharacterSheetReferenceUrls(
          snapshot.characterSheetAssignments,
          snapshot.slots
        );
        const effectiveCharacterDescription =
          snapshot.characterDescription.trim().length > 0
            ? snapshot.characterDescription
            : snapshot.legacyCharacterDescription;
        setCharacterModeInjectionBundle({
          characterId: snapshot.characterId,
          characterDescription: effectiveCharacterDescription,
          sheetReferenceStoragePaths:
            presetReferenceStoragePaths.length > 0
              ? presetReferenceStoragePaths
              : fallbackStoragePaths,
          sheetReferenceUrls: presetReferenceUrls.length > 0 ? presetReferenceUrls : fallbackUrls,
          loadedAtMs: Date.now(),
        });
      })
      .catch(() => {
        if (!active) return;
        setCharacterModeInjectionBundle(null);
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterBundleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCharacterId, setCharacterModeInjectionBundle, setIsCharacterBundleLoading]);

  return {
    characterOptions,
    characterOptionsById,
    resolveCharacterOptionById,
    refreshCharacterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
  };
};
