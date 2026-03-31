/**
 * Preview signing/hydration controller for Media Library media rows.
 * Encapsulates sign-batch prioritization, fallback resolution, and perf telemetry.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { createMediaPerfTimer, logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import { resolvePreviewProfileForSurface } from "../../../lib/mediaPreviewTransformProfile";
import { canAttemptMediaPreviewSignBatch } from "../../../lib/mediaPreviewRuntimePolicy";
import {
  classifyMediaPreviewPath,
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
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

type UseMediaPreviewSigningControllerArgs<
  TRow extends PreviewSigningRowBase,
  TTab extends string,
> = {
  activeMediaTab: MediaDataTab | null;
  activeMediaCacheLoading: boolean;
  activeMediaCachePagesLoaded: number;
  activeMediaQuery: string;
  activeMediaQueryRef: MutableRefObject<string>;
  activeTabRef: MutableRefObject<TTab>;
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
  isSignPrefetchEnabled?: boolean;
  surface?: "media-library-route" | "media-library-modal" | "media-library-panel";
  unresolvedWarningPrefix?: string;
  isResultStillRelevant?: (params: { tab: MediaDataTab; query: string }) => boolean;
  maxSignAttemptsPerItem?: number;
  maxSignCandidatesPerRow?: number;
  backgroundHydrateFallbackEnabled?: boolean;
};

/**
 * Runs tab-scoped preview signing passes for visible media rows and applies fallback hydration.
 * Inputs: active tab/cache state, filtered rows, and row-signing resolvers.
 * Output: none (effect-only hook).
 * Side effects: signs preview URLs, updates failure telemetry, and bumps sign pass nonce.
 */
export const useMediaPreviewSigningController = <
  TRow extends PreviewSigningRowBase,
  TTab extends string,
