/**
 * Hook for storing per-user custom Pulse records and Create Pulse rail selection in Supabase.
 * Keeps local values while synchronizing per-user Pulse preferences when remote columns exist.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS,
  type CreatePulseBuiltInPresetDefinition,
  normalizeCreatePulsePanelPresetIds,
  normalizeCreatePulseSavedPresets,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "../components/create/createPulsePresets";

const CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.create_pulse_preset_panel_ids";
const CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.saved_pulses";

export type CreatePulsePresetPanelSyncState = "loading" | "ready" | "saving" | "error";

type CreatePulsePresetPreferenceValue = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
};

export type UseCreatePulsePresetPanelPreferenceResult = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
  loading: boolean;
  error: string | null;
  syncState: CreatePulsePresetPanelSyncState;
  setPresetPanelIds: (presetIds: readonly CreatePulsePresetId[]) => Promise<boolean>;
  setSavedPresets: (presets: readonly CreatePulseSavedPreset[]) => Promise<boolean>;
};

type UseCreatePulsePresetPanelPreferenceOptions = {
  enabled?: boolean;
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null;
};

const DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE: CreatePulsePresetPreferenceValue = {
  presetPanelIds: normalizeCreatePulsePanelPresetIds(CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS),
  savedPresets: [],
};

const normalizeLocalPreferenceStorageUserId = (userId?: string | null): string | null => {
  if (typeof userId !== "string") return null;
  const normalized = userId.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildCreatePulsePresetPanelIdsStorageKey = (userId?: string | null): string => {
  const normalizedUserId = normalizeLocalPreferenceStorageUserId(userId);
  return normalizedUserId
    ? `${CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY}:${normalizedUserId}`
    : CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY;
};

const buildCreatePulseSavedPresetsStorageKey = (userId?: string | null): string => {
  const normalizedUserId = normalizeLocalPreferenceStorageUserId(userId);
  return normalizedUserId
    ? `${CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY}:${normalizedUserId}`
    : CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY;
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

const normalizeCreatePulsePresetPreferenceValue = (
  value: {
    presetPanelIds?: unknown;
    savedPresets?: unknown;
  },
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetPreferenceValue => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(
    value.savedPresets,
    builtInDefinitions
  );
  const presetPanelIds = Array.isArray(value.presetPanelIds)
    ? normalizeCreatePulsePanelPresetIds(
        value.presetPanelIds.filter((entry): entry is string => typeof entry === "string"),
        normalizedSavedPresets,
        builtInDefinitions
      )
    : DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE.presetPanelIds;
  return {
    presetPanelIds,
    savedPresets: normalizedSavedPresets,
  };
};

const readLocalCreatePulsePresetPreferenceValue = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null,
  userId?: string | null
): CreatePulsePresetPreferenceValue => {
  if (typeof window === "undefined") return DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE;
  const storedPresetPanelIds = window.localStorage.getItem(
    buildCreatePulsePresetPanelIdsStorageKey(userId)
  );
  const storedSavedPresets = window.localStorage.getItem(
    buildCreatePulseSavedPresetsStorageKey(userId)
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

  return normalizeCreatePulsePresetPreferenceValue(
    {
      presetPanelIds: parsedPresetPanelIds ?? undefined,
      savedPresets: parsedSavedPresets ?? undefined,
    },
    builtInDefinitions
  );
};

const writeLocalCreatePulsePresetPreferenceValue = (
  value: CreatePulsePresetPreferenceValue,
  userId?: string | null
): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizeCreatePulsePresetPreferenceValue(value);
  window.localStorage.setItem(
    buildCreatePulsePresetPanelIdsStorageKey(userId),
    JSON.stringify(normalizedValue.presetPanelIds)
  );
  window.localStorage.setItem(
    buildCreatePulseSavedPresetsStorageKey(userId),
    JSON.stringify(normalizedValue.savedPresets)
  );
};

/**
 * Reads and writes shared Pulse preferences with local fallback.
 */
