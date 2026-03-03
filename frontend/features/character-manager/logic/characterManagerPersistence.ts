/**
 * Character Manager persistence orchestrator.
 * Exposes high-level operations used by the Character Manager draft hook.
 */
import { getSignedMediaUrl, getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import {
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import type {
  CharacterSheetAssignments,
  CharacterSheetPresetDescriptionMap,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetLabelMap,
  CharacterSheetPresetId,
  CharacterSheetPresetMediaReference,
  CharacterSheetPresetState,
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSlotFile,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
  CharacterSlotValidationStatus,
} from "../types";
import {
  asErrorMessage,
  CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY,
  CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY,
  CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY,
  CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY,
  CHARACTER_PROFILE_IMAGE_ZOOM_KEY,
  CHARACTER_REFERENCE_SOURCE,
  CHARACTER_SHEET_PRESETS_KEY,
  CHARACTER_SHEET_ASSIGNMENTS_KEY,
  LEGACY_CHARACTER_SHEET_ASSIGNMENTS_KEY,
  cleanupOrphanedMedia,
  createCharacterSheetPresetStoragePath,
  createCharacterProfileStoragePath,
  createDraftCharacter,
  createStoragePath,
  DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM,
  DEFAULT_CHARACTER_NAME,
  fetchCharacterManagerList,
  getCharacterSheetPresetState,
  getCharacterSheetAssignments,
  listCharacterSheetPresetMediaReferences,
  normalizeCharacterSheetPresetAssignments,
  normalizeCharacterSheetPresetState,
  getCharacterProfileImageMetadata,
  getCharacterProfileImageTransform,
  loadSlotFilesForCharacterSheet,
  normalizeCharacterSheetAssignments,
  serializeCharacterSheetPresetState,
  resolveCharacterSheet,
  resolveSupabaseContext,
} from "./characterManagerPersistenceCore";
import {
  createNormalizedCharacterSheetPresetTabDescriptions,
  createNormalizedCharacterSheetPresetTabLabels,
  normalizeCharacterSheetPresetTabOrder,
  sanitizeCharacterSheetPresetDescription,
  sanitizeCharacterSheetPresetTabLabel,
} from "./characterSheetPresetTabs";

export type { CharacterManagerListItem } from "./characterManagerPersistenceCore";

const MEDIA_BUCKET = "media_library";

export type CharacterManagerDraftSnapshot = {
  characterId: string;
  characterSheetId: string;
  characterName: string;
  legacyCharacterDescription: string;
  characterDescription: string;
  characterSheetAssignments: CharacterSheetAssignments;
  activeCharacterSheetPresetId: CharacterSheetPresetId;
  characterSheetPresets: CharacterSheetPresetState["presets"];
  visibleCharacterSheetPresetIds: CharacterSheetPresetState["tabOrder"];
  characterSheetPresetLabels: CharacterSheetPresetLabelMap;
  characterSheetPresetDescriptions: CharacterSheetPresetDescriptionMap;
  characterSheetPresetAssignments: CharacterSheetPresetAssignments;
  profileImageUrl: string | null;
  profileImageTransform: CharacterProfileImageTransform;
  slots: CharacterSlotFileMap;
};

type SaveCharacterSlotInput = {
  characterId: string;
  characterSheetId: string;
  slotKey: CharacterReferenceSlotKey;
  file: File;
  validationStatus: CharacterSlotValidationStatus;
  validationNotes: CharacterSlotValidationNotes;
};

type SaveCharacterProfileImageInput = {
  characterId: string;
  file: File;
};

type SaveCharacterProfileImageAdjustmentsInput = {
  characterId: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type SaveCharacterSheetPresetAssetInput = {
  characterId: string;
  file: File;
};

const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeProfileImageTransform = (
  transform: CharacterProfileImageTransform
): CharacterProfileImageTransform => ({
  zoom: clamp(transform.zoom, PROFILE_ZOOM_MIN, PROFILE_ZOOM_MAX),
  offsetX: Math.round(clamp(transform.offsetX, PROFILE_OFFSET_MIN, PROFILE_OFFSET_MAX)),
  offsetY: Math.round(clamp(transform.offsetY, PROFILE_OFFSET_MIN, PROFILE_OFFSET_MAX)),
});

const toMetadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const isMissingRelationError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );

const toPresetReferenceFromSlot = (
  slotFile: CharacterSlotFile | null
): CharacterSheetPresetMediaReference | null => {
  if (!slotFile) return null;
  return {
    mediaFileId: slotFile.mediaFileId,
    storagePath: slotFile.storagePath,
    previewUrl: slotFile.previewUrl,
  };
};

const buildPresetStateFromLegacyAssignments = (
  assignments: CharacterSheetAssignments,
  slots: CharacterSlotFileMap
): CharacterSheetPresetState => {
  const presetState = createDefaultCharacterSheetPresetState();
  const presetOne = createEmptyCharacterSheetPresetAssignments();
  for (const [zoneKey, slotKey] of Object.entries(assignments)) {
    if (!slotKey) continue;
    const zone = zoneKey as CharacterSheetDropZoneKey;
    presetOne[zone] = toPresetReferenceFromSlot(slots[slotKey]) ?? null;
  }
  presetState.presets["1"] = presetOne;
  return presetState;
};

const hydratePresetStatePreviewUrls = async (
  state: CharacterSheetPresetState,
  slots: CharacterSlotFileMap
): Promise<CharacterSheetPresetState> => {
  const storagePaths = Array.from(
    new Set(
      Object.values(state.presets)
        .flatMap((assignments) => Object.values(assignments))
        .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference))
        .map((reference) => reference.storagePath)
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
            if (!reference) return [zoneKey, null];
            const slotPreviewMatch = Object.values(slots).find(
              (slot) =>
                slot?.mediaFileId === reference.mediaFileId ||
                slot?.storagePath === reference.storagePath
            );
            return [
              zoneKey,
              {
                ...reference,
                previewUrl:
                  signedByPath.get(reference.storagePath) ??
                  slotPreviewMatch?.previewUrl ??
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

const toLegacyCharacterDescription = (description: string | null | undefined): string =>
  sanitizeCharacterSheetPresetDescription(description);

const toCharacterSnapshot = async (input: {
  characterId: string;
  characterName: string;
  characterDescription: string | null | undefined;
  characterMetadata?: unknown;
}): Promise<CharacterManagerDraftSnapshot> => {
  const characterSheet = await resolveCharacterSheet(input.characterId);
  const slots = await loadSlotFilesForCharacterSheet(characterSheet.id);
  const profileMetadata = getCharacterProfileImageMetadata(input.characterMetadata);
  const profileImageTransform = normalizeProfileImageTransform(
    getCharacterProfileImageTransform(input.characterMetadata)
  );
  const legacyCharacterDescription = toLegacyCharacterDescription(input.characterDescription);
  const characterSheetAssignments = getCharacterSheetAssignments(input.characterMetadata);
  const persistedPresetState = getCharacterSheetPresetState(input.characterMetadata, {
    legacyCharacterDescription,
  });
  const resolvedPresetState = persistedPresetState
    ? await hydratePresetStatePreviewUrls(persistedPresetState, slots)
    : await hydratePresetStatePreviewUrls(
        buildPresetStateFromLegacyAssignments(characterSheetAssignments, slots),
        slots
      );
  const activeCharacterSheetPresetId = resolvedPresetState.activePresetId;
  const characterSheetPresets = resolvedPresetState.presets;
  const visibleCharacterSheetPresetIds = resolvedPresetState.tabOrder;
  const characterSheetPresetLabels = resolvedPresetState.tabLabels;
  const characterSheetPresetDescriptions = resolvedPresetState.tabDescriptions;
  const characterSheetPresetAssignments =
    characterSheetPresets[activeCharacterSheetPresetId] ??
    createEmptyCharacterSheetPresetAssignments();
  const profileImageUrl = profileMetadata.storagePath
    ? await getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath: profileMetadata.storagePath,
      })
    : null;
  return {
    characterId: input.characterId,
    characterSheetId: characterSheet.id,
    characterName: input.characterName.trim() || DEFAULT_CHARACTER_NAME,
    legacyCharacterDescription,
    characterDescription: characterSheetPresetDescriptions[activeCharacterSheetPresetId] ?? "",
    characterSheetAssignments,
    activeCharacterSheetPresetId,
    characterSheetPresets,
    visibleCharacterSheetPresetIds,
    characterSheetPresetLabels,
    characterSheetPresetDescriptions,
    characterSheetPresetAssignments,
    profileImageUrl,
    profileImageTransform,
    slots,
  };
};

/**
 * Lists user characters for the Character Manager rail with draft-completion metadata.
 */
export const listCharacterManagerCharacters = fetchCharacterManagerList;

/**
 * Loads the latest character draft and its reference slot state. Creates one when missing.
 */
export const loadOrCreateCharacterManagerDraft = async (
  preferredCharacterId?: string | null
): Promise<CharacterManagerDraftSnapshot> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const normalizedPreferredCharacterId = preferredCharacterId?.trim() || null;
  if (normalizedPreferredCharacterId) {
    const { data: preferredCharacterData, error: preferredCharacterError } = await supabase
      .from("characters")
      .select("id, name, description, status, metadata")
      .eq("user_id", userId)
      .eq("id", normalizedPreferredCharacterId)
      .maybeSingle();
    if (preferredCharacterError) {
      throw new Error(asErrorMessage(preferredCharacterError, "Failed to load characters."));
    }
    const preferredCharacter = preferredCharacterData as {
      id: string;
      name: string | null;
      description: string | null;
      status: string;
      metadata: unknown;
    } | null;
    if (preferredCharacter && preferredCharacter.status !== "archived") {
      return toCharacterSnapshot({
        characterId: preferredCharacter.id,
        characterName: preferredCharacter.name || DEFAULT_CHARACTER_NAME,
        characterDescription: preferredCharacter.description ?? "",
        characterMetadata: preferredCharacter.metadata,
      });
    }
  }

  const { data, error } = await supabase
    .from("characters")
    .select("id, name, description, metadata")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to load characters."));
  }

  const character = (data as {
    id: string;
    name: string | null;
    description: string | null;
    metadata: unknown;
  } | null)
    ? (data as {
        id: string;
        name: string | null;
        description: string | null;
        metadata: unknown;
      })
    : (await createDraftCharacter(DEFAULT_CHARACTER_NAME)).character;
  return toCharacterSnapshot({
    characterId: character.id,
    characterName: character.name || DEFAULT_CHARACTER_NAME,
    characterDescription: character.description ?? "",
    characterMetadata: character.metadata,
  });
};

/**
 * Creates a fresh character draft and empty character sheet.
 */
export const createCharacterManagerDraft = async (
  name = DEFAULT_CHARACTER_NAME
): Promise<CharacterManagerDraftSnapshot> => {
  const { character, characterSheet } = await createDraftCharacter(name);
  const presetState = createDefaultCharacterSheetPresetState();
  const legacyCharacterDescription = toLegacyCharacterDescription(character.description);
  return {
    characterId: character.id,
    characterSheetId: characterSheet.id,
    characterName: character.name?.trim() || DEFAULT_CHARACTER_NAME,
    legacyCharacterDescription,
    characterDescription: presetState.tabDescriptions[presetState.activePresetId] ?? "",
    characterSheetAssignments: getCharacterSheetAssignments(character.metadata),
    activeCharacterSheetPresetId: presetState.activePresetId,
    characterSheetPresets: presetState.presets,
    visibleCharacterSheetPresetIds: presetState.tabOrder,
    characterSheetPresetLabels: presetState.tabLabels,
    characterSheetPresetDescriptions: presetState.tabDescriptions,
    characterSheetPresetAssignments: presetState.presets[presetState.activePresetId],
    profileImageUrl: null,
    profileImageTransform: { ...DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM },
    slots: await loadSlotFilesForCharacterSheet(characterSheet.id),
  };
};

/**
 * Loads a specific character draft and latest character sheet by character id.
 */
export const loadCharacterManagerDraftByCharacterId = async (
  characterId: string
): Promise<CharacterManagerDraftSnapshot> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, description, status, metadata")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to load character."));
  }

  const character = data as {
    id: string;
    name: string | null;
    description: string | null;
    status: string;
    metadata: unknown;
  } | null;
  if (!character || character.status === "archived") {
    throw new Error("Character is no longer available.");
  }

  return toCharacterSnapshot({
    characterId: character.id,
    characterName: character.name || DEFAULT_CHARACTER_NAME,
    characterDescription: character.description ?? "",
    characterMetadata: character.metadata,
  });
};