>({
  activeMediaTab,
  activeMediaCacheLoading,
  activeMediaCachePagesLoaded,
  activeMediaQuery,
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
  isSignPrefetchEnabled = true,
  surface = "media-library-route",
  unresolvedWarningPrefix = "[media-library]",
  isResultStillRelevant,
  maxSignAttemptsPerItem,
  maxSignCandidatesPerRow = 4,
  backgroundHydrateFallbackEnabled = false,
}: UseMediaPreviewSigningControllerArgs<TRow, TTab>) => {
  const urgentQueueRef = useRef<string[]>([]);
  const deferredQueueRef = useRef<string[]>([]);
  const queueStateByIdRef = useRef<Record<string, "urgent" | "deferred" | "in_flight">>({});
  const deferredDrainTimeoutRef = useRef<number | null>(null);
  const deferredDrainArmedRef = useRef(false);
  const queueScopeKeyRef = useRef<string>("");

  const clearDeferredDrainTimeout = useCallback(() => {
    if (deferredDrainTimeoutRef.current == null || typeof window === "undefined") return;
    window.clearTimeout(deferredDrainTimeoutRef.current);
    deferredDrainTimeoutRef.current = null;
  }, []);

  const scheduleDeferredDrain = useCallback(() => {
    if (deferredDrainTimeoutRef.current != null || typeof window === "undefined") return;
    deferredDrainTimeoutRef.current = window.setTimeout(() => {
      deferredDrainTimeoutRef.current = null;
      deferredDrainArmedRef.current = true;
      if (!isMountedRef.current) return;
      setSignPassNonce((prev) => prev + 1);
    }, 180);
  }, [isMountedRef, setSignPassNonce]);

  useEffect(() => {
    return () => {
      if (deferredDrainTimeoutRef.current == null || typeof window === "undefined") return;
      window.clearTimeout(deferredDrainTimeoutRef.current);
      deferredDrainTimeoutRef.current = null;
      deferredDrainArmedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextScopeKey = `${activeMediaTab ?? "none"}|${activeMediaQuery}`;
    if (queueScopeKeyRef.current === nextScopeKey) return;
    queueScopeKeyRef.current = nextScopeKey;
    urgentQueueRef.current = [];
    deferredQueueRef.current = [];
    queueStateByIdRef.current = {};
    deferredDrainArmedRef.current = false;
    clearDeferredDrainTimeout();
  }, [activeMediaQuery, activeMediaTab, clearDeferredDrainTimeout]);

  useEffect(() => {
    if (!isSigningPassEnabled) return;
    if (!activeMediaTab) return;
    if (activeMediaCacheLoading) return;
    if (mediaSignInFlightRef.current[activeMediaTab]) return;

    const readyRows = filteredMedia.filter((row) => row.status !== "uploading");
    if (!readyRows.length) return;
    const rowById = new Map(readyRows.map((row) => [row.id, row]));
    const readyIds = new Set(rowById.keys());
    for (const queuedId of Object.keys(queueStateByIdRef.current)) {
      const queuedRow = rowById.get(queuedId);
      if (
        !queuedRow ||
        queuedRow.signedUrl ||
        !resolveMediaSigningStoragePaths(queuedRow, currentUserIdRef.current).length
      ) {
        delete queueStateByIdRef.current[queuedId];
      }
    }
    urgentQueueRef.current = urgentQueueRef.current.filter((id) => {
      if (!readyIds.has(id)) return false;
      return queueStateByIdRef.current[id] === "urgent";
    });
    deferredQueueRef.current = deferredQueueRef.current.filter((id) => {
      if (!readyIds.has(id)) return false;
      return queueStateByIdRef.current[id] === "deferred";
    });

    const removeQueuedId = (id: string) => {
      urgentQueueRef.current = urgentQueueRef.current.filter((queuedId) => queuedId !== id);
      deferredQueueRef.current = deferredQueueRef.current.filter((queuedId) => queuedId !== id);
      if (queueStateByIdRef.current[id] !== "in_flight") {
        delete queueStateByIdRef.current[id];
      }
    };

    const enqueue = (row: TRow | undefined, priority: "urgent" | "deferred") => {
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
      if (!resolveMediaSigningStoragePaths(row, currentUserIdRef.current).length || row.signedUrl) {
        removeQueuedId(row.id);
        return;
      }
      const currentState = queueStateByIdRef.current[row.id];
      if (currentState === "in_flight") return;
      if (priority === "urgent") {
        if (currentState === "urgent") return;
        removeQueuedId(row.id);
        urgentQueueRef.current.push(row.id);
        queueStateByIdRef.current[row.id] = "urgent";
        return;
      }
      if (currentState === "urgent" || currentState === "deferred") return;
      deferredQueueRef.current.push(row.id);
      queueStateByIdRef.current[row.id] = "deferred";
    };

    for (const row of readyRows.slice(0, signBudget.initialSignLimit)) {
      enqueue(row, "urgent");
    }

    if (isSignPrefetchEnabled) {
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
        const immediateVisibleWindow = Math.max(
          signBudget.initialSignLimit,
          signBudget.signBatchSize * 2
        );
        const urgentEnd = Math.min(readyRows.length, firstVisible + immediateVisibleWindow);
        const prefetchEnd = Math.min(readyRows.length, lastVisible + 1 + signBudget.prefetchWindow);
        for (let idx = start; idx < urgentEnd; idx += 1) {
          enqueue(readyRows[idx], "urgent");
        }
        for (let idx = urgentEnd; idx < prefetchEnd; idx += 1) {
          enqueue(readyRows[idx], "deferred");
        }
      }
    }

    const selectQueuedRows = (queuedIds: string[]): TRow[] =>
      queuedIds
        .map((id) => rowById.get(id) ?? null)
        .filter((row): row is TRow => Boolean(row))
        .slice(0, signBudget.signBatchSize);

    const urgentBatch = selectQueuedRows(urgentQueueRef.current);
    const deferredBatch =
      urgentBatch.length || !deferredDrainArmedRef.current
        ? []
        : selectQueuedRows(deferredQueueRef.current);
    const signBatch = urgentBatch.length ? urgentBatch : deferredBatch;
    if (!signBatch.length) {
      if (deferredQueueRef.current.length > 0) {
        scheduleDeferredDrain();
      }
      return;
    }
    const drainPriority = urgentBatch.length ? "urgent" : "deferred";
    if (drainPriority === "deferred") {
      deferredDrainArmedRef.current = false;
    }
    const scheduledIds = new Set(signBatch.map((row) => row.id));
    urgentQueueRef.current = urgentQueueRef.current.filter((id) => !scheduledIds.has(id));
    deferredQueueRef.current = deferredQueueRef.current.filter((id) => !scheduledIds.has(id));
    for (const rowId of scheduledIds) {
      queueStateByIdRef.current[rowId] = "in_flight";
    }
    clearDeferredDrainTimeout();

    const tabForBatch = activeMediaTab;
    const queryForBatch = activeMediaQuery;
    mediaSignInFlightRef.current[tabForBatch] = true;
    const finishSignBatch = createMediaPerfTimer({
      surface,
      tab: tabForBatch,
      batch_size: signBatch.length,
      page_index: activeMediaCachePagesLoaded,
      query_mode: queryForBatch ? "search" : "default",
      sign_prefetch_enabled: isSignPrefetchEnabled,
    });

    const signCandidateCap = Number.isFinite(maxSignCandidatesPerRow)
      ? Math.max(1, Math.trunc(maxSignCandidatesPerRow))
      : 4;
    const signCandidatesByRow = signBatch.map((row) => {
      const candidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current).slice(
        0,
        signCandidateCap
      );
      return {
        id: row.id,
        primaryPath: candidates[0] ?? null,
        primaryPathKind: classifyMediaPreviewPath(
          row,
          candidates[0] ?? null,
          currentUserIdRef.current
        ),
        candidates,
        directUrls: resolveMediaDirectPreviewUrls(row, currentUserIdRef.current),
      };
    });
    const signPaths = Array.from(new Set(signCandidatesByRow.flatMap((entry) => entry.candidates)));
    if (!signPaths.length) {
      for (const rowId of scheduledIds) {
        delete queueStateByIdRef.current[rowId];
      }
      mediaSignInFlightRef.current[tabForBatch] = false;
      return;
    }
    const previewProfile = resolvePreviewProfileForSurface(surface);
    const previewDeliveryMode =
      previewProfile === "none" ? "signed-original" : "signed-transform-profile";
    const sourceClasses = Array.from(
      new Set(
        signBatch.map((row) =>
          typeof row.source === "string" && row.source.trim()
            ? row.source.trim().toLowerCase()
            : "unknown"
        )
      )
    );
    const sourceClass = sourceClasses.length === 1 ? sourceClasses[0] : "mixed";
    const optimizerBypassed = true;

    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths: signPaths,
      expiresInSeconds: 3600,
      surface,
      queryMode: queryForBatch ? "search" : "default",
      tab: tabForBatch,
      previewProfile,
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
            attemptedPaths: entry.candidates,
            primaryPathKind: entry.primaryPathKind,
            resolvedPathKind: classifyMediaPreviewPath(
              signBatch.find((row) => row.id === entry.id) ?? {},
              matchedPath,
              currentUserIdRef.current
            ),
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
            delete queueStateByIdRef.current[result.id];
          } else {
            signAttemptRef.current[result.id] = (signAttemptRef.current[result.id] ?? 0) + 1;
            delete queueStateByIdRef.current[result.id];
          }
        }
        applySignedUrlsToTab(tabForBatch, signedById);
        const unresolvedRows = signBatch.filter((row) => !signedById.has(row.id));
        const unresolvedAfterResolver = unresolvedRows.length
          ? await resolveSignedUrlsByMediaIds(tabForBatch, unresolvedRows)
          : new Set<string>();
        const unresolvedAfterResolverCount = unresolvedAfterResolver.size;
        if (backgroundHydrateFallbackEnabled) {
          for (const unresolvedRow of unresolvedRows.slice(0, 4)) {
            if (!unresolvedAfterResolver.has(unresolvedRow.id)) continue;
            void hydrateViaStorageDownload(unresolvedRow);
          }
        }
        const failedCount = results.length - signedById.size;
        const fallbackCount = results.reduce(
          (count, result) => (result.usedFallback ? count + 1 : count),
          0
        );
        const transformedCount = results.reduce(
          (count, result) =>
            typeof result.signedUrl === "string" &&
            result.signedUrl.includes("/storage/v1/render/image/")
              ? count + 1
              : count,
          0
        );
        const primaryDurableCount = results.reduce(
          (count, result) => (result.primaryPathKind === "durable" ? count + 1 : count),
          0
        );
        const primaryOriginalCount = results.reduce(
          (count, result) => (result.primaryPathKind === "original" ? count + 1 : count),
          0
        );
        const resolvedDurableCount = results.reduce(
          (count, result) => (result.resolvedPathKind === "durable" ? count + 1 : count),
          0
        );
        const resolvedOriginalCount = results.reduce(
          (count, result) => (result.resolvedPathKind === "original" ? count + 1 : count),
          0
        );
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
            page_index: activeMediaCachePagesLoaded,
            query_mode: queryForBatch ? "search" : "default",
            sign_prefetch_enabled: isSignPrefetchEnabled,
          });
        }
      })
      .finally(() => {
        for (const rowId of scheduledIds) {
          if (queueStateByIdRef.current[rowId] === "in_flight") {
            delete queueStateByIdRef.current[rowId];
          }
        }
        mediaSignInFlightRef.current[tabForBatch] = false;
        if (urgentQueueRef.current.length > 0 && isMountedRef.current) {
          setSignPassNonce((prev) => prev + 1);
          return;
        }
        if (deferredQueueRef.current.length > 0 && isMountedRef.current) {
          scheduleDeferredDrain();
        }
      });
  }, [
    activeMediaCacheLoading,
    activeMediaCachePagesLoaded,
    activeMediaQuery,
    activeMediaQueryRef,
    activeMediaTab,
    activeTabRef,
    applySignedUrlsToTab,
    currentUserIdRef,
    filteredMedia,
    hydrateViaStorageDownload,
    isMountedRef,
    isResultStillRelevant,
    isSignPrefetchEnabled,
    isSigningPassEnabled,
    mediaSignInFlightRef,
    maxSignAttemptsPerItem,
    maxSignCandidatesPerRow,
    backgroundHydrateFallbackEnabled,
    clearDeferredDrainTimeout,
    resolveSignedUrlsByMediaIds,
    scheduleDeferredDrain,
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
