/**
 * Styles-library internal reference drop resolver.
 * Resolves image URL candidates from durable output state and signed storage fallbacks.
 */
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import type { PersistOutputSaveResult } from "../../hooks/useAiStudioPersistenceActions";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import {
  normalizeReferenceTransferUrlCandidate,
  resolveReferenceTransferUrl,
} from "../../utils/dragDrop";
import type { ResolvedInternalStyleDrop } from "./intake";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type ResolveStyleInternalDropCandidatesArgs = {
  payload: InternalReferenceDragPayload;
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  ensureOutputPersisted: (outputId: string) => Promise<PersistOutputSaveResult>;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
  resolveSignedStorageUrl?: (storagePath: string) => Promise<string | null>;
  resolveStoragePathFromMediaId?: (mediaId: string) => Promise<string | null>;
  resolveStoragePathFromGenerationOutput?: (args: {
    generationId: string | null;
    taskId: string | null;
    imageIndex: number;
  }) => Promise<string | null>;
};

const defaultResolveSignedStorageUrl = async (storagePath: string): Promise<string | null> =>
  await getSignedMediaUrl({
    bucket: "media_library",
    storagePath,
    forceRefresh: true,
  });

const defaultResolveStoragePathFromMediaId = async (mediaId: string): Promise<string | null> => {
  const normalizedMediaId = mediaId.trim();
  if (!normalizedMediaId) return null;
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from("media_files")
    .select("storage_path")
    .eq("id", normalizedMediaId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const storagePath = typeof data?.storage_path === "string" ? data.storage_path : null;
  return asCanonicalStoragePath(storagePath);
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asFiniteOutputIndex = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
};

const resolveMetadataOutputIndex = (metadata: unknown): number | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const metadataRecord = metadata as Record<string, unknown>;
  const generationOutputIndex = asFiniteOutputIndex(metadataRecord.generation_output_index);
  if (typeof generationOutputIndex === "number") return generationOutputIndex;
  return asFiniteOutputIndex(metadataRecord.index);
};

const resolveGenerationIdByTaskId = async (taskId: string): Promise<string | null> => {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) return null;
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .select("id, created_at")
    .eq("request_id", normalizedTaskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return asTrimmedString(data?.id);
};

const resolveStoragePathByGenerationAndIndex = async ({
  generationId,
  imageIndex,
}: {
  generationId: string;
  imageIndex: number;
}): Promise<string | null> => {
  const supabase = ensureSupabaseClient();
  const lookupByIndex = async (metadataFilter: Record<string, number>) => {
    const { data, error } = await supabase
      .from("media_files")
      .select("storage_path, created_at")
      .eq("source", "ai_studio")
      .eq("source_ref", generationId)
      .contains("metadata", metadataFilter)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return asCanonicalStoragePath(asTrimmedString(data?.storage_path));
  };

  const generationIndexPath = await lookupByIndex({ generation_output_index: imageIndex });
  if (generationIndexPath) return generationIndexPath;

  const indexPath = await lookupByIndex({ index: imageIndex });
  if (indexPath) return indexPath;

  const { data, error } = await supabase
    .from("media_files")
    .select("storage_path, metadata, created_at")
    .eq("source", "ai_studio")
    .eq("source_ref", generationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !Array.isArray(data) || !data.length) return null;

  const indexedRow =
    data.find((row) => resolveMetadataOutputIndex(row?.metadata) === imageIndex) ??
    (data.length === 1 ? data[0] : null);
  return asCanonicalStoragePath(asTrimmedString(indexedRow?.storage_path));
};

const defaultResolveStoragePathFromGenerationOutput = async ({
  generationId,
  taskId,
  imageIndex,
}: {
  generationId: string | null;
  taskId: string | null;
  imageIndex: number;
}): Promise<string | null> => {
  const resolvedGenerationId =
    generationId?.trim() || (taskId ? await resolveGenerationIdByTaskId(taskId) : null);
  if (!resolvedGenerationId) return null;
  return await resolveStoragePathByGenerationAndIndex({
    generationId: resolvedGenerationId,
    imageIndex,
  });
};