/**
 * Upload and persist the character profile image so it survives refreshes and tab switches.
 */
export const saveCharacterManagerProfileImage = async (
  input: SaveCharacterProfileImageInput
): Promise<string> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", input.characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character profile metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingProfile = getCharacterProfileImageMetadata(characterRow.metadata);
  const mimeType = input.file.type || "image/jpeg";
  const storagePath = createCharacterProfileStoragePath({
    userId,
    characterId: input.characterId,
    filename: input.file.name,
    mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: mimeType,
    });
  if (uploadError) {
    throw new Error(asErrorMessage(uploadError, "Failed to upload profile image."));
  }

  const { data: mediaRow, error: mediaInsertError } = await supabase
    .from("media_files")
    .insert({
      user_id: userId,
      filename: input.file.name,
      storage_path: storagePath,
      file_type: "image",
      file_size: input.file.size,
      source: "upload",
      metadata: {
        character_id: input.characterId,
        role: "character_profile",
      },
    })
    .select("id")
    .single();
  if (mediaInsertError || !mediaRow?.id) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(mediaInsertError, "Failed to save profile image metadata."));
  }

  const nextMetadata = toMetadataRecord(characterRow.metadata);
  nextMetadata[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY] = storagePath;
  nextMetadata[CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY] = mediaRow.id;
  nextMetadata[CHARACTER_PROFILE_IMAGE_ZOOM_KEY] = DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.zoom;
  nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY] =
    DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.offsetX;
  nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY] =
    DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.offsetY;

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", input.characterId);
  if (updateError) {
    await cleanupOrphanedMedia({
      mediaFileId: mediaRow.id,
      storagePath,
    });
    throw new Error(asErrorMessage(updateError, "Failed to save profile image on character."));
  }

  if (existingProfile.mediaFileId && existingProfile.mediaFileId !== mediaRow.id) {
    await cleanupOrphanedMedia({
      mediaFileId: existingProfile.mediaFileId,
      storagePath: existingProfile.storagePath,
    });
  }

  const signedUrl = await getSignedMediaUrl({
    bucket: MEDIA_BUCKET,
    storagePath,
    forceRefresh: true,
  });
  if (!signedUrl) {
    throw new Error("Profile image saved, but preview URL could not be created.");
  }
  return signedUrl;
};

