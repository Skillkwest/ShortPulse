/**
 * Hook for storing Expert Edit preset panel selection and custom preset overrides in Supabase.
 * Keeps local fallback values while synchronizing per-user preferences when remote columns exist.
 */
import { useCallback } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  buildUserScopedStorageKey,
  readLocalStorageValue,
} from "../../character-manager/logic/userScopedLocalStorage";
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

const buildExpertEditPresetPanelIdsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(EXPERT_EDIT_PRESET_PANEL_IDS_STORAGE_KEY, userId);

const buildExpertEditCustomPresetsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(EXPERT_EDIT_CUSTOM_PRESETS_STORAGE_KEY, userId);

const buildLegacyExpertEditPresetPanelLabelsStorageKey = (userId?: string | null): string =>
  buildUserScopedStorageKey(LEGACY_EXPERT_EDIT_PRESET_PANEL_LABELS_STORAGE_KEY, userId);

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
  setPresetPanelIds: (presetIds: readonly ExpertEditPresetId[]) => Promise<boolean>;
  setCustomPresetOverrides: (overrides: ExpertEditCustomPresetOverrides) => Promise<boolean>;
};

type UseExpertEditPresetPanelPreferenceParams = {
  enabled?: boolean;
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null;
};

const DEFAULT_PRESET_PREFERENCE_VALUE: ExpertEditPresetPreferenceValue = {
  presetPanelIds: normalizePresetPanelPresetIds(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS),
  customPresetOverrides: {},
};

const areExpertEditPresetIdListsEqual = (
  left: readonly ExpertEditPresetId[],
  right: readonly ExpertEditPresetId[]
): boolean =>
  left.length === right.length && left.every((presetId, index) => presetId === right[index]);

const hasMeaningfulExpertEditPreferenceValue = (value: ExpertEditPresetPreferenceValue): boolean =>
  Object.keys(value.customPresetOverrides).length > 0 ||
  !areExpertEditPresetIdListsEqual(
    value.presetPanelIds,
    DEFAULT_PRESET_PREFERENCE_VALUE.presetPanelIds
  );

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
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null,
  userId?: string | null
): ExpertEditPresetPreferenceValue => {
  if (typeof window === "undefined") return DEFAULT_PRESET_PREFERENCE_VALUE;
  const storedPresetPanelIds = readLocalStorageValue(
    buildExpertEditPresetPanelIdsStorageKey(userId)
  );
  const storedCustomPresetOverrides = readLocalStorageValue(
    buildExpertEditCustomPresetsStorageKey(userId)
  );
  const legacyStoredPresetPanelLabels = readLocalStorageValue(
    buildLegacyExpertEditPresetPanelLabelsStorageKey(userId)
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

const hasStoredExpertEditPreferenceKeys = (userId?: string | null): boolean =>
  readLocalStorageValue(buildExpertEditPresetPanelIdsStorageKey(userId)) != null ||
  readLocalStorageValue(buildExpertEditCustomPresetsStorageKey(userId)) != null ||
  readLocalStorageValue(buildLegacyExpertEditPresetPanelLabelsStorageKey(userId)) != null;

const writeLocalPresetPreferenceValue = (
  value: ExpertEditPresetPreferenceValue,
  systemPresetDefinitions?: readonly ExpertEditSystemPresetDefinition[] | null,
  userId?: string | null
): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizePresetPreferenceValue(value, systemPresetDefinitions);
  window.localStorage.setItem(
    buildExpertEditPresetPanelIdsStorageKey(userId),
    JSON.stringify(normalizedValue.presetPanelIds)
  );
  window.localStorage.setItem(
    buildExpertEditCustomPresetsStorageKey(userId),
    JSON.stringify(normalizedValue.customPresetOverrides)
  );
};

/**
 * Reads and writes Expert Edit preset panel preferences with local fallback.
 */
export const useExpertEditPresetPanelPreference = ({
  enabled = true,
  systemPresetDefinitions,
}: UseExpertEditPresetPanelPreferenceParams = {}): UseExpertEditPresetPanelPreferenceResult => {
  const normalizePreferenceValue = useCallback(
    (value: ExpertEditPresetPreferenceValue) =>
      normalizePresetPreferenceValue(value, systemPresetDefinitions),
    [systemPresetDefinitions]
  );
  const readLocalPreferenceValue = useCallback(
    (userId?: string | null) => readLocalPresetPreferenceValue(systemPresetDefinitions, userId),
    [systemPresetDefinitions]
  );
  const writeLocalPreferenceValue = useCallback(
    (value: ExpertEditPresetPreferenceValue, userId?: string | null) =>
      writeLocalPresetPreferenceValue(value, systemPresetDefinitions, userId),
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
      const normalizedRemoteValue = normalizePresetPreferenceValue(
        {
          presetPanelIds: storedPreference?.expert_edit_preset_panel_ids,
          customPresetOverrides: storedPreference?.expert_edit_custom_presets,
          legacyPanelLabels: storedPreference?.expert_edit_preset_panel_labels,
        },
        systemPresetDefinitions
      );
      const hasRemoteValue =
        storedPreference != null &&
        (storedPreference.expert_edit_preset_panel_ids != null ||
          storedPreference.expert_edit_custom_presets != null ||
          storedPreference.expert_edit_preset_panel_labels != null);
      if (hasRemoteValue) {
        return {
          value: normalizedRemoteValue,
          hasRemoteValue: true,
        };
      }

      const hasScopedLocalStorage = hasStoredExpertEditPreferenceKeys(userId);
      const hasLegacyGlobalStorage =
        !hasScopedLocalStorage && hasStoredExpertEditPreferenceKeys(null);
      if (hasLegacyGlobalStorage) {
        const legacyGlobalValue = readLocalPresetPreferenceValue(systemPresetDefinitions, null);
        if (hasMeaningfulExpertEditPreferenceValue(legacyGlobalValue)) {
          writeLocalPresetPreferenceValue(legacyGlobalValue, systemPresetDefinitions, userId);
          const { error: migrationError } = await supabase.from("user_preferences").upsert(
            {
              user_id: userId,
              expert_edit_preset_panel_ids: legacyGlobalValue.presetPanelIds,
              expert_edit_custom_presets: legacyGlobalValue.customPresetOverrides,
            },
            { onConflict: "user_id" }
          );
          if (migrationError) throw migrationError;
          return {
            value: legacyGlobalValue,
            hasRemoteValue: true,
          };
        }
      }

      return {
        value: normalizedRemoteValue,
        hasRemoteValue: false,
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
    enabled,
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
      return persistValue({
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
      return persistValue({
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
