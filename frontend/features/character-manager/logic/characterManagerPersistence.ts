/**
 * Character Manager persistence orchestrator.
 * Exposes high-level operations used by the Character Manager draft hook.
 */
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { CHARACTER_MANAGER_SLOT_DEFINITIONS, CHARACTER_MANAGER_SLOT_KEYS } from "../constants";
import { createDefaultCharacterValidationNotes } from "./referenceValidation";
import type {
  CharacterReferenceSlotKey,
  CharacterSlotFile,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
  CharacterSlotValidationStatus,
} from "../types";
import {
  asErrorMessage,
  CHARACTER_REFERENCE_SOURCE,
  cleanupOrphanedMedia,
  createDraftCharacter,
  createStoragePath,
  DEFAULT_CHARACTER_NAME,
  fetchCharacterManagerList,
  isCharacterReferenceSlotKey,
  loadSlotFilesForPack,
  resolveReferencePack,
  resolveSupabaseContext,
} from "./characterManagerPersistenceCore";

export type { CharacterManagerListItem } from "./characterManagerPersistenceCore";
export {
  revalidateCharacterManagerPack,
  type CharacterPackRevalidationSummary,
} from "./characterManagerRevalidation";

const MEDIA_BUCKET = "media_library";

export type CharacterManagerDraftSnapshot = {
  characterId: string;
  referencePackId: string;
  characterName: string;
  slots: CharacterSlotFileMap;
};

type SaveCharacterSlotInput = {
  characterId: string;
  referencePackId: string;
  slotKey: CharacterReferenceSlotKey;
  file: File;
  validationStatus: CharacterSlotValidationStatus;
  validationNotes: CharacterSlotValidationNotes;
};

type ActivateCharacterPackInput = {
  characterId: string;
  referencePackId: string;
  characterName: string;
};

const toCharacterSnapshot = async (input: {
  characterId: string;
  characterName: string;
}): Promise<CharacterManagerDraftSnapshot> => {
  const referencePack = await resolveReferencePack(input.characterId);
  const slots = await loadSlotFilesForPack(referencePack.id);
  return {
    characterId: input.characterId,
    referencePackId: referencePack.id,
    characterName: input.characterName.trim() || DEFAULT_CHARACTER_NAME,
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
export const loadOrCreateCharacterManagerDraft =
  async (): Promise<CharacterManagerDraftSnapshot> => {
    const { supabase, userId } = await resolveSupabaseContext();
    const { data, error } = await supabase
      .from("characters")
      .select("id, name")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(asErrorMessage(error, "Failed to load characters."));
    }

    const character = (data as { id: string; name: string | null } | null)
      ? (data as { id: string; name: string | null })
      : (await createDraftCharacter(DEFAULT_CHARACTER_NAME)).character;
    return toCharacterSnapshot({
      characterId: character.id,
      characterName: character.name || DEFAULT_CHARACTER_NAME,
    });
  };

/**
 * Creates a fresh character draft and empty reference pack.
 */
export const createCharacterManagerDraft = async (
  name = DEFAULT_CHARACTER_NAME
): Promise<CharacterManagerDraftSnapshot> => {
  const { character, referencePack } = await createDraftCharacter(name);
  return {
    characterId: character.id,
    referencePackId: referencePack.id,
    characterName: character.name?.trim() || DEFAULT_CHARACTER_NAME,
    slots: await loadSlotFilesForPack(referencePack.id),
  };
};

/**
 * Loads a specific character draft and latest reference pack by character id.
 */
export const loadCharacterManagerDraftByCharacterId = async (
  characterId: string
): Promise<CharacterManagerDraftSnapshot> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, status")
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to load character."));
  }

  const character = data as { id: string; name: string | null; status: string } | null;
  if (!character || character.status === "archived") {
    throw new Error("Character is no longer available.");
  }

  return toCharacterSnapshot({
    characterId: character.id,
    characterName: character.name || DEFAULT_CHARACTER_NAME,
  });
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
 * Uploads and assigns a slot image to the current reference pack.
 */
