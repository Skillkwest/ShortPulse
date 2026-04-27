import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { createMediaPerfTimer } from "../../../lib/mediaPerfTelemetry";
import { resolvePreviewProfileForSurface } from "../../../lib/mediaPreviewTransformProfile";
import { canAttemptMediaPreviewSignBatch } from "../../../lib/mediaPreviewRuntimePolicy";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import {
  BUCKET,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
} from "../logic/mediaLibraryPageHelpers";
import {
  buildMediaSignCandidateEntries,
  collectMediaSignPaths,
  finalizeMediaSignCompletion,
  type MediaSignCandidateEntry,
  mapMediaSignResults,
  resolveMediaSignSourceClass,
} from "../logic/mediaPreviewSigningBatch";

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

type PreparedSignState<TRow extends PreviewSigningRowBase> = {
  sourceRows: TRow[];
  currentUserId: string | null;
  signCandidateCap: number;
  readyRows: TRow[];
  signCandidateEntryById: Map<string, MediaSignCandidateEntry>;
  rowById: Map<string, TRow>;
  readyIds: Set<string>;
};

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
  const preparedSignStateRef = useRef<PreparedSignState<TRow> | null>(null);
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
    const currentUserId = currentUserIdRef.current;
    const signCandidateCap = Number.isFinite(maxSignCandidatesPerRow)
      ? Math.max(1, Math.trunc(maxSignCandidatesPerRow))
      : 4;
    const cachedPreparedSignState = preparedSignStateRef.current;
    const preparedSignState =
      cachedPreparedSignState &&
      cachedPreparedSignState.sourceRows === filteredMedia &&
      cachedPreparedSignState.currentUserId === currentUserId &&
      cachedPreparedSignState.signCandidateCap === signCandidateCap
        ? cachedPreparedSignState
        : (() => {
            const readyRows = filteredMedia.filter((row) => row.status !== "uploading");
            const signCandidateEntries = buildMediaSignCandidateEntries(
              readyRows,
              currentUserId,
              signCandidateCap
            );
            const nextState: PreparedSignState<TRow> = {
              sourceRows: filteredMedia,
              currentUserId,
              signCandidateCap,
              readyRows,
              signCandidateEntryById: new Map(
                signCandidateEntries.map((entry) => [entry.id, entry] as const)
              ),
              rowById: new Map(readyRows.map((row) => [row.id, row] as const)),
              readyIds: new Set(readyRows.map((row) => row.id)),
            };
            preparedSignStateRef.current = nextState;
            return nextState;
          })();
    const { readyRows, signCandidateEntryById, rowById, readyIds } = preparedSignState;
    if (!readyRows.length) return;
    const hasPreviewCandidate = (row: TRow) => {
      const entry = signCandidateEntryById.get(row.id);
      if (!entry) return false;
      return entry.candidates.length > 0 || entry.directUrls.length > 0;
    };
    for (const queuedId of Object.keys(queueStateByIdRef.current)) {
      const queuedRow = rowById.get(queuedId);
      if (!queuedRow || queuedRow.signedUrl || !hasPreviewCandidate(queuedRow)) {
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
      if (!hasPreviewCandidate(row) || row.signedUrl) {
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
    const signCandidatesByRow = signBatch
      .map((row) => signCandidateEntryById.get(row.id) ?? null)
      .filter((entry): entry is MediaSignCandidateEntry => Boolean(entry));
    const signPaths = collectMediaSignPaths(signCandidatesByRow);
    const previewProfile = resolvePreviewProfileForSurface(surface);
    const previewDeliveryMode =
      previewProfile === "none" ? "signed-original" : "signed-transform-profile";
    const sourceClass = resolveMediaSignSourceClass(signBatch);
    const optimizerBypassed = true;
    const signBatchById = new Map(signBatch.map((row) => [row.id, row] as const));
    const resultsPromise = signPaths.length
      ? getSignedMediaUrlsBatch({
          bucket: BUCKET,
          storagePaths: signPaths,
          expiresInSeconds: 3600,
          surface,
          queryMode: queryForBatch ? "search" : "default",
          tab: tabForBatch,
          previewProfile,
        }).then((signedByPath) =>
          mapMediaSignResults({
            currentUserId,
            entries: signCandidatesByRow,
            rowsById: signBatchById,
            signedByPath,
          })
        )
      : Promise.resolve(
          mapMediaSignResults({
            currentUserId,
            entries: signCandidatesByRow,
            rowsById: signBatchById,
            signedByPath: new Map(),
          })
        );
    void resultsPromise
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
        finalizeMediaSignCompletion({
          results,
          signedById,
          finishSignBatch,
          surface,
          tab: tabForBatch,
          pageIndex: activeMediaCachePagesLoaded,
          queryMode: queryForBatch ? "search" : "default",
          signPrefetchEnabled: isSignPrefetchEnabled,
          sourceClass,
          previewDeliveryMode,
          optimizerBypassed,
          unresolvedAfterResolverCount,
          unresolvedWarningPrefix,
        });
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
