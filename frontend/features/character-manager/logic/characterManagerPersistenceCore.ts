/**
 * Character Manager persistence core.
 * Provides shared Supabase/storage helpers used by high-level draft operations.
 */
import {
  getSignedMediaUrlsBatch,
  invalidateSignedMediaUrl,
} from "../../../lib/mediaSignedUrlCache";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  CHARACTER_SHEET_PRESET_IDS,
  CHARACTER_MANAGER_SLOT_KEYS,
  CHARACTER_SHEET_DROP_ZONES,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetPresetAssignments,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSlotMap,
  getDefaultCharacterSheetPresetTabLabel,
} from "../constants";
import {
  createNormalizedCharacterSheetPresetTabDescriptions,
  createNormalizedCharacterSheetPresetTabLabels,
  deriveLegacyCharacterSheetPresetTabOrder,
  normalizeCharacterSheetPresetTabOrder,
  sanitizeCharacterSheetPresetDescription,
} from "./characterSheetPresetTabs";
import { createDefaultCharacterValidationNotes } from "./referenceValidation";
import type {
  CharacterSheetAssignments,
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

const MEDIA_BUCKET = "media_library";
export const DEFAULT_CHARACTER_NAME = "New Character";
export const CHARACTER_REFERENCE_SOURCE = "character_reference";
export const CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY = "profile_image_storage_path";
export const CHARACTER_PROFILE_IMAGE_CHARACTER_MEDIA_ID_KEY = "profile_image_character_media_id";
export const CHARACTER_PROFILE_IMAGE_ZOOM_KEY = "profile_image_zoom";
export const CHARACTER_PROFILE_IMAGE_OFFSET_X_KEY = "profile_image_offset_x";
export const CHARACTER_PROFILE_IMAGE_OFFSET_Y_KEY = "profile_image_offset_y";
export const CHARACTER_SHEET_ASSIGNMENTS_KEY = "character_sheet_assignments";
export const CHARACTER_SHEET_PRESETS_KEY = "character_sheet_presets_v1";
export const DEFAULT_CHARACTER_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

type CharacterRow = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  metadata: unknown;
};

type CharacterCharacterSheetRow = {
  id: string;
  version: number;
  status: "draft" | "validating" | "ready" | "failed";
};

type CharacterReferenceImageRow = {
  id: string;
  slot_key: string;
  character_media_id: string | null;
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
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  created_at: string | null;
};

type CharacterMediaAssetRow = {
  id: string;
  filename: string | null;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
};

export type CreatedCharacterDraft = {
  character: CharacterRow;
  characterSheet: CharacterCharacterSheetRow;
};

export type CharacterManagerListItem = {
  characterId: string;
  characterName: string;
  characterStatus: "draft" | "active" | "archived";
  characterSheetId: string;
  profileImageUrl: string | null;
  profileImageCharacterMediaId?: string | null;
  profileImageStoragePath?: string | null;
  profileImagePreviewStoragePath?: string | null;
  profileImageTransform: CharacterProfileImageTransform | null;
  characterSheetStatus: "draft" | "validating" | "ready" | "failed";
  updatedAt: string;
};

type CharacterIndexRow = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  updated_at: string;
  metadata: unknown;
};

type CharacterSheetIndexRow = {
  id: string;
  character_id: string;
  status: "draft" | "validating" | "ready" | "failed";
  version: number;
};

type CharacterSheetImageRow = {
  character_sheet_id: string;
  slot_key: string;
  storage_path: string | null;
};

const resolveSignedPreviewCandidatePath = (
  mediaRow: MediaFileRow | CharacterMediaAssetRow | null | undefined,
  fallbackStoragePath: string,
  userId?: string | null
): string => {
  if (!mediaRow) return fallbackStoragePath;
  if (
    "metadata" in mediaRow ||
    "thumb_variant_path" in mediaRow ||
    "poster_variant_path" in mediaRow ||
    "preview_variant_path" in mediaRow
  ) {
    return resolveMediaSigningStoragePaths(mediaRow, userId)[0] ?? fallbackStoragePath;
  }
  return mediaRow.storage_path?.trim() || fallbackStoragePath;
};

export const asErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

const isMissingRelationError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );

const isMissingColumnError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return code === "23505" || /duplicate key value/i.test(message);
};

