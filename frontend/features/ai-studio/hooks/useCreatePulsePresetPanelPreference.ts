/**
 * Hook for storing shared Pulse definitions and Create Pulse rail selection in Supabase.
 * Keeps local fallback values while synchronizing per-user Pulse preferences when remote columns exist.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS,
  createPulseSavedPresetsFromLegacyOverrides,
  normalizeCreatePulsePanelPresetIds,
  normalizeCreatePulseSavedPresets,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "../components/create/createPulsePresets";

const CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.create_pulse_preset_panel_ids";
const CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.saved_pulses";
const LEGACY_CREATE_PULSE_CUSTOM_PRESETS_STORAGE_KEY =
  "shortpulse.ai_studio.create_pulse_custom_presets";

export type CreatePulsePresetPanelSyncState = "loading" | "ready" | "saving" | "error";

type CreatePulsePresetPreferenceValue = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
};

type UseCreatePulsePresetPanelPreferenceResult = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
  loading: boolean;
  error: string | null;
  syncState: CreatePulsePresetPanelSyncState;
  setPresetPanelIds: (presetIds: readonly CreatePulsePresetId[]) => void;
  setSavedPresets: (presets: readonly CreatePulseSavedPreset[]) => void;
};

const DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE: CreatePulsePresetPreferenceValue = {
  presetPanelIds: normalizeCreatePulsePanelPresetIds(CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS),
  savedPresets: [],
};

const isMissingCreatePulsePreferenceStorageError = (error: unknown): boolean => {
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
    maybeError.message.includes("ai_studio_create_pulse_panel_ids") ||
    maybeError.message.includes("ai_studio_saved_pulses")
  );
};

const normalizeCreatePulsePresetPreferenceValue = (value: {
  presetPanelIds?: unknown;
  savedPresets?: unknown;
  legacyCustomPresetOverrides?: unknown;
}): CreatePulsePresetPreferenceValue => {
  const normalizedSavedPresetsFromRemote = normalizeCreatePulseSavedPresets(value.savedPresets);
  const normalizedSavedPresets =
    normalizedSavedPresetsFromRemote.length > 0
      ? normalizedSavedPresetsFromRemote
      : createPulseSavedPresetsFromLegacyOverrides(value.legacyCustomPresetOverrides);
  const presetPanelIds = Array.isArray(value.presetPanelIds)
    ? normalizeCreatePulsePanelPresetIds(
        value.presetPanelIds.filter((entry): entry is string => typeof entry === "string"),
        normalizedSavedPresets
      )
    : DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE.presetPanelIds;
  return {
    presetPanelIds,
    savedPresets: normalizedSavedPresets,
  };
};

const readLocalCreatePulsePresetPreferenceValue = (): CreatePulsePresetPreferenceValue => {
  if (typeof window === "undefined") return DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE;
  const storedPresetPanelIds = window.localStorage.getItem(
    CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY
  );
  const storedSavedPresets = window.localStorage.getItem(CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY);
  const legacyStoredCustomPresetOverrides = window.localStorage.getItem(
    LEGACY_CREATE_PULSE_CUSTOM_PRESETS_STORAGE_KEY
  );

  const parsedPresetPanelIds = (() => {
    if (!storedPresetPanelIds) return null;
    try {
      return JSON.parse(storedPresetPanelIds) as unknown;
    } catch {
      return null;
    }
  })();

  const parsedSavedPresets = (() => {
    if (!storedSavedPresets) return null;
    try {
      return JSON.parse(storedSavedPresets) as unknown;
    } catch {
      return null;
    }
  })();

  const parsedLegacyCustomPresetOverrides = (() => {
    if (!legacyStoredCustomPresetOverrides) return null;
    try {
      return JSON.parse(legacyStoredCustomPresetOverrides) as unknown;
    } catch {
      return null;
    }
  })();

  return normalizeCreatePulsePresetPreferenceValue({
    presetPanelIds: parsedPresetPanelIds ?? undefined,
    savedPresets: parsedSavedPresets ?? undefined,
    legacyCustomPresetOverrides: parsedLegacyCustomPresetOverrides ?? undefined,
  });
};

const writeLocalCreatePulsePresetPreferenceValue = (
  value: CreatePulsePresetPreferenceValue
): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizeCreatePulsePresetPreferenceValue(value);
  window.localStorage.setItem(
    CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY,
    JSON.stringify(normalizedValue.presetPanelIds)
  );
  window.localStorage.setItem(
    CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY,
    JSON.stringify(normalizedValue.savedPresets)
  );
};

/**
 * Reads and writes shared Pulse preferences with local fallback.
 */
