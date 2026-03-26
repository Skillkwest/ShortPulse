/**
 * Hook for storing Expert Edit preset panel selection and custom preset overrides in Supabase.
 * Keeps local fallback values while synchronizing per-user preferences when remote columns exist.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  mapLegacyPresetLabelsToIds,
  normalizeExpertEditCustomPresetOverrides,
  normalizePresetPanelPresetIds,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditPresetId,
} from "../components/edit/expertEditPresets";

const EXPERT_EDIT_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.expert_edit_preset_panel_ids";
const EXPERT_EDIT_CUSTOM_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.expert_edit_custom_presets";
const LEGACY_EXPERT_EDIT_PRESET_PANEL_LABELS_STORAGE_KEY =
  "shortpulse.ai_studio.expert_edit_preset_panel_labels";

export type ExpertEditPresetPanelSyncState = "loading" | "ready" | "saving" | "error";

type ExpertEditPresetPreferenceValue = {
  presetPanelIds: ExpertEditPresetId[];
  customPresetOverrides: ExpertEditCustomPresetOverrides;
};

type UseExpertEditPresetPanelPreferenceResult = {
  presetPanelIds: ExpertEditPresetId[];
  customPresetOverrides: ExpertEditCustomPresetOverrides;
  loading: boolean;
  error: string | null;
  syncState: ExpertEditPresetPanelSyncState;
  setPresetPanelIds: (presetIds: readonly ExpertEditPresetId[]) => void;
  setCustomPresetOverrides: (overrides: ExpertEditCustomPresetOverrides) => void;
};

const DEFAULT_PRESET_PREFERENCE_VALUE: ExpertEditPresetPreferenceValue = {
  presetPanelIds: normalizePresetPanelPresetIds(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS),
  customPresetOverrides: {},
};

const isMissingPresetPreferenceStorageError = (error: unknown): boolean => {
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
    maybeError.message.includes("expert_edit_preset_panel_ids") ||
    maybeError.message.includes("expert_edit_custom_presets") ||
    maybeError.message.includes("expert_edit_preset_panel_labels")
  );
};

const normalizePresetPreferenceValue = (value: {
  presetPanelIds?: unknown;
  customPresetOverrides?: unknown;
  legacyPanelLabels?: unknown;
}): ExpertEditPresetPreferenceValue => {
  const customPresetOverrides = normalizeExpertEditCustomPresetOverrides(
    value.customPresetOverrides
  );
  const panelIdsFromNew = Array.isArray(value.presetPanelIds)
    ? normalizePresetPanelPresetIds(
        value.presetPanelIds.filter((entry): entry is string => typeof entry === "string"),
        customPresetOverrides
      ).slice(0, EDIT_PRESET_PANEL_MAX)
    : null;
  const panelIdsFromLegacyLabels = Array.isArray(value.legacyPanelLabels)
    ? mapLegacyPresetLabelsToIds(
        value.legacyPanelLabels.filter((entry): entry is string => typeof entry === "string"),
        customPresetOverrides
      ).slice(0, EDIT_PRESET_PANEL_MAX)
    : null;
  const presetPanelIds =
    panelIdsFromNew ?? panelIdsFromLegacyLabels ?? DEFAULT_PRESET_PREFERENCE_VALUE.presetPanelIds;
  return {
    presetPanelIds,
    customPresetOverrides,
  };
};

const readLocalPresetPreferenceValue = (): ExpertEditPresetPreferenceValue => {
  if (typeof window === "undefined") return DEFAULT_PRESET_PREFERENCE_VALUE;
  const storedPresetPanelIds = window.localStorage.getItem(
    EXPERT_EDIT_PRESET_PANEL_IDS_STORAGE_KEY
  );
  const storedCustomPresetOverrides = window.localStorage.getItem(
    EXPERT_EDIT_CUSTOM_PRESETS_STORAGE_KEY
  );
  const legacyStoredPresetPanelLabels = window.localStorage.getItem(
    LEGACY_EXPERT_EDIT_PRESET_PANEL_LABELS_STORAGE_KEY
  );

  const parsedPresetPanelIds = (() => {
    if (!storedPresetPanelIds) return null;
    try {
      return JSON.parse(storedPresetPanelIds) as unknown;
    } catch {
      return null;
    }
  })();

  const parsedCustomPresetOverrides = (() => {
    if (!storedCustomPresetOverrides) return {};
    try {
      return JSON.parse(storedCustomPresetOverrides) as unknown;
    } catch {
      return {};
    }
  })();

  const parsedLegacyPresetPanelLabels = (() => {
    if (!legacyStoredPresetPanelLabels) return null;
    try {
      return JSON.parse(legacyStoredPresetPanelLabels) as unknown;
    } catch {
      return null;
    }
  })();

  return normalizePresetPreferenceValue({
    presetPanelIds: parsedPresetPanelIds ?? undefined,
    customPresetOverrides: parsedCustomPresetOverrides,
    legacyPanelLabels: parsedLegacyPresetPanelLabels,
  });
};

const writeLocalPresetPreferenceValue = (value: ExpertEditPresetPreferenceValue): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizePresetPreferenceValue(value);
  window.localStorage.setItem(
    EXPERT_EDIT_PRESET_PANEL_IDS_STORAGE_KEY,
    JSON.stringify(normalizedValue.presetPanelIds)
  );
  window.localStorage.setItem(
    EXPERT_EDIT_CUSTOM_PRESETS_STORAGE_KEY,
    JSON.stringify(normalizedValue.customPresetOverrides)
  );
};

/**
 * Reads and writes Expert Edit preset panel preferences with local fallback.
 */
