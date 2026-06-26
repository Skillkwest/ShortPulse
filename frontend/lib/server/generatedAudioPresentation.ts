/**
 * Mirrors generated-audio presentation metadata onto saved media rows.
 * Projection remains canonical; media metadata is a denormalized saved-media read copy.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type GeneratedAudioPresentationStatus = "pending" | "processing" | "ready" | "failed" | null;

type GeneratedAudioMediaRow = {
  id?: unknown;
  file_type?: unknown;
  metadata?: unknown;
};

type MirrorGeneratedAudioPresentationInput = {
  generationId: string;
  userId: string;
  displayTitle?: string | null;
  companionArtStatus?: GeneratedAudioPresentationStatus;
  companionArtStoragePath?: string | null;
  supabaseAdmin?: SupabaseAdmin;
};

type MirrorGeneratedAudioPresentationResult = {
  updatedCount: number;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asMetadataObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};

const isAudioFileType = (value: unknown): boolean =>
  typeof value === "string" && value.trim().toLowerCase().startsWith("audio");

const writeOptionalMetadataString = (
  metadata: Record<string, unknown>,
  key: string,
  value: string | null | undefined
): boolean => {
  if (value === undefined) return false;
  const normalized = asTrimmedString(value);
  if (!normalized) {
    if (!(key in metadata)) return false;
    delete metadata[key];
    return true;
  }
  if (metadata[key] === normalized) return false;
  metadata[key] = normalized;
  return true;
};

/**
 * Mirrors the current generated-audio presentation fields onto any linked saved audio rows.
 * Inputs: caller-owned generation id, owner id, and fields that changed on canonical projection.
 * Output: count of media rows updated.
 * Side effects: updates `media_files.metadata` for `source='ai_studio'` audio rows.
 */
export const mirrorGeneratedAudioPresentationToMediaFiles = async ({
  generationId,
  userId,
  displayTitle,
  companionArtStatus,
  companionArtStoragePath,
  supabaseAdmin,
}: MirrorGeneratedAudioPresentationInput): Promise<MirrorGeneratedAudioPresentationResult> => {
  const normalizedGenerationId = asTrimmedString(generationId);
  const normalizedUserId = asTrimmedString(userId);
  if (!normalizedGenerationId || !normalizedUserId) return { updatedCount: 0 };

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const { data, error } = await adminClient
    .from("media_files")
    .select("id, file_type, metadata")
    .eq("user_id", normalizedUserId)
    .eq("source", "ai_studio")
    .eq("source_ref", normalizedGenerationId);
  if (error || !Array.isArray(data)) return { updatedCount: 0 };

  let updatedCount = 0;
  for (const row of data as GeneratedAudioMediaRow[]) {
    const mediaFileId = asTrimmedString(row.id);
    if (!mediaFileId || !isAudioFileType(row.file_type)) continue;

    const metadata = asMetadataObject(row.metadata);
    let changed = false;
    changed = writeOptionalMetadataString(metadata, "display_title", displayTitle) || changed;
    changed =
      writeOptionalMetadataString(metadata, "companion_art_status", companionArtStatus) || changed;
    changed =
      writeOptionalMetadataString(
        metadata,
        "companion_art_storage_path",
        companionArtStoragePath
      ) || changed;

    if (!changed) continue;
    const updateResult = await adminClient
      .from("media_files")
      .update({ metadata })
      .eq("id", mediaFileId)
      .eq("user_id", normalizedUserId);
    if (!updateResult.error) {
      updatedCount += 1;
    }
  }

  return { updatedCount };
};