/**
 * Remove a persisted character profile image.
 */
export const clearCharacterManagerProfileImage = async ({
  characterId,
}: {
  characterId: string;
}): Promise<void> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character profile metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingProfile = getCharacterProfileImageMetadata(characterRow.metadata);
  if (!existingProfile.mediaFileId && !existingProfile.storagePath) {
    return;
  }

  const nextMetadata = toMetadataRecord(characterRow.metadata);
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY];
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY];
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_ZOOM_KEY];
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY];
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY];

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", characterId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to clear character profile image."));
  }

  if (existingProfile.mediaFileId) {
    await cleanupOrphanedMedia({
      mediaFileId: existingProfile.mediaFileId,
      storagePath: existingProfile.storagePath,
    });
  }
};

/**
 * Persist profile-image framing controls so crop/position survives refreshes.
 */
export const saveCharacterManagerProfileImageAdjustments = async (
  input: SaveCharacterProfileImageAdjustmentsInput
): Promise<CharacterProfileImageTransform> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", input.characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character profile metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingProfile = getCharacterProfileImageMetadata(characterRow.metadata);
  if (!existingProfile.storagePath) {
    throw new Error("Upload a profile image before saving framing adjustments.");
  }

  const nextTransform = normalizeProfileImageTransform({
    zoom: input.zoom,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
  });
  const nextMetadata = toMetadataRecord(characterRow.metadata);
  nextMetadata[CHARACTER_PROFILE_IMAGE_ZOOM_KEY] = nextTransform.zoom;
  nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY] = nextTransform.offsetX;
  nextMetadata[CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY] = nextTransform.offsetY;

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", input.characterId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to save profile image adjustments."));
  }

  return nextTransform;
};

