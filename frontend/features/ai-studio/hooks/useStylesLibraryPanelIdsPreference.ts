/**
 * Hook for storing per-user style ordering for the shared AI Studio styles catalog.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_style_panel_ids`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { readSupabaseUserId, supabaseQueryClient } from "../../../lib/supabaseClient";
import {
  mergeStylesLibraryOrderedIds,
  normalizeStylesLibraryOrderedIds,
  removeStylesLibraryOrderedId,
} from "../logic/stylesLibraryCatalog";

const STYLE_PANEL_IDS_STORAGE_KEY = "shortpulse.ai_studio.style_panel_ids";

export type StylesLibraryPanelIdsSyncState = "loading" | "ready" | "saving" | "error";

type UseStylesLibraryPanelIdsPreferenceResult = {
  stylePanelIds: string[];
  loading: boolean;
  error: string | null;
  syncState: StylesLibraryPanelIdsSyncState;
  setStylePanelIds: (styleIds: string[]) => Promise<boolean>;
  removeStylePanelId: (styleId: string) => Promise<boolean>;
};

const readLocalStylePanelIds = (): string[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(STYLE_PANEL_IDS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return normalizeStylesLibraryOrderedIds(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeLocalStylePanelIds = (value: string[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STYLE_PANEL_IDS_STORAGE_KEY, JSON.stringify(value));
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
  const [stylePanelIds, setStylePanelIdsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<StylesLibraryPanelIdsSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestValueRef = useRef<string[]>([]);
  const writeVersionRef = useRef(0);
  const remoteSyncEnabledRef = useRef(true);
  const hasLocalOverrideRef = useRef(false);

  const updateLocalValue = useCallback((value: string[]) => {
    const normalizedValue = normalizeStylesLibraryOrderedIds(value);
    latestValueRef.current = normalizedValue;
    setStylePanelIdsState(normalizedValue);
    writeLocalStylePanelIds(normalizedValue);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      updateLocalValue(readLocalStylePanelIds());
      try {
        if (!supabaseQueryClient) {
          if (!active) return;
          remoteSyncEnabledRef.current = false;
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }

        const id = await readSupabaseUserId();
        if (!id) {
          if (!active) return;
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        setUserId(id);

        const { data: storedPreference, error: preferenceError } = await supabaseQueryClient
          .from("user_preferences")
          .select("ai_studio_style_panel_ids")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const remoteValue = normalizeStylesLibraryOrderedIds(
          storedPreference?.ai_studio_style_panel_ids
        );
        const mergedValue = mergeStylesLibraryOrderedIds(remoteValue, latestValueRef.current);
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(mergedValue);
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
  }, [updateLocalValue]);

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

      updateLocalValue(normalizedNextValue);
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
        updateLocalValue(previousValue);
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

  return {
    stylePanelIds,
    loading,
    error,
    syncState,
    setStylePanelIds,
    removeStylePanelId,
  };
};
