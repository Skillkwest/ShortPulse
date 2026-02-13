/**
 * Character Manager persistence core.
 * Provides shared Supabase/storage helpers used by high-level draft operations.
 */
import {
  getSignedMediaUrlsBatch,
  invalidateSignedMediaUrl,
} from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { CHARACTER_MANAGER_SLOT_KEYS, createEmptyCharacterSlotMap } from "../constants";
import { createDefaultCharacterValidationNotes } from "./referenceValidation";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSlotFile,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
  CharacterSlotValidationStatus,
} from "../types";

const MEDIA_BUCKET = "media_library";
export const DEFAULT_CHARACTER_NAME = "New Character";
export const CHARACTER_REFERENCE_SOURCE = "character_reference";
export const CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY = "profile_image_storage_path";
export const CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY = "profile_image_media_file_id";
export const CHARACTER_PROFILE_IMAGE_ZOOM_KEY = "profile_image_zoom";
export const CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY = "profile_image_offset_x";
export const CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY = "profile_image_offset_y";
export const DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

type CharacterRow = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  active_reference_pack_id: string | null;
  metadata: unknown;
};

type CharacterReferencePackRow = {
  id: string;
  version: number;
  status: "draft" | "validating" | "ready" | "failed";
};

type CharacterReferenceImageRow = {
  id: string;
  slot_key: string;
  media_file_id: string;
  storage_path: string;
  validation_status: CharacterSlotValidationStatus;
  validation_notes: unknown;
  updated_at: string;
};

type MediaFileRow = {
  id: string;
  filename: string | null;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
};

export type CreatedCharacterDraft = {
  character: CharacterRow;
  referencePack: CharacterReferencePackRow;
};

export type CharacterManagerListItem = {
  characterId: string;
  characterName: string;
  characterStatus: "draft" | "active" | "archived";
  referencePackId: string;
  profileImageUrl: string | null;
  referencePackStatus: "draft" | "validating" | "ready" | "failed";
  completedCount: number;
  hasFailedSlots: boolean;
  totalCount: number;
  updatedAt: string;
};

type CharacterIndexRow = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  updated_at: string;
  metadata: unknown;
};

type PackIndexRow = {
  id: string;
  character_id: string;
  status: "draft" | "validating" | "ready" | "failed";
  version: number;
};

type PackImageRow = {
  reference_pack_id: string;
  slot_key: string;
  storage_path: string | null;
  validation_status: CharacterSlotValidationStatus;
};

export const asErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

export const isCharacterReferenceSlotKey = (value: string): value is CharacterReferenceSlotKey =>
  CHARACTER_MANAGER_SLOT_KEYS.includes(value as CharacterReferenceSlotKey);

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asTextArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toValidationNotes = (value: unknown): CharacterSlotValidationNotes => {
  const notes = createDefaultCharacterValidationNotes();
  const record = toObjectRecord(value);
  notes.validatorVersion = asNumber(record.validatorVersion) ?? notes.validatorVersion;
  notes.mimeType = asText(record.mimeType);
  notes.width = asNumber(record.width);
  notes.height = asNumber(record.height);
  notes.aspectRatio = asNumber(record.aspectRatio);
  notes.sha256 = asText(record.sha256);
  notes.hardErrors = asTextArray(record.hardErrors);
  notes.warnings = asTextArray(record.warnings);
  notes.evaluatedAt = asText(record.evaluatedAt);
  return notes;
};

const inferFileExtension = (filename: string, mimeType: string): string => {
  const filenameParts = filename.trim().toLowerCase().split(".");
  if (filenameParts.length > 1) {
    const extension = filenameParts[filenameParts.length - 1]?.trim();
    if (extension) return extension.replace(/[^a-z0-9]/g, "") || "jpg";
  }

  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime.includes("png")) return "png";
  if (normalizedMime.includes("webp")) return "webp";
  if (normalizedMime.includes("avif")) return "avif";
  if (normalizedMime.includes("heic")) return "heic";
  if (normalizedMime.includes("heif")) return "heif";
  return "jpg";
};

const sanitizeFileStem = (filename: string) => {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "reference";
};

/**
 * Parse persisted profile-image linkage from character metadata.
 */
export const getCharacterProfileImageMetadata = (
  metadata: unknown
): { storagePath: string | null; mediaFileId: string | null } => {
  const record = toObjectRecord(metadata);
  return {
    storagePath: asText(record[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY]),
    mediaFileId: asText(record[CHARACTER_PROFILE_IMAGE_MEDIA_FILE_ID_KEY]),
  };
};

