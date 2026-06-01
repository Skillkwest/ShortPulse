/**
 * Hook for storing per-user style-details overrides for the AI Studio styles library.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_style_details_overrides`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseQueryClient } from "../../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { buildUserScopedStorageKey } from "../../character-manager/logic/userScopedLocalStorage";
import type { StylesLibraryStyleDetails, StylesLibraryStyleDetailsMap } from "../types";
import {
  areStyleDetailMapsEqual,
  mergeStyleDetailsMaps,
  normalizeStyleDetails,
  normalizeStyleDetailsMap,
} from "../logic/styleDetailsNormalization";

const STYLE_DETAILS_STORAGE_KEY = "shortpulse.ai_studio.style_details_overrides";
const buildStyleDetailsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(STYLE_DETAILS_STORAGE_KEY, userId);
const STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MS = 4_000;
const STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_CODE = "STYLE_DETAILS_REMOTE_SYNC_TIMEOUT";
const STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MESSAGE =
  "Saved locally. Cloud sync timed out; retry later if this style must sync across devices.";
const STYLE_DETAILS_REMOTE_SYNC_FAILED_MESSAGE =
  "Saved locally. Cloud sync failed; retry later if this style must sync across devices.";

export type StylesLibraryStyleDetailsSyncState = "loading" | "ready" | "saving" | "error";

type UseStylesLibraryStyleDetailsPreferenceResult = {
  styleDetailsById: StylesLibraryStyleDetailsMap;
  loading: boolean;
  error: string | null;
  syncState: StylesLibraryStyleDetailsSyncState;
  upsertStyleDetails: (styleId: string, details: StylesLibraryStyleDetails) => Promise<boolean>;
  deleteStyleDetails: (styleId: string) => Promise<boolean>;
};

type StyleDetailsRemoteSyncTimeoutError = Error & {
  code: typeof STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_CODE;
  timeoutMs: number;
};

const readLocalStyleDetails = (userId?: string | null): StylesLibraryStyleDetailsMap => {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(buildStyleDetailsStorageKey(userId));
  if (!stored) return {};
  try {
    return normalizeStyleDetailsMap(JSON.parse(stored) as unknown);
  } catch {
    return {};
  }
};

const writeLocalStyleDetails = (
  value: StylesLibraryStyleDetailsMap,
  userId?: string | null
): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildStyleDetailsStorageKey(userId), JSON.stringify(value));
};

const createStyleDetailsRemoteSyncTimeoutError = (
  timeoutMs: number
): StyleDetailsRemoteSyncTimeoutError => {
  const error = new Error(
    `Timed out syncing style details after ${Math.max(0, Math.trunc(timeoutMs))}ms.`
  ) as StyleDetailsRemoteSyncTimeoutError;
  error.code = STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_CODE;
  error.timeoutMs = Math.max(0, Math.trunc(timeoutMs));
  return error;
};

const isStyleDetailsRemoteSyncTimeoutError = (
  error: unknown
): error is StyleDetailsRemoteSyncTimeoutError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_CODE;
};

const withRemoteSyncTimeout = async <T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(createStyleDetailsRemoteSyncTimeoutError(timeoutMs));
    }, timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });

const isMissingStyleDetailsStorageError = (error: unknown): boolean => {
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
    maybeError.message.includes("ai_studio_style_details_overrides")
  );
};

/**
 * Reads and writes style-details overrides with Supabase persistence when available.
 */
