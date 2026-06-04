/**
 * Hook for storing per-user Pulse records and Create Pulse rail selection in Supabase.
 * Keeps local values while synchronizing per-user Pulse preferences when remote columns exist.
 */
import { useCallback } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS,
  CREATE_PULSE_SURFACE_PRESET_IDS,
  resolveCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseDefaultPanelPresetIds,
  type CreatePulseBuiltInPresetDefinition,
  normalizeCreatePulsePanelPresetIds,
  normalizeCreatePulseSavedPresets,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "../components/create/createPulsePresets";
import { useUserPreferenceSync } from "./useUserPreferenceSync";

const CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.create_pulse_preset_panel_ids";
const CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.saved_pulses";
const CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY = "shortpulse.ai_studio.hidden_builtin_pulses";

type CreatePulsePresetPanelSyncState = "loading" | "ready" | "saving" | "error";

type CreatePulsePresetPreferenceValue = {
  presetPanelIds: CreatePulsePresetId[];
  savedPresets: CreatePulseSavedPreset[];
};

type CreatePulsePresetPreferenceStorageValue = {
  presetPanelIds: CreatePulsePresetId[];
  customSavedPresets: CreatePulseSavedPreset[];
  hiddenBuiltInPresetIds: CreatePulsePresetId[];
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

const createDefaultCreatePulsePresetPreferenceValue = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetPreferenceValue => ({
  presetPanelIds: normalizeCreatePulsePanelPresetIds(
    resolveCreatePulseDefaultPanelPresetIds(builtInDefinitions),
    [],
    builtInDefinitions
  ),
  savedPresets: [],
});

const createDefaultCreatePulsePresetPreferenceStorageValue = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetPreferenceStorageValue => ({
  presetPanelIds: normalizeCreatePulsePanelPresetIds(
    resolveCreatePulseDefaultPanelPresetIds(builtInDefinitions),
    [],
    builtInDefinitions
  ),
  customSavedPresets: [],
  hiddenBuiltInPresetIds: [],
});

const DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_STORAGE_VALUE =
  createDefaultCreatePulsePresetPreferenceStorageValue();

const areCreatePulsePresetIdListsEqual = (
  left: readonly CreatePulsePresetId[],
  right: readonly CreatePulsePresetId[]
): boolean =>
  left.length === right.length && left.every((presetId, index) => presetId === right[index]);

const isLegacyDefaultCreatePulsePanelPresetIds = (presetIds: readonly string[]): boolean =>
  presetIds.length === CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS.length &&
  presetIds.every((presetId, index) => presetId === CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS[index]);

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

const buildCreatePulseHiddenBuiltInsStorageKey = (userId?: string | null): string => {
  const normalizedUserId = normalizeLocalPreferenceStorageUserId(userId);
  return normalizedUserId
    ? `${CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY}:${normalizedUserId}`
    : CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY;
};

const readCreatePulseStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
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

const normalizeCreatePulseHiddenBuiltInPresetIds = (
  value: unknown,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetId[] => {
  if (!Array.isArray(value)) return [];
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const builtInPresetIds = new Set(
    resolvedBuiltInDefinitions.map((definition) => definition.presetId)
  );
  const legacyPresetIdIndex = new Map(
    CREATE_PULSE_SURFACE_PRESET_IDS.map((presetId, index) => [presetId, index] as const)
  );
  return Array.from(
    new Set(
      value
        .flatMap((entry) => (typeof entry === "string" ? [entry.trim()] : []))
        .map((presetId) => {
          if (builtInPresetIds.has(presetId)) return presetId;
          const legacyIndex = legacyPresetIdIndex.get(presetId);
          return legacyIndex == null
            ? null
            : (resolvedBuiltInDefinitions[legacyIndex]?.presetId ?? null);
        })
        .filter((presetId): presetId is string => Boolean(presetId))
    )
  );
};

const buildHiddenBuiltInSavedPresets = (
  hiddenBuiltInPresetIds: readonly CreatePulsePresetId[],
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseSavedPreset[] => {
  const hiddenSet = new Set(hiddenBuiltInPresetIds);
  return resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions)
    .filter((definition) => hiddenSet.has(definition.presetId))
    .map((definition) => ({
      presetId: definition.presetId,
      label: definition.label,
      description: definition.description,
      systemInstructions: "",
      pulseKind: definition.pulseKind,
      runtimeMode: definition.runtimeMode,
      activationMode: definition.activationMode,
      starterAssistantMessage: definition.starterAssistantMessage,
      workflowStageHints: definition.workflowStageHints,
      outputMode: definition.outputMode,
      artifactTarget: definition.artifactTarget,
      memoryPolicy: definition.memoryPolicy,
      createdAt: null,
      schemaVersion: definition.schemaVersion,
      isHidden: true,
    }));
};

const mergeCreatePulseSavedPresets = (
  customSavedPresets: readonly CreatePulseSavedPreset[],
  hiddenBuiltInPresetIds: readonly CreatePulsePresetId[],
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseSavedPreset[] => [
  ...customSavedPresets,
  ...buildHiddenBuiltInSavedPresets(hiddenBuiltInPresetIds, builtInDefinitions),
];

const splitCreatePulseSavedPresetPersistence = (
  presets: unknown,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): {
  customSavedPresets: CreatePulseSavedPreset[];
  hiddenBuiltInPresetIds: CreatePulsePresetId[];
} => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(presets, builtInDefinitions);
  const hiddenBuiltInPresetIds = normalizeCreatePulseHiddenBuiltInPresetIds(
    normalizedSavedPresets
      .filter((preset) => preset.isHidden === true)
      .map((preset) => preset.presetId),
    builtInDefinitions
  );
  return {
    customSavedPresets: normalizedSavedPresets.filter((preset) => preset.isHidden !== true),
    hiddenBuiltInPresetIds,
  };
};

const normalizeCreatePulsePresetPreferenceStorageValue = (
  value: {
    presetPanelIds?: unknown;
    customSavedPresets?: unknown;
    hiddenBuiltInPresetIds?: unknown;
  },
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null,
  options?: {
    preserveHiddenBuiltInPresetIds?: readonly CreatePulsePresetId[];
  }
): CreatePulsePresetPreferenceStorageValue => {
  const { customSavedPresets, hiddenBuiltInPresetIds } = splitCreatePulseSavedPresetPersistence(
    value.customSavedPresets ?? [],
    builtInDefinitions
  );
  const normalizedHiddenBuiltInPresetIds = normalizeCreatePulseHiddenBuiltInPresetIds(
    [
      ...hiddenBuiltInPresetIds,
      ...normalizeCreatePulseHiddenBuiltInPresetIds(
        value.hiddenBuiltInPresetIds,
        builtInDefinitions
      ),
      ...(options?.preserveHiddenBuiltInPresetIds ?? []),
    ],
    builtInDefinitions
  );
  const mergedSavedPresets = mergeCreatePulseSavedPresets(
    customSavedPresets,
    normalizedHiddenBuiltInPresetIds,
    builtInDefinitions
  );
  const defaultPreferenceValue = createDefaultCreatePulsePresetPreferenceValue(builtInDefinitions);
  const defaultPresetPanelIds = normalizeCreatePulsePanelPresetIds(
    defaultPreferenceValue.presetPanelIds,
    mergedSavedPresets,
    builtInDefinitions
  );
  const presetPanelIds = Array.isArray(value.presetPanelIds)
    ? normalizeCreatePulsePanelPresetIds(
        (() => {
          const normalizedPresetIds = value.presetPanelIds.filter(
            (entry): entry is string => typeof entry === "string"
          );
          return isLegacyDefaultCreatePulsePanelPresetIds(normalizedPresetIds)
            ? defaultPreferenceValue.presetPanelIds
            : normalizedPresetIds;
        })(),
        mergedSavedPresets,
        builtInDefinitions
      )
    : defaultPresetPanelIds;
  return {
    presetPanelIds,
    customSavedPresets,
    hiddenBuiltInPresetIds: normalizedHiddenBuiltInPresetIds,
  };
};

const resolveCreatePulsePresetPreferenceValue = (
  value: CreatePulsePresetPreferenceStorageValue,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetPreferenceValue => ({
  presetPanelIds: value.presetPanelIds,
  savedPresets: mergeCreatePulseSavedPresets(
    value.customSavedPresets,
    value.hiddenBuiltInPresetIds,
    builtInDefinitions
  ),
});

const hasStoredCreatePulsePreferenceKeys = (userId?: string | null): boolean =>
  readCreatePulseStorageValue(buildCreatePulsePresetPanelIdsStorageKey(userId)) != null ||
  readCreatePulseStorageValue(buildCreatePulseSavedPresetsStorageKey(userId)) != null ||
  readCreatePulseStorageValue(buildCreatePulseHiddenBuiltInsStorageKey(userId)) != null;

const hasMeaningfulCreatePulsePreferenceStorageValue = (
  value: CreatePulsePresetPreferenceStorageValue,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): boolean => {
  const defaultValue = createDefaultCreatePulsePresetPreferenceStorageValue(builtInDefinitions);
  return (
    value.customSavedPresets.length > 0 ||
    value.hiddenBuiltInPresetIds.length > 0 ||
    !areCreatePulsePresetIdListsEqual(value.presetPanelIds, defaultValue.presetPanelIds)
  );
};

const readLocalCreatePulsePresetPreferenceValue = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null,
  userId?: string | null
): CreatePulsePresetPreferenceStorageValue => {
  if (typeof window === "undefined") return DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_STORAGE_VALUE;
  const storedPresetPanelIds = readCreatePulseStorageValue(
    buildCreatePulsePresetPanelIdsStorageKey(userId)
  );
  const storedSavedPresets = readCreatePulseStorageValue(
    buildCreatePulseSavedPresetsStorageKey(userId)
  );
  const storedHiddenBuiltIns = readCreatePulseStorageValue(
    buildCreatePulseHiddenBuiltInsStorageKey(userId)
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
  const parsedHiddenBuiltIns = (() => {
    if (!storedHiddenBuiltIns) return null;
    try {
      return JSON.parse(storedHiddenBuiltIns) as unknown;
    } catch {
      return null;
    }
  })();

  const { customSavedPresets, hiddenBuiltInPresetIds: legacyHiddenBuiltInPresetIds } =
    splitCreatePulseSavedPresetPersistence(parsedSavedPresets ?? [], builtInDefinitions);
  return normalizeCreatePulsePresetPreferenceStorageValue(
    {
      presetPanelIds: parsedPresetPanelIds ?? undefined,
      customSavedPresets,
      hiddenBuiltInPresetIds: [
        ...legacyHiddenBuiltInPresetIds,
        ...normalizeCreatePulseHiddenBuiltInPresetIds(parsedHiddenBuiltIns, builtInDefinitions),
      ],
    },
    builtInDefinitions
  );
};

const writeLocalCreatePulsePresetPreferenceValue = (
  value: CreatePulsePresetPreferenceStorageValue,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null,
  userId?: string | null
): void => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizeCreatePulsePresetPreferenceStorageValue(
    value,
    builtInDefinitions
  );
  window.localStorage.setItem(
    buildCreatePulsePresetPanelIdsStorageKey(userId),
    JSON.stringify(normalizedValue.presetPanelIds)
  );
  window.localStorage.setItem(
    buildCreatePulseSavedPresetsStorageKey(userId),
    JSON.stringify(normalizedValue.customSavedPresets)
  );
  window.localStorage.setItem(
    buildCreatePulseHiddenBuiltInsStorageKey(userId),
    JSON.stringify(normalizedValue.hiddenBuiltInPresetIds)
  );
};

/**
 * Reads and writes shared Pulse preferences with local fallback.
 */
export const useCreatePulsePresetPanelPreference = ({
  enabled = true,
  builtInDefinitions = null,
}: UseCreatePulsePresetPanelPreferenceOptions = {}): UseCreatePulsePresetPanelPreferenceResult => {
  const normalizePreferenceValue = useCallback(
    (value: CreatePulsePresetPreferenceStorageValue) =>
      normalizeCreatePulsePresetPreferenceStorageValue(value, builtInDefinitions),
    [builtInDefinitions]
  );
  const readLocalPreferenceValue = useCallback(
    (userId?: string | null) =>
      readLocalCreatePulsePresetPreferenceValue(builtInDefinitions, userId),
    [builtInDefinitions]
  );
  const writeLocalPreferenceValue = useCallback(
    (value: CreatePulsePresetPreferenceStorageValue, userId?: string | null) =>
      writeLocalCreatePulsePresetPreferenceValue(value, builtInDefinitions, userId),
    [builtInDefinitions]
  );
  const loadRemotePreferenceValue = useCallback(
    async (userId: string, localValue: CreatePulsePresetPreferenceStorageValue) => {
      const supabase = ensureSupabaseQueryClient();
      const { data: storedPreference, error: preferenceError } = await supabase
        .from("user_preferences")
        .select("ai_studio_create_pulse_panel_ids, ai_studio_saved_pulses")
        .eq("user_id", userId)
        .maybeSingle();
      if (preferenceError) throw preferenceError;
      const normalizedRemoteValue = normalizeCreatePulsePresetPreferenceStorageValue(
        {
          presetPanelIds: storedPreference?.ai_studio_create_pulse_panel_ids,
          customSavedPresets: storedPreference?.ai_studio_saved_pulses,
        },
        builtInDefinitions,
        {
          preserveHiddenBuiltInPresetIds: localValue.hiddenBuiltInPresetIds,
        }
      );
      const hasRemoteValue =
        storedPreference != null &&
        (storedPreference.ai_studio_create_pulse_panel_ids != null ||
          storedPreference.ai_studio_saved_pulses != null);
      if (hasRemoteValue) {
        return {
          value: normalizedRemoteValue,
          hasRemoteValue: true,
        };
      }

      const hasScopedLocalStorage = hasStoredCreatePulsePreferenceKeys(userId);
      const hasLegacyGlobalStorage =
        !hasScopedLocalStorage && hasStoredCreatePulsePreferenceKeys(null);
      if (hasLegacyGlobalStorage) {
        const legacyGlobalValue = readLocalCreatePulsePresetPreferenceValue(
          builtInDefinitions,
          null
        );
        if (hasMeaningfulCreatePulsePreferenceStorageValue(legacyGlobalValue, builtInDefinitions)) {
          writeLocalCreatePulsePresetPreferenceValue(legacyGlobalValue, builtInDefinitions, userId);
          const { error: migrationError } = await supabase.from("user_preferences").upsert(
            {
              user_id: userId,
              ai_studio_create_pulse_panel_ids: legacyGlobalValue.presetPanelIds,
              ai_studio_saved_pulses: legacyGlobalValue.customSavedPresets,
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
    [builtInDefinitions]
  );
  const persistRemotePreferenceValue = useCallback(
    async (userId: string, nextValue: CreatePulsePresetPreferenceStorageValue) => {
      const supabase = ensureSupabaseQueryClient();
      const { error: upsertError } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          ai_studio_create_pulse_panel_ids: nextValue.presetPanelIds,
          ai_studio_saved_pulses: nextValue.customSavedPresets,
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
  } = useUserPreferenceSync<CreatePulsePresetPreferenceStorageValue>({
    enabled,
    defaultValue: DEFAULT_CREATE_PULSE_PRESET_PREFERENCE_STORAGE_VALUE,
    normalizeValue: normalizePreferenceValue,
    readLocal: readLocalPreferenceValue,
    writeLocal: writeLocalPreferenceValue,
    loadRemote: loadRemotePreferenceValue,
    persistRemote: persistRemotePreferenceValue,
    isMissingRemoteError: isMissingCreatePulsePreferenceStorageError,
    loadErrorMessage: "Unable to load Pulse presets.",
    saveErrorMessage: "Unable to save Pulse presets.",
  });

  const setPresetPanelIds = useCallback(
    (presetIds: readonly CreatePulsePresetId[]) => {
      const savedPresets = mergeCreatePulseSavedPresets(
        latestValueRef.current.customSavedPresets,
        latestValueRef.current.hiddenBuiltInPresetIds,
        builtInDefinitions
      );
      return persistValue({
        customSavedPresets: latestValueRef.current.customSavedPresets,
        hiddenBuiltInPresetIds: latestValueRef.current.hiddenBuiltInPresetIds,
        presetPanelIds: normalizeCreatePulsePanelPresetIds(
          presetIds,
          savedPresets,
          builtInDefinitions
        ),
      });
    },
    [builtInDefinitions, latestValueRef, persistValue]
  );

  const setSavedPresets = useCallback(
    (presets: readonly CreatePulseSavedPreset[]) => {
      const { customSavedPresets, hiddenBuiltInPresetIds } = splitCreatePulseSavedPresetPersistence(
        presets,
        builtInDefinitions
      );
      const normalizedSavedPresets = mergeCreatePulseSavedPresets(
        customSavedPresets,
        hiddenBuiltInPresetIds,
        builtInDefinitions
      );
      return persistValue({
        presetPanelIds: normalizeCreatePulsePanelPresetIds(
          latestValueRef.current.presetPanelIds,
          normalizedSavedPresets,
          builtInDefinitions
        ),
        customSavedPresets,
        hiddenBuiltInPresetIds,
      });
    },
    [builtInDefinitions, latestValueRef, persistValue]
  );

  const resolvedPreferenceValue = resolveCreatePulsePresetPreferenceValue(
    preferenceValue,
    builtInDefinitions
  );

  return {
    presetPanelIds: resolvedPreferenceValue.presetPanelIds,
    savedPresets: resolvedPreferenceValue.savedPresets,
    loading,
    error,
    syncState,
    setPresetPanelIds,
    setSavedPresets,
  };
};