/**
 * Parse persisted profile-image framing controls from character metadata.
 */
export const getCharacterProfileImageTransform = (
  metadata: unknown
): CharacterProfileImageTransform => {
  const record = toObjectRecord(metadata);
  return {
    zoom:
      asNumber(record[CHARACTER_PROFILE_IMAGE_ZOOM_KEY]) ??
      DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.zoom,
    offsetX:
      asNumber(record[CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY]) ??
      DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.offsetX,
    offsetY:
      asNumber(record[CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY]) ??
      DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM.offsetY,
  };
};

/**
 * Build a user-scoped storage path for a slot image.
 */
export const createStoragePath = ({
  userId,
  characterId,
  referencePackId,
  slotKey,
  filename,
  mimeType,
}: {
  userId: string;
  characterId: string;
  referencePackId: string;
  slotKey: CharacterReferenceSlotKey;
  filename: string;
  mimeType: string;
}) => {
  const extension = inferFileExtension(filename, mimeType);
  const stem = sanitizeFileStem(filename);
  return `${userId}/characters/${characterId}/${referencePackId}/${slotKey}/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`;
};

/**
 * Build a user-scoped storage path for a persisted character profile image.
 */
export const createCharacterProfileStoragePath = ({
  userId,
  characterId,
  filename,
  mimeType,
}: {
  userId: string;
  characterId: string;
  filename: string;
  mimeType: string;
}) => {
  const extension = inferFileExtension(filename, mimeType);
  const stem = sanitizeFileStem(filename);
  return `${userId}/characters/${characterId}/profile/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`;
};

/**
 * Resolve authenticated client context for Character Manager operations.
 */
export const resolveSupabaseContext = async () => {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new Error("Please sign in to access Character Manager.");
  }
  return { supabase, userId };
};

/**
 * Create a new character with an initial draft reference pack.
 */
export const createDraftCharacter = async (name: string): Promise<CreatedCharacterDraft> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const trimmedName = name.trim() || DEFAULT_CHARACTER_NAME;
  const { data: createdCharacter, error: createCharacterError } = await supabase
    .from("characters")
    .insert({
      user_id: userId,
      name: trimmedName,
      status: "draft",
    })
    .select("id, name, status, active_reference_pack_id, metadata")
    .single();
  if (createCharacterError || !createdCharacter) {
    throw new Error(
      asErrorMessage(createCharacterError, "Unable to create a character draft right now.")
    );
  }

  const { data: createdPack, error: createPackError } = await supabase
    .from("character_reference_packs")
    .insert({
      character_id: createdCharacter.id,
      user_id: userId,
      version: 1,
      status: "draft",
    })
    .select("id, version, status")
    .single();
  if (createPackError || !createdPack) {
    throw new Error(
      asErrorMessage(createPackError, "Unable to create a character reference pack right now.")
    );
  }

  return {
    character: createdCharacter as CharacterRow,
    referencePack: createdPack as CharacterReferencePackRow,
  };
};

/**
 * Resolve the latest reference pack for a character, creating the first pack when absent.
 */
export const resolveReferencePack = async (
  characterId: string
): Promise<CharacterReferencePackRow> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("character_reference_packs")
    .select("id, version, status")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to load character reference packs."));
  }
  if (data) {
    return data as CharacterReferencePackRow;
  }

  const { data: createdPack, error: createPackError } = await supabase
    .from("character_reference_packs")
    .insert({
      character_id: characterId,
      user_id: userId,
      version: 1,
      status: "draft",
    })
    .select("id, version, status")
    .single();
  if (createPackError || !createdPack) {
    throw new Error(asErrorMessage(createPackError, "Unable to create a reference pack."));
  }
  return createdPack as CharacterReferencePackRow;
};

/**
 * Delete the backing media row/storage object only when no slot references remain.
 */
