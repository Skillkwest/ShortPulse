/**
 * Hook for storing per-user style ordering for the shared AI Studio styles catalog.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_style_panel_ids`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseQueryClient } from "../../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { buildUserScopedStorageKey } from "../../character-manager/logic/userScopedLocalStorage";
import {
  mergeStylesLibraryOrderedIds,
  normalizeStylesLibraryOrderedIds,
  removeStylesLibraryOrderedId,
} from "../logic/stylesLibraryCatalog";

const STYLE_PANEL_IDS_STORAGE_KEY = "shortpulse.ai_studio.style_panel_ids";

const buildStylePanelIdsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(STYLE_PANEL_IDS_STORAGE_KEY, userId);

export type StylesLibraryPanelIdsSyncState = "loading" | "ready" | "saving" | "error";

type UseStylesLibraryPanelIdsPreferenceResult = {
  stylePanelIds: string[];
  loading: boolean;
  error: string | null;
  syncState: StylesLibraryPanelIdsSyncState;
  setStylePanelIds: (styleIds: string[]) => Promise<boolean>;
  removeStylePanelId: (styleId: string) => Promise<boolean>;
  resetStylePanelIds: () => Promise<boolean>;
};

const readLocalStylePanelIds = (userId?: string | null): string[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(buildStylePanelIdsStorageKey(userId));
  if (!stored) return [];
  try {
    return normalizeStylesLibraryOrderedIds(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeLocalStylePanelIds = (value: string[], userId?: string | null): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildStylePanelIdsStorageKey(userId), JSON.stringify(value));
};

const isMissingStylePanelIdsStorageError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (
    maybeError.code === "PGRST205" ||
    maybeError.code === "PGRST204" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703"
  ) {
    return true;
  }
  if (typeof maybeError.message !== "string") return false;
  return (
    maybeError.message.includes("user_preferences") ||
    maybeError.message.includes("ai_studio_style_panel_ids")
  );
};

/**
 * Reads and writes shared style ordering with Supabase persistence when available.
 */
export const useStylesLibraryPanelIdsPreference = (): UseStylesLibraryPanelIdsPreferenceResult => {
  const sessionSnapshot = useResolvedProtectedSessionState();
  const sessionUserId = sessionSnapshot.user?.id ?? null;
  const [stylePanelIds, setStylePanelIdsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<StylesLibraryPanelIdsSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestValueRef = useRef<string[]>([]);
  const writeVersionRef = useRef(0);
  const remoteSyncEnabledRef = useRef(true);
  const hasLocalOverrideRef = useRef(false);

  const updateLocalValue = useCallback(
    (value: string[], storageUserId?: string | null) => {
      const normalizedValue = normalizeStylesLibraryOrderedIds(value);
      latestValueRef.current = normalizedValue;
      setStylePanelIdsState(normalizedValue);
      writeLocalStylePanelIds(normalizedValue, storageUserId ?? userId);
    },
    [userId]
  );

  useEffect(() => {
    if (!sessionSnapshot.initialized) {
      setLoading(true);
      setSyncState("loading");
      return;
    }
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      try {
        if (!supabaseQueryClient) {
          if (!active) return;
          updateLocalValue(readLocalStylePanelIds(), null);
          remoteSyncEnabledRef.current = false;
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }

        if (!sessionUserId) {
          if (!active) return;
          updateLocalValue(readLocalStylePanelIds(), null);
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        setUserId(sessionUserId);
        const localValue = readLocalStylePanelIds(sessionUserId);
        updateLocalValue(localValue, sessionUserId);

        const { data: storedPreference, error: preferenceError } = await supabaseQueryClient
          .from("user_preferences")
          .select("ai_studio_style_panel_ids")
          .eq("user_id", sessionUserId)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const remoteValue = normalizeStylesLibraryOrderedIds(
          storedPreference?.ai_studio_style_panel_ids
        );
        const mergedValue = mergeStylesLibraryOrderedIds(remoteValue, localValue);
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(mergedValue, sessionUserId);
        }

        if (!active) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingStylePanelIdsStorageError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load style order.");
        setSyncState("error");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionSnapshot.initialized, sessionUserId, updateLocalValue]);

  const persistNextValue = useCallback(
    async (nextValue: string[]): Promise<boolean> => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const normalizedNextValue = normalizeStylesLibraryOrderedIds(nextValue);
      const previousValue = latestValueRef.current;
      const valuesMatch =
        normalizedNextValue.length === previousValue.length &&
        normalizedNextValue.every((value, index) => previousValue[index] === value);
      if (valuesMatch) return true;

      updateLocalValue(normalizedNextValue, userId);
      setSyncState("saving");
      setError(null);

      if (!userId || !remoteSyncEnabledRef.current || !supabaseQueryClient) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return true;
      }

      try {
        const { error: upsertError } = await supabaseQueryClient
          .from("user_preferences")
          .upsert(
            { user_id: userId, ai_studio_style_panel_ids: normalizedNextValue },
            { onConflict: "user_id" }
          );
        if (upsertError) throw upsertError;
        if (requestVersion !== writeVersionRef.current) return true;
        setError(null);
        setSyncState("ready");
        return true;
      } catch (err) {
        if (requestVersion !== writeVersionRef.current) return true;
        if (isMissingStylePanelIdsStorageError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return true;
        }
        updateLocalValue(previousValue, userId);
        setError(err instanceof Error ? err.message : "Unable to save style order.");
        setSyncState("error");
        return false;
      }
    },
    [updateLocalValue, userId]
  );

  const setStylePanelIds = useCallback(
    async (nextValue: string[]): Promise<boolean> => persistNextValue(nextValue),
    [persistNextValue]
  );

  const removeStylePanelId = useCallback(
    async (styleId: string): Promise<boolean> =>
      persistNextValue(removeStylesLibraryOrderedId(latestValueRef.current, styleId)),
    [persistNextValue]
  );

  const resetStylePanelIds = useCallback(
    async (): Promise<boolean> => persistNextValue([]),
    [persistNextValue]
  );

  return {
    stylePanelIds,
    loading,
    error,
    syncState,
    setStylePanelIds,
    removeStylePanelId,
    resetStylePanelIds,
  };
};