/**
 * Persists character naming changes for the current draft.
 */
export const updateCharacterManagerName = async ({
  characterId,
  name,
}: {
  characterId: string;
  name: string;
}) => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Character name must be at least 2 characters.");
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase
    .from("characters")
    .update({
      name: trimmedName,
    })
    .eq("user_id", userId)
    .eq("id", characterId);
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to save character name."));
  }
};

/**
 * Persists character description changes for the current draft.
 */
export const updateCharacterManagerDescription = async ({
  characterId,
  description,
}: {
  characterId: string;
  description: string;
}) => {
  const normalizedDescription = description.slice(0, 150);
  const { supabase, userId } = await resolveSupabaseContext();
  const { error } = await supabase
    .from("characters")
    .update({
      description: normalizedDescription,
    })
    .eq("user_id", userId)
    .eq("id", characterId);
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to save character description."));
  }
};

/**
 * Persist character-sheet card assignments in character metadata.
 */
export const saveCharacterManagerCharacterSheetAssignments = async ({
  characterId,
  assignments,
}: {
  characterId: string;
  assignments: CharacterSheetAssignments;
}): Promise<CharacterSheetAssignments> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const normalizedAssignments = normalizeCharacterSheetAssignments(assignments);
  const nextMetadata = toMetadataRecord(characterRow.metadata);
  nextMetadata[CHARACTER_SHEET_ASSIGNMENTS_KEY] = normalizedAssignments;
  nextMetadata[LEGACY_CHARACTER_SHEET_ASSIGNMENTS_KEY] = normalizedAssignments;

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", characterId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to save character sheet assignments."));
  }

  return normalizedAssignments;
};

