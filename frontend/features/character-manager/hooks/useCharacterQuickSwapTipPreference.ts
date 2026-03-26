/**
 * Hook for storing per-user Character QuickSwap tip visibility.
 * Keeps a local fallback while synchronizing with
 * `user_preferences.ai_studio_character_quickswap_tip_hidden`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  buildUserScopedStorageKey,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
} from "../logic/userScopedLocalStorage";

const QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_V2 = "shortpulse.character_manager.quickswap_tip_hidden.v2";
const QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_LEGACY =
  "shortpulse.character_manager.quickswap_tip_hidden";

export type CharacterQuickSwapTipSyncState = "loading" | "ready" | "saving" | "error";

type UseCharacterQuickSwapTipPreferenceResult = {
  isQuickSwapTipHidden: boolean;
  loading: boolean;
  error: string | null;
  syncState: CharacterQuickSwapTipSyncState;
  markQuickSwapTipHidden: (options?: { persistRemotely?: boolean }) => Promise<boolean>;
};

const parseStoredBoolean = (value: string | null): boolean | null => {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const readLocalTipHidden = (userId: string | null): boolean => {
  const scopedKey = buildUserScopedStorageKey(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_V2, userId);
  const scopedValue = parseStoredBoolean(readLocalStorageValue(scopedKey));
  if (scopedValue !== null) return scopedValue;
  if (userId) return false;
  const legacyValue = parseStoredBoolean(
    readLocalStorageValue(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_LEGACY)
  );
  return legacyValue ?? false;
};

const writeLocalTipHidden = (value: boolean, userId: string | null): void => {
  const scopedKey = buildUserScopedStorageKey(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_V2, userId);
  writeLocalStorageValue(scopedKey, String(value));
  if (userId) {
    removeLocalStorageValue(QUICK_SWAP_TIP_HIDDEN_STORAGE_KEY_LEGACY);
  }
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
  const userIdRef = useRef<string | null>(null);
  const latestValueRef = useRef(false);
  const writeVersionRef = useRef(0);
  const remoteSyncEnabledRef = useRef(true);
  const hasLocalOverrideRef = useRef(false);

  const updateLocalValue = useCallback((value: boolean, scopeUserId?: string | null) => {
    const resolvedUserId = scopeUserId ?? userIdRef.current;
    latestValueRef.current = value;
    setIsQuickSwapTipHidden(value);
    writeLocalTipHidden(value, resolvedUserId);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      try {
        const supabase = ensureSupabaseQueryClient();
        const id = (await readSupabaseUserId())?.trim() ?? null;
        if (!active) return;
        setUserId(id);
        userIdRef.current = id;

        const localValue = readLocalTipHidden(id);
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(localValue, id);
        }

        if (!id) {
          if (!active) return;
          setError(null);
          setSyncState("ready");
          return;
        }

        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const hasStoredPreference = Boolean(storedPreference);
        const remoteValue = storedPreference?.ai_studio_character_quickswap_tip_hidden === true;
        const mergedValue = hasLocalOverrideRef.current
          ? latestValueRef.current
          : hasStoredPreference
            ? remoteValue
            : localValue;
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(mergedValue, id);
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

  const markQuickSwapTipHidden = useCallback(
    async (options?: { persistRemotely?: boolean }): Promise<boolean> => {
      const persistRemotely = options?.persistRemotely ?? true;
      if (latestValueRef.current) return true;
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const previousValue = latestValueRef.current;
      updateLocalValue(true, userIdRef.current);
      setSyncState("saving");
      setError(null);

      if (!persistRemotely || !userId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return true;
      }

      try {
        const supabase = ensureSupabaseQueryClient();
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
        updateLocalValue(previousValue, userIdRef.current);
        setError(err instanceof Error ? err.message : "Unable to update QuickSwap tip preference.");
        setSyncState("error");
        return false;
      }
    },
    [updateLocalValue, userId]
  );

  return {
    isQuickSwapTipHidden,
    loading,
    error,
    syncState,
    markQuickSwapTipHidden,
  };
};
