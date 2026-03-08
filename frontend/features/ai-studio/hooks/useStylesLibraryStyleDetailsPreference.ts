/**
 * Hook for storing per-user style-details overrides for the AI Studio styles library.
 * Keeps a local fallback while synchronizing with `user_preferences.ai_studio_style_details_overrides`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseClient } from "../../../lib/supabaseClient";
import type { StylesLibraryStyleDetails, StylesLibraryStyleDetailsMap } from "../types";

const STYLE_DETAILS_STORAGE_KEY = "shortpulse.ai_studio.style_details_overrides";

export type StylesLibraryStyleDetailsSyncState = "loading" | "ready" | "saving" | "error";

type UseStylesLibraryStyleDetailsPreferenceResult = {
  styleDetailsById: StylesLibraryStyleDetailsMap;
  loading: boolean;
  error: string | null;
  syncState: StylesLibraryStyleDetailsSyncState;
  upsertStyleDetails: (styleId: string, details: StylesLibraryStyleDetails) => Promise<boolean>;
};

const MAX_STYLE_FIELD_LENGTH = 120;
const MAX_STYLE_PROMPT_LENGTH = 4000;

const clampString = (value: unknown, limit: number): string => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim();
};

const normalizeStyleDetails = (value: unknown): StylesLibraryStyleDetails => {
  const details = value as Partial<StylesLibraryStyleDetails> | null | undefined;
  return {
    style: clampString(details?.style, MAX_STYLE_FIELD_LENGTH),
    title: clampString(details?.title, MAX_STYLE_FIELD_LENGTH),
    referenceImageName: clampString(details?.referenceImageName, MAX_STYLE_FIELD_LENGTH),
    stylePrompt: clampString(details?.stylePrompt, MAX_STYLE_PROMPT_LENGTH),
  };
};

const normalizeStyleDetailsMap = (value: unknown): StylesLibraryStyleDetailsMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: StylesLibraryStyleDetailsMap = {};
  entries.forEach(([rawId, rawDetails]) => {
    const styleId = rawId.trim();
    if (!styleId) return;
    normalized[styleId] = normalizeStyleDetails(rawDetails);
  });
  return normalized;
};

const areStyleDetailMapsEqual = (
  left: StylesLibraryStyleDetailsMap,
  right: StylesLibraryStyleDetailsMap
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = leftKeys[index];
    const leftValue = left[key];
    const rightValue = right[key];
    if (!rightValue) return false;
    if (
      leftValue.style !== rightValue.style ||
      leftValue.title !== rightValue.title ||
      leftValue.referenceImageName !== rightValue.referenceImageName ||
      leftValue.stylePrompt !== rightValue.stylePrompt
    ) {
      return false;
    }
  }
  return true;
};

const mergeStyleDetailsMaps = (
  remoteValue: StylesLibraryStyleDetailsMap,
  localValue: StylesLibraryStyleDetailsMap
): StylesLibraryStyleDetailsMap => {
  return {
    ...remoteValue,
    ...localValue,
  };
};

const readLocalStyleDetails = (): StylesLibraryStyleDetailsMap => {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(STYLE_DETAILS_STORAGE_KEY);
  if (!stored) return {};
  try {
    return normalizeStyleDetailsMap(JSON.parse(stored) as unknown);
  } catch {
    return {};
  }
};

const writeLocalStyleDetails = (value: StylesLibraryStyleDetailsMap): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STYLE_DETAILS_STORAGE_KEY, JSON.stringify(value));
};

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
    const [styleDetailsById, setStyleDetailsById] = useState<StylesLibraryStyleDetailsMap>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<StylesLibraryStyleDetailsSyncState>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const latestValueRef = useRef<StylesLibraryStyleDetailsMap>({});
    const writeVersionRef = useRef(0);
    const remoteSyncEnabledRef = useRef(true);
    const hasLocalOverrideRef = useRef(false);

    const updateLocalValue = useCallback((value: StylesLibraryStyleDetailsMap) => {
      const normalizedValue = normalizeStyleDetailsMap(value);
      latestValueRef.current = normalizedValue;
      setStyleDetailsById(normalizedValue);
      writeLocalStyleDetails(normalizedValue);
    }, []);

    useEffect(() => {
      let active = true;
      setLoading(true);
      setSyncState("loading");

      (async () => {
        updateLocalValue(readLocalStyleDetails());
        try {
          if (!supabaseClient) {
            if (!active) return;
            remoteSyncEnabledRef.current = false;
            setUserId(null);
            setError(null);
            setSyncState("ready");
            return;
          }

          const { data, error: sessionError } = await supabaseClient.auth.getSession();
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

          const { data: storedPreference, error: preferenceError } = await supabaseClient
            .from("user_preferences")
            .select("ai_studio_style_details_overrides")
            .eq("user_id", id)
            .maybeSingle();
          if (preferenceError) throw preferenceError;
          if (!active) return;

          const remoteValue = normalizeStyleDetailsMap(
            storedPreference?.ai_studio_style_details_overrides
          );
          const mergedValue = mergeStyleDetailsMaps(remoteValue, latestValueRef.current);
          if (!hasLocalOverrideRef.current) {
            updateLocalValue(mergedValue);
          }

          if (
            !storedPreference ||
            !storedPreference.ai_studio_style_details_overrides ||
            !areStyleDetailMapsEqual(remoteValue, mergedValue)
          ) {
            const { error: upsertError } = await supabaseClient
              .from("user_preferences")
              .upsert(
                { user_id: id, ai_studio_style_details_overrides: mergedValue },
                { onConflict: "user_id" }
              );
            if (upsertError) throw upsertError;
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
    }, [updateLocalValue]);

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

        if (!userId || !remoteSyncEnabledRef.current || !supabaseClient) {
          if (requestVersion === writeVersionRef.current) {
            setSyncState("ready");
          }
          return true;
        }

        try {
          const { error: upsertError } = await supabaseClient
            .from("user_preferences")
            .upsert(
              { user_id: userId, ai_studio_style_details_overrides: nextValue },
              { onConflict: "user_id" }
            );
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
          updateLocalValue(previousValue);
          setError(err instanceof Error ? err.message : "Unable to save style details.");
          setSyncState("error");
          return false;
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
    };
  };
