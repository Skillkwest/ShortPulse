/**
 * Preview signing/hydration controller for Media Library media rows.
 * Encapsulates sign-batch prioritization, fallback resolution, and perf telemetry.
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import { canAttemptMediaPreviewSignBatch } from "../../../lib/mediaPreviewRuntimePolicy";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import type { MediaTab } from "../logic/mediaMoveRouting";
import {
  BUCKET,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
} from "../logic/mediaLibraryPageHelpers";

type PreviewSigningRowBase = {
  id: string;
  storage_path: string;
  source?: string | null;
  file_type?: string | null;
  status?: "uploading" | "ready";
  signedUrl?: string | null;
};

type UseMediaPreviewSigningControllerArgs<TRow extends PreviewSigningRowBase> = {
  activeMediaTab: MediaDataTab | null;
  activeMediaCacheLoading: boolean;
  activeMediaCachePagesLoaded: number;
  activeMediaQueryRef: MutableRefObject<string>;
  activeTabRef: MutableRefObject<MediaTab>;
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserIdRef: MutableRefObject<string | null>;
  filteredMedia: TRow[];
  hydrateViaStorageDownload: (row: TRow) => Promise<string | null>;
  isMountedRef: MutableRefObject<boolean>;
  mediaSignInFlightRef: MutableRefObject<MediaTabBooleanState>;
  resolveSignedUrlsByMediaIds: (tab: MediaDataTab, rows: TRow[]) => Promise<Set<string>>;
  setSignPassNonce: Dispatch<SetStateAction<number>>;
  signAttemptRef: MutableRefObject<Record<string, number>>;
  signBudget: MediaSignBudget;
  signPassNonce: number;
  visibleMediaIdsRef: MutableRefObject<Set<string>>;
  visibleMediaVersion: number;
  isSigningPassEnabled?: boolean;
  surface?: "media-library-route" | "media-library-modal";
  unresolvedWarningPrefix?: string;
  isResultStillRelevant?: (params: { tab: MediaDataTab; query: string }) => boolean;
  maxSignAttemptsPerItem?: number;
};

/**
 * Runs tab-scoped preview signing passes for visible media rows and applies fallback hydration.
 * Inputs: active tab/cache state, filtered rows, and row-signing resolvers.
 * Output: none (effect-only hook).
 * Side effects: signs preview URLs, updates failure telemetry, and bumps sign pass nonce.
 */