const listPresetReferencesFromState = (
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

const hydratePresetStateWithPreviewUrls = async (
  state: CharacterSheetPresetState
): Promise<CharacterSheetPresetState> => {
  const storagePaths = Array.from(
    new Set(
      Object.values(state.presets)
        .flatMap((assignments) => Object.values(assignments))
        .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference))
        .map((reference) => reference.storagePath)
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
                previewUrl: signedByPath.get(reference.storagePath) ?? reference.previewUrl,
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

/**
 * Persist active character-sheet preset tab selection.
 */
export const saveCharacterManagerActiveCharacterSheetPreset = async ({
  characterId,
  presetId,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
}): Promise<CharacterSheetPresetState> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: presetId,
    presets: existingState.presets,
    tabOrder: existingState.tabOrder,
    tabLabels: existingState.tabLabels,
    tabDescriptions: existingState.tabDescriptions,
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to save active character preset tab."));
  }

  return nextState;
};

/**
 * Persist a single preset tab's character-sheet assignments.
 */
export const saveCharacterManagerCharacterSheetPresetAssignments = async ({
  characterId,
  presetId,
  assignments,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
  assignments: CharacterSheetPresetAssignments;
}): Promise<CharacterSheetPresetState> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const previousState = normalizeCharacterSheetPresetState(existingState);
  const normalizedAssignments = normalizeCharacterSheetPresetAssignments(assignments);
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: previousState.activePresetId,
    presets: {
      ...previousState.presets,
      [presetId]: normalizedAssignments,
    },
    tabOrder: previousState.tabOrder,
    tabLabels: previousState.tabLabels,
    tabDescriptions: previousState.tabDescriptions,
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to save character sheet preset."));
  }

  const previousReferences = listPresetReferencesFromState(previousState);
  const nextReferences = listPresetReferencesFromState(nextState);
  const nextById = new Set(nextReferences.map((reference) => reference.mediaFileId));
  await Promise.allSettled(
    previousReferences
      .filter((reference) => !nextById.has(reference.mediaFileId))
      .map((reference) =>
        cleanupOrphanedMedia({
          mediaFileId: reference.mediaFileId,
          storagePath: reference.storagePath,
        })
      )
  );

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Persist visible character-sheet preset tab order and active tab selection.
 */
export const saveCharacterManagerCharacterSheetPresetTabOrder = async ({
  characterId,
  tabOrder,
  activePresetId,
}: {
  characterId: string;
  tabOrder: CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
}): Promise<CharacterSheetPresetState> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId,
    presets: existingState.presets,
    tabOrder: normalizeCharacterSheetPresetTabOrder({
      tabOrder,
      activePresetId,
    }),
    tabLabels: existingState.tabLabels,
    tabDescriptions: existingState.tabDescriptions,
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to save character preset tabs."));
  }

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Persist a display label for a single visible character-sheet preset tab.
 */
export const saveCharacterManagerCharacterSheetPresetTabLabel = async ({
  characterId,
  presetId,
  label,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
  label: string;
}): Promise<CharacterSheetPresetState> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const nextTabLabels = createNormalizedCharacterSheetPresetTabLabels({
    labels: {
      ...existingState.tabLabels,
      [presetId]: sanitizeCharacterSheetPresetTabLabel({
        presetId,
        label,
      }),
    },
  });
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: existingState.activePresetId,
    presets: existingState.presets,
    tabOrder: existingState.tabOrder,
    tabLabels: nextTabLabels,
    tabDescriptions: existingState.tabDescriptions,
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to save character preset label."));
  }

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Persist a description for a single preset tab.
 */
