import { upsertGenerationProjection } from "./generationProjection";
import { upsertGenerationPublication } from "./generationPublications";
import {
  attachMediaFileToGenerationOutput,
  readPersistedGenerationOutputs,
  type PersistedGenerationOutputRow,
} from "./generationOutputs";
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const readMediaStoragePathById = async ({
  supabaseAdmin,
  userId,
  mediaFileIds,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  mediaFileIds: string[];
}): Promise<Map<string, string>> => {
  const normalizedMediaFileIds = Array.from(
    new Set(
      mediaFileIds
        .map((value) => asString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!normalizedMediaFileIds.length) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("media_files")
    .select("id, storage_path")
    .eq("user_id", userId)
    .in("id", normalizedMediaFileIds)
    .limit(normalizedMediaFileIds.length);
  if (error || !Array.isArray(data)) {
    return new Map();
  }

  const storagePathByMediaId = new Map<string, string>();
  for (const item of data) {
    const row = asObject(item);
    const mediaFileId = asString(row.id);
    const storagePath = asString(row.storage_path);
    if (!mediaFileId || !storagePath) continue;
    storagePathByMediaId.set(mediaFileId, storagePath);
  }
  return storagePathByMediaId;
};

export type ReconcileOwnedGenerationOutputSlotInput = {
  generationId: string;
  userId: string;
  outputIndex: number;
  mediaFileId: string;
  resultUrl?: string | null;
  providerRequestId?: string | null;
  generationAttemptId?: string | null;
  metadata?: JsonObject;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
};

export type ReconcileOwnedGenerationOutputSlotResult = {
  persistedOutputRows: PersistedGenerationOutputRow[];
  savedMediaIds: string[];
  hasCanonicalOwnedMedia: boolean;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export const reconcileOwnedGenerationOutputSlot = async ({
  generationId,
  userId,
  outputIndex,
  mediaFileId,
  resultUrl,
  providerRequestId,
  generationAttemptId,
  metadata = {},
  supabaseAdmin,
}: ReconcileOwnedGenerationOutputSlotInput): Promise<ReconcileOwnedGenerationOutputSlotResult> => {
  const adminClient = supabaseAdmin ?? getSupabaseAdmin();

  await attachMediaFileToGenerationOutput({
    generationId,
    userId,
    outputIndex,
    mediaFileId,
    resultUrl,
    providerRequestId,
    generationAttemptId,
    metadata,
  });

  const persistedOutputRows = await readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
  const storagePathByMediaId = await readMediaStoragePathById({
    supabaseAdmin: adminClient,
    userId,
    mediaFileIds: persistedOutputRows
      .map((row) => row.mediaFileId)
      .filter((value): value is string => Boolean(value)),
  });
  const savedMediaIds = persistedOutputRows
    .map((row) => row.mediaFileId)
    .filter(
      (value): value is string => Boolean(value) && storagePathByMediaId.has(value as string)
    );
  const hasCanonicalOwnedMedia =
    persistedOutputRows.length > 0 &&
    persistedOutputRows.every(
      (row) => typeof row.mediaFileId === "string" && storagePathByMediaId.has(row.mediaFileId)
    );
  const firstOwnedStoragePath =
    persistedOutputRows
      .map((row) => {
        if (!row.mediaFileId) return null;
        return storagePathByMediaId.get(row.mediaFileId) ?? null;
      })
      .find((value): value is string => Boolean(value)) ?? null;
  const normalizedResultUrls = persistedOutputRows.map((row) => row.resultUrl);
  const nowIso = new Date().toISOString();

  await Promise.all(
    persistedOutputRows.map((row) => {
      if (!row.id || !row.mediaFileId) return Promise.resolve();
      const storagePath = storagePathByMediaId.get(row.mediaFileId) ?? null;
      return upsertGenerationPublication({
        generationId,
        generationOutputId: row.id,
        userId,
        generationAttemptId,
        publicationState: storagePath ? "published" : "suppressed",
        ownedMediaFileId: row.mediaFileId,
        previewUrl: row.resultUrl,
        fullUrl: row.resultUrl,
        previewStoragePath: storagePath,
        fullStoragePath: storagePath,
        publishedAt: storagePath ? nowIso : undefined,
        metadata,
      });
    })
  );

  const projectionPayload: Parameters<typeof upsertGenerationProjection>[0] = {
    supabaseAdmin: adminClient,
    generationId,
    userId,
    previewUrl: normalizedResultUrls[0] ?? asString(resultUrl) ?? undefined,
    resultUrls: normalizedResultUrls,
    savedMediaIds,
  };
  if (firstOwnedStoragePath) {
    projectionPayload.previewStoragePath = firstOwnedStoragePath;
    projectionPayload.fullStoragePath = firstOwnedStoragePath;
  }
  if (hasCanonicalOwnedMedia) {
    projectionPayload.publicationState = "published";
  }

  await upsertGenerationProjection(projectionPayload);

  return {
    persistedOutputRows,
    savedMediaIds,
    hasCanonicalOwnedMedia,
    previewStoragePath: firstOwnedStoragePath,
    fullStoragePath: firstOwnedStoragePath,
  };
};