export const saveCharacterManagerSlot = async (
  input: SaveCharacterSlotInput
): Promise<CharacterSlotFile> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingRowError } = await supabase
    .from("character_reference_images")
    .select("id, media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("reference_pack_id", input.referencePackId)
    .eq("slot_key", input.slotKey)
    .maybeSingle();
  if (existingRowError) {
    throw new Error(asErrorMessage(existingRowError, "Failed to load existing slot image."));
  }

  const mimeType = input.file.type || "image/jpeg";
  const storagePath = createStoragePath({
    userId,
    characterId: input.characterId,
    referencePackId: input.referencePackId,
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
        reference_pack_id: input.referencePackId,
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
      reference_pack_id: input.referencePackId,
      user_id: userId,
      slot_key: input.slotKey,
      media_file_id: mediaRow.id,
      storage_path: storagePath,
      validation_status: input.validationStatus,
      validation_notes: input.validationNotes,
    },
    {
      onConflict: "reference_pack_id,slot_key",
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
 * Removes a slot image from the current reference pack and cleans up orphaned storage.
 */
export const clearCharacterManagerSlot = async ({
  referencePackId,
  slotKey,
}: {
  referencePackId: string;
  slotKey: CharacterReferenceSlotKey;
}) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingRowError } = await supabase
    .from("character_reference_images")
    .select("id, media_file_id, storage_path")
    .eq("user_id", userId)
    .eq("reference_pack_id", referencePackId)
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

/**
 * Activates the current reference pack after validating all required slots are present.
 */
export const activateCharacterManagerPack = async (input: ActivateCharacterPackInput) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: imageRows, error: imageRowsError } = await supabase
    .from("character_reference_images")
    .select("slot_key, media_file_id, storage_path, validation_status, validation_notes")
    .eq("user_id", userId)
    .eq("reference_pack_id", input.referencePackId);
  if (imageRowsError) {
    throw new Error(asErrorMessage(imageRowsError, "Failed to validate reference pack."));
  }

  const typedRows = (imageRows ?? []) as Array<{
    slot_key: string;
    media_file_id: string;
    storage_path: string;
    validation_status: CharacterSlotValidationStatus;
    validation_notes: unknown;
  }>;
  const rowsBySlot = new Map<CharacterReferenceSlotKey, (typeof typedRows)[number]>();
  for (const row of typedRows) {
    if (!isCharacterReferenceSlotKey(row.slot_key)) continue;
    rowsBySlot.set(row.slot_key, row);
  }

  const missingSlotKeys = CHARACTER_MANAGER_SLOT_KEYS.filter((slotKey) => !rowsBySlot.has(slotKey));
  if (missingSlotKeys.length) {
    const missingLabels = CHARACTER_MANAGER_SLOT_DEFINITIONS.filter((slot) =>
      missingSlotKeys.includes(slot.key)
    ).map((slot) => slot.label);
    throw new Error(`Complete all required shots before activation: ${missingLabels.join(", ")}`);
  }

  const failedSlotLabels = CHARACTER_MANAGER_SLOT_DEFINITIONS.filter(
    (slot) => rowsBySlot.get(slot.key)?.validation_status === "fail"
  ).map((slot) => slot.label);
  if (failedSlotLabels.length) {
    throw new Error(`Fix failed shots before activation: ${failedSlotLabels.join(", ")}`);
  }

  const hashToSlotLabels = new Map<string, string[]>();
  for (const slot of CHARACTER_MANAGER_SLOT_DEFINITIONS) {
    const row = rowsBySlot.get(slot.key);
    if (!row) continue;
    const notesRecord =
      row.validation_notes &&
      typeof row.validation_notes === "object" &&
      !Array.isArray(row.validation_notes)
        ? (row.validation_notes as Record<string, unknown>)
        : null;
    const sha256 =
      notesRecord && typeof notesRecord.sha256 === "string" ? notesRecord.sha256.trim() : null;
    if (!sha256) continue;
    const existing = hashToSlotLabels.get(sha256) ?? [];
    existing.push(slot.label);
    hashToSlotLabels.set(sha256, existing);
  }

  const duplicatedGroups = Array.from(hashToSlotLabels.values()).filter(
    (labels) => labels.length > 1
  );
  if (duplicatedGroups.length) {
    const duplicateSummary = duplicatedGroups.map((group) => group.join(" + ")).join("; ");
    throw new Error(`Duplicate reference images detected: ${duplicateSummary}`);
  }

  const orderedManifest = CHARACTER_MANAGER_SLOT_KEYS.map((slotKey) => {
    const row = rowsBySlot.get(slotKey);
    if (!row) {
      throw new Error("Pack validation failed while assembling references.");
    }
    return {
      slot_key: slotKey,
      media_file_id: row.media_file_id,
      storage_path: row.storage_path,
      validation_status: row.validation_status,
      validation_notes:
        row.validation_notes &&
        typeof row.validation_notes === "object" &&
        !Array.isArray(row.validation_notes)
          ? row.validation_notes
          : createDefaultCharacterValidationNotes(),
    };
  });

  const seedreamPayload = {
    schema_version: 1,
    required_slot_count: CHARACTER_MANAGER_SLOT_KEYS.length,
    slot_manifest: orderedManifest,
    activated_at: new Date().toISOString(),
  };

  const { error: updatePackError } = await supabase
    .from("character_reference_packs")
    .update({
      status: "ready",
      seedream_payload: seedreamPayload,
    })
    .eq("id", input.referencePackId)
    .eq("character_id", input.characterId)
    .eq("user_id", userId);
  if (updatePackError) {
    throw new Error(asErrorMessage(updatePackError, "Failed to activate reference pack."));
  }

  const { error: updateCharacterError } = await supabase
    .from("characters")
    .update({
      name: input.characterName.trim() || DEFAULT_CHARACTER_NAME,
      status: "active",
      active_reference_pack_id: input.referencePackId,
    })
    .eq("id", input.characterId)
    .eq("user_id", userId);
  if (updateCharacterError) {
    throw new Error(asErrorMessage(updateCharacterError, "Failed to mark character as active."));
  }
};