export const cleanupOrphanedMedia = async ({
  mediaFileId,
  storagePath,
}: {
  mediaFileId: string;
  storagePath: string | null;
}) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { count, error: refCheckError } = await supabase
    .from("character_reference_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("media_file_id", mediaFileId);
  if (refCheckError) {
    throw new Error(asErrorMessage(refCheckError, "Failed to validate image references."));
  }
  if ((count ?? 0) > 0) {
    return;
  }

  const { error: deleteMediaError } = await supabase
    .from("media_files")
    .delete()
    .eq("user_id", userId)
    .eq("id", mediaFileId);
  if (deleteMediaError) {
    throw new Error(asErrorMessage(deleteMediaError, "Failed to clean up unused media file."));
  }

  if (storagePath) {
    const { error: removeStorageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath]);
    if (removeStorageError) {
      // Storage cleanup is best-effort; keep user-facing flows resilient if objects already moved/expired.
    }
    invalidateSignedMediaUrl(MEDIA_BUCKET, storagePath);
  }
};

const mapSlotRowsToSlotFileMap = async (
  imageRows: CharacterReferenceImageRow[],
  mediaRows: MediaFileRow[]
): Promise<CharacterSlotFileMap> => {
  const slots = createEmptyCharacterSlotMap();
  if (!imageRows.length) {
    return slots;
  }

  const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
  const storagePaths = imageRows.map((row) => row.storage_path).filter(Boolean);
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths,
  });

  for (const imageRow of imageRows) {
    if (!isCharacterReferenceSlotKey(imageRow.slot_key)) continue;
    const mediaRow = mediaById.get(imageRow.media_file_id);
    if (!mediaRow) continue;

    const signedUrl = signedByPath.get(imageRow.storage_path) ?? null;
    if (!signedUrl) continue;

    const slot: CharacterSlotFile = {
      mediaFileId: imageRow.media_file_id,
      storagePath: imageRow.storage_path,
      validationStatus: imageRow.validation_status,
      validationNotes: toValidationNotes(imageRow.validation_notes),
      name: mediaRow.filename?.trim() || `${imageRow.slot_key}.jpg`,
      size: Number(mediaRow.file_size ?? 0),
      type: mediaRow.file_type ?? "image",
      previewUrl: signedUrl,
      updatedAt: imageRow.updated_at || mediaRow.created_at || new Date().toISOString(),
    };
    slots[imageRow.slot_key] = slot;
  }

  return slots;
};

/**
 * Load persisted slot images for a reference pack and map them to UI slot state.
 */
export const loadSlotFilesForPack = async (
  referencePackId: string
): Promise<CharacterSlotFileMap> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: imageRows, error: imagesError } = await supabase
    .from("character_reference_images")
    .select(
      "id, slot_key, media_file_id, storage_path, validation_status, validation_notes, updated_at"
    )
    .eq("user_id", userId)
    .eq("reference_pack_id", referencePackId);
  if (imagesError) {
    throw new Error(asErrorMessage(imagesError, "Failed to load character reference images."));
  }

  const typedImageRows = (imageRows ?? []) as CharacterReferenceImageRow[];
  if (!typedImageRows.length) {
    return createEmptyCharacterSlotMap();
  }

  const mediaIds = Array.from(new Set(typedImageRows.map((row) => row.media_file_id)));
  const { data: mediaRows, error: mediaError } = await supabase
    .from("media_files")
    .select("id, filename, storage_path, file_type, file_size, created_at")
    .eq("user_id", userId)
    .in("id", mediaIds);
  if (mediaError) {
    throw new Error(asErrorMessage(mediaError, "Failed to load character media files."));
  }

  return mapSlotRowsToSlotFileMap(typedImageRows, (mediaRows ?? []) as MediaFileRow[]);
};

/**
 * List user characters with latest-pack completion metadata for the Character Manager rail.
 */