export const saveCharacterManagerCharacterSheetPresetTabDescription = async ({
  characterId,
  presetId,
  description,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
  description: string;
}): Promise<CharacterSheetPresetState> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const nextTabDescriptions = createNormalizedCharacterSheetPresetTabDescriptions({
    descriptions: {
      ...existingState.tabDescriptions,
      [presetId]: sanitizeCharacterSheetPresetDescription(description),
    },
  });
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: existingState.activePresetId,
    presets: existingState.presets,
    tabOrder: existingState.tabOrder,
    tabLabels: existingState.tabLabels,
    tabDescriptions: nextTabDescriptions,
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to save character preset description."));
  }

  return nextState;
};

const resolveActivePresetAfterDelete = ({
  originalTabOrder,
  filteredTabOrder,
  presetId,
  requestedActivePresetId,
}: {
  originalTabOrder: CharacterSheetPresetId[];
  filteredTabOrder: CharacterSheetPresetId[];
  presetId: CharacterSheetPresetId;
  requestedActivePresetId: CharacterSheetPresetId;
}): CharacterSheetPresetId | null => {
  if (!filteredTabOrder.length) return null;

  if (requestedActivePresetId !== presetId && filteredTabOrder.includes(requestedActivePresetId)) {
    return requestedActivePresetId;
  }

  const deletedIndex = originalTabOrder.indexOf(presetId);
  if (deletedIndex >= 0) {
    for (let index = deletedIndex - 1; index >= 0; index -= 1) {
      const candidate = originalTabOrder[index];
      if (candidate && filteredTabOrder.includes(candidate)) {
        return candidate;
      }
    }
    for (let index = deletedIndex + 1; index < originalTabOrder.length; index += 1) {
      const candidate = originalTabOrder[index];
      if (candidate && filteredTabOrder.includes(candidate)) {
        return candidate;
      }
    }
  }

  return filteredTabOrder[0] ?? null;
};

/**
 * Permanently delete a visible preset tab and clear its assignments.
 */
export const deleteCharacterManagerCharacterSheetPreset = async ({
  characterId,
  presetId,
  nextTabOrder,
  nextActivePresetId,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
  nextTabOrder: CharacterSheetPresetId[];
  nextActivePresetId: CharacterSheetPresetId;
}): Promise<CharacterSheetPresetState> => {
  if (presetId === "1") {
    throw new Error("Preset tab 1 cannot be deleted.");
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterError } = await supabase
    .from("characters")
    .select("metadata, description")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterError) {
    throw new Error(asErrorMessage(characterError, "Failed to load character metadata."));
  }
  if (!characterRow) {
    throw new Error("Character is no longer available.");
  }

  const existingState =
    getCharacterSheetPresetState(characterRow.metadata, {
      legacyCharacterDescription: toLegacyCharacterDescription(
        (characterRow as { description?: string | null }).description
      ),
    }) ?? createDefaultCharacterSheetPresetState();
  const previousState = normalizeCharacterSheetPresetState(existingState);
  if (!previousState.tabOrder.includes(presetId)) {
    return previousState;
  }

  const requestedFilteredTabOrder = nextTabOrder.filter(
    (visiblePresetId) =>
      visiblePresetId !== presetId && previousState.tabOrder.includes(visiblePresetId)
  );
  const filteredTabOrder = requestedFilteredTabOrder.length
    ? requestedFilteredTabOrder
    : previousState.tabOrder.filter((visiblePresetId) => visiblePresetId !== presetId);
  if (!filteredTabOrder.length) {
    throw new Error("At least one preset tab must remain visible.");
  }
  const resolvedActivePresetId = resolveActivePresetAfterDelete({
    originalTabOrder: previousState.tabOrder,
    filteredTabOrder,
    presetId,
    requestedActivePresetId: nextActivePresetId,
  });
  if (!resolvedActivePresetId) {
    throw new Error("At least one preset tab must remain visible.");
  }
  const normalizedTabOrder = normalizeCharacterSheetPresetTabOrder({
    tabOrder: filteredTabOrder,
    activePresetId: resolvedActivePresetId,
  });
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: resolvedActivePresetId,
    presets: {
      ...previousState.presets,
      [presetId]: createEmptyCharacterSheetPresetAssignments(),
    },
    tabOrder: normalizedTabOrder,
    tabLabels: {
      ...previousState.tabLabels,
      [presetId]: presetId,
    },
    tabDescriptions: {
      ...previousState.tabDescriptions,
      [presetId]: "",
    },
  });
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
    throw new Error(asErrorMessage(updateError, "Failed to delete character preset tab."));
  }

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Upload and persist a character-sheet preset image asset.
 */
