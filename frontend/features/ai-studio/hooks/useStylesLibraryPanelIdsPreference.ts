/**
 * Hook for storing per-user style ordering for the shared AI Studio styles catalog.
 * Uses `user_preferences.ai_studio_style_panel_ids` as the canonical order authority.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseQueryClient } from "../../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import {
  normalizeStylesLibraryOrderedIds,
  removeStylesLibraryOrderedId,
} from "../logic/stylesLibraryCatalog";

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

const resolveStyleOrderErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallbackMessage;
};

/**
 * Reads and writes shared style ordering through the canonical user preference row.
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

  const updateValue = useCallback((value: string[]) => {
    const normalizedValue = normalizeStylesLibraryOrderedIds(value);
    latestValueRef.current = normalizedValue;
    setStylePanelIdsState(normalizedValue);
  }, []);

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
          throw new Error("Style order persistence is unavailable.");
        }

        if (!sessionUserId) {
          if (!active) return;
          updateValue([]);
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        setUserId(sessionUserId);

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
        updateValue(remoteValue);

        if (!active) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        updateValue([]);
        setError(resolveStyleOrderErrorMessage(err, "Unable to load style order."));
        setSyncState("error");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionSnapshot.initialized, sessionUserId, updateValue]);

  const persistNextValue = useCallback(
    async (nextValue: string[]): Promise<boolean> => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;

      const normalizedNextValue = normalizeStylesLibraryOrderedIds(nextValue);
      const previousValue = latestValueRef.current;
      const valuesMatch =
        normalizedNextValue.length === previousValue.length &&
        normalizedNextValue.every((value, index) => previousValue[index] === value);
      if (valuesMatch) return true;

      updateValue(normalizedNextValue);
      setSyncState("saving");
      setError(null);

      if (!userId || !supabaseQueryClient) {
        if (requestVersion === writeVersionRef.current) {
          updateValue(previousValue);
          setError("Style order persistence is unavailable.");
          setSyncState("error");
        }
        return false;
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
        updateValue(previousValue);
        setError(resolveStyleOrderErrorMessage(err, "Unable to save style order."));
        setSyncState("error");
        return false;
      }
    },
    [updateValue, userId]
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