export const isCharacterReferenceSlotKey = (value: string): value is CharacterReferenceSlotKey =>
  CHARACTER_MANAGER_SLOT_KEYS.includes(value as CharacterReferenceSlotKey);

const isCharacterSheetDropZoneKey = (value: string): value is CharacterSheetDropZoneKey =>
  CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === value);

const isCharacterSheetPresetId = (value: string): value is CharacterSheetPresetId =>
  CHARACTER_SHEET_PRESET_IDS.includes(value as CharacterSheetPresetId);

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

const toCharacterSheetPresetMediaReference = (
  value: unknown
): CharacterSheetPresetMediaReference | null => {
  const record = toObjectRecord(value);
  const characterMediaId =
    asText(record.character_media_id) ?? asText(record.characterMediaId) ?? null;
  const storagePath = asText(record.storage_path) ?? asText(record.storagePath) ?? null;
  if (!characterMediaId || !storagePath) {
    return null;
  }
  return {
    characterMediaId,
    storagePath,
    previewStoragePath:
      asText(record.preview_storage_path) ?? asText(record.previewStoragePath) ?? null,
    previewUrl: asText(record.preview_url) ?? asText(record.previewUrl),
  };
};

/**
 * Normalize persisted character-sheet card assignments to a shape-stable record.
 */
export const normalizeCharacterSheetAssignments = (
  assignments: Partial<Record<CharacterSheetDropZoneKey, CharacterReferenceSlotKey | null>>
): CharacterSheetAssignments => {
  const normalized = createEmptyCharacterSheetAssignments();
  for (const [rawZoneKey, rawSlotKey] of Object.entries(assignments)) {
    if (!isCharacterSheetDropZoneKey(rawZoneKey)) continue;
    if (typeof rawSlotKey !== "string" || !isCharacterReferenceSlotKey(rawSlotKey)) {
      normalized[rawZoneKey] = null;
      continue;
    }
    normalized[rawZoneKey] = rawSlotKey;
  }
  return normalized;
};

/**
 * Normalize persisted character-sheet look assignments for a single visible tab.
 */
export const normalizeCharacterSheetPresetAssignments = (
  assignments: Partial<Record<CharacterSheetDropZoneKey, CharacterSheetPresetMediaReference | null>>
): CharacterSheetPresetAssignments => {
  const normalized = createEmptyCharacterSheetPresetAssignments();
  for (const [rawZoneKey, rawValue] of Object.entries(assignments)) {
    if (!isCharacterSheetDropZoneKey(rawZoneKey)) continue;
    const normalizedReference = toCharacterSheetPresetMediaReference(rawValue);
    normalized[rawZoneKey] = normalizedReference;
  }
  return normalized;
};

/**
 * Normalize persisted character-sheet look state to a shape-stable record.
 */
