import {
  classifyMediaPreviewPath,
  resolveMediaPreviewCandidates,
  type MediaPreviewPathKind,
} from "../../../lib/mediaPreviewPath";
import { logMediaPerf, type MediaPerfEventName } from "../../../lib/mediaPerfTelemetry";

type PreviewSigningRowLike = {
  id: string;
  storage_path: string;
  source?: string | null;
};

export type MediaSignCandidateEntry = {
  id: string;
  primaryPath: string | null;
  primaryPathKind: MediaPreviewPathKind;
  candidates: string[];
  directUrl: string | null;
  directUrlKind: MediaPreviewPathKind;
};

export type MediaSignResult = {
  id: string;
  signedUrl: string | null;
  usedFallback: boolean;
  attemptedPaths: string[];
  primaryPathKind: MediaPreviewPathKind;
  resolvedPathKind: MediaPreviewPathKind;
};

type MediaSignBatchMetrics = ReturnType<typeof summarizeMediaSignResults>;

type MediaSignCompletionParams = {
  results: MediaSignResult[];
  signedById: Map<string, string>;
  finishSignBatch: (eventName: MediaPerfEventName, metrics: Record<string, unknown>) => void;
  surface: "media-library-modal" | "media-library-panel" | "elements-media-panel";
  tab: string;
  pageIndex: number;
  queryMode: "search" | "default";
  signPrefetchEnabled: boolean;
  sourceClass: string;
  previewDeliveryMode: "signed-original" | "signed-transform-profile";
  optimizerBypassed: boolean;
  unresolvedAfterResolverCount: number;
  unresolvedWarningPrefix: string;
};

export const buildMediaSignCandidateEntry = <TRow extends PreviewSigningRowLike>(
  row: TRow,
  currentUserId: string | null,
  maxSignCandidatesPerRow: number
): MediaSignCandidateEntry => {
  const previewCandidates = resolveMediaPreviewCandidates(row, currentUserId);
  const candidates = previewCandidates.storagePaths.slice(0, maxSignCandidatesPerRow);
  const primaryPath = candidates[0] ?? null;
  const directUrl = previewCandidates.directUrl;
  const directUrlKind = directUrl
    ? classifyMediaPreviewPath(row, directUrl, currentUserId)
    : "unknown";
  return {
    id: row.id,
    primaryPath,
    primaryPathKind: classifyMediaPreviewPath(row, primaryPath, currentUserId),
    candidates,
    directUrl,
    directUrlKind,
  };
};

export const buildMediaSignCandidateEntries = <TRow extends PreviewSigningRowLike>(
  rows: TRow[],
  currentUserId: string | null,
  maxSignCandidatesPerRow: number
): MediaSignCandidateEntry[] =>
  rows.map((row) => buildMediaSignCandidateEntry(row, currentUserId, maxSignCandidatesPerRow));

export const collectMediaSignPaths = (entries: MediaSignCandidateEntry[]): string[] =>
  Array.from(new Set(entries.flatMap((entry) => entry.candidates)));

export const resolveMediaSignSourceClass = <TRow extends PreviewSigningRowLike>(
  rows: TRow[]
): string => {
  const sourceClasses = Array.from(
    new Set(
      rows.map((row) =>
        typeof row.source === "string" && row.source.trim()
          ? row.source.trim().toLowerCase()
          : "unknown"
      )
    )
  );
  return sourceClasses.length === 1 ? sourceClasses[0] : "mixed";
};

export const mapMediaSignResults = <TRow extends PreviewSigningRowLike>(params: {
  currentUserId: string | null;
  entries: MediaSignCandidateEntry[];
  rowsById: Map<string, TRow>;
  signedByPath: Map<string, string | null>;
}): MediaSignResult[] => {
  const { currentUserId, entries, rowsById, signedByPath } = params;
  return entries.map((entry) => {
    const matchedPath = entry.candidates.find((path) => Boolean(signedByPath.get(path))) ?? null;
    const signedFromPath = matchedPath ? (signedByPath.get(matchedPath) ?? null) : null;
    const directUrl = signedFromPath ? null : entry.directUrl;
    const signedUrl = signedFromPath ?? directUrl;
    const resolvedPreviewSource = matchedPath ?? directUrl;
    return {
      id: entry.id,
      signedUrl,
      usedFallback: Boolean(matchedPath && entry.primaryPath && matchedPath !== entry.primaryPath),
      attemptedPaths: entry.candidates,
      primaryPathKind: entry.primaryPathKind,
      resolvedPathKind: classifyMediaPreviewPath(
        rowsById.get(entry.id) ?? { storage_path: "" },
        resolvedPreviewSource,
        currentUserId
      ),
    };
  });
};

