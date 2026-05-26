/**
 * Character Manager persistence orchestrator.
 * Exposes high-level operations used by the Character Manager draft hook.
 */
import { getSignedMediaUrl, getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
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
  CHARACTER_PROFILE_IMAGE_CHARACTER_MEDIA_ID_KEY,
  CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY,
  CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY,
  CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY,
  CHARACTER_PROFILE_IMAGE_ZOOM_KEY,
  CHARACTER_SHEET_ASSIGNMENTS_KEY,
  CHARACTER_SHEET_PRESETS_KEY,
  cleanupOrphanedMedia,
  createCharacterMediaAsset,
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
  normalizeCharacterSheetPresetState,
  getCharacterProfileImageMetadata,
  getCharacterProfileImageTransform,
  loadSlotFilesForCharacterSheet,
  normalizeCharacterSheetAssignments,
  resolveCharacterSheet,
  resolveSupabaseContext,
  serializeCharacterSheetPresetState,
} from "./characterManagerPersistenceCore";
import {
  clearDeletedPresetAssignments,
  hydratePresetStateWithPreviewUrls,
  listPresetReferencesFromState,
  loadCharacterPresetState,
  normalizePresetAssignmentsForSave,
  persistCharacterPresetState,
  toLegacyCharacterDescription,
} from "./characterManagerPresetPersistence";
import {
  createNormalizedCharacterSheetPresetTabDescriptions,
  createNormalizedCharacterSheetPresetTabLabels,
  normalizeCharacterSheetPresetTabOrder,
  sanitizeCharacterSheetPresetDescription,
  sanitizeCharacterSheetPresetTabLabel,
} from "./characterSheetPresetTabs";

export type { CharacterManagerListItem } from "./characterManagerPersistenceCore";

const MEDIA_BUCKET = "media_library";
const LEGACY_CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY = "profile_image_media_file_id";

