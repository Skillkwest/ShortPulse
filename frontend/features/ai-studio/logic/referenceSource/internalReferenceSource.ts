/**
 * Shared internal reference source contract for AI Studio drag consumers.
 * Resolves app-owned image references into a lazy blob loader plus provenance metadata.
 */
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import { refreshSupabaseSignedUrlIfNeeded } from "../../utils/imageUpload";
import type { PersistOutputSaveResult } from "../../hooks/useAiStudioPersistenceActions";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

export type ReferenceSourceKind =
  | "local_file"
  | "media_library"
  | "generated_output"
  | "external_url"
  | "internal";

export type ReferenceSourceResolutionReason =
  | "persisted_delivery"
  | "output_storage_path"
  | "saved_media_lookup"
  | "generation_index_lookup"
  | "local_object_url"
  | "payload_reference_url"
  | null;

export type ResolvedInternalReferenceSource = {
  kind: "internal";
  sourceKind: ReferenceSourceKind;
  sourceId: string;
  provenance: {
    origin: string | null;
    outputId: string | null;
    mediaId: string | null;
    imageIndex: number;
    sourceSurface: string | null;
    resolutionReason: ReferenceSourceResolutionReason;
  };
  outputId: string | null;
  mediaId: string | null;
  mediaSource: StudioOutput["mediaSource"] | null;
  preview: {
    url: string | null;
    width?: number;
    height?: number;
  };
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  promptText: string | null;
  preparedImageUrl?: string | null;
  loadBlob: () => Promise<Blob>;
};

export type ResolveInternalReferenceDrop = (
  payload: InternalReferenceDragPayload
) => Promise<ResolvedInternalReferenceSource | null>;

type ResolveInternalReferenceSourceArgs = {
  payload: InternalReferenceDragPayload;
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  ensureOutputPersisted: (outputId: string) => Promise<PersistOutputSaveResult>;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
  resolveStoragePathFromMediaId?: (mediaId: string) => Promise<string | null>;
  resolveStoragePathFromGenerationOutput?: (args: {
    generationId: string | null;
    taskId: string | null;
    imageIndex: number;
  }) => Promise<string | null>;
};

const MEDIA_BUCKET = "media_library";

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
  return (
    asFiniteOutputIndex(metadataRecord.generation_output_index) ??
    asFiniteOutputIndex(metadataRecord.index)
  );
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
      .select("preview_storage_path, storage_path, created_at")
      .eq("source", "ai_studio")
      .eq("source_ref", generationId)
      .contains("metadata", metadataFilter)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (
      asCanonicalStoragePath(asTrimmedString(data?.preview_storage_path)) ??
      asCanonicalStoragePath(asTrimmedString(data?.storage_path))
    );
  };

  const generationIndexPath = await lookupByIndex({ generation_output_index: imageIndex });
  if (generationIndexPath) return generationIndexPath;
  const indexPath = await lookupByIndex({ index: imageIndex });
  if (indexPath) return indexPath;

  const { data, error } = await supabase
    .from("media_files")
    .select("preview_storage_path, storage_path, metadata, created_at")
    .eq("source", "ai_studio")
    .eq("source_ref", generationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error || !Array.isArray(data) || !data.length) return null;

  const indexedRow =
    data.find((row) => resolveMetadataOutputIndex(row?.metadata) === imageIndex) ??
    (data.length === 1 ? data[0] : null);
  return (
    asCanonicalStoragePath(asTrimmedString(indexedRow?.preview_storage_path)) ??
    asCanonicalStoragePath(asTrimmedString(indexedRow?.storage_path))
  );
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

