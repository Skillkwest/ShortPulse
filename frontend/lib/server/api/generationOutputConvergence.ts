import { upsertGenerationProjection } from "./generationProjection";
import { readMediaDeliveryPathsById, type MediaDeliveryPaths } from "./mediaDeliveryPaths";
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

const readSourceRef = (metadata: JsonObject): string | null =>
  asString(asObject(metadata).source_ref);

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
    supabaseAdmin: adminClient,
  });

  const persistedOutputRows = await readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: adminClient,
  });
  const deliveryPathsByMediaId = await readMediaDeliveryPathsById({
    supabaseAdmin: adminClient,
    userId,
    mediaFileIds: persistedOutputRows
      .map((row) => row.mediaFileId)
      .filter((value): value is string => Boolean(value)),
  });
  const savedMediaIds = persistedOutputRows
    .map((row) => row.mediaFileId)
    .filter(
      (value): value is string => Boolean(value) && deliveryPathsByMediaId.has(value as string)
    );
  const hasCanonicalOwnedMedia =
    persistedOutputRows.length > 0 &&
    persistedOutputRows.every(
      (row) => typeof row.mediaFileId === "string" && deliveryPathsByMediaId.has(row.mediaFileId)
    );
  const firstOwnedDeliveryPaths =
    persistedOutputRows
      .map((row) => {
        if (!row.mediaFileId) return null;
        return deliveryPathsByMediaId.get(row.mediaFileId) ?? null;
      })
      .find((value): value is MediaDeliveryPaths => Boolean(value)) ?? null;
  const normalizedResultUrls = persistedOutputRows.map((row) => row.resultUrl);
  const nowIso = new Date().toISOString();

  await Promise.all(
    persistedOutputRows.map((row) => {
      if (!row.id || !row.mediaFileId) return Promise.resolve();
      const deliveryPaths = deliveryPathsByMediaId.get(row.mediaFileId) ?? null;
      return upsertGenerationPublication({
        generationId,
        generationOutputId: row.id,
        userId,
        generationAttemptId,
        publicationState: deliveryPaths ? "published" : "suppressed",
        ownedMediaFileId: row.mediaFileId,
        previewUrl: row.resultUrl,
        fullUrl: row.resultUrl,
        previewStoragePath: deliveryPaths?.previewStoragePath ?? null,
        fullStoragePath: deliveryPaths?.fullStoragePath ?? null,
        publishedAt: deliveryPaths ? nowIso : undefined,
        metadata,
      });
    })
  );

  const projectionPayload: Parameters<typeof upsertGenerationProjection>[0] = {
    supabaseAdmin: adminClient,
    generationId,
    userId,
    sourceRef: readSourceRef(metadata),
    requestId: asString(providerRequestId),
    providerRequestId: asString(providerRequestId),
    previewUrl: normalizedResultUrls[0] ?? asString(resultUrl) ?? undefined,
    resultUrls: normalizedResultUrls,
    savedMediaIds,
  };
  const generationReplay = asObject(metadata.generation_replay);
  const workflowReload = asObject(metadata.workflow_reload);
  const characterContext = asObject(metadata.character_context);
  const styleContext = asObject(metadata.style_context);
  if (Object.keys(generationReplay).length > 0) {
    projectionPayload.generationReplay = generationReplay;
  }
  if (Object.keys(workflowReload).length > 0) {
    projectionPayload.workflowReload = workflowReload;
  }
  if (Object.keys(characterContext).length > 0) {
    projectionPayload.characterContext = characterContext;
  }
  if (Object.keys(styleContext).length > 0) {
    projectionPayload.styleContext = styleContext;
  }
  if (firstOwnedDeliveryPaths) {
    projectionPayload.previewStoragePath = firstOwnedDeliveryPaths.previewStoragePath;
    projectionPayload.fullStoragePath = firstOwnedDeliveryPaths.fullStoragePath;
  }
  if (hasCanonicalOwnedMedia) {
    projectionPayload.publicationState = "published";
  }

  await upsertGenerationProjection(projectionPayload);

  return {
    persistedOutputRows,
    savedMediaIds,
    hasCanonicalOwnedMedia,
    previewStoragePath: firstOwnedDeliveryPaths?.previewStoragePath ?? null,
    fullStoragePath: firstOwnedDeliveryPaths?.fullStoragePath ?? null,
  };
};