export const useCreatePulsePresetPanelPreference = ({
  enabled = true,
  builtInDefinitions = null,
}: UseCreatePulsePresetPanelPreferenceOptions = {}): UseCreatePulsePresetPanelPreferenceResult => {
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

  const updatePreferenceValue = useCallback(
    (nextValue: CreatePulsePresetPreferenceValue, storageUserId?: string | null) => {
      const normalizedValue = normalizeCreatePulsePresetPreferenceValue(
        nextValue,
        builtInDefinitions
      );
      latestValueRef.current = normalizedValue;
      setPreferenceValue(normalizedValue);
      writeLocalCreatePulsePresetPreferenceValue(normalizedValue, storageUserId ?? userId);
    },
    [builtInDefinitions, userId]
  );

  useEffect(() => {
    let active = true;
    if (!enabled) {
      remoteSyncEnabledRef.current = true;
      hasLocalOverrideRef.current = false;
      latestValueRef.current = DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE;
      setPreferenceValue(DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_VALUE);
      setLoading(false);
      setError(null);
      setSyncState("ready");
      setUserId(null);
      return () => {
        active = false;
      };
    }
    remoteSyncEnabledRef.current = true;
    hasLocalOverrideRef.current = false;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      try {
        const supabase = ensureSupabaseQueryClient();
        const id = await readSupabaseUserId();
        if (!id) {
          if (!active) return;
          setUserId(null);
          updatePreferenceValue(readLocalCreatePulsePresetPreferenceValue(builtInDefinitions));
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        setUserId(id);
        updatePreferenceValue(
          readLocalCreatePulsePresetPreferenceValue(builtInDefinitions, id),
          id
        );

        const { data: storedPreference, error: preferenceError } = await supabase
          .from("user_preferences")
          .select("ai_studio_create_pulse_panel_ids, ai_studio_saved_pulses")
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const nextValue = normalizeCreatePulsePresetPreferenceValue(
          {
            presetPanelIds: storedPreference?.ai_studio_create_pulse_panel_ids,
            savedPresets: storedPreference?.ai_studio_saved_pulses,
          },
          builtInDefinitions
        );
        const hasRemotePulsePreference =
          storedPreference != null &&
          (storedPreference.ai_studio_create_pulse_panel_ids != null ||
            storedPreference.ai_studio_saved_pulses != null);

        if (!hasLocalOverrideRef.current && hasRemotePulsePreference) {
          updatePreferenceValue(nextValue, id);
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
  }, [builtInDefinitions, enabled, updatePreferenceValue]);

  const persistPreference = useCallback(
    async (nextValue: CreatePulsePresetPreferenceValue) => {
      if (!enabled) return false;
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const normalizedNextValue = normalizeCreatePulsePresetPreferenceValue(
        nextValue,
        builtInDefinitions
      );
      const previousValue = latestValueRef.current;
      updatePreferenceValue(normalizedNextValue);
      setSyncState("saving");
      setError(null);

      if (!userId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return true;
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
        if (requestVersion !== writeVersionRef.current) return true;
        setSyncState("ready");
        return true;
      } catch (err) {
        if (requestVersion !== writeVersionRef.current) return false;
        updatePreferenceValue(previousValue);
        setError(err instanceof Error ? err.message : "Unable to save Pulse presets.");
        setSyncState("error");
        return false;
      }
    },
    [builtInDefinitions, enabled, updatePreferenceValue, userId]
  );

  const setPresetPanelIds = useCallback(
    (presetIds: readonly CreatePulsePresetId[]) => {
      return persistPreference({
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
      const normalizedSavedPresets = normalizeCreatePulseSavedPresets(presets, builtInDefinitions);
      return persistPreference({
        presetPanelIds: normalizeCreatePulsePanelPresetIds(
          latestValueRef.current.presetPanelIds,
          normalizedSavedPresets,
          builtInDefinitions
        ),
        savedPresets: normalizedSavedPresets,
      });
    },
    [builtInDefinitions, persistPreference]
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