const resolvePayloadOutputId = ({
  payload,
  getOutputSnapshot,
}: {
  payload: InternalReferenceDragPayload;
  getOutputSnapshot: () => OutputSnapshot;
}): string => {
  const explicitOutputId = (payload.outputId ?? payload.referenceId ?? "").trim();
  if (explicitOutputId) return explicitOutputId;

  const droppedReferenceUrl = (payload.referenceUrl ?? "").trim();
  if (!droppedReferenceUrl) return "";
  const snapshot = getOutputSnapshot();
  const candidateIds = [...snapshot.outputOrder, ...snapshot.archivedOutputOrder];
  return (
    candidateIds.find((candidateId) => {
      const output = snapshot.outputById[candidateId] ?? snapshot.archivedOutputById[candidateId];
      if (!output) return false;
      if ((output.previewUrl ?? "").trim() === droppedReferenceUrl) return true;
      return (output.resultUrls ?? []).some((url) => (url ?? "").trim() === droppedReferenceUrl);
    }) ?? ""
  );
};

const pushImageCandidate = (next: string[], value: string | null | undefined) => {
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value?.trim() ?? "";
  if (!normalized) return;
  if (!next.includes(normalized)) {
    next.push(normalized);
  }
};

const resolveOutputStoragePath = (output: StudioOutput): string | null => {
  return (
    asCanonicalStoragePath(output.previewStoragePath) ??
    asCanonicalStoragePath(output.fullStoragePath)
  );
};

const resolvePersistedDeliveryStoragePath = (
  persisted: PersistOutputSaveResult | null | undefined
): string | null => {
  if (!persisted?.delivery) return null;
  return (
    asCanonicalStoragePath(persisted.delivery.previewStoragePath) ??
    asCanonicalStoragePath(persisted.delivery.fullStoragePath)
  );
};

/**
 * Resolves style-drop candidates for internal reference-grid drags.
 * Adds signed storage URLs first when canonical storage paths are available.
 */
