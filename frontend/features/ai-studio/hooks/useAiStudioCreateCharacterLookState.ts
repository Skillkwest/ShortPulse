/**
 * AI Studio create-character look state hook.
 * Caches look options and keeps create-mode look selection/labels out of the page orchestrator.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
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
  loadCharacterSnapshot: (characterId: string) => Promise<CharacterManagerDraftSnapshot>;
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

  const resolveFallbackLookId = useCallback((options: CharacterModeLookOption[]): string => {
    return options.find((option) => option.isDefault)?.id ?? options[0]?.id ?? "";
  }, []);

  const loadCreateCharacterLookOptions = useCallback(
    async (characterId: string) => {
      const normalizedCharacterId = characterId.trim();
      if (!normalizedCharacterId) return [];
      const snapshot = await loadCharacterSnapshot(normalizedCharacterId);
      const nextOptions = buildCharacterModeLookOptions(snapshot);
      setCreateCharacterLookOptionsByCharacterId((current) => {
        const existingOptions = current[normalizedCharacterId] ?? null;
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
          [normalizedCharacterId]: nextOptions,
        };
      });
      return nextOptions;
    },
    [loadCharacterSnapshot]
  );

  const handleCreateCharacterSelection = useCallback(
    (characterId: string, lookId: string) => {
      setCreateSelectedCharacterId(characterId);
      setCreateSelectedCharacterLookId(lookId);
    },
    [setCreateSelectedCharacterId, setCreateSelectedCharacterLookId]
  );

  useEffect(() => {
    const normalizedCharacterId = createSelectedCharacterId.trim();
    const normalizedLookId = createSelectedCharacterLookId.trim();
    if (!normalizedCharacterId) {
      if (normalizedLookId) {
        setCreateSelectedCharacterLookId("");
      }
      return;
    }

    const cachedOptions = createCharacterLookOptionsByCharacterId[normalizedCharacterId] ?? null;
    if (cachedOptions) {
      if (normalizedLookId) return;
      const fallbackLookId = resolveFallbackLookId(cachedOptions);
      if (fallbackLookId) {
        setCreateSelectedCharacterLookId(fallbackLookId);
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
          setCreateSelectedCharacterLookId((current) =>
            current.trim() ? current : fallbackLookId
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
    setCreateSelectedCharacterLookId,
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
    setCreateSelectedCharacterLookId(fallbackLookId);
  }, [
    createCharacterLookOptionsByCharacterId,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    resolveFallbackLookId,
    setCreateSelectedCharacterLookId,
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
