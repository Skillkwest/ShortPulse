/**
 * Hook for storing AI Studio media autosave preference in Supabase.
 * Keeps a local fallback while synchronizing per-user preference when available.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

const DEFAULT_MEDIA_AUTOSAVE_ENABLED = true;
const MEDIA_AUTOSAVE_STORAGE_KEY = "shortpulse.ai_studio.media_autosave_enabled";

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
  const [mediaAutosaveEnabled, setMediaAutosaveEnabledState] = useState<boolean>(
    DEFAULT_MEDIA_AUTOSAVE_ENABLED
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<MediaAutosaveSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestValueRef = useRef<boolean>(DEFAULT_MEDIA_AUTOSAVE_ENABLED);
  const remoteSyncEnabledRef = useRef<boolean>(true);
  const writeVersionRef = useRef<number>(0);
  const hasLocalOverrideRef = useRef<boolean>(false);

  const updateLocalValue = useCallback((value: boolean) => {
    latestValueRef.current = value;
    setMediaAutosaveEnabledState(value);
    writeLocalMediaAutosave(value);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      updateLocalValue(readLocalMediaAutosave());
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
          .select("media_autosave_enabled")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const nextValue =
          storedPreference?.media_autosave_enabled ?? DEFAULT_MEDIA_AUTOSAVE_ENABLED;
        if (!hasLocalOverrideRef.current) {
          updateLocalValue(nextValue);
        }

        if (!storedPreference) {
          const { error: insertError } = await supabase
            .from("user_preferences")
            .upsert(
              { user_id: id, media_autosave_enabled: DEFAULT_MEDIA_AUTOSAVE_ENABLED },
              { onConflict: "user_id" }
            );
          if (insertError) throw insertError;
        }

        if (!active) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
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
  }, [updateLocalValue]);

  const persistPreference = useCallback(
    async (value: boolean) => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const previous = latestValueRef.current;
      updateLocalValue(value);
      setSyncState("saving");
      setError(null);

      if (!userId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return;
      }

      try {
        const supabase = ensureSupabaseClient();
        const { error: upsertError } = await supabase
          .from("user_preferences")
          .upsert({ user_id: userId, media_autosave_enabled: value }, { onConflict: "user_id" });
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
    [userId, updateLocalValue]
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
