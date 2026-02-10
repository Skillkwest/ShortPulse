/**
 * Hook for storing the AI Studio beginner mode preference in Supabase.
 * Loads the persisted toggle for the signed-in user and keeps it in sync with the database.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

const DEFAULT_BEGINNER_MODE = true;
const BEGINNER_MODE_STORAGE_KEY = "shortpulse.ai_studio.beginner_mode";

type UseBeginnerModePreferenceResult = {
  beginnerMode: boolean;
  loading: boolean;
  error: string | null;
  setBeginnerMode: (value: boolean) => void;
};

const isMissingUserPreferencesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === "PGRST205" || maybeError.code === "42P01") return true;
  return typeof maybeError.message === "string" && maybeError.message.includes("user_preferences");
};

const readLocalBeginnerMode = (): boolean => {
  if (typeof window === "undefined") return DEFAULT_BEGINNER_MODE;
  const stored = window.localStorage.getItem(BEGINNER_MODE_STORAGE_KEY);
  if (stored == null) return DEFAULT_BEGINNER_MODE;
  return stored === "true";
};

const writeLocalBeginnerMode = (value: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BEGINNER_MODE_STORAGE_KEY, String(value));
};

export const useBeginnerModePreference = (): UseBeginnerModePreferenceResult => {
  const [beginnerMode, setBeginnerModeState] = useState<boolean>(DEFAULT_BEGINNER_MODE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const latestModeRef = useRef<boolean>(DEFAULT_BEGINNER_MODE);
  const remoteSyncEnabledRef = useRef<boolean>(true);

  const updateLocalMode = useCallback((value: boolean) => {
    latestModeRef.current = value;
    setBeginnerModeState(value);
    writeLocalBeginnerMode(value);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      updateLocalMode(readLocalBeginnerMode());
      try {
        const supabase = ensureSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const id = data.session?.user?.id;
        if (!id) {
          setUserId(null);
          setError(null);
          return;
        }
        if (!active) return;
        setUserId(id);
        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("beginner_mode")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;
        const nextValue = storedPreference?.beginner_mode ?? DEFAULT_BEGINNER_MODE;
        updateLocalMode(nextValue);
        if (!storedPreference) {
          const { error: insertError } = await supabase
            .from("user_preferences")
            .upsert({ user_id: id, beginner_mode: DEFAULT_BEGINNER_MODE }, { onConflict: "user_id" });
          if (insertError) throw insertError;
        }
        setError(null);
      } catch (err) {
        if (!active) return;
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load beginner mode preference");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [updateLocalMode]);

  const persistPreference = useCallback(
    async (value: boolean) => {
      const previous = latestModeRef.current;
      updateLocalMode(value);
      if (!userId || !remoteSyncEnabledRef.current) return;
      try {
        const supabase = ensureSupabaseClient();
        const { error: upsertError } = await supabase
          .from("user_preferences")
          .upsert({ user_id: userId, beginner_mode: value }, { onConflict: "user_id" });
        if (upsertError) throw upsertError;
        setError(null);
      } catch (err) {
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          return;
        }
        updateLocalMode(previous);
        setError(err instanceof Error ? err.message : "Unable to update beginner mode preference");
      }
    },
    [userId, updateLocalMode],
  );

  const setBeginnerMode = useCallback((value: boolean) => {
    void persistPreference(value);
  }, [persistPreference]);

  return {
    beginnerMode,
    loading,
    error,
    setBeginnerMode,
  };
};