export const normalizeCharacterSheetPresetState = (
  state: Partial<{
    activePresetId: CharacterSheetPresetId | null;
    presets: Partial<Record<CharacterSheetPresetId, CharacterSheetPresetAssignments | null>>;
    tabOrder: CharacterSheetPresetId[];
    tabLabels: Partial<Record<CharacterSheetPresetId, string>>;
    tabDescriptions: Partial<Record<CharacterSheetPresetId, string>>;
  }>
): CharacterSheetPresetState => {
  const normalized = createDefaultCharacterSheetPresetState();
  if (state.activePresetId && isCharacterSheetPresetId(state.activePresetId)) {
    normalized.activePresetId = state.activePresetId;
  }
  for (const presetId of CHARACTER_SHEET_PRESET_IDS) {
    const presetAssignments = state.presets?.[presetId];
    normalized.presets[presetId] = normalizeCharacterSheetPresetAssignments(
      presetAssignments ?? {}
    );
  }
  normalized.tabOrder = normalizeCharacterSheetPresetTabOrder({
    tabOrder: state.tabOrder ?? normalized.tabOrder,
    activePresetId: normalized.activePresetId,
  });
  normalized.tabLabels = createNormalizedCharacterSheetPresetTabLabels({
    labels: state.tabLabels ?? normalized.tabLabels,
  });
  normalized.tabDescriptions = createNormalizedCharacterSheetPresetTabDescriptions({
    descriptions: state.tabDescriptions ?? normalized.tabDescriptions,
  });
  return normalized;
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
 * Creates a character-owned media asset row and returns the persisted id.
 */
export const createCharacterMediaAsset = async ({
  userId,
  characterId,
  assetKind,
  storagePath,
  filename,
  fileType,
  fileSize,
  metadata,
}: {
  userId: string;
  characterId: string;
  assetKind: "profile" | "sheet_slot" | "sheet_preset" | "quickswap";
  storagePath: string;
  filename: string;
  fileType: string;
  fileSize: number;
  metadata: Record<string, unknown>;
}): Promise<{ id: string; createdAt: string }> => {
  const { supabase } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("character_media_assets")
    .insert({
      user_id: userId,
      character_id: characterId,
      asset_kind: assetKind,
      storage_path: storagePath,
      filename,
      file_type: fileType,
      file_size: fileSize,
      metadata,
    })
    .select("id, created_at")
    .single();
  if (error || !data?.id) {
    throw new Error(asErrorMessage(error, "Failed to create character media asset."));
  }
  return {
    id: data.id,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
};

/**
 * Parse persisted profile-image linkage from character metadata.
 */
export const getCharacterProfileImageMetadata = (
  metadata: unknown
): { storagePath: string | null; characterMediaId: string | null } => {
  const record = toObjectRecord(metadata);
  return {
    storagePath: asText(record[CHARACTER_PROFILE_IMAGE_STORAGE_PATH_KEY]),
    characterMediaId: asText(record[CHARACTER_PROFILE_IMAGE_CHARACTER_MEDIA_ID_KEY]),
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
 * Parse persisted character-sheet card assignments from character metadata.
 */
export const getCharacterSheetAssignments = (metadata: unknown): CharacterSheetAssignments => {
  const record = toObjectRecord(metadata);
  const rawAssignments = toObjectRecord(record[CHARACTER_SHEET_ASSIGNMENTS_KEY]);
  const parsedAssignments = Object.fromEntries(
    Object.entries(rawAssignments).map(([zoneKey, slotKey]) => [
      zoneKey,
      typeof slotKey === "string" ? slotKey : null,
    ])
  ) as Partial<Record<CharacterSheetDropZoneKey, CharacterReferenceSlotKey | null>>;
  return normalizeCharacterSheetAssignments(parsedAssignments);
};

/**
 * Parse persisted character-sheet look state from character metadata.
 */
export const getCharacterSheetPresetState = (
  metadata: unknown,
  options?: {
    legacyCharacterDescription?: string | null;
  }
): CharacterSheetPresetState | null => {
  const record = toObjectRecord(metadata);
  const rawPresetState = toObjectRecord(record[CHARACTER_SHEET_PRESETS_KEY]);
  if (!Object.keys(rawPresetState).length) {
    return null;
  }
  const rawActivePresetId =
    asText(rawPresetState.active_preset_id) ?? asText(rawPresetState.activePresetId);
  const rawPresets = toObjectRecord(rawPresetState.presets);
  const rawTabOrder = Array.isArray(rawPresetState.tab_order)
    ? rawPresetState.tab_order
    : Array.isArray(rawPresetState.tabOrder)
      ? rawPresetState.tabOrder
      : null;
  const parsedTabOrder = Array.isArray(rawTabOrder)
    ? rawTabOrder.filter(
        (rawPresetId): rawPresetId is CharacterSheetPresetId =>
          typeof rawPresetId === "string" && isCharacterSheetPresetId(rawPresetId)
      )
    : [];
  const rawTabLabels = toObjectRecord(rawPresetState.tab_labels ?? rawPresetState.tabLabels);
  const hasRawTabDescriptions =
    rawPresetState.tab_descriptions !== undefined || rawPresetState.tabDescriptions !== undefined;
  const rawTabDescriptions = toObjectRecord(
    rawPresetState.tab_descriptions ?? rawPresetState.tabDescriptions
  );
  const parsedTabLabels: Partial<Record<CharacterSheetPresetId, string>> = {};
  const parsedTabDescriptions: Partial<Record<CharacterSheetPresetId, string>> = {};
  for (const [rawPresetId, rawLabel] of Object.entries(rawTabLabels)) {
    if (!isCharacterSheetPresetId(rawPresetId) || typeof rawLabel !== "string") continue;
    parsedTabLabels[rawPresetId] = rawLabel;
  }
  for (const [rawPresetId, rawDescription] of Object.entries(rawTabDescriptions)) {
    if (!isCharacterSheetPresetId(rawPresetId) || typeof rawDescription !== "string") continue;
    parsedTabDescriptions[rawPresetId] = sanitizeCharacterSheetPresetDescription(rawDescription);
  }
  if (!hasRawTabDescriptions) {
    parsedTabDescriptions["1"] = sanitizeCharacterSheetPresetDescription(
      options?.legacyCharacterDescription
    );
  }
  const parsedPresets: Partial<
    Record<CharacterSheetPresetId, CharacterSheetPresetAssignments | null>
  > = {};
  for (const [rawPresetId, rawAssignments] of Object.entries(rawPresets)) {
    if (!isCharacterSheetPresetId(rawPresetId)) continue;
    const parsedAssignments = normalizeCharacterSheetPresetAssignments(
      toObjectRecord(rawAssignments) as Partial<
        Record<CharacterSheetDropZoneKey, CharacterSheetPresetMediaReference | null>
      >
    );
    parsedPresets[rawPresetId] = parsedAssignments;
  }
  const normalizedActivePresetId =
    rawActivePresetId && isCharacterSheetPresetId(rawActivePresetId) ? rawActivePresetId : "1";
  const fallbackLegacyTabOrder = deriveLegacyCharacterSheetPresetTabOrder({
    rawPresetIds: Object.keys(rawPresets),
    activePresetId: normalizedActivePresetId,
  });
  return normalizeCharacterSheetPresetState({
    activePresetId: normalizedActivePresetId,
    presets: parsedPresets,
    tabOrder: parsedTabOrder.length ? parsedTabOrder : fallbackLegacyTabOrder,
    tabLabels: parsedTabLabels,
    tabDescriptions: parsedTabDescriptions,
  });
};

/**
 * Convert look state to the persisted metadata shape.
 */
export const serializeCharacterSheetPresetState = (
  state: CharacterSheetPresetState
): Record<string, unknown> => ({
  active_preset_id: state.activePresetId,
  tab_order: state.tabOrder,
  tab_labels: Object.fromEntries(
    CHARACTER_SHEET_PRESET_IDS.map((presetId) => [
      presetId,
      state.tabLabels[presetId] ?? getDefaultCharacterSheetPresetTabLabel(presetId),
    ])
  ) as CharacterSheetPresetLabelMap,
  tab_descriptions: Object.fromEntries(
    CHARACTER_SHEET_PRESET_IDS.map((presetId) => [
      presetId,
      sanitizeCharacterSheetPresetDescription(state.tabDescriptions[presetId]),
    ])
  ),
  presets: Object.fromEntries(
    CHARACTER_SHEET_PRESET_IDS.map((presetId) => [
      presetId,
      Object.fromEntries(
        CHARACTER_SHEET_DROP_ZONES.map((zone) => {
          const reference = state.presets[presetId][zone.key];
          if (!reference) {
            return [zone.key, null];
          }
          return [
            zone.key,
            {
              character_media_id: reference.characterMediaId,
              storage_path: reference.storagePath,
              ...(reference.previewStoragePath
                ? { preview_storage_path: reference.previewStoragePath }
                : {}),
            },
          ];
        })
      ),
    ])
  ),
});

/**
 * Collect all character-sheet look media references from metadata.
 */
export const listCharacterSheetPresetMediaReferences = (
  metadata: unknown
): Array<{ characterMediaId: string; storagePath: string }> => {
  const presetState = getCharacterSheetPresetState(metadata);
  if (!presetState) {
    return [];
  }
  return Array.from(
    new Map(
      Object.values(presetState.presets)
        .flatMap((assignments) => Object.values(assignments))
        .filter((reference): reference is CharacterSheetPresetMediaReference => Boolean(reference))
        .map((reference) => [
          reference.characterMediaId,
          {
            characterMediaId: reference.characterMediaId,
            storagePath: reference.storagePath,
          },
        ])
    ).values()
  );
};

/**
 * Build a user-scoped storage path for a slot image.
 */
export const createStoragePath = ({
  userId,
  characterId,
  characterSheetId,
  slotKey,
  filename,
  mimeType,
}: {
  userId: string;
  characterId: string;
  characterSheetId: string;
  slotKey: CharacterReferenceSlotKey;
  filename: string;
  mimeType: string;
}) => {
  const extension = inferFileExtension(filename, mimeType);
  const stem = sanitizeFileStem(filename);
  return assertUserScopedMediaStoragePath({
    path: `${userId}/characters/${characterId}/${characterSheetId}/${slotKey}/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`,
    userId,
    label: "Character slot storage path",
  });
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
  return assertUserScopedMediaStoragePath({
    path: `${userId}/characters/${characterId}/profile/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`,
    userId,
    label: "Character profile storage path",
  });
};

/**
 * Build a user-scoped storage path for a persisted character-sheet look asset.
 */
export const createCharacterSheetPresetStoragePath = ({
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
  return assertUserScopedMediaStoragePath({
    path: `${userId}/characters/${characterId}/presets/${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`,
    userId,
    label: "Character look storage path",
  });
};

/**
 * Resolve authenticated client context for Character Manager operations.
 */
export const resolveSupabaseContext = async () => {
  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) {
    throw new Error("Please sign in to access Character Manager.");
  }
  return { supabase, userId };
};

/**
 * Create a new character with an initial draft character sheet.
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
    .select("id, name, description, status, metadata")
    .single();
  if (createCharacterError || !createdCharacter) {
    throw new Error(
      asErrorMessage(createCharacterError, "Unable to create a character draft right now.")
    );
  }

  const { data: createdCharacterSheet, error: createCharacterSheetError } = await supabase
    .from("character_reference_packs")
    .insert({
      character_id: createdCharacter.id,
      user_id: userId,
      version: 1,
      status: "draft",
    })
    .select("id, version, status")
    .single();
  if (createCharacterSheetError || !createdCharacterSheet) {
    await supabase.from("characters").delete().eq("user_id", userId).eq("id", createdCharacter.id);
    throw new Error(
      asErrorMessage(createCharacterSheetError, "Unable to create a character sheet right now.")
    );
  }

  return {
    character: createdCharacter as CharacterRow,
    characterSheet: createdCharacterSheet as CharacterCharacterSheetRow,
  };
};

/**
 * Resolve the latest character sheet for a character, creating the first sheet when absent.
 */
export const resolveCharacterSheet = async (
  characterId: string
): Promise<CharacterCharacterSheetRow> => {
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
    throw new Error(asErrorMessage(error, "Failed to load character sheets."));
  }
  if (data) {
    return data as CharacterCharacterSheetRow;
  }

  const { data: createdCharacterSheet, error: createCharacterSheetError } = await supabase
    .from("character_reference_packs")
    .insert({
      character_id: characterId,
      user_id: userId,
      version: 1,
      status: "draft",
    })
    .select("id, version, status")
    .single();
  if (createCharacterSheetError || !createdCharacterSheet) {
    throw new Error(
      asErrorMessage(createCharacterSheetError, "Unable to create a character sheet.")
    );
  }
  return createdCharacterSheet as CharacterCharacterSheetRow;
};

const createOrLoadLatestCharacterSheetForList = async ({
  supabase,
  userId,
  characterId,
}: {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
  characterId: string;
}): Promise<CharacterSheetIndexRow> => {
  const { data: createdCharacterSheet, error: createCharacterSheetError } = await supabase
    .from("character_reference_packs")
    .insert({
      character_id: characterId,
      user_id: userId,
      version: 1,
      status: "draft",
    })
    .select("id, character_id, status, version")
    .single();
  if (createdCharacterSheet && !createCharacterSheetError) {
    return createdCharacterSheet as CharacterSheetIndexRow;
  }
  if (!isDuplicateKeyError(createCharacterSheetError)) {
    throw new Error(
      asErrorMessage(createCharacterSheetError, "Unable to create a character sheet.")
    );
  }

  const { data: existingCharacterSheet, error: existingCharacterSheetError } = await supabase
    .from("character_reference_packs")
    .select("id, character_id, status, version")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingCharacterSheetError) {
    throw new Error(
      asErrorMessage(existingCharacterSheetError, "Failed to load character sheets.")
    );
  }
  if (!existingCharacterSheet) {
    throw new Error("Unable to create a character sheet.");
  }
  return existingCharacterSheet as CharacterSheetIndexRow;
};

/**
 * Delete the backing media row/storage object only when no slot references remain.
 */
export const cleanupOrphanedMedia = async ({
  characterMediaId,
  storagePath,
}: {
  characterMediaId: string;
  storagePath: string | null;
}) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { count: quickSwapCount, error: quickSwapRefError } = await supabase
    .from("character_quick_swap_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("character_media_id", characterMediaId);
  if (quickSwapRefError && !isMissingRelationError(quickSwapRefError)) {
    throw new Error(asErrorMessage(quickSwapRefError, "Failed to validate quick swap references."));
  }
  if (Number(quickSwapCount ?? 0) > 0) {
    return;
  }

  const { count: referenceCount, error: refCheckError } = await supabase
    .from("character_reference_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("character_media_id", characterMediaId);
  if (refCheckError) {
    throw new Error(asErrorMessage(refCheckError, "Failed to validate image references."));
  }
  if (Number(referenceCount ?? 0) > 0) {
    return;
  }

  const { data: characterRows, error: characterRowsError } = await supabase
    .from("characters")
    .select("metadata")
    .eq("user_id", userId)
    .neq("status", "archived");
  if (characterRowsError) {
    throw new Error(
      asErrorMessage(characterRowsError, "Failed to validate character look references.")
    );
  }
  const presetReferenced = (characterRows ?? []).some((row) =>
    listCharacterSheetPresetMediaReferences((row as { metadata: unknown }).metadata).some(
      (reference) => reference.characterMediaId === characterMediaId
    )
  );
  if (presetReferenced) {
    return;
  }

  const { data: deletedCharacterMediaRows, error: deleteCharacterMediaError } = await supabase
    .from("character_media_assets")
    .delete()
    .eq("user_id", userId)
    .eq("id", characterMediaId)
    .select("id");
  if (deleteCharacterMediaError && !isMissingRelationError(deleteCharacterMediaError)) {
    throw new Error(
      asErrorMessage(deleteCharacterMediaError, "Failed to clean up unused character media asset.")
    );
  }

  if (!deletedCharacterMediaRows?.length) {
    const { error: deleteMediaError } = await supabase
      .from("media_files")
      .delete()
      .eq("user_id", userId)
      .eq("id", characterMediaId);
    if (deleteMediaError) {
      throw new Error(asErrorMessage(deleteMediaError, "Failed to clean up unused media file."));
    }
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
  mediaRows: CharacterMediaAssetRow[],
  userId?: string | null
): Promise<CharacterSlotFileMap> => {
  const slots = createEmptyCharacterSlotMap();
  if (!imageRows.length) {
    return slots;
  }

  const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
  const previewPathByRowId = new Map<string, string>();
  const storagePaths = imageRows
    .map((row) => {
      const mediaReferenceId = row.character_media_id?.trim() ?? "";
      const mediaRow = mediaReferenceId ? mediaById.get(mediaReferenceId) : null;
      const previewPath = resolveSignedPreviewCandidatePath(mediaRow, row.storage_path, userId);
      previewPathByRowId.set(row.id, previewPath);
      return previewPath;
    })
    .filter(Boolean);
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths,
    surface: "character-grid",
  });

  for (const imageRow of imageRows) {
    if (!isCharacterReferenceSlotKey(imageRow.slot_key)) continue;
    const mediaReferenceId = imageRow.character_media_id?.trim() ?? "";
    if (!mediaReferenceId) continue;
    const mediaRow = mediaById.get(mediaReferenceId);
    if (!mediaRow) continue;

    const previewStoragePath = previewPathByRowId.get(imageRow.id) ?? imageRow.storage_path;
    const signedUrl = signedByPath.get(previewStoragePath) ?? null;
    if (!signedUrl) continue;

    const slot: CharacterSlotFile = {
      characterMediaId: mediaReferenceId,
      storagePath: imageRow.storage_path,
      previewStoragePath,
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
 * Load persisted slot images for a character sheet and map them to UI slot state.
 */
export const loadSlotFilesForCharacterSheet = async (
  characterSheetId: string
): Promise<CharacterSlotFileMap> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const imageRowsResponse = await supabase
    .from("character_reference_images")
    .select(
      "id, slot_key, character_media_id, storage_path, validation_status, validation_notes, updated_at"
    )
    .eq("user_id", userId)
    .eq("character_sheet_id", characterSheetId);
  if (imageRowsResponse.error) {
    throw new Error(
      asErrorMessage(imageRowsResponse.error, "Failed to load character reference images.")
    );
  }

  const typedImageRows = (imageRowsResponse.data ?? []) as CharacterReferenceImageRow[];
  if (!typedImageRows.length) {
    return createEmptyCharacterSlotMap();
  }

  const characterMediaIds = Array.from(
    new Set(
      typedImageRows
        .map((row) => row.character_media_id?.trim() ?? "")
        .filter((value): value is string => Boolean(value))
    )
  );

  let characterMediaRows: CharacterMediaAssetRow[] = [];
  if (characterMediaIds.length) {
    const { data, error } = await supabase
      .from("character_media_assets")
      .select("id, filename, storage_path, file_type, file_size, created_at")
      .eq("user_id", userId)
      .in("id", characterMediaIds);
    if (error && !isMissingRelationError(error)) {
      throw new Error(asErrorMessage(error, "Failed to load character media assets."));
    }
    characterMediaRows = (data ?? []) as CharacterMediaAssetRow[];
  }

  return mapSlotRowsToSlotFileMap(typedImageRows, characterMediaRows, userId);
};

/**
 * List user characters with latest-sheet completion metadata for the Character Manager rail.
 */
export const fetchCharacterManagerList = async (): Promise<CharacterManagerListItem[]> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: characterRows, error: characterRowsError } = await supabase
    .from("characters")
    .select("id, name, description, status, updated_at, metadata")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (characterRowsError) {
    throw new Error(asErrorMessage(characterRowsError, "Failed to list characters."));
  }

  const typedCharacterRows = (characterRows ?? []) as CharacterIndexRow[];
  if (!typedCharacterRows.length) return [];
  const characterIds = typedCharacterRows.map((row) => row.id);

  const { data: characterSheetRows, error: characterSheetRowsError } = await supabase
    .from("character_reference_packs")
    .select("id, character_id, status, version")
    .eq("user_id", userId)
    .in("character_id", characterIds)
    .order("version", { ascending: false });
  if (characterSheetRowsError) {
    throw new Error(asErrorMessage(characterSheetRowsError, "Failed to load character sheets."));
  }

  const latestCharacterSheetByCharacter = new Map<string, CharacterSheetIndexRow>();
  for (const characterSheet of (characterSheetRows ?? []) as CharacterSheetIndexRow[]) {
    if (!latestCharacterSheetByCharacter.has(characterSheet.character_id)) {
      latestCharacterSheetByCharacter.set(characterSheet.character_id, characterSheet);
    }
  }

  const missingCharacterIds = characterIds.filter(
    (characterId) => !latestCharacterSheetByCharacter.has(characterId)
  );
  if (missingCharacterIds.length) {
    const repairedCharacterSheets = await Promise.all(
      missingCharacterIds.map((characterId) =>
        createOrLoadLatestCharacterSheetForList({
          supabase,
          userId,
          characterId,
        })
      )
    );
    for (const characterSheet of repairedCharacterSheets) {
      latestCharacterSheetByCharacter.set(characterSheet.character_id, characterSheet);
    }
  }

  const characterSheetIds = Array.from(latestCharacterSheetByCharacter.values()).map(
    (characterSheet) => characterSheet.id
  );
  const characterSheetToCharacterId = new Map<string, string>();
  for (const [characterId, characterSheet] of latestCharacterSheetByCharacter.entries()) {
    characterSheetToCharacterId.set(characterSheet.id, characterId);
  }

  const profilePathByCharacter = new Map<string, string>();
  const profileMediaIdByCharacter = new Map<string, string>();
  const profileTransformByCharacter = new Map<string, CharacterProfileImageTransform>();
  for (const row of typedCharacterRows) {
    const profileMetadata = getCharacterProfileImageMetadata(row.metadata);
    if (profileMetadata.storagePath) {
      profilePathByCharacter.set(row.id, profileMetadata.storagePath);
      profileTransformByCharacter.set(row.id, getCharacterProfileImageTransform(row.metadata));
    }
    if (profileMetadata.characterMediaId) {
      profileMediaIdByCharacter.set(row.id, profileMetadata.characterMediaId);
    }
  }

  const profileMediaIds = Array.from(new Set(profileMediaIdByCharacter.values()));
  const profileMediaRowById = new Map<string, MediaFileRow>();
  if (profileMediaIds.length) {
    const { data: profileMediaRows, error: profileMediaRowsError } = await supabase
      .from("media_files")
      .select(
        "id, filename, storage_path, file_type, file_size, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at"
      )
      .eq("user_id", userId)
      .in("id", profileMediaIds);
    if (profileMediaRowsError && !isMissingColumnError(profileMediaRowsError)) {
      throw new Error(
        asErrorMessage(profileMediaRowsError, "Failed to load character profile media.")
      );
    }
    for (const row of (profileMediaRows ?? []) as MediaFileRow[]) {
      profileMediaRowById.set(row.id, row);
    }
  }

  const fallbackAvatarPathByCharacter = new Map<string, string>();
  if (characterSheetIds.length) {
    const { data: imageRows, error: imageRowsError } = await supabase
      .from("character_reference_images")
      .select("character_sheet_id, slot_key, storage_path")
      .eq("user_id", userId)
      .in("character_sheet_id", characterSheetIds);
    if (imageRowsError) {
      throw new Error(asErrorMessage(imageRowsError, "Failed to load character slot metadata."));
    }
    for (const row of (imageRows ?? []) as CharacterSheetImageRow[]) {
      if (typeof row.storage_path === "string" && row.storage_path.trim().length) {
        const characterId = characterSheetToCharacterId.get(row.character_sheet_id);
        if (!characterId) continue;
        const shouldPromoteToAvatar =
          row.slot_key === "portrait_close" || !fallbackAvatarPathByCharacter.has(characterId);
        if (shouldPromoteToAvatar) {
          fallbackAvatarPathByCharacter.set(characterId, row.storage_path);
        }
      }
    }
  }

  const avatarPathByCharacter = new Map<string, string>();
  const avatarPreviewPathByCharacter = new Map<string, string>();
  for (const row of typedCharacterRows) {
    const preferredPath =
      profilePathByCharacter.get(row.id) ?? fallbackAvatarPathByCharacter.get(row.id) ?? null;
    if (preferredPath) {
      avatarPathByCharacter.set(row.id, preferredPath);
    }
    const profileMediaId = profileMediaIdByCharacter.get(row.id) ?? null;
    const profileMediaRow = profileMediaId
      ? (profileMediaRowById.get(profileMediaId) ?? null)
      : null;
    const previewPath = profileMediaRow
      ? (resolveMediaSigningStoragePaths(profileMediaRow, userId)[0] ?? preferredPath)
      : preferredPath;
    if (previewPath) {
      avatarPreviewPathByCharacter.set(row.id, previewPath);
    }
  }

  const avatarUrlByCharacter = new Map<string, string | null>();
  if (avatarPreviewPathByCharacter.size) {
    const signedUrlByStoragePath = await getSignedMediaUrlsBatch({
      bucket: MEDIA_BUCKET,
      storagePaths: Array.from(avatarPreviewPathByCharacter.values()),
      surface: "character-grid",
    });
    for (const [characterId, storagePath] of avatarPreviewPathByCharacter.entries()) {
      avatarUrlByCharacter.set(characterId, signedUrlByStoragePath.get(storagePath) ?? null);
    }
  }

  return typedCharacterRows
    .map((row) => {
      const latestCharacterSheet = latestCharacterSheetByCharacter.get(row.id);
      if (!latestCharacterSheet) return null;
      const item: CharacterManagerListItem = {
        characterId: row.id,
        characterName: row.name?.trim() || DEFAULT_CHARACTER_NAME,
        characterStatus: row.status,
        characterSheetId: latestCharacterSheet.id,
        profileImageUrl: avatarUrlByCharacter.get(row.id) ?? null,
        profileImageCharacterMediaId: profileMediaIdByCharacter.get(row.id) ?? null,
        profileImageStoragePath: avatarPathByCharacter.get(row.id) ?? null,
        profileImagePreviewStoragePath: avatarPreviewPathByCharacter.get(row.id) ?? null,
        profileImageTransform: profileTransformByCharacter.get(row.id) ?? null,
        characterSheetStatus: latestCharacterSheet.status,
        updatedAt: row.updated_at,
      };
      return item;
    })
    .filter((item): item is CharacterManagerListItem => item !== null);
};
