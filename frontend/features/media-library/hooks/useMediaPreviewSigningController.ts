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
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import {
  BUCKET,
  type MediaDataTab,
  type MediaSignBudget,
  type MediaTabBooleanState,
} from "../logic/mediaLibraryPageHelpers";
import {
  prepareMediaSigningState,
  type PreparedSignState,
  resolveMediaSignQueuePass,
} from "../logic/mediaPreviewSigningPass";
import {
  collectMediaSignPaths,
  finalizeMediaSignCompletion,
  type MediaSignCandidateEntry,
  mapMediaSignResults,
  resolveMediaSignSourceClass,
} from "../logic/mediaPreviewSigningBatch";
import {
  resolveBackgroundHydrateFallbackLimit,
  VISIBLE_SCOPED_SIGN_SURFACES,
  type MediaPreviewSigningSurface,
} from "./mediaPreviewSigningControllerConfig";

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
  surface?: MediaPreviewSigningSurface;
  unresolvedWarningPrefix?: string;
  isResultStillRelevant?: (params: { tab: MediaDataTab; query: string }) => boolean;
  maxSignAttemptsPerItem?: number;
  maxSignCandidatesPerRow?: number;
  backgroundHydrateFallbackEnabled?: boolean;
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
  surface = "media-library-panel",
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
  const failedSignAttemptKeyByIdRef = useRef<Record<string, string>>({});
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
      clearDeferredDrainTimeout();
      deferredDrainArmedRef.current = false;
    };
  }, [clearDeferredDrainTimeout]);
  useEffect(() => {
    const nextScopeKey = `${activeMediaTab ?? "none"}|${activeMediaQuery}`;
    if (queueScopeKeyRef.current === nextScopeKey) return;
    queueScopeKeyRef.current = nextScopeKey;
    urgentQueueRef.current = [];
    deferredQueueRef.current = [];
    queueStateByIdRef.current = {};
    failedSignAttemptKeyByIdRef.current = {};
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
            const nextState = prepareMediaSigningState({
              sourceRows: filteredMedia,
              currentUserId,
              signCandidateCap,
            });
            preparedSignStateRef.current = nextState;
            return nextState;
          })();
    const { readyRows, signCandidateEntryById } = preparedSignState;
    if (!readyRows.length) return;
    const signPassAttemptScopeKey = [
      queueScopeKeyRef.current,
      signPassNonce,
      visibleMediaVersion,
      activeMediaCachePagesLoaded,
    ].join("|");
    const resolveBlockedSignAttemptKey = (rowId: string) => {
      const entry = signCandidateEntryById.get(rowId);
      const candidateKey = [entry?.directUrl ?? "", ...(entry?.candidates ?? [])].join("\0");
      if (VISIBLE_SCOPED_SIGN_SURFACES.has(surface) && !visibleMediaIdsRef.current.has(rowId)) {
        return `panel-offscreen|${candidateKey}`;
      }
      return `${signPassAttemptScopeKey}|${candidateKey}`;
    };
    const blockedSignAttemptIds = new Set<string>();
    for (const row of readyRows) {
      if ((signAttemptRef.current[row.id] ?? 0) <= 0) continue;
      if (failedSignAttemptKeyByIdRef.current[row.id] === resolveBlockedSignAttemptKey(row.id)) {
        blockedSignAttemptIds.add(row.id);
      }
    }
    const queuePass = resolveMediaSignQueuePass({
      preparedState: preparedSignState,
      existingState: {
        urgentQueue: urgentQueueRef.current,
        deferredQueue: deferredQueueRef.current,
        queueStateById: queueStateByIdRef.current,
      },
      signBudget,
      visibleMediaIds: visibleMediaIdsRef.current,
      isSignPrefetchEnabled,
      allowDeferredPrefetch: surface === "media-library-modal",
      isDeferredDrainArmed: deferredDrainArmedRef.current,
      signAttemptCounts: signAttemptRef.current,
      blockedSignAttemptIds,
      maxSignAttemptsPerItem,
    });
    urgentQueueRef.current = queuePass.queueState.urgentQueue;
    deferredQueueRef.current = queuePass.queueState.deferredQueue;
    queueStateByIdRef.current = queuePass.queueState.queueStateById;
    const signBatch = queuePass.signBatch;
    if (!signBatch.length) {
      if (deferredQueueRef.current.length > 0) scheduleDeferredDrain();
      return;
    }
    const drainPriority = queuePass.drainPriority === "deferred" ? "deferred" : "urgent";
    if (drainPriority === "deferred") deferredDrainArmedRef.current = false;
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
    const directPreferredEntries = signCandidatesByRow.filter(
      (entry) => Boolean(entry.directUrl) && entry.directUrlKind === "durable"
    );
    const signableEntries =
      directPreferredEntries.length > 0
        ? signCandidatesByRow.filter((entry) => !directPreferredEntries.includes(entry))
        : signCandidatesByRow;
    const scheduledIds = new Set(signBatch.map((row) => row.id));
    const signPaths = collectMediaSignPaths(signableEntries);
    const previewProfile = resolvePreviewProfileForSurface(surface);
    const previewDeliveryMode = previewProfile === "none" ? "signed-original" : "signed-profile";
    const sourceClass = resolveMediaSignSourceClass(signBatch);
    const optimizerBypassed = true;
    const signBatchById = new Map(signBatch.map((row) => [row.id, row] as const));
    const directPreferredResults = mapMediaSignResults({
      currentUserId,
      entries: directPreferredEntries,
      rowsById: signBatchById,
      signedByPath: new Map(),
    });
    const resultsPromise = signPaths.length
      ? getSignedMediaUrlsBatch({
          bucket: BUCKET,
          storagePaths: signPaths,
          expiresInSeconds: 3600,
          surface,
          queryMode: queryForBatch ? "search" : "default",
          tab: tabForBatch,
          previewProfile,
        }).then((signedByPath) => [
          ...directPreferredResults,
          ...mapMediaSignResults({
            currentUserId,
            entries: signableEntries,
            rowsById: signBatchById,
            signedByPath,
          }),
        ])
      : Promise.resolve([
          ...directPreferredResults,
          ...mapMediaSignResults({
            currentUserId,
            entries: signableEntries,
            rowsById: signBatchById,
            signedByPath: new Map(),
          }),
        ]);
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
            delete failedSignAttemptKeyByIdRef.current[result.id];
          } else {
            signAttemptRef.current[result.id] = (signAttemptRef.current[result.id] ?? 0) + 1;
            delete queueStateByIdRef.current[result.id];
            failedSignAttemptKeyByIdRef.current[result.id] = resolveBlockedSignAttemptKey(
              result.id
            );
          }
        }
        applySignedUrlsToTab(tabForBatch, signedById);
        const unresolvedRows = signBatch.filter((row) => !signedById.has(row.id));
        const resolverRows = unresolvedRows.filter((row) => visibleMediaIdsRef.current.has(row.id));
        void (async () => {
          let unresolvedAfterResolver: Set<string>;
          try {
            unresolvedAfterResolver = resolverRows.length
              ? await resolveSignedUrlsByMediaIds(tabForBatch, resolverRows)
              : new Set<string>();
          } catch {
            unresolvedAfterResolver = new Set(resolverRows.map((row) => row.id));
          }
          const unresolvedAfterResolverCount =
            unresolvedAfterResolver.size + (unresolvedRows.length - resolverRows.length);
          if (backgroundHydrateFallbackEnabled) {
            for (const unresolvedRow of resolverRows.slice(
              0,
              resolveBackgroundHydrateFallbackLimit(surface)
            )) {
              if (unresolvedAfterResolver.has(unresolvedRow.id))
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
        })();
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
    signBudget,
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
