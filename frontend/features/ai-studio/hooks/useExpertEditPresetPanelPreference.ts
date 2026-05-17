/**
 * Hook for storing Expert Edit preset panel selection and custom preset overrides in Supabase.
 * Keeps local fallback values while synchronizing per-user preferences when remote columns exist.
 */
import { useCallback } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  mapLegacyPresetLabelsToIds,
  normalizeExpertEditUserCustomPresetOverrides,
  normalizePresetPanelPresetIds,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditSystemPresetDefinition,
  type ExpertEditPresetId,
} from "../components/edit/expertEditPresets";
import { useUserPreferenceSync } from "./useUserPreferenceSync";

const EXPERT_EDIT_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.expert_edit_preset_panel_ids";
const EXPERT_EDIT_CUSTOM_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.expert_edit_custom_presets";
const LEGACY_EXPERT_EDIT_PRESET_PANEL_LABELS_STORAGE_KEY =
  "shortpulse.ai_studio.expert_edit_preset_panel_labels";

type ExpertEditPresetPanelSyncState = "loading" | "ready" | "saving" | "error";

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

type UseExpertEditPresetPanelPreferenceParams = {
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null;
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

const normalizePresetPreferenceValue = (
  value: {
    presetPanelIds?: unknown;
    customPresetOverrides?: unknown;
    legacyPanelLabels?: unknown;
  },
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null
): ExpertEditPresetPreferenceValue => {
  const customPresetOverrides = normalizeExpertEditUserCustomPresetOverrides(
    value.customPresetOverrides,
    systemPresetDefinitions
  );
  const panelIdsFromNew = Array.isArray(value.presetPanelIds)
    ? normalizePresetPanelPresetIds(
        value.presetPanelIds.filter((entry): entry is string => typeof entry === "string"),
        customPresetOverrides,
        systemPresetDefinitions
      ).slice(0, EDIT_PRESET_PANEL_MAX)
    : null;
  const panelIdsFromLegacyLabels = Array.isArray(value.legacyPanelLabels)
    ? mapLegacyPresetLabelsToIds(
        value.legacyPanelLabels.filter((entry): entry is string => typeof entry === "string"),
        customPresetOverrides,
        systemPresetDefinitions
      ).slice(0, EDIT_PRESET_PANEL_MAX)
    : null;
  const presetPanelIds =
    panelIdsFromNew ?? panelIdsFromLegacyLabels ?? DEFAULT_PRESET_PREFERENCE_VALUE.presetPanelIds;
  return {
    presetPanelIds,
    customPresetOverrides,
  };
};

const readLocalPresetPreferenceValue = (
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null
): ExpertEditPresetPreferenceValue => {
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

  return normalizePresetPreferenceValue(
    {
      presetPanelIds: parsedPresetPanelIds ?? undefined,
      customPresetOverrides: parsedCustomPresetOverrides,
      legacyPanelLabels: parsedLegacyPresetPanelLabels,
    },
    systemPresetDefinitions
  );
};

const writeLocalPresetPreferenceValue = (
  value: ExpertEditPresetPreferenceValue,
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null
): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizePresetPreferenceValue(value, systemPresetDefinitions);
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
export const useExpertEditPresetPanelPreference = ({
  systemPresetDefinitions,
}: UseExpertEditPresetPanelPreferenceParams = {}): UseExpertEditPresetPanelPreferenceResult => {
  const normalizePreferenceValue = useCallback(
    (value: ExpertEditPresetPreferenceValue) =>
      normalizePresetPreferenceValue(value, systemPresetDefinitions),
    [systemPresetDefinitions]
  );
  const readLocalPreferenceValue = useCallback(
    () => readLocalPresetPreferenceValue(systemPresetDefinitions),
    [systemPresetDefinitions]
  );
  const writeLocalPreferenceValue = useCallback(
    (value: ExpertEditPresetPreferenceValue) =>
      writeLocalPresetPreferenceValue(value, systemPresetDefinitions),
    [systemPresetDefinitions]
  );
  const loadRemotePreferenceValue = useCallback(
    async (userId: string) => {
      const supabase = ensureSupabaseQueryClient();
      const { data: storedPreference, error: preferenceError } = await supabase
        .from("user_preferences")
        .select(
          "expert_edit_preset_panel_ids, expert_edit_custom_presets, expert_edit_preset_panel_labels"
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (preferenceError) throw preferenceError;
      return {
        value: normalizePresetPreferenceValue(
          {
            presetPanelIds: storedPreference?.expert_edit_preset_panel_ids,
            customPresetOverrides: storedPreference?.expert_edit_custom_presets,
            legacyPanelLabels: storedPreference?.expert_edit_preset_panel_labels,
          },
          systemPresetDefinitions
        ),
        hasRemoteValue:
          storedPreference != null &&
          (storedPreference.expert_edit_preset_panel_ids != null ||
            storedPreference.expert_edit_custom_presets != null ||
            storedPreference.expert_edit_preset_panel_labels != null),
      };
    },
    [systemPresetDefinitions]
  );
  const persistRemotePreferenceValue = useCallback(
    async (userId: string, nextValue: ExpertEditPresetPreferenceValue) => {
      const supabase = ensureSupabaseQueryClient();
      const { error: upsertError } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          expert_edit_preset_panel_ids: nextValue.presetPanelIds,
          expert_edit_custom_presets: nextValue.customPresetOverrides,
        },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;
    },
    []
  );

  const {
    value: preferenceValue,
    loading,
    error,
    syncState,
    latestValueRef,
    persistValue,
  } = useUserPreferenceSync<ExpertEditPresetPreferenceValue>({
    defaultValue: DEFAULT_PRESET_PREFERENCE_VALUE,
    normalizeValue: normalizePreferenceValue,
    readLocal: readLocalPreferenceValue,
    writeLocal: writeLocalPreferenceValue,
    loadRemote: loadRemotePreferenceValue,
    persistRemote: persistRemotePreferenceValue,
    isMissingRemoteError: isMissingPresetPreferenceStorageError,
    loadErrorMessage: "Unable to load Expert Edit preset panel.",
    saveErrorMessage: "Unable to update Expert Edit preset panel.",
    treatMissingPersistErrorAsDisableRemote: true,
  });

  const setPresetPanelIds = useCallback(
    (presetIds: readonly ExpertEditPresetId[]) => {
      void persistValue({
        ...latestValueRef.current,
        presetPanelIds: normalizePresetPanelPresetIds(
          presetIds,
          latestValueRef.current.customPresetOverrides,
          systemPresetDefinitions
        ),
      });
    },
    [persistValue, systemPresetDefinitions, latestValueRef]
  );

  const setCustomPresetOverrides = useCallback(
    (overrides: ExpertEditCustomPresetOverrides) => {
      void persistValue({
        ...latestValueRef.current,
        customPresetOverrides: normalizeExpertEditUserCustomPresetOverrides(
          overrides,
          systemPresetDefinitions
        ),
      });
    },
    [persistValue, systemPresetDefinitions, latestValueRef]
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