export const saveCharacterManagerCharacterSheetPresetAsset = async (
  input: SaveCharacterSheetPresetAssetInput
): Promise<CharacterSheetPresetMediaReference> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const mimeType = input.file.type || "image/jpeg";
  const storagePath = createCharacterSheetPresetStoragePath({
    userId,
    characterId: input.characterId,
    filename: input.file.name,
    mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: mimeType,
    });
  if (uploadError) {
    throw new Error(asErrorMessage(uploadError, "Failed to upload character preset image."));
  }

  const { data: mediaRow, error: mediaInsertError } = await supabase
    .from("media_files")
    .insert({
      user_id: userId,
      filename: input.file.name,
      storage_path: storagePath,
      file_type: "image",
      file_size: input.file.size,
      source: "upload",
      metadata: {
        character_id: input.characterId,
        role: "character_sheet_preset",
      },
    })
    .select("id")
    .single();
  if (mediaInsertError || !mediaRow?.id) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(mediaInsertError, "Failed to save character preset metadata."));
  }

  const signedUrl = await getSignedMediaUrl({
    bucket: MEDIA_BUCKET,
    storagePath,
    forceRefresh: true,
  });
  if (!signedUrl) {
    throw new Error("Preset image saved, but preview URL could not be created.");
  }

  return {
    mediaFileId: mediaRow.id,
    storagePath,
    previewUrl: signedUrl,
  };
};

/**
 * Permanently deletes a character draft and best-effort cleans orphaned reference media rows/files.
 */