const defaultResolveStoragePathFromMediaId = async (mediaId: string): Promise<string | null> => {
  const normalizedMediaId = mediaId.trim();
  if (!normalizedMediaId) return null;
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from("media_files")
    .select("preview_storage_path, storage_path")
    .eq("id", normalizedMediaId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (
    asCanonicalStoragePath(asTrimmedString(data?.preview_storage_path)) ??
    asCanonicalStoragePath(asTrimmedString(data?.storage_path))
  );
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

const fetchMaybeAuthenticated = async (url: string): Promise<Response> => {
  const parsed = new URL(url, window.location.href);
  const sameOrigin = parsed.origin === window.location.origin;
  const initialResponse = sameOrigin
    ? await fetch(url, { credentials: "include" })
    : await fetch(url);
  if ((initialResponse.status === 401 || initialResponse.status === 403) && sameOrigin) {
    return fetchWithAuth(url, {
      method: "GET",
      shortpulseLogScope: "generation",
      shortpulseSkipErrorLogging: true,
    });
  }
  return initialResponse;
};

const downloadBlobFromUrl = async (inputUrl: string): Promise<Blob> => {
  const refreshedUrl = await refreshSupabaseSignedUrlIfNeeded(inputUrl).catch(() => inputUrl);
  const response = await fetchMaybeAuthenticated(refreshedUrl);
  if (!response.ok) {
    throw new Error(`Unable to download image (${response.status}).`);
  }
  const blob = await response.blob();
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("Dropped image returned no data.");
  }
  return blob;
};

const resolveOutputStoragePath = (output: StudioOutput): string | null => {
  return (
    asCanonicalStoragePath(output.previewStoragePath) ??
    asCanonicalStoragePath(output.fullStoragePath)
  );
};

const resolvePersistedPreviewStoragePath = (
  persisted: PersistOutputSaveResult | null | undefined
): string | null =>
  asCanonicalStoragePath(persisted?.delivery?.previewStoragePath) ??
  asCanonicalStoragePath(persisted?.delivery?.fullStoragePath);

const resolvePersistedFullStoragePath = (
  persisted: PersistOutputSaveResult | null | undefined
): string | null =>
  asCanonicalStoragePath(persisted?.delivery?.fullStoragePath) ??
  asCanonicalStoragePath(persisted?.delivery?.previewStoragePath);

const resolveSharedSourceKind = (
  output: StudioOutput | null,
  mediaId: string | null
): ReferenceSourceKind => {
  if (output?.localObjectUrl?.trim()) return "local_file";
  if (output?.mediaSource === "generated") return "generated_output";
  if (output?.mediaSource === "upload") return "local_file";
  if (output?.mediaSource === "library" || mediaId) return "media_library";
  return "internal";
};

/**
 * Resolves one authoritative internal reference source that downstream consumers can lazily load.
 */
export const resolveInternalReferenceSource = async ({
  payload,
  getOutputById,
  getOutputSnapshot,
  ensureOutputPersisted,
  resolveSavedMediaIdFromOutput,
  resolveStoragePathFromMediaId = defaultResolveStoragePathFromMediaId,
  resolveStoragePathFromGenerationOutput = defaultResolveStoragePathFromGenerationOutput,
}: ResolveInternalReferenceSourceArgs): Promise<ResolvedInternalReferenceSource | null> => {
  const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
  const resolvedOutputId = resolvePayloadOutputId({ payload, getOutputSnapshot });
  const initialOutput = resolvedOutputId ? getOutputById(resolvedOutputId) : null;
  let resolvedOutput = initialOutput?.mode === "image" ? initialOutput : null;
  let resolvedMediaId =
    payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex) || null;
  let persistedResult: PersistOutputSaveResult | null = null;

  if (
    resolvedOutputId &&
    (!resolvedOutput || !resolvedMediaId || !resolveOutputStoragePath(resolvedOutput))
  ) {
    try {
      persistedResult = await ensureOutputPersisted(resolvedOutputId);
      const nextOutput = getOutputById(resolvedOutputId);
      if (nextOutput?.mode === "image") {
        resolvedOutput = nextOutput;
      }
      if (!resolvedMediaId) {
        resolvedMediaId =
          persistedResult.mediaFileIds[imageIndex] ??
          persistedResult.mediaFileIds[0] ??
          resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex) ??
          null;
      }
    } catch {
      // Best effort only. Downstream consumers still get deterministic null/error behavior.
    }
  }

  let previewStoragePath =
    resolvePersistedPreviewStoragePath(persistedResult) ??
    (resolvedOutput ? asCanonicalStoragePath(resolvedOutput.previewStoragePath) : null) ??
    null;
  let fullStoragePath =
    resolvePersistedFullStoragePath(persistedResult) ??
    (resolvedOutput ? asCanonicalStoragePath(resolvedOutput.fullStoragePath) : null) ??
    previewStoragePath;
  let resolutionReason: ReferenceSourceResolutionReason = persistedResult?.delivery
    ? "persisted_delivery"
    : previewStoragePath || fullStoragePath
      ? "output_storage_path"
      : null;

  if (!previewStoragePath && !fullStoragePath && resolvedMediaId) {
    const mediaPath = await resolveStoragePathFromMediaId(resolvedMediaId).catch(() => null);
    if (mediaPath) {
      previewStoragePath = mediaPath;
      fullStoragePath = mediaPath;
      resolutionReason = "saved_media_lookup";
    }
  }

  if (!previewStoragePath && !fullStoragePath && resolvedOutput) {
    const generationPath = await resolveStoragePathFromGenerationOutput({
      generationId: asTrimmedString(resolvedOutput.generationId),
      taskId: asTrimmedString(resolvedOutput.taskId),
      imageIndex,
    }).catch(() => null);
    if (generationPath) {
      previewStoragePath = generationPath;
      fullStoragePath = generationPath;
      resolutionReason = "generation_index_lookup";
    }
  }

  const localObjectUrl =
    asTrimmedString(resolvedOutput?.localObjectUrl)?.replace(/#video=1$/i, "") ?? null;
  const compatibilityHintUrl =
    asTrimmedString(payload.referenceUrl) ?? asTrimmedString(resolvedOutput?.previewUrl) ?? null;
  const previewUrl =
    asTrimmedString(resolvedOutput?.previewUrl) ??
    asTrimmedString(payload.referenceRenderUrl) ??
    compatibilityHintUrl;

  const loadBlob = async (): Promise<Blob> => {
    if (previewStoragePath || fullStoragePath) {
      const storagePath = previewStoragePath ?? fullStoragePath;
      if (!storagePath) {
        throw new Error("Internal reference source is missing storage path.");
      }
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(storagePath);
      if (error || !data) {
        throw error ?? new Error("Unable to download internal reference source.");
      }
      return data;
    }
    if (localObjectUrl) {
      return await downloadBlobFromUrl(localObjectUrl);
    }
    if (compatibilityHintUrl) {
      return await downloadBlobFromUrl(compatibilityHintUrl);
    }
    throw new Error("Internal reference source could not be resolved.");
  };

  if (!previewStoragePath && !fullStoragePath && !localObjectUrl && !compatibilityHintUrl) {
    return null;
  }

  return {
    kind: "internal",
    sourceKind: resolveSharedSourceKind(resolvedOutput, resolvedMediaId),
    sourceId:
      resolvedMediaId ??
      resolvedOutputId ??
      `reference-source:${payload.origin ?? "internal"}:${imageIndex}`,
    provenance: {
      origin: payload.origin ?? null,
      outputId: resolvedOutputId || null,
      mediaId: resolvedMediaId || null,
      imageIndex,
      sourceSurface: payload.sourceSurface ?? null,
      resolutionReason:
        resolutionReason ??
        (localObjectUrl
          ? "local_object_url"
          : compatibilityHintUrl
            ? "payload_reference_url"
            : null),
    },
    outputId: resolvedOutputId || null,
    mediaId: resolvedMediaId || null,
    mediaSource: resolvedOutput?.mediaSource ?? null,
    preview: {
      url: previewUrl ?? null,
      ...(payload.width ? { width: payload.width } : {}),
      ...(payload.height ? { height: payload.height } : {}),
    },
    previewStoragePath: previewStoragePath ?? null,
    fullStoragePath: fullStoragePath ?? null,
    promptText: resolvedOutput?.prompt || resolvedOutput?.previewText || null,
    loadBlob,
  };
};
