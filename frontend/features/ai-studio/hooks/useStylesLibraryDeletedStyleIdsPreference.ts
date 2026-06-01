/**
 * Hook for storing per-user deleted style IDs for the AI Studio styles library.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_deleted_style_ids`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseQueryClient } from "../../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { buildUserScopedStorageKey } from "../../character-manager/logic/userScopedLocalStorage";

const DELETED_STYLE_IDS_STORAGE_KEY = "shortpulse.ai_studio.deleted_style_ids";
const buildDeletedStyleIdsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(DELETED_STYLE_IDS_STORAGE_KEY, userId);

export type StylesLibraryDeleteSyncState = "loading" | "ready" | "saving" | "error";

type UseStylesLibraryDeletedStyleIdsPreferenceResult = {
  deletedStyleIds: string[];
  loading: boolean;
  error: string | null;
  syncState: StylesLibraryDeleteSyncState;
  deleteStyleId: (styleId: string) => Promise<boolean>;
};

const normalizeDeletedStyleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") return;
    const nextId = entry.trim();
    if (!nextId || seen.has(nextId)) return;
    seen.add(nextId);
    normalized.push(nextId);
  });
  return normalized;
};

const readLocalDeletedStyleIds = (userId?: string | null): string[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(buildDeletedStyleIdsStorageKey(userId));
  if (!stored) return [];
  try {
    return normalizeDeletedStyleIds(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeLocalDeletedStyleIds = (value: string[], userId?: string | null): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildDeletedStyleIdsStorageKey(userId), JSON.stringify(value));
};

const isMissingDeletedStyleStorageError = (error: unknown): boolean => {
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
    maybeError.message.includes("ai_studio_deleted_style_ids")
  );
};

/**
 * Reads and writes deleted style IDs with Supabase persistence when available.
 */
export const useStylesLibraryDeletedStyleIdsPreference =
  (): UseStylesLibraryDeletedStyleIdsPreferenceResult => {
    const sessionSnapshot = useResolvedProtectedSessionState();
    const sessionUserId = sessionSnapshot.user?.id ?? null;
    const [deletedStyleIds, setDeletedStyleIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<StylesLibraryDeleteSyncState>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const latestValueRef = useRef<string[]>([]);
    const writeVersionRef = useRef(0);
    const remoteSyncEnabledRef = useRef(true);
    const hasLocalOverrideRef = useRef(false);

    const updateLocalValue = useCallback(
      (value: string[], storageUserId?: string | null) => {
        const normalizedValue = normalizeDeletedStyleIds(value);
        latestValueRef.current = normalizedValue;
        setDeletedStyleIds(normalizedValue);
        writeLocalDeletedStyleIds(normalizedValue, storageUserId ?? userId);
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
            updateLocalValue(readLocalDeletedStyleIds(), null);
            remoteSyncEnabledRef.current = false;
            setUserId(null);
            setError(null);
            setSyncState("ready");
            return;
          }

          if (!sessionUserId) {
            if (!active) return;
            updateLocalValue(readLocalDeletedStyleIds(), null);
            setUserId(null);
            setError(null);
            setSyncState("ready");
            return;
          }
          if (!active) return;
          setUserId(sessionUserId);
          const localValue = readLocalDeletedStyleIds(sessionUserId);
          updateLocalValue(localValue, sessionUserId);

          const { data: storedPreference, error: preferenceError } = await supabaseQueryClient
            .from("user_preferences")
            .select("ai_studio_deleted_style_ids")
            .eq("user_id", sessionUserId)
            .maybeSingle();
          if (preferenceError) throw preferenceError;
          if (!active) return;

          const remoteValue = normalizeDeletedStyleIds(
            storedPreference?.ai_studio_deleted_style_ids
          );
          const mergedValue = normalizeDeletedStyleIds([...remoteValue, ...localValue]);
          if (!hasLocalOverrideRef.current) {
            updateLocalValue(mergedValue, sessionUserId);
          }

          if (!active) return;
          setError(null);
          setSyncState("ready");
        } catch (err) {
          if (!active) return;
          if (isMissingDeletedStyleStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return;
          }
          setError(err instanceof Error ? err.message : "Unable to load styles library.");
          setSyncState("error");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [sessionSnapshot.initialized, sessionUserId, updateLocalValue]);

    const deleteStyleId = useCallback(
      async (styleId: string): Promise<boolean> => {
        const normalizedStyleId = styleId.trim();
        if (!normalizedStyleId) return false;
        const requestVersion = writeVersionRef.current + 1;
        writeVersionRef.current = requestVersion;
        hasLocalOverrideRef.current = true;

        const previousValue = latestValueRef.current;
        const nextValue = normalizeDeletedStyleIds([...previousValue, normalizedStyleId]);
        if (nextValue.length === previousValue.length) return true;

        updateLocalValue(nextValue, userId);
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
              { user_id: userId, ai_studio_deleted_style_ids: nextValue },
              { onConflict: "user_id" }
            );
          if (upsertError) throw upsertError;
          if (requestVersion !== writeVersionRef.current) return true;
          setError(null);
          setSyncState("ready");
          return true;
        } catch (err) {
          if (requestVersion !== writeVersionRef.current) return true;
          if (isMissingDeletedStyleStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return true;
          }
          updateLocalValue(previousValue, userId);
          setError(err instanceof Error ? err.message : "Unable to delete style.");
          setSyncState("error");
          return false;
        }
      },
      [updateLocalValue, userId]
    );

    return {
      deletedStyleIds,
      loading,
      error,
      syncState,
      deleteStyleId,
    };
  };