export const resolveStyleInternalDropCandidates = async ({
  payload,
  getOutputById,
  getOutputSnapshot,
  ensureOutputPersisted,
  resolveSavedMediaIdFromOutput,
  resolveSignedStorageUrl = defaultResolveSignedStorageUrl,
  resolveStoragePathFromMediaId = defaultResolveStoragePathFromMediaId,
  resolveStoragePathFromGenerationOutput = defaultResolveStoragePathFromGenerationOutput,
}: ResolveStyleInternalDropCandidatesArgs): Promise<ResolvedInternalStyleDrop | null> => {
  const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
  const resolvedOutputId = resolvePayloadOutputId({
    payload,
    getOutputSnapshot,
  });
  const initialOutput = resolvedOutputId ? getOutputById(resolvedOutputId) : null;
  const fallbackCandidates: string[] = [];
  pushImageCandidate(fallbackCandidates, payload.referenceUrl);
  if (!initialOutput || initialOutput.mode !== "image") {
    const mediaLookupCandidates: string[] = [];
    const payloadMediaId = payload.mediaId?.trim() ?? null;
    let mediaLookupStoragePath: string | null = null;
    if (payloadMediaId) {
      mediaLookupStoragePath = await resolveStoragePathFromMediaId(payloadMediaId).catch(
        () => null
      );
      if (mediaLookupStoragePath) {
        const signedMediaLookupUrl = await resolveSignedStorageUrl(mediaLookupStoragePath).catch(
          () => null
        );
        pushImageCandidate(mediaLookupCandidates, signedMediaLookupUrl);
      }
    }
    fallbackCandidates.forEach((candidate) => pushImageCandidate(mediaLookupCandidates, candidate));
    if (!mediaLookupCandidates.length) return null;
    const mediaLookupPreviewUrlHint = mediaLookupCandidates[0] ?? null;
    return {
      imageUrlCandidates: mediaLookupCandidates,
      promptText: null,
      serverCopyHints: {
        outputId: resolvedOutputId || null,
        mediaId: payloadMediaId,
        imageIndex,
        generationId: null,
        taskId: null,
        previewStoragePathHint: mediaLookupStoragePath,
        fullStoragePathHint: mediaLookupStoragePath,
        previewUrlHint: mediaLookupPreviewUrlHint,
        fullUrlHint: mediaLookupPreviewUrlHint,
      },
      resolutionReason: mediaLookupStoragePath
        ? "saved_media_lookup"
        : fallbackCandidates.length
          ? "payload_reference_url"
          : null,
    };
  }

  let resolvedOutput = initialOutput;
  let resolvedMediaId =
    payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex);
  let persistedResult: PersistOutputSaveResult | null = null;
  if (resolvedOutputId && (!resolvedMediaId || !resolveOutputStoragePath(resolvedOutput))) {
    try {
      persistedResult = await ensureOutputPersisted(resolvedOutputId);
      const nextOutput = getOutputById(resolvedOutputId);
      if (nextOutput && nextOutput.mode === "image") {
        resolvedOutput = nextOutput;
      }
      if (!resolvedMediaId) {
        resolvedMediaId =
          persistedResult.mediaFileIds[imageIndex] ??
          persistedResult.mediaFileIds[0] ??
          resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex);
      }
    } catch {
      // Continue with best-effort recovery from durable output state and lookup fallbacks.
    }
  }

  const candidates: string[] = [];
  let resolutionReason: ResolvedInternalStyleDrop["resolutionReason"] = null;
  let storagePath =
    resolvePersistedDeliveryStoragePath(persistedResult) ??
    resolveOutputStoragePath(resolvedOutput);
  if (storagePath) {
    resolutionReason = persistedResult?.delivery ? "persisted_delivery" : "output_storage_path";
  }
  if (!storagePath && resolvedMediaId) {
    storagePath = await resolveStoragePathFromMediaId(resolvedMediaId).catch(() => null);
    if (storagePath) {
      resolutionReason = "saved_media_lookup";
    }
  }
  if (!storagePath) {
    storagePath = await resolveStoragePathFromGenerationOutput({
      generationId: asTrimmedString(resolvedOutput.generationId),
      taskId: asTrimmedString(resolvedOutput.taskId),
      imageIndex,
    }).catch(() => null);
    if (storagePath) {
      resolutionReason = "generation_index_lookup";
    }
  }
  if (storagePath) {
    const signedUrl = await resolveSignedStorageUrl(storagePath).catch(() => null);
    pushImageCandidate(candidates, signedUrl);
  }

  const indexedResultUrl = asTrimmedString(resolvedOutput.resultUrls?.[imageIndex]);
  const outputPreviewCandidate =
    asTrimmedString(resolvedOutput.previewUrl) ??
    resolveReferenceTransferUrl(resolvedOutput, "image");
  pushImageCandidate(candidates, indexedResultUrl);
  pushImageCandidate(candidates, outputPreviewCandidate);
  fallbackCandidates.forEach((candidate) => pushImageCandidate(candidates, candidate));
  if (!candidates.length) return null;
  if (!resolutionReason) {
    if (indexedResultUrl?.trim()) {
      resolutionReason = "result_url";
    } else if ((outputPreviewCandidate ?? "").trim()) {
      resolutionReason = "output_preview_url";
    } else if (fallbackCandidates.length) {
      resolutionReason = "payload_reference_url";
    }
  }

  const previewStoragePathHint =
    asCanonicalStoragePath(asTrimmedString(resolvedOutput.previewStoragePath)) ??
    asCanonicalStoragePath(asTrimmedString(resolvedOutput.fullStoragePath)) ??
    null;
  const fullStoragePathHint =
    asCanonicalStoragePath(asTrimmedString(resolvedOutput.fullStoragePath)) ??
    previewStoragePathHint;
  const previewUrlHint =
    asTrimmedString(outputPreviewCandidate) ?? asTrimmedString(resolvedOutput.previewUrl);
  const fullUrlHint =
    asTrimmedString(indexedResultUrl) ??
    asTrimmedString(resolvedOutput.resultUrls?.[0]) ??
    previewUrlHint;

  return {
    managedStoragePath: storagePath,
    imageUrlCandidates: candidates,
    promptText: resolvedOutput.prompt || resolvedOutput.previewText || null,
    serverCopyHints: {
      outputId: resolvedOutputId || asTrimmedString(resolvedOutput.id),
      mediaId: resolvedMediaId || payload.mediaId || null,
      imageIndex,
      generationId: asTrimmedString(resolvedOutput.generationId),
      taskId: asTrimmedString(resolvedOutput.taskId),
      previewStoragePathHint:
        resolvePersistedDeliveryStoragePath(persistedResult) ?? previewStoragePathHint,
      fullStoragePathHint:
        asCanonicalStoragePath(persistedResult?.delivery?.fullStoragePath) ?? fullStoragePathHint,
      previewUrlHint,
      fullUrlHint,
    },
    resolutionReason,
  };
};
