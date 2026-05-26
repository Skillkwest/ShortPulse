/**
 * Shared internal reference source contract for AI Studio drag consumers.
 * Resolves app-owned image references into a lazy blob loader plus provenance metadata.
 */
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../../lib/supabaseClient";
import { refreshSupabaseSignedUrlIfNeeded } from "../../utils/imageUpload";
import { resolvePublishedGenerationOutputStoragePathByIndex } from "../generatedMediaAuthority";
import type {
  PersistOutputSaveOptions,
  PersistOutputSaveResult,
} from "../../hooks/useAiStudioPersistenceActions";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type InternalReferenceSourceResolutionDebugEntry = {
  capturedAt: string;
  origin: string | null;
  sourceSurface: string | null;
  outputId: string | null;
  mediaId: string | null;
  imageIndex: number;
  sourceKind: ReferenceSourceKind | null;
  initialOutputFound: boolean;
  persistedAttempted: boolean;
  persistedResolved: boolean;
  persistedDeliveryPresent: boolean;
  persistedMediaIdCount: number;
  outputStoragePathPresent: boolean;
  mediaLookupAttempted: boolean;
  mediaLookupResolved: boolean;
  generationLookupAttempted: boolean;
  generationLookupResolved: boolean;
  localObjectUrlPresent: boolean;
  compatibilityHintUrlPresent: boolean;
  previewUrlPresent: boolean;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  resolutionReason: ReferenceSourceResolutionReason;
  returnedNull: boolean;
  loadBlobStrategy:
    | "storage_download"
    | "signed_storage_url"
    | "local_object_url"
    | "rendered_hint_url"
    | "compatibility_hint_url"
    | "preview_url"
    | null;
  loadBlobOutcome: "pending" | "success" | "error" | null;
  error: string | null;
};

type InternalReferenceSourceResolutionDebugHandle = {
  version: string;
  snapshot: () => InternalReferenceSourceResolutionDebugEntry[];
  latest: () => InternalReferenceSourceResolutionDebugEntry | null;
  clear: () => void;
};

const INTERNAL_REFERENCE_SOURCE_DEBUG_VERSION = "internal-reference-source-v1";
const INTERNAL_REFERENCE_SOURCE_DEBUG_LIMIT = 20;
const internalReferenceSourceDebugBuffer: InternalReferenceSourceResolutionDebugEntry[] = [];

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
  | "payload_render_url"
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
  generationId?: string | null;
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
  ensureOutputPersisted: (
    outputId: string,
    options?: PersistOutputSaveOptions
  ) => Promise<PersistOutputSaveResult>;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
  allowPersistenceRecovery?: boolean;
  allowTrustedPreviewFallback?: boolean;
  resolveStoragePathFromMediaId?: (mediaId: string) => Promise<string | null>;
  resolveStoragePathFromGenerationOutput?: (args: {
    generationId: string | null;
    imageIndex: number;
  }) => Promise<string | null>;
};

const MEDIA_BUCKET = "media_library";

const installInternalReferenceSourceDebugHandle = (): void => {
  if (typeof window === "undefined") return;
  if (window.__shortpulseInternalReferenceSourceResolution) return;
  window.__shortpulseInternalReferenceSourceResolution = {
    version: INTERNAL_REFERENCE_SOURCE_DEBUG_VERSION,
    snapshot: () => [...internalReferenceSourceDebugBuffer],
    latest: () =>
      internalReferenceSourceDebugBuffer.length
        ? internalReferenceSourceDebugBuffer[internalReferenceSourceDebugBuffer.length - 1]
        : null,
    clear: () => {
      internalReferenceSourceDebugBuffer.length = 0;
    },
  };
};

const recordInternalReferenceSourceDebugEntry = (
  entry: InternalReferenceSourceResolutionDebugEntry
): InternalReferenceSourceResolutionDebugEntry => {
  internalReferenceSourceDebugBuffer.push(entry);
  if (internalReferenceSourceDebugBuffer.length > INTERNAL_REFERENCE_SOURCE_DEBUG_LIMIT) {
    internalReferenceSourceDebugBuffer.splice(
      0,
      internalReferenceSourceDebugBuffer.length - INTERNAL_REFERENCE_SOURCE_DEBUG_LIMIT
    );
  }
  installInternalReferenceSourceDebugHandle();
  return entry;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

type MediaStoragePathRow = {
  preview_storage_path?: unknown;
  storage_path?: unknown;
  metadata?: unknown;
  created_at?: unknown;
};

const isPreviewStoragePathSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  return message.includes("preview_storage_path") && message.includes("schema cache");
};