export type CharacterManagerDraftSnapshot = {
  userId: string;
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

type SaveCharacterManagerDraftInput = {
  name: string;
  activeCharacterSheetPresetId: CharacterSheetPresetId;
  visibleCharacterSheetPresetIds: CharacterSheetPresetState["tabOrder"];
  characterSheetPresetLabels: CharacterSheetPresetLabelMap;
  characterSheetPresetDescriptions: CharacterSheetPresetDescriptionMap;
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

export type SavedCharacterProfileImage = {
  signedUrl: string;
  characterMediaId: string | null;
  previewStoragePath: string;
  storagePath: string;
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

type PresetPreviewMediaRow = {
  id: string;
  storage_path: string;
  file_type: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
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
    characterMediaId: slotFile.characterMediaId,
    storagePath: slotFile.storagePath,
    previewStoragePath: slotFile.previewStoragePath ?? null,
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
  const references = Object.values(state.presets)
    .flatMap((assignments) => Object.values(assignments))
    .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference));
  const mediaIds = Array.from(
    new Set(references.map((reference) => reference.characterMediaId).filter(Boolean))
  );
  const previewPathCandidatesByMediaId = new Map<string, string[]>();

  if (mediaIds.length) {
    const { supabase, userId } = await resolveSupabaseContext();
    const { data: mediaRows, error: mediaRowsError } = await supabase
      .from("media_files")
      .select(
        "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .eq("user_id", userId)
      .in("id", mediaIds);
    if (mediaRowsError) {
      throw new Error(
        asErrorMessage(mediaRowsError, "Failed to hydrate character preset previews.")
      );
    }
    for (const row of (mediaRows ?? []) as PresetPreviewMediaRow[]) {
      const previewPaths = resolveMediaSigningStoragePaths(row, userId);
      previewPathCandidatesByMediaId.set(
        row.id,
        previewPaths.length ? previewPaths : [row.storage_path]
      );
    }
  }

  const storagePaths = Array.from(
    new Set(
      references.flatMap((reference) => {
        const slotPreviewMatch = Object.values(slots).find(
          (slot) =>
            slot?.characterMediaId === reference.characterMediaId ||
            slot?.storagePath === reference.storagePath
        );
        const previewPathCandidates = previewPathCandidatesByMediaId.get(
          reference.characterMediaId
        );
        return previewPathCandidates?.length
          ? previewPathCandidates
          : [
              slotPreviewMatch?.previewStoragePath ??
                reference.previewStoragePath ??
                reference.storagePath,
            ];
      })
    )
  );
  if (!storagePaths.length) {
    return state;
  }
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths,
    surface: "character-grid",
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
                slot?.characterMediaId === reference.characterMediaId ||
                slot?.storagePath === reference.storagePath
            );
            const previewPathCandidates = previewPathCandidatesByMediaId.get(
              reference.characterMediaId
            ) ?? [
              slotPreviewMatch?.previewStoragePath ??
                reference.previewStoragePath ??
                reference.storagePath,
            ];
            const previewStoragePath =
              previewPathCandidates.find(
                (path) => Boolean(path) && Boolean(signedByPath.get(path))
              ) ??
              previewPathCandidates[0] ??
              reference.storagePath;
            return [
              zoneKey,
              {
                ...reference,
                previewStoragePath,
                previewUrl:
                  signedByPath.get(previewStoragePath) ??
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

const toCharacterSnapshot = async (input: {
  userId: string;
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
    userId: input.userId,
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
 * Loads a preferred/saved character draft when one exists and returns null for first-run users.
 */
export const loadLatestCharacterManagerDraft = async (
  preferredCharacterId?: string | null
): Promise<CharacterManagerDraftSnapshot | null> => {
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
        userId,
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

  if (!data) {
    return null;
  }

  const character = data as {
    id: string;
    name: string | null;
    description: string | null;
    metadata: unknown;
  };
  return toCharacterSnapshot({
    userId,
    characterId: character.id,
    characterName: character.name || DEFAULT_CHARACTER_NAME,
    characterDescription: character.description ?? "",
    characterMetadata: character.metadata,
  });
};

/**
 * Persists a locally staged Character Profile into the database and returns the saved snapshot.
 */
export const saveCharacterManagerDraft = async ({
  name,
  activeCharacterSheetPresetId,
  visibleCharacterSheetPresetIds,
  characterSheetPresetLabels,
  characterSheetPresetDescriptions,
}: SaveCharacterManagerDraftInput): Promise<CharacterManagerDraftSnapshot> => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Character name must be at least 2 characters.");
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const { character, characterSheet } = await createDraftCharacter(trimmedName);
  const normalizedPresetState = normalizeCharacterSheetPresetState({
    activePresetId: activeCharacterSheetPresetId,
    presets: createDefaultCharacterSheetPresetState().presets,
    tabOrder: visibleCharacterSheetPresetIds,
    tabLabels: characterSheetPresetLabels,
    tabDescriptions: characterSheetPresetDescriptions,
  });
  const activeDescription =
    normalizedPresetState.tabDescriptions[normalizedPresetState.activePresetId] ?? "";
  const nextMetadata = toMetadataRecord(character.metadata);
  nextMetadata[CHARACTER_SHEET_PRESETS_KEY] =
    serializeCharacterSheetPresetState(normalizedPresetState);

  const cleanupCreatedDraft = async () => {
    await supabase
      .from("character_reference_packs")
      .delete()
      .eq("user_id", userId)
      .eq("character_id", character.id);
    await supabase.from("characters").delete().eq("user_id", userId).eq("id", character.id);
  };

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      name: trimmedName,
      description: toLegacyCharacterDescription(activeDescription),
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", character.id);
  if (updateError) {
    await cleanupCreatedDraft();
    throw new Error(asErrorMessage(updateError, "Failed to save character."));
  }

  return {
    userId,
    characterId: character.id,
    characterSheetId: characterSheet.id,
    characterName: trimmedName,
    legacyCharacterDescription: toLegacyCharacterDescription(activeDescription),
    characterDescription: activeDescription,
    characterSheetAssignments: getCharacterSheetAssignments(nextMetadata),
    activeCharacterSheetPresetId: normalizedPresetState.activePresetId,
    characterSheetPresets: normalizedPresetState.presets,
    visibleCharacterSheetPresetIds: normalizedPresetState.tabOrder,
    characterSheetPresetLabels: normalizedPresetState.tabLabels,
    characterSheetPresetDescriptions: normalizedPresetState.tabDescriptions,
    characterSheetPresetAssignments:
      normalizedPresetState.presets[normalizedPresetState.activePresetId] ??
      createEmptyCharacterSheetPresetAssignments(),
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
    userId,
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
): Promise<SavedCharacterProfileImage> => {
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

  let mediaReferenceId: string;
  try {
    const createdAsset = await createCharacterMediaAsset({
      userId,
      characterId: input.characterId,
      assetKind: "profile",
      storagePath,
      filename: input.file.name,
      fileType: "image",
      fileSize: input.file.size,
      metadata: {
        role: "character_profile",
      },
    });
    mediaReferenceId = createdAsset.id;
  } catch (nextError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(nextError, "Failed to save profile image metadata."));
  }

  const nextMetadata = toMetadataRecord(characterRow.metadata);
  nextMetadata[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY] = storagePath;
  nextMetadata[CHARACTER_PROFILE_IMAGE_CHARACTER_MEDIA_ID_KEY] = mediaReferenceId;
  delete nextMetadata[LEGACY_CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY];
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
      characterMediaId: mediaReferenceId,
      storagePath,
    });
    throw new Error(asErrorMessage(updateError, "Failed to save profile image on character."));
  }

  if (existingProfile.characterMediaId && existingProfile.characterMediaId !== mediaReferenceId) {
    await cleanupOrphanedMedia({
      characterMediaId: existingProfile.characterMediaId,
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
  return {
    signedUrl,
    characterMediaId: mediaReferenceId,
    previewStoragePath: storagePath,
    storagePath,
  };
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
  if (!existingProfile.characterMediaId && !existingProfile.storagePath) {
    return;
  }

  const nextMetadata = toMetadataRecord(characterRow.metadata);
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY];
  delete nextMetadata[LEGACY_CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY];
  delete nextMetadata[CHARACTER_PROFILE_IMAGE_CHARACTER_MEDIA_ID_KEY];
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

  if (existingProfile.characterMediaId) {
    await cleanupOrphanedMedia({
      characterMediaId: existingProfile.characterMediaId,
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

/**
 * Persist active character-sheet look tab selection.
 */
export const saveCharacterManagerActiveCharacterSheetPreset = async ({
  characterId,
  presetId,
}: {
  characterId: string;
  presetId: CharacterSheetPresetId;
}): Promise<CharacterSheetPresetState> => {
  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
  const nextState = normalizeCharacterSheetPresetState({
    activePresetId: presetId,
    presets: existingState.presets,
    tabOrder: existingState.tabOrder,
    tabLabels: existingState.tabLabels,
    tabDescriptions: existingState.tabDescriptions,
  });
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to save the active character look.",
    supabase,
    userId,
  });

  return nextState;
};

/**
 * Persist a single look tab's character-sheet assignments.
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
  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
  const previousState = normalizeCharacterSheetPresetState(existingState);
  const normalizedAssignments = normalizePresetAssignmentsForSave(assignments);
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
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to save the character look.",
    supabase,
    userId,
  });

  const previousReferences = listPresetReferencesFromState(previousState);
  const nextReferences = listPresetReferencesFromState(nextState);
  const nextById = new Set(nextReferences.map((reference) => reference.characterMediaId));
  await Promise.allSettled(
    previousReferences
      .filter((reference) => !nextById.has(reference.characterMediaId))
      .map((reference) =>
        cleanupOrphanedMedia({
          characterMediaId: reference.characterMediaId,
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
 * Persist visible character-sheet look tab order and active tab selection.
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
  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
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
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to save character looks.",
    supabase,
    userId,
  });

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Persist a display label for a single visible character-sheet look tab.
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
  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
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
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to save the look name.",
    supabase,
    userId,
  });

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Persist a description for a single look tab.
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
  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
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
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to save the look description.",
    supabase,
    userId,
  });

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
 * Permanently delete a visible look tab and clear its assignments.
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
    throw new Error("Look 1 cannot be deleted.");
  }

  const { characterRow, existingState, supabase, userId } = await loadCharacterPresetState(
    characterId,
    "Failed to load character metadata."
  );
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
    throw new Error("At least one look must remain visible.");
  }
  const resolvedActivePresetId = resolveActivePresetAfterDelete({
    originalTabOrder: previousState.tabOrder,
    filteredTabOrder,
    presetId,
    requestedActivePresetId: nextActivePresetId,
  });
  if (!resolvedActivePresetId) {
    throw new Error("At least one look must remain visible.");
  }
  const normalizedTabOrder = normalizeCharacterSheetPresetTabOrder({
    tabOrder: filteredTabOrder,
    activePresetId: resolvedActivePresetId,
  });
  const nextState = normalizeCharacterSheetPresetState({
    ...clearDeletedPresetAssignments(previousState, presetId),
    activePresetId: resolvedActivePresetId,
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
  await persistCharacterPresetState({
    characterId,
    characterRow,
    nextState,
    saveErrorMessage: "Failed to delete the character look.",
    supabase,
    userId,
  });

  try {
    return await hydratePresetStateWithPreviewUrls(nextState);
  } catch {
    return nextState;
  }
};

/**
 * Upload and persist a character-sheet look image asset.
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
    throw new Error(asErrorMessage(uploadError, "Failed to upload the character look image."));
  }

  let mediaReferenceId: string;
  try {
    const createdAsset = await createCharacterMediaAsset({
      userId,
      characterId: input.characterId,
      assetKind: "sheet_preset",
      storagePath,
      filename: input.file.name,
      fileType: "image",
      fileSize: input.file.size,
      metadata: {
        role: "character_sheet_preset",
      },
    });
    mediaReferenceId = createdAsset.id;
  } catch (nextError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(nextError, "Failed to save character look metadata."));
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
    characterMediaId: mediaReferenceId,
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
    .select("character_media_id, storage_path")
    .eq("user_id", userId)
    .eq("character_id", characterId);
  if (mediaRowsError) {
    throw new Error(asErrorMessage(mediaRowsError, "Failed to load character media for deletion."));
  }

  // Retained legacy compatibility boundary:
  // historical datasets can still contain quick-swap-owned media rows, including known contamination
  // cases from older staging/bootstrap data. Keep these cleanup candidates in delete flows until an
  // explicit compatibility/data-retirement decision says the table no longer needs protection.
  const { data: quickSwapRows, error: quickSwapRowsError } = await supabase
    .from("character_quick_swap_items")
    .select("character_media_id, storage_path")
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
      (
        (mediaRows ?? []) as Array<{
          character_media_id: string | null;
          storage_path: string | null;
        }>
      ).flatMap((row) => {
        const mediaReferenceId = row.character_media_id?.trim() || null;
        if (!mediaReferenceId) return [];
        return [
          [
            mediaReferenceId,
            {
              characterMediaId: mediaReferenceId,
              storagePath: row.storage_path ?? null,
            },
          ] as const,
        ];
      })
    ).values()
  );
  const quickSwapCleanupCandidates = Array.from(
    new Map(
      (
        (quickSwapRows ?? []) as Array<{
          character_media_id: string | null;
          storage_path: string | null;
        }>
      ).flatMap((row) => {
        const mediaReferenceId = row.character_media_id?.trim() || null;
        if (!mediaReferenceId) return [];
        return [
          [
            mediaReferenceId,
            {
              characterMediaId: mediaReferenceId,
              storagePath: row.storage_path ?? null,
            },
          ] as const,
        ];
      })
    ).values()
  );
  const cleanupCandidates = profileMedia.characterMediaId
    ? [
        ...referenceCleanupCandidates,
        ...quickSwapCleanupCandidates,
        ...presetCleanupCandidates,
        {
          characterMediaId: profileMedia.characterMediaId,
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
        characterMediaId: candidate.characterMediaId,
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
    .select("id, character_media_id, storage_path")
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

  let mediaRow: {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    created_at: string;
  };
  try {
    const createdAsset = await createCharacterMediaAsset({
      userId,
      characterId: input.characterId,
      assetKind: "sheet_slot",
      storagePath,
      filename: input.file.name,
      fileType: "image",
      fileSize: input.file.size,
      metadata: {
        character_sheet_id: input.characterSheetId,
        slot_key: input.slotKey,
        role: "character_slot",
      },
    });
    mediaRow = {
      id: createdAsset.id,
      filename: input.file.name,
      file_type: "image",
      file_size: input.file.size,
      created_at: createdAsset.createdAt,
    };
  } catch (nextError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(nextError, "Failed to save uploaded image metadata."));
  }

  const { error: upsertError } = await supabase.from("character_reference_images").upsert(
    {
      character_id: input.characterId,
      character_sheet_id: input.characterSheetId,
      user_id: userId,
      slot_key: input.slotKey,
      character_media_id: mediaRow.id,
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
        characterMediaId: mediaRow.id,
        storagePath,
      });
    } catch {
      // Cleanup failure should not mask assignment failure.
    }
    throw new Error(asErrorMessage(upsertError, "Failed to assign image to this shot."));
  }

  const existingMediaReferenceId = existingRow?.character_media_id?.trim() ?? "";
  if (existingMediaReferenceId && existingMediaReferenceId !== mediaRow.id) {
    await cleanupOrphanedMedia({
      characterMediaId: existingMediaReferenceId,
      storagePath: existingRow?.storage_path ?? null,
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
    characterMediaId: mediaRow.id,
    storagePath,
    previewStoragePath: storagePath,
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
    .select("id, character_media_id, storage_path")
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

  const mediaReferenceId = existingRow.character_media_id?.trim() ?? "";
  if (!mediaReferenceId) return;

  await cleanupOrphanedMedia({
    characterMediaId: mediaReferenceId,
    storagePath: existingRow.storage_path ?? null,
  });
};
