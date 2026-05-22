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
import { readSupabaseUserId } from "../../../lib/supabaseClient";
import type { ToolId } from "../types";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
  type CharacterManagerDraftSnapshot,
} from "../../character-manager/logic/characterManagerPersistence";
import { subscribeCharacterListChanged } from "../../character-manager/logic/characterListSyncEvents";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
  subscribeToSelectedCharacterId,
} from "../../character-manager/logic/selectedCharacterPersistence";
import { buildCharacterModeInjectionBundleFromSnapshot } from "../logic/characterModeLookSelection";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

export type CharacterSelectOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

const CHARACTER_OPTIONS_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

const isCharacterSelectionTool = (selectedTool: ToolId | null): boolean =>
  selectedTool === "create" ||
  selectedTool === "text" ||
  selectedTool === "edit" ||
  selectedTool === "image";

type UseAiStudioCharacterModeLifecycleParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  selectedTool: ToolId | null;
  selectedCharacterLookId?: string | null;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setCharacterModeInjectionBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>>;
  setIsCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
};

/**
 * Returns Character Mode list selection state and keeps bundle side effects in sync.
 */
export const useAiStudioCharacterModeLifecycle = ({
  projectId = null,
  projectRouteRequested = false,
  selectedTool,
  selectedCharacterLookId = null,
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
  const inFlightRefreshPromiseRef = useRef<Promise<CharacterSelectOption[]> | null>(null);
  const characterSnapshotCacheRef = useRef<Map<string, CharacterManagerDraftSnapshot>>(new Map());
  const inFlightCharacterSnapshotLoadsRef = useRef<
    Map<string, Promise<CharacterManagerDraftSnapshot>>
  >(new Map());
  const pendingRefreshRequestedRef = useRef(false);
  const refreshRequestIdRef = useRef(0);
  const previousSelectedToolRef = useRef<ToolId | null>(selectedTool);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyCharacterOptions = useCallback(
    (items: Awaited<ReturnType<typeof listCharacterManagerCharacters>>) => {
      if (!isMountedRef.current) return;
      const mappedOptions = items.map((item) => ({
        id: item.characterId,
        name: item.characterName,
        profileImageUrl: item.profileImageUrl,
      }));
      const validCharacterIds = new Set(mappedOptions.map((option) => option.id));
      characterSnapshotCacheRef.current.forEach((_snapshot, characterId) => {
        if (!validCharacterIds.has(characterId)) {
          characterSnapshotCacheRef.current.delete(characterId);
          inFlightCharacterSnapshotLoadsRef.current.delete(characterId);
        }
      });
      setCharacterOptions(mappedOptions);
      setSelectedCharacterId((current) =>
        mappedOptions.some((option) => option.id === current) ? current : ""
      );
    },
    []
  );
  const loadCharacterSnapshot = useCallback(
    async (
      characterId: string,
      { forceRefresh = false }: { forceRefresh?: boolean } = {}
    ): Promise<CharacterManagerDraftSnapshot> => {
      const normalizedCharacterId = characterId.trim();
      if (!normalizedCharacterId) {
        throw new Error("Character id is required.");
      }
      if (!forceRefresh) {
        const cachedSnapshot = characterSnapshotCacheRef.current.get(normalizedCharacterId);
        if (cachedSnapshot) return cachedSnapshot;
        const inFlightSnapshot =
          inFlightCharacterSnapshotLoadsRef.current.get(normalizedCharacterId);
        if (inFlightSnapshot) {
          return inFlightSnapshot;
        }
      }

      const loadPromise = loadCharacterManagerDraftByCharacterId(normalizedCharacterId)
        .then((snapshot) => {
          characterSnapshotCacheRef.current.set(normalizedCharacterId, snapshot);
          return snapshot;
        })
        .finally(() => {
          if (
            inFlightCharacterSnapshotLoadsRef.current.get(normalizedCharacterId) === loadPromise
          ) {
            inFlightCharacterSnapshotLoadsRef.current.delete(normalizedCharacterId);
          }
        });

      inFlightCharacterSnapshotLoadsRef.current.set(normalizedCharacterId, loadPromise);
      return loadPromise;
    },
    []
  );
  const runCharacterOptionsRefresh = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    const items = await listCharacterManagerCharacters();
    if (requestId === refreshRequestIdRef.current) {
      applyCharacterOptions(items);
    }
    return items.map((item) => ({
      id: item.characterId,
      name: item.characterName,
      profileImageUrl: item.profileImageUrl,
    })) as CharacterSelectOption[];
  }, [applyCharacterOptions]);
  const refreshCharacterOptions = useCallback(async () => {
    const startRefresh = (): Promise<CharacterSelectOption[]> => {
      const nextPromise = runCharacterOptionsRefresh().finally(() => {
        inFlightRefreshPromiseRef.current = null;
        if (pendingRefreshRequestedRef.current) {
          pendingRefreshRequestedRef.current = false;
          void startRefresh().catch(() => {
            // Best-effort catch-up refresh to collapse bursts while avoiding unhandled rejections.
          });
        }
      });
      inFlightRefreshPromiseRef.current = nextPromise;
      return nextPromise;
    };

    if (inFlightRefreshPromiseRef.current) {
      pendingRefreshRequestedRef.current = true;
      return inFlightRefreshPromiseRef.current;
    }
    return startRefresh();
  }, [runCharacterOptionsRefresh]);
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
    void readSupabaseUserId().then((userId) => {
      if (!active) return;
      const resolvedScope = userId?.trim() ?? null;
      setSelectedCharacterStorageScope(resolvedScope);
      if (projectRouteRequested || projectId || !resolvedScope) return;
      const persistedId = readPersistedSelectedCharacterId({ userId: resolvedScope });
      if (!persistedId) return;
      setSelectedCharacterId((current) => (current.trim().length > 0 ? current : persistedId));
    });
    return () => {
      active = false;
    };
  }, [projectId, projectRouteRequested]);

  useEffect(() => {
    let active = true;
    void refreshCharacterOptions()
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to load AI Studio character profiles.";
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
    if (!isCharacterSelectionTool(selectedTool)) {
      return () => {};
    }
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
  }, [refreshCharacterOptions, selectedTool]);

  useEffect(() => {
    if (selectedCharacterStorageScope === undefined) {
      return () => {};
    }
    const unsubscribe = subscribeCharacterListChanged(
      () => {
        void refreshCharacterOptions().catch(() => {
          // Cross-surface sync is best-effort and should not block local interactions.
        });
      },
      {
        userId: selectedCharacterStorageScope,
      }
    );
    return unsubscribe;
  }, [refreshCharacterOptions, selectedCharacterStorageScope]);

  useEffect(() => {
    const previousTool = previousSelectedToolRef.current;
    previousSelectedToolRef.current = selectedTool;
    if (!isCharacterSelectionTool(selectedTool) || previousTool === selectedTool) {
      return;
    }
    void refreshCharacterOptions().catch(() => {
      // Tool-activation refresh is best-effort and should never block panel render.
    });
  }, [refreshCharacterOptions, selectedTool]);

  useEffect(() => {
    if (projectRouteRequested || projectId) return;
    if (selectedCharacterStorageScope === undefined) return;
    persistSelectedCharacterId(selectedCharacterId || null, {
      userId: selectedCharacterStorageScope,
    });
  }, [projectId, projectRouteRequested, selectedCharacterId, selectedCharacterStorageScope]);

  useEffect(() => {
    if (projectRouteRequested || projectId) {
      return () => {};
    }
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
  }, [projectId, projectRouteRequested, selectedCharacterStorageScope]);

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
    void loadCharacterSnapshot(selectedCharacterId)
      .then((snapshot) => {
        if (!active) return;
        setCharacterModeInjectionBundle(
          buildCharacterModeInjectionBundleFromSnapshot(snapshot, selectedCharacterLookId)
        );
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
  }, [
    loadCharacterSnapshot,
    selectedCharacterId,
    selectedCharacterLookId,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
  ]);

  return {
    characterOptions,
    characterOptionsById,
    resolveCharacterOptionById,
    refreshCharacterOptions,
    loadCharacterSnapshot,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
  };
};