export const useExpertEditPresetPanelPreference = (): UseExpertEditPresetPanelPreferenceResult => {
  const [preferenceValue, setPreferenceValue] = useState<ExpertEditPresetPreferenceValue>(
    DEFAULT_PRESET_PREFERENCE_VALUE
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<ExpertEditPresetPanelSyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const latestValueRef = useRef<ExpertEditPresetPreferenceValue>(DEFAULT_PRESET_PREFERENCE_VALUE);
  const remoteSyncEnabledRef = useRef<boolean>(true);
  const writeVersionRef = useRef<number>(0);
  const hasLocalOverrideRef = useRef<boolean>(false);

  const updateLocalValue = useCallback((nextValue: ExpertEditPresetPreferenceValue) => {
    const normalizedValue = normalizePresetPreferenceValue(nextValue);
    latestValueRef.current = normalizedValue;
    setPreferenceValue(normalizedValue);
    writeLocalPresetPreferenceValue(normalizedValue);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSyncState("loading");

    (async () => {
      updateLocalValue(readLocalPresetPreferenceValue());
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
          .select(
            "expert_edit_preset_panel_ids, expert_edit_custom_presets, expert_edit_preset_panel_labels"
          )
          .eq("user_id", id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (!active) return;

        const nextValue = normalizePresetPreferenceValue({
          presetPanelIds: storedPreference?.expert_edit_preset_panel_ids,
          customPresetOverrides: storedPreference?.expert_edit_custom_presets,
          legacyPanelLabels: storedPreference?.expert_edit_preset_panel_labels,
        });

        if (!hasLocalOverrideRef.current) {
          updateLocalValue(nextValue);
        }

        if (!active) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingPresetPreferenceStorageError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load Expert Edit preset panel.");
        setSyncState("error");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [updateLocalValue]);

  const persistPreference = useCallback(
    async (nextValue: ExpertEditPresetPreferenceValue) => {
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const normalizedNextValue = normalizePresetPreferenceValue(nextValue);
      const previousValue = latestValueRef.current;
      updateLocalValue(normalizedNextValue);
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
            expert_edit_preset_panel_ids: normalizedNextValue.presetPanelIds,
            expert_edit_custom_presets: normalizedNextValue.customPresetOverrides,
          },
          { onConflict: "user_id" }
        );
        if (upsertError) throw upsertError;

        if (requestVersion !== writeVersionRef.current) return;
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (requestVersion !== writeVersionRef.current) return;
        if (isMissingPresetPreferenceStorageError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        updateLocalValue(previousValue);
        setError(err instanceof Error ? err.message : "Unable to update Expert Edit preset panel.");
        setSyncState("error");
      }
    },
    [updateLocalValue, userId]
  );

  const setPresetPanelIds = useCallback(
    (presetIds: readonly ExpertEditPresetId[]) => {
      void persistPreference({
        ...latestValueRef.current,
        presetPanelIds: normalizePresetPanelPresetIds(
          presetIds,
          latestValueRef.current.customPresetOverrides
        ),
      });
    },
    [persistPreference]
  );

  const setCustomPresetOverrides = useCallback(
    (overrides: ExpertEditCustomPresetOverrides) => {
      void persistPreference({
        ...latestValueRef.current,
        customPresetOverrides: normalizeExpertEditCustomPresetOverrides(overrides),
      });
    },
    [persistPreference]
  );

  return {
    presetPanelIds: preferenceValue.presetPanelIds,
    customPresetOverrides: preferenceValue.customPresetOverrides,
    loading,
    error,
    syncState,
    setPresetPanelIds,
    setCustomPresetOverrides,
  };
};
