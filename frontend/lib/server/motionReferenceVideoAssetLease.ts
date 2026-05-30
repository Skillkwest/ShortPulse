import {
  MOTION_REFERENCE_VIDEO_STORAGE_FOLDER,
  isMotionReferenceVideoStoragePath,
} from "../motionReferenceVideoStorage";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { deleteSignedStorageAssetForUser } from "./mediaUploadService";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeMotionReferenceStoragePath = ({
  storagePath,
  userId,
}: {
  storagePath: string;
  userId: string;
}): string => {
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Motion reference video storage path",
  });
  if (!isMotionReferenceVideoStoragePath(safeStoragePath)) {
    throw new Error("Motion reference video storage path is outside the expected namespace.");
  }
  return safeStoragePath;
};

const countActiveLeasesForStoragePath = async ({
  userId,
  storagePath,
}: {
  userId: string;
  storagePath: string;
}): Promise<number> => {
  const { count, error } = await getSupabaseAdmin()
    .from("motion_reference_video_generation_leases")
    .select("generation_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("storage_path", storagePath)
    .is("released_at", null);
  if (error) throw error;
  return count ?? 0;
};

const markRetirementRow = async ({
  userId,
  storagePath,
  deletedAt = null,
  deleteError = null,
}: {
  userId: string;
  storagePath: string;
  deletedAt?: string | null;
  deleteError?: string | null;
}): Promise<void> => {
  const nowIso = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("motion_reference_video_retirements").upsert(
    {
      user_id: userId,
      storage_path: storagePath,
      retired_at: nowIso,
      deleted_at: deletedAt,
      last_delete_attempt_at: nowIso,
      delete_error: deleteError,
    },
    {
      onConflict: "user_id,storage_path",
    }
  );
  if (error) throw error;
};

const deleteRetiredMotionReferenceVideoIfSafe = async ({
  userId,
  storagePath,
}: {
  userId: string;
  storagePath: string;
}): Promise<{ deleted: boolean; waitingOnLease: boolean }> => {
  const activeLeaseCount = await countActiveLeasesForStoragePath({
    userId,
    storagePath,
  });
  if (activeLeaseCount > 0) {
    return {
      deleted: false,
      waitingOnLease: true,
    };
  }

  try {
    await deleteSignedStorageAssetForUser({
      userId,
      storagePath,
      storageFolderOverride: MOTION_REFERENCE_VIDEO_STORAGE_FOLDER,
    });
    await markRetirementRow({
      userId,
      storagePath,
      deletedAt: new Date().toISOString(),
      deleteError: null,
    });
    return {
      deleted: true,
      waitingOnLease: false,
    };
  } catch (error) {
    await markRetirementRow({
      userId,
      storagePath,
      deletedAt: null,
      deleteError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const readMotionReferenceAssetFromShortpulseContext = (
  shortpulseContext: Record<string, unknown> | null | undefined
): { storagePath: string } | null => {
  const motionReferenceAsset = asObject(shortpulseContext?.motion_reference_asset);
  const storagePath = asString(motionReferenceAsset.storage_path);
  if (!storagePath || !isMotionReferenceVideoStoragePath(storagePath)) return null;
  return { storagePath };
};

export const createMotionReferenceVideoLeaseForGeneration = async ({
  generationId,
  userId,
  shortpulseContext,
}: {
  generationId: string;
  userId: string;
  shortpulseContext: Record<string, unknown> | null | undefined;
}): Promise<void> => {
  const motionReferenceAsset = readMotionReferenceAssetFromShortpulseContext(shortpulseContext);
  if (!motionReferenceAsset) return;
  const storagePath = normalizeMotionReferenceStoragePath({
    storagePath: motionReferenceAsset.storagePath,
    userId,
  });
  const { error } = await getSupabaseAdmin()
    .from("motion_reference_video_generation_leases")
    .upsert(
      {
        generation_id: generationId,
        user_id: userId,
        storage_path: storagePath,
        released_at: null,
        metadata: {
          source: "motion_control_upload",
        },
      },
      {
        onConflict: "generation_id,storage_path",
      }
    );
  if (error) throw error;
};

export const retireMotionReferenceVideoStoragePathForUser = async ({
  userId,
  storagePath,
}: {
  userId: string;
  storagePath: string;
}): Promise<{ deleted: boolean; waitingOnLease: boolean }> => {
  const safeStoragePath = normalizeMotionReferenceStoragePath({
    storagePath,
    userId,
  });
  const nowIso = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("motion_reference_video_retirements").upsert(
    {
      user_id: userId,
      storage_path: safeStoragePath,
      retired_at: nowIso,
      deleted_at: null,
      last_delete_attempt_at: null,
      delete_error: null,
    },
    {
      onConflict: "user_id,storage_path",
    }
  );
  if (error) throw error;
  return await deleteRetiredMotionReferenceVideoIfSafe({
    userId,
    storagePath: safeStoragePath,
  });
};

export const releaseMotionReferenceVideoLeasesForGeneration = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<void> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("motion_reference_video_generation_leases")
    .update({
      released_at: nowIso,
    })
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .is("released_at", null)
    .select("storage_path");
  if (error) throw error;

  const releasedStoragePaths = Array.isArray(data)
    ? Array.from(
        new Set(
          data
            .map((row) => asString((row as Record<string, unknown>).storage_path))
            .filter((value): value is string => Boolean(value))
        )
      )
    : [];

  for (const storagePath of releasedStoragePaths) {
    const { data: retirementRows, error: retirementError } = await getSupabaseAdmin()
      .from("motion_reference_video_retirements")
      .select("storage_path")
      .eq("user_id", userId)
      .eq("storage_path", storagePath)
      .is("deleted_at", null)
      .limit(1);
    if (retirementError) throw retirementError;
    if (!Array.isArray(retirementRows) || retirementRows.length === 0) continue;
    await deleteRetiredMotionReferenceVideoIfSafe({
      userId,
      storagePath,
    });
  }
};