export const deleteCharacterManagerDraft = async ({ characterId }: { characterId: string }) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRow, error: characterRowError } = await supabase
    .from("characters")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (characterRowError) {
    throw new Error(asErrorMessage(characterRowError, "Failed to load character metadata."));
  }

  const { data: mediaRows, error: mediaRowsError } = await supabase
    .from("character_reference_images")
    .select("media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("character_id", characterId);
  if (mediaRowsError) {
    throw new Error(asErrorMessage(mediaRowsError, "Failed to load character media for deletion."));
  }

  const { data: quickSwapRows, error: quickSwapRowsError } = await supabase
    .from("character_quick_swap_items")
    .select("media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("character_id", characterId);
  if (quickSwapRowsError && !isMissingRelationError(quickSwapRowsError)) {
    throw new Error(
      asErrorMessage(quickSwapRowsError, "Failed to load quick swap media for deletion.")
    );
  }

  const profileMedia = getCharacterProfileImageMetadata(characterRow?.metadata);
  const presetCleanupCandidates = listCharacterSheetPresetMediaReferences(characterRow?.metadata);
  const referenceCleanupCandidates = Array.from(
    new Map(
      ((mediaRows ?? []) as Array<{ media_file_id: string; storage_path: string | null }>).map(
        (row) => [
          row.media_file_id,
          {
            mediaFileId: row.media_file_id,
            storagePath: row.storage_path ?? null,
          },
        ]
      )
    ).values()
  );
  const quickSwapCleanupCandidates = Array.from(
    new Map(
      ((quickSwapRows ?? []) as Array<{ media_file_id: string; storage_path: string | null }>).map(
        (row) => [
          row.media_file_id,
          {
            mediaFileId: row.media_file_id,
            storagePath: row.storage_path ?? null,
          },
        ]
      )
    ).values()
  );
  const cleanupCandidates = profileMedia.mediaFileId
    ? [
        ...referenceCleanupCandidates,
        ...quickSwapCleanupCandidates,
        ...presetCleanupCandidates,
        {
          mediaFileId: profileMedia.mediaFileId,
          storagePath: profileMedia.storagePath,
        },
      ]
    : [...referenceCleanupCandidates, ...quickSwapCleanupCandidates, ...presetCleanupCandidates];

  const { error: deleteCharacterError } = await supabase
    .from("characters")
    .delete()
    .eq("user_id", userId)
    .eq("id", characterId);
  if (deleteCharacterError) {
    throw new Error(asErrorMessage(deleteCharacterError, "Failed to delete character."));
  }

  await Promise.allSettled(
    cleanupCandidates.map((candidate) =>
      cleanupOrphanedMedia({
        mediaFileId: candidate.mediaFileId,
        storagePath: candidate.storagePath,
      })
    )
  );
};

/**
 * Uploads and assigns a slot image to the current character sheet.
 */
export const saveCharacterManagerSlot = async (
  input: SaveCharacterSlotInput
): Promise<CharacterSlotFile> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingRowError } = await supabase
    .from("character_reference_images")
    .select("id, media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("character_sheet_id", input.characterSheetId)
    .eq("slot_key", input.slotKey)
    .maybeSingle();
  if (existingRowError) {
    throw new Error(asErrorMessage(existingRowError, "Failed to load existing slot image."));
  }

  const mimeType = input.file.type || "image/jpeg";
  const storagePath = createStoragePath({
    userId,
    characterId: input.characterId,
    characterSheetId: input.characterSheetId,
    slotKey: input.slotKey,
    filename: input.file.name,
    mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: mimeType,
    });
  if (uploadError) {
    throw new Error(asErrorMessage(uploadError, "Failed to upload reference image."));
  }

  const { data: mediaRow, error: mediaInsertError } = await supabase
    .from("media_files")
    .insert({
      user_id: userId,
      filename: input.file.name,
      storage_path: storagePath,
      file_type: "image",
      file_size: input.file.size,
      source: CHARACTER_REFERENCE_SOURCE,
      metadata: {
        character_id: input.characterId,
        character_sheet_id: input.characterSheetId,
        reference_pack_id: input.characterSheetId,
        slot_key: input.slotKey,
      },
    })
    .select("id, filename, file_type, file_size, created_at")
    .single();
  if (mediaInsertError || !mediaRow) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(mediaInsertError, "Failed to save uploaded image metadata."));
  }

  const { error: upsertError } = await supabase.from("character_reference_images").upsert(
    {
      character_id: input.characterId,
      character_sheet_id: input.characterSheetId,
      reference_pack_id: input.characterSheetId,
      user_id: userId,
      slot_key: input.slotKey,
      media_file_id: mediaRow.id,
      storage_path: storagePath,
      validation_status: input.validationStatus,
      validation_notes: input.validationNotes,
    },
    {
      onConflict: "character_sheet_id,slot_key",
    }
  );
  if (upsertError) {
    try {
      await cleanupOrphanedMedia({
        mediaFileId: mediaRow.id,
        storagePath,
      });
    } catch {
      // Cleanup failure should not mask assignment failure.
    }
    throw new Error(asErrorMessage(upsertError, "Failed to assign image to this shot."));
  }

  if (existingRow?.media_file_id && existingRow.media_file_id !== mediaRow.id) {
    await cleanupOrphanedMedia({
      mediaFileId: existingRow.media_file_id,
      storagePath: existingRow.storage_path ?? null,
    });
  }

  const signedUrl = await getSignedMediaUrl({
    bucket: MEDIA_BUCKET,
    storagePath,
    forceRefresh: true,
  });
  if (!signedUrl) {
    throw new Error("Uploaded image saved, but preview URL could not be created.");
  }

  return {
    mediaFileId: mediaRow.id,
    storagePath,
    validationStatus: input.validationStatus,
    validationNotes: input.validationNotes,
    name: mediaRow.filename?.trim() || input.file.name,
    size: Number(mediaRow.file_size ?? input.file.size),
    type: mediaRow.file_type ?? "image",
    previewUrl: signedUrl,
    updatedAt: mediaRow.created_at || new Date().toISOString(),
  };
};

/**
 * Removes a slot image from the current character sheet and cleans up orphaned storage.
 */
export const clearCharacterManagerSlot = async ({
  characterSheetId,
  slotKey,
}: {
  characterSheetId: string;
  slotKey: CharacterReferenceSlotKey;
}) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingRowError } = await supabase
    .from("character_reference_images")
    .select("id, media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("character_sheet_id", characterSheetId)
    .eq("slot_key", slotKey)
    .maybeSingle();
  if (existingRowError) {
    throw new Error(asErrorMessage(existingRowError, "Failed to load slot image."));
  }
  if (!existingRow) {
    return;
  }

  const { error: deleteRowError } = await supabase
    .from("character_reference_images")
    .delete()
    .eq("id", existingRow.id)
    .eq("user_id", userId);
  if (deleteRowError) {
    throw new Error(asErrorMessage(deleteRowError, "Failed to remove shot image."));
  }

  await cleanupOrphanedMedia({
    mediaFileId: existingRow.media_file_id,
    storagePath: existingRow.storage_path ?? null,
  });
};