export const useStylesLibraryStyleDetailsPreference =
  (): UseStylesLibraryStyleDetailsPreferenceResult => {
    const sessionSnapshot = useResolvedProtectedSessionState();
    const sessionUserId = sessionSnapshot.user?.id ?? null;
    const [styleDetailsById, setStyleDetailsById] = useState<StylesLibraryStyleDetailsMap>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<StylesLibraryStyleDetailsSyncState>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const latestValueRef = useRef<StylesLibraryStyleDetailsMap>({});
    const writeVersionRef = useRef(0);
    const remoteSyncEnabledRef = useRef(true);
    const hasLocalOverrideRef = useRef(false);

    const updateLocalValue = useCallback(
      (value: StylesLibraryStyleDetailsMap, storageUserId?: string | null) => {
        const normalizedValue = normalizeStyleDetailsMap(value);
        latestValueRef.current = normalizedValue;
        setStyleDetailsById(normalizedValue);
        writeLocalStyleDetails(normalizedValue, storageUserId ?? userId);
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
            updateLocalValue(readLocalStyleDetails(), null);
            remoteSyncEnabledRef.current = false;
            setUserId(null);
            setError(null);
            setSyncState("ready");
            return;
          }

          if (!sessionUserId) {
            if (!active) return;
            updateLocalValue(readLocalStyleDetails(), null);
            setUserId(null);
            setError(null);
            setSyncState("ready");
            return;
          }
          if (!active) return;
          setUserId(sessionUserId);
          const localValue = readLocalStyleDetails(sessionUserId);
          updateLocalValue(localValue, sessionUserId);

          const { data: storedPreference, error: preferenceError } = await supabaseQueryClient
            .from("user_preferences")
            .select("ai_studio_style_details_overrides")
            .eq("user_id", sessionUserId)
            .maybeSingle();
          if (preferenceError) throw preferenceError;
          if (!active) return;

          const remoteValue = normalizeStyleDetailsMap(
            storedPreference?.ai_studio_style_details_overrides
          );
          const mergedValue = mergeStyleDetailsMaps(remoteValue, localValue);
          if (!hasLocalOverrideRef.current) {
            updateLocalValue(mergedValue, sessionUserId);
          }

          if (!active) return;
          setError(null);
          setSyncState("ready");
        } catch (err) {
          if (!active) return;
          if (isMissingStyleDetailsStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return;
          }
          setError(err instanceof Error ? err.message : "Unable to load style details.");
          setSyncState("error");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [sessionSnapshot.initialized, sessionUserId, updateLocalValue]);

    const upsertStyleDetails = useCallback(
      async (styleId: string, details: StylesLibraryStyleDetails): Promise<boolean> => {
        const normalizedStyleId = styleId.trim();
        if (!normalizedStyleId) return false;
        const requestVersion = writeVersionRef.current + 1;
        writeVersionRef.current = requestVersion;
        hasLocalOverrideRef.current = true;

        const normalizedDetails = normalizeStyleDetails(details);
        const previousValue = latestValueRef.current;
        const nextValue: StylesLibraryStyleDetailsMap = {
          ...previousValue,
          [normalizedStyleId]: normalizedDetails,
        };

        if (areStyleDetailMapsEqual(previousValue, nextValue)) return true;

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
          const upsertResult = await withRemoteSyncTimeout<{ error: unknown }>(
            supabaseQueryClient
              .from("user_preferences")
              .upsert(
                { user_id: userId, ai_studio_style_details_overrides: nextValue },
                { onConflict: "user_id" }
              ),
            STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MS
          );
          const upsertError = upsertResult.error;
          if (upsertError) throw upsertError;
          if (requestVersion !== writeVersionRef.current) return true;
          setError(null);
          setSyncState("ready");
          return true;
        } catch (err) {
          if (requestVersion !== writeVersionRef.current) return true;
          if (isMissingStyleDetailsStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return true;
          }
          setError(
            isStyleDetailsRemoteSyncTimeoutError(err)
              ? STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MESSAGE
              : STYLE_DETAILS_REMOTE_SYNC_FAILED_MESSAGE
          );
          setSyncState("error");
          return true;
        }
      },
      [updateLocalValue, userId]
    );

    const deleteStyleDetails = useCallback(
      async (styleId: string): Promise<boolean> => {
        const normalizedStyleId = styleId.trim();
        if (!normalizedStyleId) return false;
        const requestVersion = writeVersionRef.current + 1;
        writeVersionRef.current = requestVersion;
        hasLocalOverrideRef.current = true;

        const previousValue = latestValueRef.current;
        if (!(normalizedStyleId in previousValue)) return true;
        const nextValue = { ...previousValue };
        delete nextValue[normalizedStyleId];

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
          const upsertResult = await withRemoteSyncTimeout<{ error: unknown }>(
            supabaseQueryClient
              .from("user_preferences")
              .upsert(
                { user_id: userId, ai_studio_style_details_overrides: nextValue },
                { onConflict: "user_id" }
              ),
            STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MS
          );
          const upsertError = upsertResult.error;
          if (upsertError) throw upsertError;
          if (requestVersion !== writeVersionRef.current) return true;
          setError(null);
          setSyncState("ready");
          return true;
        } catch (err) {
          if (requestVersion !== writeVersionRef.current) return true;
          if (isMissingStyleDetailsStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return true;
          }
          setError(
            isStyleDetailsRemoteSyncTimeoutError(err)
              ? STYLE_DETAILS_REMOTE_SYNC_TIMEOUT_MESSAGE
              : STYLE_DETAILS_REMOTE_SYNC_FAILED_MESSAGE
          );
          setSyncState("error");
          return true;
        }
      },
      [updateLocalValue, userId]
    );

    return {
      styleDetailsById,
      loading,
      error,
      syncState,
      upsertStyleDetails,
      deleteStyleDetails,
    };
  };
