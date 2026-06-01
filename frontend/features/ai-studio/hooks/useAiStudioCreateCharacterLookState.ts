/**
 * AI Studio create-character look state hook.
 * Caches look options and keeps create-mode look selection/labels out of the page orchestrator.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CharacterManagerDraftSnapshot } from "../../character-manager/logic/characterManagerPersistence";
import {
  buildCharacterModeLookOptions,
  type CharacterModeLookOption,
} from "../logic/characterModeLookSelection";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

type UseAiStudioCreateCharacterLookStateParams = {
  createSelectedCharacterId: string;
  setCreateSelectedCharacterId: (value: string) => void;
  createSelectedCharacterLookId: string;
  setCreateSelectedCharacterLookId: Dispatch<SetStateAction<string>>;
  createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
  loadCharacterSnapshot: (
    characterId: string,
    options?: { forceRefresh?: boolean }
  ) => Promise<CharacterManagerDraftSnapshot>;
};

/**
 * Returns create-character look selection state, label resolution, and option loading handlers.
 */
export const useAiStudioCreateCharacterLookState = ({
  createSelectedCharacterId,
  setCreateSelectedCharacterId,
  createSelectedCharacterLookId,
  setCreateSelectedCharacterLookId,
  createCharacterModeInjectionBundle,
  loadCharacterSnapshot,
}: UseAiStudioCreateCharacterLookStateParams) => {
  const [createCharacterLookOptionsByCharacterId, setCreateCharacterLookOptionsByCharacterId] =
    useState<Record<string, CharacterModeLookOption[]>>({});
  const lookSelectionModeRef = useRef<"explicit" | "default-following">(
    createSelectedCharacterLookId.trim() ? "explicit" : "default-following"
  );
  const previousSelectionRef = useRef({
    characterId: createSelectedCharacterId.trim(),
    lookId: createSelectedCharacterLookId.trim(),
  });
  const pendingSelectionRef = useRef<{
    characterId: string;
    lookId: string;
    mode: "explicit" | "default-following";
  } | null>(null);
  const lastBundleOptionRefreshKeyRef = useRef("");

  const resolveFallbackLookId = useCallback((options: CharacterModeLookOption[]): string => {
    return options.find((option) => option.isDefault)?.id ?? options[0]?.id ?? "";
  }, []);

  const syncCharacterLookOptionsCache = useCallback(
    (characterId: string, nextOptions: CharacterModeLookOption[]) => {
      setCreateCharacterLookOptionsByCharacterId((current) => {
        const existingOptions = current[characterId] ?? null;
        const isUnchanged =
          existingOptions != null &&
          existingOptions.length === nextOptions.length &&
          existingOptions.every(
            (option, index) =>
              option.id === nextOptions[index]?.id &&
              option.label === nextOptions[index]?.label &&
              option.isDefault === nextOptions[index]?.isDefault
          );
        if (isUnchanged) return current;
        return {
          ...current,
          [characterId]: nextOptions,
        };
      });
    },
    []
  );

  const fetchCharacterLookOptions = useCallback(
    async (characterId: string, options?: { forceRefresh?: boolean }) => {
      const normalizedCharacterId = characterId.trim();
      if (!normalizedCharacterId) return [];
      const snapshot = await loadCharacterSnapshot(normalizedCharacterId, options);
      return buildCharacterModeLookOptions(snapshot);
    },
    [loadCharacterSnapshot]
  );

  const loadCreateCharacterLookOptions = useCallback(
    async (characterId: string, options?: { forceRefresh?: boolean }) => {
      const normalizedCharacterId = characterId.trim();
      if (!normalizedCharacterId) return [];
      const nextOptions = await fetchCharacterLookOptions(normalizedCharacterId, options);
      syncCharacterLookOptionsCache(normalizedCharacterId, nextOptions);
      return nextOptions;
    },
    [fetchCharacterLookOptions, syncCharacterLookOptionsCache]
  );

  const scheduleLookSelection = useCallback(
    (
      characterId: string,
      lookId: string,
      mode: "explicit" | "default-following",
      update: string | ((current: string) => string)
    ) => {
      pendingSelectionRef.current = {
        characterId: characterId.trim(),
        lookId: lookId.trim(),
        mode,
      };
      if (typeof update === "function") {
        setCreateSelectedCharacterLookId((current) => update(current));
        return;
      }
      setCreateSelectedCharacterLookId(update);
    },
    [setCreateSelectedCharacterLookId]
  );

  const handleCreateCharacterSelection = useCallback(
    (characterId: string, lookId: string) => {
      lookSelectionModeRef.current = lookId.trim() ? "explicit" : "default-following";
      setCreateSelectedCharacterId(characterId);
      scheduleLookSelection(
        characterId,
        lookId,
        lookId.trim() ? "explicit" : "default-following",
        lookId
      );
    },
    [scheduleLookSelection, setCreateSelectedCharacterId]
  );

  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    const previousSelection = previousSelectionRef.current;
    if (
      previousSelection.characterId === normalizedCharacterId &&
      previousSelection.lookId === normalizedLookId
    ) {
      return;
    }
    const pendingSelection = pendingSelectionRef.current;
    if (
      pendingSelection &&
      pendingSelection.characterId === normalizedCharacterId &&
      pendingSelection.lookId === normalizedLookId
    ) {
      lookSelectionModeRef.current = pendingSelection.mode;
      pendingSelectionRef.current = null;
    } else {
      lookSelectionModeRef.current = normalizedLookId ? "explicit" : "default-following";
      pendingSelectionRef.current = null;
    }
    previousSelectionRef.current = {
      characterId: normalizedCharacterId,
      lookId: normalizedLookId,
    };
  }, [createSelectedCharacterId, createSelectedCharacterLookId]);

  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    if (!normalizedCharacterId) {
      if (normalizedLookId) {
        lookSelectionModeRef.current = "default-following";
        scheduleLookSelection("", "", "default-following", "");
      }
      return;
    }

    const cachedOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? null;
    if (cachedOptions) {
      if (normalizedLookId) return;
      const fallbackLookId = resolveFallbackLookId(cachedOptions);
      if (fallbackLookId) {
        lookSelectionModeRef.current = "default-following";
        scheduleLookSelection(
          normalizedCharacterId,
          fallbackLookId,
          "default-following",
          fallbackLookId
        );
      }
      return;
    }

    let cancelled = false;
    globalThis.queueMicrotask(() => {
      if (cancelled) return;
      void loadCreateCharacterLookOptions(normalizedCharacterId)
        .then((options) => {
          if (cancelled || normalizedLookId) return;
          const fallbackLookId = resolveFallbackLookId(options);
          if (!fallbackLookId) return;
          lookSelectionModeRef.current = "default-following";
          scheduleLookSelection(
            normalizedCharacterId,
            fallbackLookId,
            "default-following",
            (current) => (current.trim() ? current : fallbackLookId)
          );
        })
        .catch(() => {
          // Best-effort cache warm-up so selected look labels survive reload/restore.
        });
    });
    return () => {
      cancelled = true;
    };
  }, [
    createCharacterLookOptionsByCharacterId,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    loadCreateCharacterLookOptions,
    resolveFallbackLookId,
    scheduleLookSelection,
  ]);

  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    if (!normalizedCharacterId || !normalizedLookId) return;
    const lookOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? [];
    if (lookOptions.length === 0) return;
    if (lookOptions.some((option) => option.id === normalizedLookId)) return;
    const fallbackLookId = resolveFallbackLookId(lookOptions);
    if (!fallbackLookId) return;
    lookSelectionModeRef.current = "default-following";
    scheduleLookSelection(
      normalizedCharacterId,
      fallbackLookId,
      "default-following",
      fallbackLookId
    );
  }, [
    createCharacterLookOptionsByCharacterId,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    resolveFallbackLookId,
    scheduleLookSelection,
  ]);

  useEffect(() => {
    if (lookSelectionModeRef.current !== "default-following") return;
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    const bundleCharacterId = createCharacterModeInjectionBundle?.characterId?.trim() ?? "";
    const bundleLookId = createCharacterModeInjectionBundle?.characterLookId?.trim() ?? "";
    if (!normalizedCharacterId || bundleCharacterId !== normalizedCharacterId || !bundleLookId) {
      return;
    }
    if (bundleLookId === normalizedLookId) return;
    scheduleLookSelection(normalizedCharacterId, bundleLookId, "default-following", bundleLookId);
  }, [
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    scheduleLookSelection,
  ]);

  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedBundleCharacterId =
      createCharacterModeInjectionBundle?.characterId?.trim() ?? "";
    if (!normalizedCharacterId || normalizedBundleCharacterId !== normalizedCharacterId) {
      return;
    }
    const cachedOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? null;
    if (!cachedOptions) {
      return;
    }
    const bundleRefreshKey = `${normalizedBundleCharacterId}:${createCharacterModeInjectionBundle?.loadedAtMs ?? 0}`;
    if (lastBundleOptionRefreshKeyRef.current === bundleRefreshKey) {
      return;
    }
    lastBundleOptionRefreshKeyRef.current = bundleRefreshKey;
    let cancelled = false;
    void fetchCharacterLookOptions(normalizedCharacterId, { forceRefresh: true })
      .then((options) => {
        if (cancelled) return;
        syncCharacterLookOptionsCache(normalizedCharacterId, options);
        const fallbackLookId = resolveFallbackLookId(options);
        scheduleLookSelection(
          normalizedCharacterId,
          fallbackLookId,
          "default-following",
          (current) => {
            const normalizedCurrentLookId = current.trim();
            if (!normalizedCurrentLookId) return current;
            if (options.some((option) => option.id === normalizedCurrentLookId)) {
              return current;
            }
            return fallbackLookId;
          }
        );
      })
      .catch(() => {
        // Best-effort refresh keeps look options aligned with refreshed character bundles.
      });
    return () => {
      cancelled = true;
    };
  }, [
    createCharacterLookOptionsByCharacterId,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    fetchCharacterLookOptions,
    resolveFallbackLookId,
    scheduleLookSelection,
    syncCharacterLookOptionsCache,
  ]);

  const selectedCreateCharacterLookLabel = (() => {
    if (createCharacterModeInjectionBundle?.characterId === createSelectedCharacterId) {
      const bundleLookName = createCharacterModeInjectionBundle.characterLookName?.trim() ?? "";
      if (bundleLookName) return bundleLookName;
    }
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    if (!normalizedCharacterId || !normalizedLookId) return null;
    const lookOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? [];
    return lookOptions.find((option) => option.id === normalizedLookId)?.label ?? null;
  })();

  return {
    handleCreateCharacterSelection,
    loadCreateCharacterLookOptions,
    selectedCreateCharacterLookLabel,
  };
};