export const fetchCharacterManagerList = async (): Promise<CharacterManagerListItem[]> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRows, error: characterRowsError } = await supabase
    .from("characters")
    .select("id, name, status, updated_at, metadata")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (characterRowsError) {
    throw new Error(asErrorMessage(characterRowsError, "Failed to list characters."));
  }

  const typedCharacterRows = (characterRows ?? []) as CharacterIndexRow[];
  if (!typedCharacterRows.length) return [];
  const characterIds = typedCharacterRows.map((row) => row.id);

  const { data: packRows, error: packRowsError } = await supabase
    .from("character_reference_packs")
    .select("id, character_id, status, version")
    .eq("user_id", userId)
    .in("character_id", characterIds)
    .order("version", { ascending: false });
  if (packRowsError) {
    throw new Error(asErrorMessage(packRowsError, "Failed to load character reference packs."));
  }

  const latestPackByCharacter = new Map<string, PackIndexRow>();
  for (const pack of (packRows ?? []) as PackIndexRow[]) {
    if (!latestPackByCharacter.has(pack.character_id)) {
      latestPackByCharacter.set(pack.character_id, pack);
    }
  }

  const referencePackIds = Array.from(latestPackByCharacter.values()).map((pack) => pack.id);
  const packToCharacterId = new Map<string, string>();
  for (const [characterId, pack] of latestPackByCharacter.entries()) {
    packToCharacterId.set(pack.id, characterId);
  }

  const profilePathByCharacter = new Map<string, string>();
  for (const row of typedCharacterRows) {
    const profileMetadata = getCharacterProfileImageMetadata(row.metadata);
    if (profileMetadata.storagePath) {
      profilePathByCharacter.set(row.id, profileMetadata.storagePath);
    }
  }

  const slotCountsByPack = new Map<string, number>();
  const failedCountsByPack = new Map<string, number>();
  const fallbackAvatarPathByCharacter = new Map<string, string>();
  if (referencePackIds.length) {
    const { data: imageRows, error: imageRowsError } = await supabase
      .from("character_reference_images")
      .select("reference_pack_id, slot_key, storage_path, validation_status")
      .eq("user_id", userId)
      .in("reference_pack_id", referencePackIds);
    if (imageRowsError) {
      throw new Error(asErrorMessage(imageRowsError, "Failed to load character slot metadata."));
    }

    const uniqueSlotsByPack = new Map<string, Set<string>>();
    for (const row of (imageRows ?? []) as PackImageRow[]) {
      const nextSet = uniqueSlotsByPack.get(row.reference_pack_id) ?? new Set<string>();
      if (isCharacterReferenceSlotKey(row.slot_key)) {
        nextSet.add(row.slot_key);
      }
      uniqueSlotsByPack.set(row.reference_pack_id, nextSet);

      if (typeof row.storage_path === "string" && row.storage_path.trim().length) {
        const characterId = packToCharacterId.get(row.reference_pack_id);
        if (!characterId) continue;
        const shouldPromoteToAvatar =
          row.slot_key === "portrait_close" || !fallbackAvatarPathByCharacter.has(characterId);
        if (shouldPromoteToAvatar) {
          fallbackAvatarPathByCharacter.set(characterId, row.storage_path);
        }
      }

      if (row.validation_status === "fail") {
        failedCountsByPack.set(
          row.reference_pack_id,
          (failedCountsByPack.get(row.reference_pack_id) ?? 0) + 1
        );
      }
    }
    for (const [packId, slots] of uniqueSlotsByPack.entries()) {
      slotCountsByPack.set(packId, slots.size);
    }
  }

  const avatarPathByCharacter = new Map<string, string>();
  for (const row of typedCharacterRows) {
    const preferredPath =
      profilePathByCharacter.get(row.id) ?? fallbackAvatarPathByCharacter.get(row.id) ?? null;
    if (preferredPath) {
      avatarPathByCharacter.set(row.id, preferredPath);
    }
  }

  const avatarUrlByCharacter = new Map<string, string | null>();
  if (avatarPathByCharacter.size) {
    const signedUrlByStoragePath = await getSignedMediaUrlsBatch({
      bucket: MEDIA_BUCKET,
      storagePaths: Array.from(avatarPathByCharacter.values()),
    });
    for (const [characterId, storagePath] of avatarPathByCharacter.entries()) {
      avatarUrlByCharacter.set(characterId, signedUrlByStoragePath.get(storagePath) ?? null);
    }
  }

  return typedCharacterRows
    .map((row) => {
      const latestPack = latestPackByCharacter.get(row.id);
      if (!latestPack) return null;
      return {
        characterId: row.id,
        characterName: row.name?.trim() || DEFAULT_CHARACTER_NAME,
        characterStatus: row.status,
        referencePackId: latestPack.id,
        profileImageUrl: avatarUrlByCharacter.get(row.id) ?? null,
        referencePackStatus: latestPack.status,
        completedCount: slotCountsByPack.get(latestPack.id) ?? 0,
        hasFailedSlots: (failedCountsByPack.get(latestPack.id) ?? 0) > 0,
        totalCount: CHARACTER_MANAGER_SLOT_KEYS.length,
        updatedAt: row.updated_at,
      } satisfies CharacterManagerListItem;
    })
    .filter((item): item is CharacterManagerListItem => Boolean(item));
};
