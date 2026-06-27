import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { upsertGenerationProjection } from "../api/generationProjection";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { mirrorGeneratedAudioPresentationToMediaFiles } from "../generatedAudioPresentation";

const MEDIA_BUCKET = "media_library";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type AudioCompanionArtCleanupResult = {
  clearedProjection: boolean;
  deletedStoragePath: string | null;
  storageDeleted: boolean;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const logCleanupFailure = async ({
  userId,
  generationId,
  source,
  error,
  storagePath,
}: {
  userId: string;
  generationId: string;
  source: string;
  error: unknown;
  storagePath?: string | null;
}) => {
  await writeAppErrorLog({
    source,
    scope: "generation",
    message: "Audio companion art cleanup failed.",
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      companion_art_storage_path: storagePath ?? null,
      error: error instanceof Error ? error.message : String(error),
    },
  }).catch(() => undefined);
};

export const cleanupAudioCompanionArt = async ({
  generationId,
  userId,
  clearProjection = true,
  supabaseAdmin,
}: {
  generationId: string;
  userId: string;
  clearProjection?: boolean;
  supabaseAdmin?: SupabaseAdmin;
}): Promise<AudioCompanionArtCleanupResult> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  let companionArtStoragePath: string | null = null;

  try {
    const { data, error } = await adminClient
      .from("generation_projection")
      .select("companion_art_storage_path")
      .eq("generation_id", generationId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Failed to load audio companion art projection.");
    }
    companionArtStoragePath = asTrimmedString(
      data && typeof data === "object"
        ? (data as Record<string, unknown>).companion_art_storage_path
        : null
    );
  } catch (error) {
    await logCleanupFailure({
      userId,
      generationId,
      source: "telemetry.audio_companion_art.cleanup_lookup_failed",
      error,
    });
  }

  let storageDeleted = false;
  if (companionArtStoragePath) {
    try {
      const scopedPath = assertUserScopedMediaStoragePath({
        userId,
        path: companionArtStoragePath,
        label: "Audio companion art cleanup path",
      });
      const { error } = await adminClient.storage.from(MEDIA_BUCKET).remove([scopedPath]);
      if (error) {
        throw new Error(error.message || "Failed to remove audio companion art storage.");
      }
      storageDeleted = true;
    } catch (error) {
      await logCleanupFailure({
        userId,
        generationId,
        source: "telemetry.audio_companion_art.cleanup_storage_failed",
        error,
        storagePath: companionArtStoragePath,
      });
    }
  }

  try {
    await mirrorGeneratedAudioPresentationToMediaFiles({
      generationId,
      userId,
      companionArtStatus: null,
      companionArtStoragePath: null,
      supabaseAdmin: adminClient,
    });
  } catch (error) {
    await logCleanupFailure({
      userId,
      generationId,
      source: "telemetry.audio_companion_art.cleanup_media_mirror_failed",
      error,
      storagePath: companionArtStoragePath,
    });
  }

  let clearedProjection = false;
  if (clearProjection) {
    try {
      await upsertGenerationProjection({
        generationId,
        userId,
        companionArtStatus: null,
        companionArtStoragePath: null,
      });
      clearedProjection = true;
    } catch (error) {
      await logCleanupFailure({
        userId,
        generationId,
        source: "telemetry.audio_companion_art.cleanup_projection_clear_failed",
        error,
        storagePath: companionArtStoragePath,
      });
    }
  }

  return {
    clearedProjection,
    deletedStoragePath: companionArtStoragePath,
    storageDeleted,
  };
};
