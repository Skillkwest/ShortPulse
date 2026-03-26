/**
 * Hook for storing the AI Studio beginner mode preference in Supabase.
 * Loads the persisted toggle for the signed-in user and keeps it in sync with the database.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";

const DEFAULT_BEGINNER_MODE = false;
const BEGINNER_MODE_STORAGE_KEY = "shortpulse.ai_studio.beginner_mode";

export type BeginnerSyncState = "loading" | "ready" | "saving" | "error";

type UseBeginnerModePreferenceResult = {
  beginnerMode: boolean;
  loading: boolean;
  error: string | null;
  syncState: BeginnerSyncState;
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
  const [syncState, setSyncState] = useState<BeginnerSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestModeRef = useRef<boolean>(DEFAULT_BEGINNER_MODE);
  const remoteSyncEnabledRef = useRef<boolean>(true);
  const writeVersionRef = useRef<number>(0);
  const hasLocalOverrideRef = useRef<boolean>(false);

  const updateLocalMode = useCallback((value: boolean) => {
    latestModeRef.current = value;
    setBeginnerModeState(value);
    writeLocalBeginnerMode(value);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      updateLocalMode(readLocalBeginnerMode());
      try {
        const supabase = ensureSupabaseQueryClient();
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

        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("beginner_mode")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const nextValue = storedPreference?.beginner_mode ?? DEFAULT_BEGINNER_MODE;
        if (!hasLocalOverrideRef.current) {
          updateLocalMode(nextValue);
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
        setError(err instanceof Error ? err.message : "Unable to load beginner mode preference");
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
  }, [updateLocalMode]);

  const persistPreference = useCallback(
    async (value: boolean) => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const previous = latestModeRef.current;
      updateLocalMode(value);
      setSyncState("saving");
      setError(null);

      if (!userId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return;
      }

      try {
        const supabase = ensureSupabaseQueryClient();
        const { error: upsertError } = await supabase
          .from("user_preferences")
          .upsert({ user_id: userId, beginner_mode: value }, { onConflict: "user_id" });
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
        updateLocalMode(previous);
        setError(err instanceof Error ? err.message : "Unable to update beginner mode preference");
        setSyncState("error");
      }
    },
    [userId, updateLocalMode]
  );

  const setBeginnerMode = useCallback(
    (value: boolean) => {
      void persistPreference(value);
    },
    [persistPreference]
  );

  return {
    beginnerMode,
    loading,
    error,
    syncState,
    setBeginnerMode,
  };
};
