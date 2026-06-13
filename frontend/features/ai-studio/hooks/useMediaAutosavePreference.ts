/**
 * Hook for storing AI Studio media autosave preference in Supabase.
 * Keeps a local fallback while synchronizing per-user preference when available.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { buildUserScopedStorageKey } from "../../character-manager/logic/userScopedLocalStorage";

const DEFAULT_MEDIA_AUTOSAVE_ENABLED = true;
const MEDIA_AUTOSAVE_STORAGE_KEY = "shortpulse.ai_studio.media_autosave_enabled";
const MEDIA_AUTOSAVE_RETRY_DELAY_MS = 15_000;
export const MEDIA_AUTOSAVE_REMOTE_IDLE_TIMEOUT_MS = 1_500;
export const MEDIA_AUTOSAVE_REMOTE_FALLBACK_DELAY_MS = 250;
const buildMediaAutosaveStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(MEDIA_AUTOSAVE_STORAGE_KEY, userId);

export type MediaAutosaveSyncState = "loading" | "ready" | "saving" | "error";

type UseMediaAutosavePreferenceResult = {
  mediaAutosaveEnabled: boolean;
  loading: boolean;
  error: string | null;
  syncState: MediaAutosaveSyncState;
  setMediaAutosaveEnabled: (value: boolean) => void;
};

type UseMediaAutosavePreferenceOptions = {
  enabled?: boolean;
};

const isMissingUserPreferencesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === "PGRST205" || maybeError.code === "42P01") return true;
  return typeof maybeError.message === "string" && maybeError.message.includes("user_preferences");
};

const readLocalMediaAutosave = (userId?: string | null): boolean => {
  if (typeof window === "undefined") return DEFAULT_MEDIA_AUTOSAVE_ENABLED;
  const stored = window.localStorage.getItem(buildMediaAutosaveStorageKey(userId));
  if (stored == null) return DEFAULT_MEDIA_AUTOSAVE_ENABLED;
  return stored === "true";
};

const writeLocalMediaAutosave = (value: boolean, userId?: string | null): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildMediaAutosaveStorageKey(userId), String(value));
};

const scheduleRemotePreferenceRead = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  let cancelled = false;
  const run = () => {
    if (!cancelled) callback();
  };

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(run, {
      timeout: MEDIA_AUTOSAVE_REMOTE_IDLE_TIMEOUT_MS,
    });
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  const timeoutId = window.setTimeout(run, MEDIA_AUTOSAVE_REMOTE_FALLBACK_DELAY_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
};

/**
 * Reads and writes `user_preferences.media_autosave_enabled` with local fallback.
 */
export const useMediaAutosavePreference = ({
  enabled = true,
}: UseMediaAutosavePreferenceOptions = {}): UseMediaAutosavePreferenceResult => {
  const sessionSnapshot = useResolvedProtectedSessionState({ enabled });
  const sessionUserId = enabled ? (sessionSnapshot.user?.id ?? null) : null;
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

  const updateLocalValue = useCallback((value: boolean, storageUserId?: string | null) => {
    latestValueRef.current = value;
    setMediaAutosaveEnabledState(value);
    writeLocalMediaAutosave(value, storageUserId);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      setError(null);
      setSyncState("loading");
      return;
    }
    if (!sessionSnapshot.initialized) {
      setLoading(true);
      setSyncState("loading");
      return;
    }
    let active = true;
    const localValue = readLocalMediaAutosave(sessionUserId);
    const userChanged = lastResolvedUserIdRef.current !== sessionUserId;
    if (userChanged) {
      hasLocalOverrideRef.current = false;
      remoteSyncEnabledRef.current = true;
      lastResolvedUserIdRef.current = sessionUserId;
    }
    setLoading(true);
    setSyncState("loading");

    const runRemotePreferenceRead = () => {
      void (async () => {
        try {
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
            updateLocalValue(nextValue, sessionUserId);
          }

          if (!active) return;
          remoteSyncEnabledRef.current = true;
          setError(null);
          setSyncState("ready");
        } catch (err) {
          if (!active) return;
          if (isMissingUserPreferencesTableError(err)) {
            remoteSyncEnabledRef.current = false;
            updateLocalValue(localValue, sessionUserId);
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
    };

    if (!sessionUserId) {
      try {
        if (!active) return;
        updateLocalValue(localValue, null);
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingUserPreferencesTableError(err)) {
          remoteSyncEnabledRef.current = false;
          updateLocalValue(localValue, sessionUserId);
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
      return () => {
        active = false;
      };
    }

    const cancelRemotePreferenceRead = scheduleRemotePreferenceRead(runRemotePreferenceRead);

    return () => {
      active = false;
      cancelRemotePreferenceRead();
    };
  }, [enabled, reloadVersion, sessionSnapshot.initialized, sessionUserId, updateLocalValue]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== buildMediaAutosaveStorageKey(null)) return;
      if (sessionUserId) return;
      updateLocalValue(readLocalMediaAutosave(null), null);
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [enabled, sessionUserId, updateLocalValue]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, syncState]);

  const persistPreference = useCallback(
    async (value: boolean) => {
      if (!enabled) {
        updateLocalValue(value, sessionUserId);
        setLoading(false);
        setError(null);
        setSyncState("ready");
        return;
      }
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const previous = latestValueRef.current;
      updateLocalValue(value, sessionUserId);
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
        updateLocalValue(previous, sessionUserId);
        setError(err instanceof Error ? err.message : "Unable to update media autosave preference");
        setSyncState("error");
      }
    },
    [enabled, sessionUserId, updateLocalValue]
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
