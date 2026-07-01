import { isMotionReferenceVideoStoragePath } from "../motionReferenceVideoStorage";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
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

export const readMotionReferenceAssetFromShortpulseContext = (
  shortpulseContext: Record<string, unknown> | null | undefined
): { storagePath: string; sourceRef: string | null; requestId: string | null } | null => {
  const motionReferenceAsset = asObject(shortpulseContext?.motion_reference_asset);
  const storagePath = asString(motionReferenceAsset.storage_path);
  if (!storagePath || !isMotionReferenceVideoStoragePath(storagePath)) return null;
  return {
    storagePath,
    sourceRef: asString(shortpulseContext?.source_ref) ?? asString(motionReferenceAsset.source_ref),
    requestId: asString(shortpulseContext?.request_id) ?? asString(motionReferenceAsset.request_id),
  };
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
          source_ref: motionReferenceAsset.sourceRef,
          request_id: motionReferenceAsset.requestId,
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
  const activeLeaseCount = await countActiveLeasesForStoragePath({
    userId,
    storagePath: safeStoragePath,
  });
  return {
    deleted: false,
    waitingOnLease: activeLeaseCount > 0,
  };
};

export const releaseMotionReferenceVideoLeasesForGeneration = async ({
  generationId,
  userId,
}: {
  generationId: string;
  userId: string;
}): Promise<void> => {
  const nowIso = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("motion_reference_video_generation_leases")
    .update({
      released_at: nowIso,
    })
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .is("released_at", null)
    .select("storage_path");
  if (error) throw error;
};