const resolveCanonicalMediaStoragePath = (
  row: MediaStoragePathRow | null | undefined
): string | null =>
  asCanonicalStoragePath(asTrimmedString(row?.preview_storage_path)) ??
  asCanonicalStoragePath(asTrimmedString(row?.storage_path));

const runMaybeSingleMediaStorageQuery = async <TRow extends MediaStoragePathRow>(args: {
  runSelect: (
    columns: "preview_storage_path, storage_path" | "storage_path"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const primary = await args.runSelect("preview_storage_path, storage_path");
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const fallback = await args.runSelect("storage_path");
  return fallback.error ? null : fallback.data;
};

const runMultiMediaStorageQuery = async <TRow extends MediaStoragePathRow>(args: {
  runSelect: (
    columns:
      | "preview_storage_path, storage_path, metadata, created_at"
      | "storage_path, metadata, created_at"
  ) => Promise<{ data: TRow[] | null; error: unknown }>;
}): Promise<TRow[] | null> => {
  const primary = await args.runSelect("preview_storage_path, storage_path, metadata, created_at");
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const fallback = await args.runSelect("storage_path, metadata, created_at");
  return fallback.error ? null : fallback.data;
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
    asFiniteOutputIndex(metadataRecord.index) ??
    asFiniteOutputIndex(metadataRecord.generation_output_index)
  );
};

const resolveStoragePathByGenerationAndIndex = async ({
  generationId,
  imageIndex,
}: {
  generationId: string;
  imageIndex: number;
}): Promise<string | null> => {
  const supabase = ensureSupabaseQueryClient();
  const canonicalOutputLookup = await resolvePublishedGenerationOutputStoragePathByIndex({
    supabase,
    generationId,
    imageIndex,
  });
  if (canonicalOutputLookup) return canonicalOutputLookup;

  const lookupByIndex = async (metadataFilter: Record<string, number>) => {
    const data = await runMaybeSingleMediaStorageQuery({
      runSelect: async (columns) =>
        (await supabase
          .from("media_files")
          .select(columns)
          .eq("source", "ai_studio")
          .eq("source_ref", generationId)
          .contains("metadata", metadataFilter)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()) as unknown as { data: MediaStoragePathRow | null; error: unknown },
    });
    return resolveCanonicalMediaStoragePath(data);
  };

  const indexPath = await lookupByIndex({ index: imageIndex });
  if (indexPath) return indexPath;
  const generationIndexPath = await lookupByIndex({ generation_output_index: imageIndex });
  if (generationIndexPath) return generationIndexPath;

  const data = await runMultiMediaStorageQuery({
    runSelect: async (columns) =>
      (await supabase
        .from("media_files")
        .select(columns)
        .eq("source", "ai_studio")
        .eq("source_ref", generationId)
        .order("created_at", { ascending: false })
        .limit(8)) as unknown as { data: MediaStoragePathRow[] | null; error: unknown },
  });
  if (!Array.isArray(data) || !data.length) return null;

  const indexedRow =
    data.find((row) => resolveMetadataOutputIndex(row?.metadata) === imageIndex) ??
    (data.length === 1 ? data[0] : null);
  return resolveCanonicalMediaStoragePath(indexedRow);
};

const defaultResolveStoragePathFromGenerationOutput = async ({
  generationId,
  imageIndex,
}: {
  generationId: string | null;
  imageIndex: number;
}): Promise<string | null> => {
  const resolvedGenerationId = generationId?.trim() || null;
  if (!resolvedGenerationId) return null;
  return await resolveStoragePathByGenerationAndIndex({
    generationId: resolvedGenerationId,
    imageIndex,
  });
};

const defaultResolveStoragePathFromMediaId = async (mediaId: string): Promise<string | null> => {
  const normalizedMediaId = mediaId.trim();
  if (!normalizedMediaId) return null;
  const supabase = ensureSupabaseQueryClient();
  const data = await runMaybeSingleMediaStorageQuery({
    runSelect: async (columns) =>
      (await supabase
        .from("media_files")
        .select(columns)
        .eq("id", normalizedMediaId)
        .limit(1)
        .maybeSingle()) as unknown as { data: MediaStoragePathRow | null; error: unknown },
  });
  return resolveCanonicalMediaStoragePath(data);
};

const resolvePayloadOutputId = ({ payload }: { payload: InternalReferenceDragPayload }): string => {
  const explicitOutputId = (payload.outputId ?? payload.referenceId ?? "").trim();
  return explicitOutputId;
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

const resolvePayloadPreviewStoragePath = (
  payload: Pick<InternalReferenceDragPayload, "previewStoragePath" | "fullStoragePath">,
  options?: { allowPayloadAuthority?: boolean }
): string | null =>
  options?.allowPayloadAuthority === true
    ? (asCanonicalStoragePath(payload.previewStoragePath) ??
      asCanonicalStoragePath(payload.fullStoragePath))
    : null;

const resolvePayloadFullStoragePath = (
  payload: Pick<InternalReferenceDragPayload, "previewStoragePath" | "fullStoragePath">,
  options?: { allowPayloadAuthority?: boolean }
): string | null =>
  options?.allowPayloadAuthority === true
    ? (asCanonicalStoragePath(payload.fullStoragePath) ??
      asCanonicalStoragePath(payload.previewStoragePath))
    : null;

const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;

const resolvePrimaryReferenceStoragePath = ({
  mediaKind,
  previewStoragePath,
  fullStoragePath,
}: {
  mediaKind: InternalReferenceDragPayload["mediaKind"] | StudioOutput["mode"] | null | undefined;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mediaKind !== "video") return previewStoragePath;
  if (previewStoragePath && VIDEO_STORAGE_PATH_PATTERN.test(previewStoragePath)) {
    return previewStoragePath;
  }
  if (fullStoragePath) return fullStoragePath;
  return previewStoragePath;
};

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
  ensureOutputPersisted,
  resolveSavedMediaIdFromOutput,
  allowPersistenceRecovery = true,
  allowTrustedPreviewFallback = false,
  resolveStoragePathFromMediaId = defaultResolveStoragePathFromMediaId,
  resolveStoragePathFromGenerationOutput = defaultResolveStoragePathFromGenerationOutput,
}: ResolveInternalReferenceSourceArgs): Promise<ResolvedInternalReferenceSource | null> => {
  const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
  const resolvedOutputId = resolvePayloadOutputId({ payload });
  const renderHintUrl = asTrimmedString(payload.referenceRenderUrl) ?? null;
  const payloadReferenceUrl = asTrimmedString(payload.referenceUrl) ?? null;
  const sessionBackedPayload = payload.sessionBacked === true;
  const allowSessionPayloadAuthority = sessionBackedPayload;
  const allowTrustedPreviewBypass = allowTrustedPreviewFallback && sessionBackedPayload;
  const allowedPayloadRenderHintUrl = sessionBackedPayload ? renderHintUrl : null;
  const trustedPreviewHintUrl = allowTrustedPreviewBypass
    ? (renderHintUrl ?? payloadReferenceUrl)
    : null;
  const initialOutput = resolvedOutputId ? getOutputById(resolvedOutputId) : null;
  let resolvedOutput = initialOutput?.mode === "image" ? initialOutput : null;
  let resolvedMediaId =
    payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex) || null;
  let persistedResult: PersistOutputSaveResult | null = null;
  const debugEntry = recordInternalReferenceSourceDebugEntry({
    capturedAt: new Date().toISOString(),
    origin: payload.origin ?? null,
    sourceSurface: payload.sourceSurface ?? null,
    outputId: resolvedOutputId || null,
    mediaId: resolvedMediaId,
    imageIndex,
    sourceKind: null,
    initialOutputFound: Boolean(resolvedOutput),
    persistedAttempted: false,
    persistedResolved: false,
    persistedDeliveryPresent: false,
    persistedMediaIdCount: 0,
    outputStoragePathPresent: Boolean(resolvedOutput && resolveOutputStoragePath(resolvedOutput)),
    mediaLookupAttempted: false,
    mediaLookupResolved: false,
    generationLookupAttempted: false,
    generationLookupResolved: false,
    localObjectUrlPresent: false,
    compatibilityHintUrlPresent: false,
    previewUrlPresent: false,
    previewStoragePath: null,
    fullStoragePath: null,
    resolutionReason: null,
    returnedNull: false,
    loadBlobStrategy: null,
    loadBlobOutcome: null,
    error: null,
  });

  if (
    allowPersistenceRecovery &&
    !trustedPreviewHintUrl &&
    resolvedOutputId &&
    (!resolvedOutput || !resolvedMediaId || !resolveOutputStoragePath(resolvedOutput))
  ) {
    debugEntry.persistedAttempted = true;
    try {
      persistedResult = await ensureOutputPersisted(resolvedOutputId, { imageIndex });
      debugEntry.persistedResolved = true;
      debugEntry.persistedDeliveryPresent = Boolean(persistedResult.delivery);
      debugEntry.persistedMediaIdCount = Array.isArray(persistedResult.mediaFileIds)
        ? persistedResult.mediaFileIds.length
        : 0;
      const nextOutput = getOutputById(resolvedOutputId);
      if (nextOutput?.mode === "image") {
        resolvedOutput = nextOutput;
        debugEntry.outputStoragePathPresent = Boolean(resolveOutputStoragePath(nextOutput));
      }
      if (!resolvedMediaId) {
        resolvedMediaId =
          persistedResult.mediaFileIds[imageIndex] ??
          persistedResult.mediaFileIds[0] ??
          resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex) ??
          null;
      }
      debugEntry.mediaId = resolvedMediaId;
    } catch {
      // Best effort only. Downstream consumers still get deterministic null/error behavior.
    }
  }

  let previewStoragePath =
    resolvePersistedPreviewStoragePath(persistedResult) ??
    (resolvedOutput ? asCanonicalStoragePath(resolvedOutput.previewStoragePath) : null) ??
    resolvePayloadPreviewStoragePath(payload, {
      allowPayloadAuthority: allowSessionPayloadAuthority,
    }) ??
    null;
  let fullStoragePath =
    resolvePersistedFullStoragePath(persistedResult) ??
    (resolvedOutput ? asCanonicalStoragePath(resolvedOutput.fullStoragePath) : null) ??
    resolvePayloadFullStoragePath(payload, {
      allowPayloadAuthority: allowSessionPayloadAuthority,
    }) ??
    previewStoragePath;
  const effectiveMediaKind =
    resolvedOutput?.mode ??
    (payload.mediaKind === "image" || payload.mediaKind === "video" || payload.mediaKind === "audio"
      ? payload.mediaKind
      : null);
  previewStoragePath = resolvePrimaryReferenceStoragePath({
    mediaKind: effectiveMediaKind,
    previewStoragePath,
    fullStoragePath,
  });
  let resolutionReason: ReferenceSourceResolutionReason = persistedResult?.delivery
    ? "persisted_delivery"
    : previewStoragePath || fullStoragePath
      ? "output_storage_path"
      : null;

  if (!previewStoragePath && !fullStoragePath && resolvedMediaId) {
    debugEntry.mediaLookupAttempted = true;
    const mediaPath = await resolveStoragePathFromMediaId(resolvedMediaId).catch(() => null);
    if (mediaPath) {
      previewStoragePath = mediaPath;
      fullStoragePath = mediaPath;
      resolutionReason = "saved_media_lookup";
      debugEntry.mediaLookupResolved = true;
    }
  }

  if (!previewStoragePath && !fullStoragePath && resolvedOutput) {
    debugEntry.generationLookupAttempted = true;
    const generationPath = await resolveStoragePathFromGenerationOutput({
      generationId: asTrimmedString(resolvedOutput.generationId),
      imageIndex,
    }).catch(() => null);
    if (generationPath) {
      previewStoragePath = generationPath;
      fullStoragePath = generationPath;
      resolutionReason = "generation_index_lookup";
      debugEntry.generationLookupResolved = true;
    }
  }

  const localObjectUrl =
    asTrimmedString(resolvedOutput?.localObjectUrl)?.replace(/#video=1$/i, "") ?? null;
  const hasInternalIdentity = Boolean(resolvedOutputId || resolvedMediaId);
  const missingDurableGeneratedIdentity =
    resolveSharedSourceKind(resolvedOutput, resolvedMediaId) === "generated_output" &&
    !(
      resolvedMediaId ||
      previewStoragePath ||
      fullStoragePath ||
      asTrimmedString(resolvedOutput?.generationId)
    );
  const compatibilityHintUrl =
    !hasInternalIdentity || (missingDurableGeneratedIdentity && !allowTrustedPreviewBypass)
      ? null
      : allowSessionPayloadAuthority
        ? (payloadReferenceUrl ?? asTrimmedString(resolvedOutput?.previewUrl) ?? null)
        : (asTrimmedString(resolvedOutput?.previewUrl) ?? null);
  const previewUrl =
    trustedPreviewHintUrl ??
    asTrimmedString(resolvedOutput?.previewUrl) ??
    allowedPayloadRenderHintUrl ??
    compatibilityHintUrl;
  debugEntry.localObjectUrlPresent = Boolean(localObjectUrl);
  debugEntry.compatibilityHintUrlPresent = Boolean(compatibilityHintUrl);
  debugEntry.previewUrlPresent = Boolean(previewUrl);
  debugEntry.previewStoragePath = previewStoragePath ?? null;
  debugEntry.fullStoragePath = fullStoragePath ?? null;
  debugEntry.resolutionReason =
    resolutionReason ??
    (localObjectUrl
      ? "local_object_url"
      : allowedPayloadRenderHintUrl
        ? "payload_render_url"
        : compatibilityHintUrl
          ? "payload_reference_url"
          : null);

  const preparedImageUrl =
    (await getSignedMediaUrl({
      bucket: MEDIA_BUCKET,
      storagePath: fullStoragePath ?? previewStoragePath ?? "",
      previewProfile: "none",
    }).catch(() => null)) ?? null;

  const loadBlob = async (): Promise<Blob> => {
    try {
      if (previewStoragePath || fullStoragePath) {
        debugEntry.loadBlobStrategy = "storage_download";
        debugEntry.loadBlobOutcome = "pending";
        const storagePath = resolvePrimaryReferenceStoragePath({
          mediaKind: effectiveMediaKind,
          previewStoragePath,
          fullStoragePath,
        });
        if (!storagePath) {
          throw new Error("Internal reference source is missing storage path.");
        }
        const supabase = ensureSupabaseQueryClient();
        const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(storagePath);
        if (!error && data) {
          debugEntry.loadBlobOutcome = "success";
          return data;
        }
        if (preparedImageUrl) {
          debugEntry.loadBlobStrategy = "signed_storage_url";
          const blob = await downloadBlobFromUrl(preparedImageUrl);
          debugEntry.loadBlobOutcome = "success";
          return blob;
        }
        if (allowedPayloadRenderHintUrl) {
          debugEntry.loadBlobStrategy = "rendered_hint_url";
          const blob = await downloadBlobFromUrl(allowedPayloadRenderHintUrl);
          debugEntry.loadBlobOutcome = "success";
          return blob;
        }
        if (compatibilityHintUrl) {
          debugEntry.loadBlobStrategy = "compatibility_hint_url";
          const blob = await downloadBlobFromUrl(compatibilityHintUrl);
          debugEntry.loadBlobOutcome = "success";
          return blob;
        }
        throw error ?? new Error("Unable to download internal reference source.");
      }
      if (localObjectUrl) {
        debugEntry.loadBlobStrategy = "local_object_url";
        debugEntry.loadBlobOutcome = "pending";
        const blob = await downloadBlobFromUrl(localObjectUrl);
        debugEntry.loadBlobOutcome = "success";
        return blob;
      }
      if (allowedPayloadRenderHintUrl) {
        debugEntry.loadBlobStrategy = "rendered_hint_url";
        debugEntry.loadBlobOutcome = "pending";
        const blob = await downloadBlobFromUrl(allowedPayloadRenderHintUrl);
        debugEntry.loadBlobOutcome = "success";
        return blob;
      }
      if (compatibilityHintUrl) {
        debugEntry.loadBlobStrategy = "compatibility_hint_url";
        debugEntry.loadBlobOutcome = "pending";
        const blob = await downloadBlobFromUrl(compatibilityHintUrl);
        debugEntry.loadBlobOutcome = "success";
        return blob;
      }
      if (allowTrustedPreviewBypass && previewUrl) {
        debugEntry.loadBlobStrategy = "preview_url";
        debugEntry.loadBlobOutcome = "pending";
        const blob = await downloadBlobFromUrl(previewUrl);
        debugEntry.loadBlobOutcome = "success";
        return blob;
      }
      throw new Error("Internal reference source could not be resolved.");
    } catch (error) {
      debugEntry.loadBlobOutcome = "error";
      debugEntry.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  };

  if (
    !previewStoragePath &&
    !fullStoragePath &&
    !localObjectUrl &&
    !allowedPayloadRenderHintUrl &&
    !compatibilityHintUrl &&
    !(allowTrustedPreviewBypass && previewUrl)
  ) {
    debugEntry.returnedNull = true;
    return null;
  }

  debugEntry.sourceKind = resolveSharedSourceKind(resolvedOutput, resolvedMediaId);

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
          : allowedPayloadRenderHintUrl
            ? "payload_render_url"
            : compatibilityHintUrl
              ? "payload_reference_url"
              : null),
    },
    outputId: resolvedOutputId || null,
    generationId: asTrimmedString(resolvedOutput?.generationId),
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
    preparedImageUrl,
    loadBlob,
  };
};

declare global {
  interface Window {
    __shortpulseInternalReferenceSourceResolution?: InternalReferenceSourceResolutionDebugHandle;
  }
}
