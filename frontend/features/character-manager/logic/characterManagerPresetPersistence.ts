import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import {
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import type {
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
  CharacterSheetPresetMediaReference,
  CharacterSheetPresetState,
} from "../types";
import {
  asErrorMessage,
  CHARACTER_SHEET_PRESETS_KEY,
  getCharacterSheetPresetState,
  normalizeCharacterSheetPresetAssignments,
  normalizeCharacterSheetPresetState,
  resolveSupabaseContext,
  serializeCharacterSheetPresetState,
} from "./characterManagerPersistenceCore";

const MEDIA_BUCKET = "media_library";

type CharacterPresetMetadataRow = {
  metadata: unknown;
  description?: string | null;
};

type LoadCharacterPresetStateResult = {
  characterRow: CharacterPresetMetadataRow;
  existingState: CharacterSheetPresetState;
  supabase: Awaited<ReturnType<typeof resolveSupabaseContext>>["supabase"];
  userId: string;
};

export const toLegacyCharacterDescription = (description: string | null | undefined): string =>
  (description ?? "").trim().slice(0, 150);

const toMetadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export const listPresetReferencesFromState = (
  state: CharacterSheetPresetState
): Array<{ mediaFileId: string; storagePath: string }> =>
  Array.from(
    new Map(
      Object.values(state.presets)
        .flatMap((assignments) => Object.values(assignments))
        .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference))
        .map((reference) => [
          reference.mediaFileId,
          {
            mediaFileId: reference.mediaFileId,
            storagePath: reference.storagePath,
          },
        ])
    ).values()
  );

export const hydratePresetStateWithPreviewUrls = async (
  state: CharacterSheetPresetState
): Promise<CharacterSheetPresetState> => {
  const storagePaths = Array.from(
    new Set(
      Object.values(state.presets)
        .flatMap((assignments) => Object.values(assignments))
        .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference))
        .map((reference) => reference.previewStoragePath ?? reference.storagePath)
    )
  );
  if (!storagePaths.length) {
    return state;
  }

  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths,
  });
  return normalizeCharacterSheetPresetState({
    activePresetId: state.activePresetId,
    presets: Object.fromEntries(
      Object.entries(state.presets).map(([presetId, assignments]) => [
        presetId,
        Object.fromEntries(
          Object.entries(assignments).map(([zoneKey, reference]) => {
            if (!reference) {
              return [zoneKey, null];
            }
            return [
              zoneKey,
              {
                ...reference,
                previewUrl:
                  signedByPath.get(reference.previewStoragePath ?? reference.storagePath) ??
                  reference.previewUrl,
              },
            ];
          })
        ),
      ])
    ) as Partial<Record<CharacterSheetPresetId, CharacterSheetPresetAssignments>>,
    tabOrder: state.tabOrder,
    tabLabels: state.tabLabels,
    tabDescriptions: state.tabDescriptions,
  });
};

export const loadCharacterPresetState = async (
  characterId: string,
  loadErrorMessage: string
): Promise<LoadCharacterPresetStateResult> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, loadErrorMessage));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(characterRow.description),
    }) ?? createDefaultCharacterSheetPresetState();

  return {
    characterRow,
    existingState,
    supabase,
    userId,
  };
};

export const persistCharacterPresetState = async ({
  characterId,
  characterRow,
  nextState,
  saveErrorMessage,
  supabase,
  userId,
}: {
  characterId: string;
  characterRow: CharacterPresetMetadataRow;
  nextState: CharacterSheetPresetState;
  saveErrorMessage: string;
  supabase: Awaited<ReturnType<typeof resolveSupabaseContext>>["supabase"];
  userId: string;
}): Promise<void> => {
  const nextMetadata = toMetadataRecord(characterRow.metadata);
  nextMetadata[CHARACTER_SHEET_PRESETS_KEY] = serializeCharacterSheetPresetState(nextState);

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", characterId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, saveErrorMessage));
  }
};

export const clearDeletedPresetAssignments = (
  state: CharacterSheetPresetState,
  presetId: CharacterSheetPresetId
): CharacterSheetPresetState =>
  normalizeCharacterSheetPresetState({
    activePresetId: state.activePresetId,
    presets: {
      ...state.presets,
      [presetId]: createEmptyCharacterSheetPresetAssignments(),
    },
    tabOrder: state.tabOrder,
    tabLabels: state.tabLabels,
    tabDescriptions: state.tabDescriptions,
  });

export const normalizePresetAssignmentsForSave = (
  assignments: CharacterSheetPresetAssignments
): CharacterSheetPresetAssignments => normalizeCharacterSheetPresetAssignments(assignments);
