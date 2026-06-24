/**
 * Character look selection helpers for AI Studio Character Mode.
 * Keeps Create picker selection, bundle loading, and submit-time resolution aligned.
 */
import { createEmptyCharacterSheetPresetAssignments } from "../../character-manager/constants";
import type { CharacterManagerDraftSnapshot } from "../../character-manager/logic/characterManagerPersistence";
import type {
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
} from "../../character-manager/types";
import {
  resolveCharacterSheetLookReferenceStoragePaths,
  resolveCharacterSheetLookReferenceUrls,
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "./characterModePayload";

export type CharacterModeLookOption = {
  id: CharacterSheetPresetId;
  label: string;
  isDefault: boolean;
};

export type ResolvedCharacterModeLookSelection = {
  lookId: CharacterSheetPresetId;
  lookLabel: string;
  lookDescription: string;
  lookAssignments: CharacterSheetPresetAssignments;
};

const normalizeCharacterLookLabel = (lookId: CharacterSheetPresetId, label: string): string => {
  const trimmed = label.trim();
  if (!trimmed) return `Look ${lookId}`;
  return trimmed;
};

export const buildCharacterModeLookOptions = (
  snapshot: CharacterManagerDraftSnapshot
): CharacterModeLookOption[] =>
  snapshot.visibleCharacterSheetPresetIds.map((lookId) => ({
    id: lookId,
    label: normalizeCharacterLookLabel(lookId, snapshot.characterSheetPresetLabels[lookId] ?? ""),
    isDefault: lookId === snapshot.activeCharacterSheetPresetId,
  }));

export const resolveCharacterModeLookSelection = (
  snapshot: CharacterManagerDraftSnapshot,
  requestedLookId?: string | null
): ResolvedCharacterModeLookSelection => {
  const visibleLookOptions = buildCharacterModeLookOptions(snapshot);
  const requestedId = requestedLookId?.trim() ?? "";
  const requestedVisibleOption =
    visibleLookOptions.find((option) => option.id === requestedId) ?? null;
  const fallbackOption =
    visibleLookOptions.find((option) => option.id === snapshot.activeCharacterSheetPresetId) ??
    visibleLookOptions[0] ??
    null;
  const selectedOption = requestedVisibleOption ?? fallbackOption;
  const lookId = selectedOption?.id ?? snapshot.activeCharacterSheetPresetId;
  return {
    lookId,
    lookLabel:
      selectedOption?.label ??
      normalizeCharacterLookLabel(lookId, snapshot.characterSheetPresetLabels[lookId] ?? ""),
    lookDescription: snapshot.characterSheetPresetDescriptions[lookId] ?? "",
    lookAssignments:
      snapshot.characterSheetPresets[lookId] ?? createEmptyCharacterSheetPresetAssignments(),
  };
};

export const buildCharacterModeInjectionBundleFromSnapshot = (
  snapshot: CharacterManagerDraftSnapshot,
  requestedLookId?: string | null
) => {
  const resolvedLook = resolveCharacterModeLookSelection(snapshot, requestedLookId);
  const lookReferenceStoragePaths = resolveCharacterSheetLookReferenceStoragePaths(
    resolvedLook.lookAssignments
  );
  const lookReferenceUrls = resolveCharacterSheetLookReferenceUrls(resolvedLook.lookAssignments);
  const fallbackStoragePaths = resolveCharacterSheetReferenceStoragePaths(
    snapshot.characterSheetAssignments,
    snapshot.slots
  );
  const fallbackUrls = resolveCharacterSheetReferenceUrls(
    snapshot.characterSheetAssignments,
    snapshot.slots
  );
  const effectiveCharacterDescription =
    resolvedLook.lookDescription.trim().length > 0
      ? resolvedLook.lookDescription
      : snapshot.legacyCharacterDescription;
  const directLookReferenceCount = Math.max(
    lookReferenceStoragePaths.length,
    lookReferenceUrls.length
  );

  return {
    characterId: snapshot.characterId,
    characterDescription: effectiveCharacterDescription,
    characterLookId: resolvedLook.lookId,
    characterLookName: resolvedLook.lookLabel,
    characterProfileImageUrl: snapshot.profileImageUrl ?? null,
    directLookReferenceCount,
    usedLegacyReferenceFallback:
      directLookReferenceCount === 0 &&
      (fallbackStoragePaths.length > 0 || fallbackUrls.length > 0),
    sheetReferenceStoragePaths:
      lookReferenceStoragePaths.length > 0 ? lookReferenceStoragePaths : fallbackStoragePaths,
    sheetReferenceUrls: lookReferenceUrls.length > 0 ? lookReferenceUrls : fallbackUrls,
    loadedAtMs: Date.now(),
  };
};