export const summarizeMediaSignResults = (results: MediaSignResult[]) => ({
  failedCount: results.length - results.filter((result) => result.signedUrl).length,
  fallbackCount: results.reduce((count, result) => (result.usedFallback ? count + 1 : count), 0),
  transformedCount: results.reduce(
    (count, result) =>
      typeof result.signedUrl === "string" && result.signedUrl.includes("/storage/v1/render/image/")
        ? count + 1
        : count,
    0
  ),
  primaryDurableCount: results.reduce(
    (count, result) => (result.primaryPathKind === "durable" ? count + 1 : count),
    0
  ),
  primaryOriginalCount: results.reduce(
    (count, result) => (result.primaryPathKind === "original" ? count + 1 : count),
    0
  ),
  resolvedDurableCount: results.reduce(
    (count, result) => (result.resolvedPathKind === "durable" ? count + 1 : count),
    0
  ),
  resolvedOriginalCount: results.reduce(
    (count, result) => (result.resolvedPathKind === "original" ? count + 1 : count),
    0
  ),
});

export const finalizeMediaSignCompletion = ({
  results,
  signedById,
  finishSignBatch,
  surface,
  tab,
  pageIndex,
  queryMode,
  signPrefetchEnabled,
  sourceClass,
  previewDeliveryMode,
  optimizerBypassed,
  unresolvedAfterResolverCount,
  unresolvedWarningPrefix,
}: MediaSignCompletionParams): MediaSignBatchMetrics => {
  const metrics = summarizeMediaSignResults(results);
  const {
    failedCount,
    fallbackCount,
    transformedCount,
    primaryDurableCount,
    primaryOriginalCount,
    resolvedDurableCount,
    resolvedOriginalCount,
  } = metrics;
  finishSignBatch("media.sign.batch.completed", {
    signed_count: signedById.size,
    failed_count: failedCount,
    fallback_count: fallbackCount,
    transformed_count: transformedCount,
    primary_durable_count: primaryDurableCount,
    primary_original_count: primaryOriginalCount,
    resolved_durable_count: resolvedDurableCount,
    resolved_original_count: resolvedOriginalCount,
    preview_delivery_mode: previewDeliveryMode,
    optimizer_bypassed: optimizerBypassed,
    source_class: sourceClass,
    error_kind: failedCount > 0 ? "unresolved_after_signing" : "none",
    unresolved_after_resolver_count: unresolvedAfterResolverCount,
  });
  if (failedCount > 0) {
    if (process.env.NODE_ENV !== "production") {
      const unresolved = results
        .filter((result) => !result.signedUrl)
        .map((result) => ({ id: result.id, paths: result.attemptedPaths }))
        .slice(0, 8);
      if (unresolved.length) {
        console.warn(`${unresolvedWarningPrefix} unresolved preview rows`, unresolved);
      }
    }
    logMediaPerf("media.sign.batch.failed", {
      surface,
      tab,
      batch_size: results.length,
      failed_count: failedCount,
      fallback_count: fallbackCount,
      transformed_count: transformedCount,
      primary_durable_count: primaryDurableCount,
      primary_original_count: primaryOriginalCount,
      resolved_durable_count: resolvedDurableCount,
      resolved_original_count: resolvedOriginalCount,
      preview_delivery_mode: previewDeliveryMode,
      optimizer_bypassed: optimizerBypassed,
      source_class: sourceClass,
      error_kind: "unresolved_after_signing",
      unresolved_after_resolver_count: unresolvedAfterResolverCount,
      page_index: pageIndex,
      query_mode: queryMode,
      sign_prefetch_enabled: signPrefetchEnabled,
    });
  }
  return metrics;
};
