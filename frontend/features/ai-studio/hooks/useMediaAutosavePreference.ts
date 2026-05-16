/**
 * Hook for storing AI Studio media autosave preference in Supabase.
 * Keeps a local fallback while synchronizing per-user preference when available.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../lib/supabaseClient";

const DEFAULT_MEDIA_AUTOSAVE_ENABLED = true;
const MEDIA_AUTOSAVE_STORAGE_KEY = "shortpulse.ai_studio.media_autosave_enabled";
const MEDIA_AUTOSAVE_RETRY_DELAY_MS = 15_000;

export type MediaAutosaveSyncState = "loading" | "ready" | "saving" | "error";

type UseMediaAutosavePreferenceResult = {
  mediaAutosaveEnabled: boolean;
  loading: boolean;
  error: string | null;
  syncState: MediaAutosaveSyncState;
  setMediaAutosaveEnabled: (value: boolean) => void;
};

const isMissingUserPreferencesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === "PGRST205" || maybeError.code === "42P01") return true;
  return typeof maybeError.message === "string" && maybeError.message.includes("user_preferences");
};

const readLocalMediaAutosave = (): boolean => {
  if (typeof window === "undefined") return DEFAULT_MEDIA_AUTOSAVE_ENABLED;
  const stored = window.localStorage.getItem(MEDIA_AUTOSAVE_STORAGE_KEY);
  if (stored == null) return DEFAULT_MEDIA_AUTOSAVE_ENABLED;
  return stored === "true";
};

const writeLocalMediaAutosave = (value: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEDIA_AUTOSAVE_STORAGE_KEY, String(value));
};

/**
 * Reads and writes `user_preferences.media_autosave_enabled` with local fallback.
 */
export const useMediaAutosavePreference = (): UseMediaAutosavePreferenceResult => {
  const sessionSnapshot = useSupabaseSessionState();
  const sessionUserId = sessionSnapshot.user?.id ?? null;
  const [mediaAutosaveEnabled, setMediaAutosaveEnabledState] = useState<boolean>(
    DEFAULT_MEDIA_AUTOSAVE_ENABLED
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<MediaAutosaveSyncState>("loading");
  const [reloadVersion, setReloadVersion] = useState<number>(0);
  const latestValueRef = useRef<boolean>(DEFAULT_MEDIA_AUTOSAVE_ENABLED);
  const remoteSyncEnabledRef = useRef<boolean>(true);
  const writeVersionRef = useRef<number>(0);
  const hasLocalOverrideRef = useRef<boolean>(false);
  const lastResolvedUserIdRef = useRef<string | null>(null);

  const updateLocalValue = useCallback((value: boolean) => {
    latestValueRef.current = value;
    setMediaAutosaveEnabledState(value);
    writeLocalMediaAutosave(value);
  }, []);

  useEffect(() => {
    if (!sessionSnapshot.initialized) {
      setLoading(true);
      setSyncState("loading");
      return;
    }
    let active = true;
    const localValue = readLocalMediaAutosave();
    const userChanged = lastResolvedUserIdRef.current !== sessionUserId;
    if (userChanged) {
      hasLocalOverrideRef.current = false;
      remoteSyncEnabledRef.current = true;
      lastResolvedUserIdRef.current = sessionUserId;
    }
    setLoading(true);
    setSyncState("loading");

    (async () => {
      try {
        if (!sessionUserId) {
          if (!active) return;
          updateLocalValue(localValue);
          setError(null);
          setSyncState("ready");
          return;
        }

        const supabase = ensureSupabaseQueryClient();
        if (!active) return;

        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("media_autosave_enabled")
          .eq("user_id", sessionUserId)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const nextValue =
          storedPreference?.media_autosave_enabled ?? DEFAULT_MEDIA_AUTOSAVE_ENABLED;
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(nextValue);
        }

        if (!active) return;
        remoteSyncEnabledRef.current = true;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
          updateLocalValue(localValue);
          setError(null);
          setSyncState("ready");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load media autosave preference");
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
  }, [reloadVersion, sessionSnapshot.initialized, sessionUserId, updateLocalValue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MEDIA_AUTOSAVE_STORAGE_KEY) return;
      if (sessionUserId) return;
      updateLocalValue(readLocalMediaAutosave());
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [sessionUserId, updateLocalValue]);

  useEffect(() => {
    if (syncState !== "error") return;
    const retry = () => {
      setReloadVersion((current) => current + 1);
    };
    const retryTimer = window.setTimeout(retry, MEDIA_AUTOSAVE_RETRY_DELAY_MS);
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(retryTimer);
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, [syncState]);

  const persistPreference = useCallback(
    async (value: boolean) => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const previous = latestValueRef.current;
      updateLocalValue(value);
      setSyncState("saving");
      setError(null);

      if (!sessionUserId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return;
      }

      try {
        const supabase = ensureSupabaseQueryClient();
        const { error: upsertError } = await supabase
          .from("user_preferences")
          .upsert(
            { user_id: sessionUserId, media_autosave_enabled: value },
            { onConflict: "user_id" }
          );
        if (upsertError) throw upsertError;

        if (requestVersion !== writeVersionRef.current) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (requestVersion !== writeVersionRef.current) return;
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        updateLocalValue(previous);
        setError(err instanceof Error ? err.message : "Unable to update media autosave preference");
        setSyncState("error");
      }
    },
    [sessionUserId, updateLocalValue]
  );

  const setMediaAutosaveEnabled = useCallback(
    (value: boolean) => {
      void persistPreference(value);
    },
    [persistPreference]
  );

  return {
    mediaAutosaveEnabled,
    loading,
    error,
    syncState,
    setMediaAutosaveEnabled,
  };
};