export const useCreatePulsePresetPanelPreference =
  (): UseCreatePulsePresetPanelPreferenceResult => {
    const [preferenceValue, setPreferenceValue] = useState<CreatePulsePresetPreferenceValue>(
      DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE
    );
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<CreatePulsePresetPanelSyncState>("loading");
    const [userId, setUserId] = useState<string | null>(null);
    const latestValueRef = useRef<CreatePulsePresetPreferenceValue>(
      DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE
    );
    const remoteSyncEnabledRef = useRef<boolean>(true);
    const writeVersionRef = useRef<number>(0);
    const hasLocalOverrideRef = useRef<boolean>(false);

    const updatePreferenceValue = useCallback((nextValue: CreatePulsePresetPreferenceValue) => {
      const normalizedValue = normalizeCreatePulsePresetPreferenceValue(nextValue);
      latestValueRef.current = normalizedValue;
      setPreferenceValue(normalizedValue);
      writeLocalCreatePulsePresetPreferenceValue(normalizedValue);
    }, []);

    useEffect(() => {
      let active = true;
      setLoading(true);
      setSyncState("loading");

      (async () => {
        updatePreferenceValue(readLocalCreatePulsePresetPreferenceValue());
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
            .select("ai_studio_create_pulse_panel_ids, ai_studio_saved_pulses")
            .eq("user_id", id)
            .maybeSingle();
          if (preferenceError) throw preferenceError;
          if (!active) return;

          const nextValue = normalizeCreatePulsePresetPreferenceValue({
            presetPanelIds: storedPreference?.ai_studio_create_pulse_panel_ids,
            savedPresets: storedPreference?.ai_studio_saved_pulses,
            legacyCustomPresetOverrides: undefined,
          });
          const hasRemotePulsePreference =
            storedPreference != null &&
            (storedPreference.ai_studio_create_pulse_panel_ids != null ||
              storedPreference.ai_studio_saved_pulses != null);

          if (!hasLocalOverrideRef.current && hasRemotePulsePreference) {
            updatePreferenceValue(nextValue);
          }

          if (!active) return;
          setError(null);
          setSyncState("ready");
        } catch (err) {
          if (!active) return;
          if (isMissingCreatePulsePreferenceStorageError(err)) {
            remoteSyncEnabledRef.current = false;
            setError(null);
            setSyncState("ready");
            return;
          }
          setError(err instanceof Error ? err.message : "Unable to load Pulse presets.");
          setSyncState("error");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [updatePreferenceValue]);

    const persistPreference = useCallback(
      async (nextValue: CreatePulsePresetPreferenceValue) => {
        const requestVersion = writeVersionRef.current + 1;
        writeVersionRef.current = requestVersion;
        hasLocalOverrideRef.current = true;

        const normalizedNextValue = normalizeCreatePulsePresetPreferenceValue(nextValue);
        const previousValue = latestValueRef.current;
        updatePreferenceValue(normalizedNextValue);
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
          const { error: upsertError } = await supabase.from("user_preferences").upsert(
            {
              user_id: userId,
              ai_studio_create_pulse_panel_ids: normalizedNextValue.presetPanelIds,
              ai_studio_saved_pulses: normalizedNextValue.savedPresets,
            },
            { onConflict: "user_id" }
          );
          if (upsertError) throw upsertError;
          if (requestVersion !== writeVersionRef.current) return;
          setSyncState("ready");
        } catch (err) {
          if (requestVersion !== writeVersionRef.current) return;
          updatePreferenceValue(previousValue);
          setError(err instanceof Error ? err.message : "Unable to save Pulse presets.");
          setSyncState("error");
        }
      },
      [updatePreferenceValue, userId]
    );

    const setPresetPanelIds = useCallback(
      (presetIds: readonly CreatePulsePresetId[]) => {
        void persistPreference({
          ...latestValueRef.current,
          presetPanelIds: normalizeCreatePulsePanelPresetIds(
            presetIds,
            latestValueRef.current.savedPresets
          ),
        });
      },
      [persistPreference]
    );

    const setSavedPresets = useCallback(
      (presets: readonly CreatePulseSavedPreset[]) => {
        const normalizedSavedPresets = normalizeCreatePulseSavedPresets(presets);
        void persistPreference({
          presetPanelIds: normalizeCreatePulsePanelPresetIds(
            latestValueRef.current.presetPanelIds,
            normalizedSavedPresets
          ),
          savedPresets: normalizedSavedPresets,
        });
      },
      [persistPreference]
    );

    return {
      presetPanelIds: preferenceValue.presetPanelIds,
      savedPresets: preferenceValue.savedPresets,
      loading,
      error,
      syncState,
      setPresetPanelIds,
      setSavedPresets,
    };
  };
