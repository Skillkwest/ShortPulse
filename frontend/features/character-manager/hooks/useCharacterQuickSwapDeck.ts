/**
 * Quick Swap deck state hook.
 * Coordinates active/archive quick-swap data with append/remove/restore operations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendQuickSwapFiles,
  appendQuickSwapExistingMediaReference,
  countQuickSwapArchived,
  listQuickSwapActive,
  listQuickSwapArchived,
  removeQuickSwapItem,
  restoreQuickSwapItem,
  type QuickSwapArchivedCursor,
} from "../logic/characterQuickSwapPersistence";
import type { CharacterQuickSwapItem } from "../types";

type UseCharacterQuickSwapDeckParams = {
  characterId: string | null;
  disabled?: boolean;
};

type UseCharacterQuickSwapDeckResult = {
  activeItems: CharacterQuickSwapItem[];
  archivedItems: CharacterQuickSwapItem[];
  archivedCount: number;
  loading: boolean;
  loadingArchived: boolean;
  mutating: boolean;
  error: string | null;
  hasMoreArchived: boolean;
  appendFiles: (files: File[]) => Promise<boolean>;
  appendExistingMediaReference: (
    mediaFileId: string,
    options?: { suppressError?: boolean }
  ) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  restoreItem: (itemId: string) => Promise<boolean>;
  loadMoreArchived: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

/**
 * Provides reactive quick-swap state for Character Manager shells.
 */
export const useCharacterQuickSwapDeck = ({
  characterId,
  disabled = false,
}: UseCharacterQuickSwapDeckParams): UseCharacterQuickSwapDeckResult => {
  const [activeItems, setActiveItems] = useState<CharacterQuickSwapItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<CharacterQuickSwapItem[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivedCursorRef = useRef<QuickSwapArchivedCursor | null>(null);
  const requestVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    const trimmedCharacterId = characterId?.trim() ?? "";
    if (disabled || !trimmedCharacterId) {
      setActiveItems([]);
      setArchivedItems([]);
      setArchivedCount(0);
      setLoading(false);
      archivedCursorRef.current = null;
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setLoading(true);
    try {
      const [nextActive, nextArchivedCount] = await Promise.all([
        listQuickSwapActive(trimmedCharacterId),
        countQuickSwapArchived(trimmedCharacterId),
      ]);
      if (requestVersionRef.current !== requestVersion) return;
      setActiveItems(nextActive);
      setArchivedItems([]);
      setArchivedCount(nextArchivedCount);
      archivedCursorRef.current = null;
      setError(null);
    } catch (nextError) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(toErrorMessage(nextError, "Failed to load QuickSwap deck."));
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [characterId, disabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const appendFiles = useCallback(
    async (files: File[]) => {
      const trimmedCharacterId = characterId?.trim() ?? "";
      if (disabled || !trimmedCharacterId || !files.length) return false;
      setMutating(true);
      try {
        await appendQuickSwapFiles({
          characterId: trimmedCharacterId,
          files,
        });
        await refresh();
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to add files to QuickSwap deck."));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [characterId, disabled, refresh]
  );

  const appendExistingMediaReference = useCallback(
    async (mediaFileId: string, options?: { suppressError?: boolean }) => {
      const trimmedCharacterId = characterId?.trim() ?? "";
      const trimmedMediaFileId = mediaFileId.trim();
      if (disabled || !trimmedCharacterId || !trimmedMediaFileId) return false;
      setMutating(true);
      try {
        await appendQuickSwapExistingMediaReference({
          characterId: trimmedCharacterId,
          mediaFileId: trimmedMediaFileId,
        });
        await refresh();
        return true;
      } catch (nextError) {
        if (!options?.suppressError) {
          setError(toErrorMessage(nextError, "Failed to add dropped media to QuickSwap deck."));
        }
        return false;
      } finally {
        setMutating(false);
      }
    },
    [characterId, disabled, refresh]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const trimmedCharacterId = characterId?.trim() ?? "";
      if (disabled || !trimmedCharacterId || !itemId.trim()) return false;
      setMutating(true);
      try {
        await removeQuickSwapItem({
          characterId: trimmedCharacterId,
          itemId,
        });
        await refresh();
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to remove this QuickSwap reference."));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [characterId, disabled, refresh]
  );

  const restoreItem = useCallback(
    async (itemId: string) => {
      const trimmedCharacterId = characterId?.trim() ?? "";
      if (disabled || !trimmedCharacterId || !itemId.trim()) return false;
      setMutating(true);
      try {
        await restoreQuickSwapItem({
          characterId: trimmedCharacterId,
          itemId,
        });
        await refresh();
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to restore this QuickSwap reference."));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [characterId, disabled, refresh]
  );

  const loadMoreArchived = useCallback(async () => {
    const trimmedCharacterId = characterId?.trim() ?? "";
    if (disabled || !trimmedCharacterId) return;
    if (loadingArchived) return;
    if (archivedItems.length >= archivedCount && archivedCursorRef.current === null) return;

    setLoadingArchived(true);
    try {
      const page = await listQuickSwapArchived(trimmedCharacterId, {
        cursor: archivedCursorRef.current,
        pageSize: 30,
      });
      setArchivedItems((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        for (const item of page.items) {
          if (ids.has(item.id)) continue;
          ids.add(item.id);
          merged.push(item);
        }
        return merged;
      });
      archivedCursorRef.current = page.nextCursor;
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to load archived QuickSwap references."));
    } finally {
      setLoadingArchived(false);
    }
  }, [archivedCount, archivedItems.length, characterId, disabled, loadingArchived]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hasMoreArchived = useMemo(() => {
    if (archivedItems.length < archivedCount) return true;
    return archivedCursorRef.current !== null;
  }, [archivedCount, archivedItems.length]);

  return {
    activeItems,
    archivedItems,
    archivedCount,
    loading,
    loadingArchived,
    mutating,
    error,
    hasMoreArchived,
    appendFiles,
    appendExistingMediaReference,
    removeItem,
    restoreItem,
    loadMoreArchived,
    refresh,
    clearError,
  };
};
