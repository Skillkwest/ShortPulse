/**
 * Character-sheet preset tab helper functions.
 * Centralizes tab-capacity, label normalization, and legacy tab-order fallback behavior.
 */
import { CHARACTER_SHEET_PRESET_IDS } from "../constants";
import type { CharacterSheetPresetId, CharacterSheetPresetLabelMap } from "../types";

export const MAX_CHARACTER_SHEET_PRESET_TAB_COUNT = 10;
export const CHARACTER_SHEET_PRESET_TAB_LABEL_MAX_LENGTH = 24;

const PRESET_ID_ORDER = new Map(
  CHARACTER_SHEET_PRESET_IDS.map((presetId, index) => [presetId, index] as const)
);

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const isCharacterSheetPresetId = (value: string): value is CharacterSheetPresetId =>
  CHARACTER_SHEET_PRESET_IDS.includes(value as CharacterSheetPresetId);

const dedupePresetIds = (presetIds: readonly CharacterSheetPresetId[]): CharacterSheetPresetId[] =>
  Array.from(new Set(presetIds));

const byPresetIdOrder = (a: CharacterSheetPresetId, b: CharacterSheetPresetId): number =>
  (PRESET_ID_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) -
  (PRESET_ID_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER);

export const sanitizeCharacterSheetPresetTabLabel = ({
  presetId,
  label,
}: {
  presetId: CharacterSheetPresetId;
  label: string | null | undefined;
}): string => {
  const normalized = collapseWhitespace(label ?? "").slice(
    0,
    CHARACTER_SHEET_PRESET_TAB_LABEL_MAX_LENGTH
  );
  return normalized.length > 0 ? normalized : presetId;
};

export const normalizeCharacterSheetPresetTabOrder = ({
  tabOrder,
  activePresetId,
}: {
  tabOrder: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
}): CharacterSheetPresetId[] => {
  const normalized = dedupePresetIds(tabOrder).slice(0, MAX_CHARACTER_SHEET_PRESET_TAB_COUNT);
  if (!normalized.length) {
    return [activePresetId];
  }
  if (normalized.includes(activePresetId)) {
    return normalized;
  }
  if (normalized.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT) {
    return [...normalized, activePresetId];
  }
  return [...normalized.slice(0, normalized.length - 1), activePresetId];
};

export const deriveLegacyCharacterSheetPresetTabOrder = ({
  rawPresetIds,
  activePresetId,
}: {
  rawPresetIds: readonly string[];
  activePresetId: CharacterSheetPresetId;
}): CharacterSheetPresetId[] => {
  const parsedPresetIds = dedupePresetIds(
    rawPresetIds.filter((rawPresetId): rawPresetId is CharacterSheetPresetId =>
      isCharacterSheetPresetId(rawPresetId)
    )
  ).sort(byPresetIdOrder);
  return normalizeCharacterSheetPresetTabOrder({
    tabOrder: parsedPresetIds,
    activePresetId,
  });
};

export const getNextCharacterSheetPresetId = (
  visiblePresetIds: readonly CharacterSheetPresetId[]
): CharacterSheetPresetId | null => {
  const visibleSet = new Set(visiblePresetIds);
  for (const presetId of CHARACTER_SHEET_PRESET_IDS) {
    if (!visibleSet.has(presetId)) {
      return presetId;
    }
  }
  return null;
};

export const createNormalizedCharacterSheetPresetTabLabels = ({
  labels,
}: {
  labels: Partial<Record<CharacterSheetPresetId, string>> | null | undefined;
}): CharacterSheetPresetLabelMap =>
  CHARACTER_SHEET_PRESET_IDS.reduce((acc, presetId) => {
    acc[presetId] = sanitizeCharacterSheetPresetTabLabel({
      presetId,
      label: labels?.[presetId],
    });
    return acc;
  }, {} as CharacterSheetPresetLabelMap);
