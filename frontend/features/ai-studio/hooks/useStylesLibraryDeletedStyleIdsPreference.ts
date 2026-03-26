/**
 * Hook for storing per-user deleted style IDs for the AI Studio styles library.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_deleted_style_ids`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { readSupabaseUserId, supabaseQueryClient } from "../../../lib/supabaseClient";

const DELETED_STYLE_IDS_STORAGE_KEY = "shortpulse.ai_studio.deleted_style_ids";

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

const areStringArraysEqual = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const readLocalDeletedStyleIds = (): string[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(DELETED_STYLE_IDS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return normalizeDeletedStyleIds(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
};

const writeLocalDeletedStyleIds = (value: string[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_STYLE_IDS_STORAGE_KEY, JSON.stringify(value));
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
    const [deletedStyleIds, setDeletedStyleIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<StylesLibraryDeleteSyncState>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const latestValueRef = useRef<string[]>([]);
    const writeVersionRef = useRef(0);
    const remoteSyncEnabledRef = useRef(true);
    const hasLocalOverrideRef = useRef(false);

    const updateLocalValue = useCallback((value: string[]) => {
      const normalizedValue = normalizeDeletedStyleIds(value);
      latestValueRef.current = normalizedValue;
      setDeletedStyleIds(normalizedValue);
      writeLocalDeletedStyleIds(normalizedValue);
    }, []);

    useEffect(() => {
      let active = true;
      setLoading(true);
      setSyncState("loading");

      (async () => {
        updateLocalValue(readLocalDeletedStyleIds());
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
            .select("ai_studio_deleted_style_ids")
            .eq("user_id", id)
            .maybeSingle();
          if (preferenceError) throw preferenceError;
          if (!active) return;

          const remoteValue = normalizeDeletedStyleIds(
            storedPreference?.ai_studio_deleted_style_ids
          );
          const mergedValue = normalizeDeletedStyleIds([...remoteValue, ...latestValueRef.current]);
          if (!hasLocalOverrideRef.current) {
            updateLocalValue(mergedValue);
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
    }, [updateLocalValue]);

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

        updateLocalValue(nextValue);
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
          updateLocalValue(previousValue);
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
