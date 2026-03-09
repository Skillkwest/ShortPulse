/**
 * Hook for storing per-user Character QuickSwap tip visibility.
 * Keeps a local fallback while synchronizing with
 * `user_preferences.ai_studio_character_quickswap_tip_hidden`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

const QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY = "shortpulse.character_manager.quickswap_tip_hidden";

export type CharacterQuickSwapTipSyncState = "loading" | "ready" | "saving" | "error";

type UseCharacterQuickSwapTipPreferenceResult = {
  isQuickSwapTipHidden: boolean;
  loading: boolean;
  error: string | null;
  syncState: CharacterQuickSwapTipSyncState;
  markQuickSwapTipHidden: () => Promise<boolean>;
};

const readLocalTipHidden = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY);
  return stored === "true";
};

const writeLocalTipHidden = (value: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY, String(value));
};

const isMissingQuickSwapTipPreferenceError = (error: unknown): boolean => {
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
    maybeError.message.includes("ai_studio_character_quickswap_tip_hidden")
  );
};

/**
 * Reads and writes Character QuickSwap tip preference with Supabase persistence when available.
 */
export const useCharacterQuickSwapTipPreference = (): UseCharacterQuickSwapTipPreferenceResult => {
  const [isQuickSwapTipHidden, setIsQuickSwapTipHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<CharacterQuickSwapTipSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestValueRef = useRef(false);
  const writeVersionRef = useRef(0);
  const remoteSyncEnabledRef = useRef(true);
  const hasLocalOverrideRef = useRef(false);

  const updateLocalValue = useCallback((value: boolean) => {
    latestValueRef.current = value;
    setIsQuickSwapTipHidden(value);
    writeLocalTipHidden(value);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      updateLocalValue(readLocalTipHidden());
      try {
        const supabase = ensureSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const id = data.session?.user?.id;
        if (!id) {
          if (!active) return;
          setUserId(null);
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        setUserId(id);

        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("ai_studio_character_quickswap_tip_hidden")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const remoteValue = storedPreference?.ai_studio_character_quickswap_tip_hidden === true;
        const mergedValue = latestValueRef.current || remoteValue;
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(mergedValue);
        }

        if (
          !storedPreference ||
          storedPreference.ai_studio_character_quickswap_tip_hidden !== mergedValue
        ) {
          const { error: upsertError } = await supabase.from("user_preferences").upsert(
            {
              user_id: id,
              ai_studio_character_quickswap_tip_hidden: mergedValue,
            },
            { onConflict: "user_id" }
          );
          if (upsertError) throw upsertError;
        }

        if (!active) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingQuickSwapTipPreferenceError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load QuickSwap tip preference.");
        setSyncState("error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [updateLocalValue]);

  const markQuickSwapTipHidden = useCallback(async (): Promise<boolean> => {
    if (latestValueRef.current) return true;
    const requestVersion = writeVersionRef.current + 1;
    writeVersionRef.current = requestVersion;
    hasLocalOverrideRef.current = true;

    const previousValue = latestValueRef.current;
    updateLocalValue(true);
    setSyncState("saving");
    setError(null);

    if (!userId || !remoteSyncEnabledRef.current) {
      if (requestVersion === writeVersionRef.current) {
        setSyncState("ready");
      }
      return true;
    }

    try {
      const supabase = ensureSupabaseClient();
      const { error: upsertError } = await supabase
        .from("user_preferences")
        .upsert(
          { user_id: userId, ai_studio_character_quickswap_tip_hidden: true },
          { onConflict: "user_id" }
        );
      if (upsertError) throw upsertError;
      if (requestVersion !== writeVersionRef.current) return true;
      setError(null);
      setSyncState("ready");
      return true;
    } catch (err) {
      if (requestVersion !== writeVersionRef.current) return true;
      if (isMissingQuickSwapTipPreferenceError(err)) {
        remoteSyncEnabledRef.current = false;
        setError(null);
        setSyncState("ready");
        return true;
      }
      updateLocalValue(previousValue);
      setError(err instanceof Error ? err.message : "Unable to update QuickSwap tip preference.");
      setSyncState("error");
      return false;
    }
  }, [updateLocalValue, userId]);

  return {
    isQuickSwapTipHidden,
    loading,
    error,
    syncState,
    markQuickSwapTipHidden,
  };
};