export const useMediaPreviewSigningController = <TRow extends PreviewSigningRowBase>({
  activeMediaTab,
  activeMediaCacheLoading,
  activeMediaCachePagesLoaded,
  activeMediaQueryRef,
  activeTabRef,
  applySignedUrlsToTab,
  currentUserIdRef,
  filteredMedia,
  hydrateViaStorageDownload,
  isMountedRef,
  mediaSignInFlightRef,
  resolveSignedUrlsByMediaIds,
  setSignPassNonce,
  signAttemptRef,
  signBudget,
  signPassNonce,
  visibleMediaIdsRef,
  visibleMediaVersion,
  isSigningPassEnabled = true,
  surface = "media-library-route",
  unresolvedWarningPrefix = "[media-library]",
  isResultStillRelevant,
  maxSignAttemptsPerItem,
}: UseMediaPreviewSigningControllerArgs<TRow>) => {
  useEffect(() => {
    if (!isSigningPassEnabled) return;
    if (!activeMediaTab) return;
    if (activeMediaCacheLoading) return;
    if (mediaSignInFlightRef.current[activeMediaTab]) return;

    const readyRows = filteredMedia.filter((row) => row.status !== "uploading");
    if (!readyRows.length) return;

    const prioritizedRows: TRow[] = [];
    const seen = new Set<string>();
    const enqueue = (row?: TRow) => {
      if (!row) return;
      if (
        typeof maxSignAttemptsPerItem === "number" &&
        Number.isFinite(maxSignAttemptsPerItem) &&
        !canAttemptMediaPreviewSignBatch(
          signAttemptRef.current[row.id] ?? 0,
          maxSignAttemptsPerItem
        )
      ) {
        return;
      }
      if (
        !resolveMediaSigningStoragePaths(row, currentUserIdRef.current).length ||
        row.signedUrl ||
        seen.has(row.id)
      ) {
        return;
      }
      seen.add(row.id);
      prioritizedRows.push(row);
    };

    for (const row of readyRows.slice(0, signBudget.initialSignLimit)) {
      enqueue(row);
    }

    const visibleIndexes: number[] = [];
    for (let idx = 0; idx < readyRows.length; idx += 1) {
      if (visibleMediaIdsRef.current.has(readyRows[idx].id)) {
        visibleIndexes.push(idx);
      }
    }

    if (visibleIndexes.length) {
      const firstVisible = Math.min(...visibleIndexes);
      const lastVisible = Math.max(...visibleIndexes);
      const before = Math.floor(signBudget.prefetchWindow / 3);
      const start = Math.max(0, firstVisible - before);
      const end = Math.min(readyRows.length, lastVisible + 1 + signBudget.prefetchWindow);
      for (let idx = start; idx < end; idx += 1) {
        enqueue(readyRows[idx]);
      }
    } else {
      const fallbackEnd = Math.min(
        readyRows.length,
        signBudget.initialSignLimit + signBudget.prefetchWindow
      );
      for (let idx = signBudget.initialSignLimit; idx < fallbackEnd; idx += 1) {
        enqueue(readyRows[idx]);
      }
    }

    const signBatch = prioritizedRows.slice(0, signBudget.signBatchSize);
    if (!signBatch.length) return;

    const tabForBatch = activeMediaTab;
    const queryForBatch = activeMediaQueryRef.current;
    mediaSignInFlightRef.current[tabForBatch] = true;
    const finishSignBatch = createMediaPerfTimer({
      surface,
      tab: tabForBatch,
      batch_size: signBatch.length,
      page_index: activeMediaCachePagesLoaded,
      query_mode: queryForBatch ? "search" : "default",
    });

    const signCandidatesByRow = signBatch.map((row) => {
      const candidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current);
      return {
        id: row.id,
        primaryPath: candidates[0] ?? null,
        candidates,
        directUrls: resolveMediaDirectPreviewUrls(row, currentUserIdRef.current),
      };
    });
    const signPaths = Array.from(new Set(signCandidatesByRow.flatMap((entry) => entry.candidates)));
    if (!signPaths.length) {
      mediaSignInFlightRef.current[tabForBatch] = false;
      return;
    }

    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths: signPaths,
      expiresInSeconds: 3600,
    })
      .then((signedByPath) =>
        signCandidatesByRow.map((entry) => {
          const matchedPath =
            entry.candidates.find((path) => Boolean(signedByPath.get(path))) ?? null;
          const signedFromPath = matchedPath ? (signedByPath.get(matchedPath) ?? null) : null;
          const directUrl = signedFromPath ? null : (entry.directUrls[0] ?? null);
          const signedUrl = signedFromPath ?? directUrl;
          const usedFallback = Boolean(
            matchedPath && entry.primaryPath && matchedPath !== entry.primaryPath
          );
          return {
            id: entry.id,
            signedUrl,
            usedFallback,
            attemptedPaths: entry.candidates.slice(0, 4),
          };
        })
      )
      .then(async (results) => {
        if (
          isResultStillRelevant
            ? !isResultStillRelevant({ tab: tabForBatch, query: queryForBatch })
            : activeTabRef.current !== tabForBatch || activeMediaQueryRef.current !== queryForBatch
        ) {
          return;
        }
        const signedById = new Map<string, string>();
        for (const result of results) {
          if (result.signedUrl) {
            signAttemptRef.current[result.id] = 0;
            signedById.set(result.id, result.signedUrl);
          } else {
            signAttemptRef.current[result.id] = (signAttemptRef.current[result.id] ?? 0) + 1;
          }
        }
        applySignedUrlsToTab(tabForBatch, signedById);
        const unresolvedRows = signBatch.filter((row) => !signedById.has(row.id));
        const unresolvedAfterResolver = unresolvedRows.length
          ? await resolveSignedUrlsByMediaIds(tabForBatch, unresolvedRows)
          : new Set<string>();
        for (const unresolvedRow of unresolvedRows.slice(0, 4)) {
          if (!unresolvedAfterResolver.has(unresolvedRow.id)) continue;
          void hydrateViaStorageDownload(unresolvedRow);
        }
        const failedCount = results.length - signedById.size;
        const fallbackCount = results.reduce(
          (count, result) => (result.usedFallback ? count + 1 : count),
          0
        );
        finishSignBatch("media.sign.batch.completed", {
          signed_count: signedById.size,
          failed_count: failedCount,
          fallback_count: fallbackCount,
        });
        if (failedCount > 0) {
          if (process.env.NODE_ENV !== "production") {
            const unresolved = results
              .filter((result) => !result.signedUrl)
              .map((result) => ({
                id: result.id,
                paths: result.attemptedPaths,
              }))
              .slice(0, 8);
            if (unresolved.length) {
              console.warn(`${unresolvedWarningPrefix} unresolved preview rows`, unresolved);
            }
          }
          logMediaPerf("media.sign.batch.failed", {
            surface,
            tab: tabForBatch,
            batch_size: results.length,
            failed_count: failedCount,
            fallback_count: fallbackCount,
            page_index: activeMediaCachePagesLoaded,
            query_mode: queryForBatch ? "search" : "default",
          });
        }
      })
      .finally(() => {
        mediaSignInFlightRef.current[tabForBatch] = false;
        if (isMountedRef.current) {
          setSignPassNonce((prev) => prev + 1);
        }
      });
  }, [
    activeMediaCacheLoading,
    activeMediaCachePagesLoaded,
    activeMediaQueryRef,
    activeMediaTab,
    activeTabRef,
    applySignedUrlsToTab,
    currentUserIdRef,
    filteredMedia,
    hydrateViaStorageDownload,
    isMountedRef,
    isResultStillRelevant,
    isSigningPassEnabled,
    mediaSignInFlightRef,
    maxSignAttemptsPerItem,
    resolveSignedUrlsByMediaIds,
    setSignPassNonce,
    signAttemptRef,
    signBudget.initialSignLimit,
    signBudget.prefetchWindow,
    signBudget.signBatchSize,
    signPassNonce,
    surface,
    unresolvedWarningPrefix,
    visibleMediaIdsRef,
    visibleMediaVersion,
  ]);
};
