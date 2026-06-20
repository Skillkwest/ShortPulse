/**
 * AI Studio generated-output maintenance.
 * Owns canonical generated-output hydration/sync plus generated and storage poster repair loops.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { StudioOutput } from "../types";
import {
  listVisibleGeneratedOutputs,
  resolveVisibleGenerationReconcile,
  type VisibleGeneratedOutputRuntimeIdentity,
} from "../logic/generatedMediaAuthority";
import { mergeCanonicalGeneratedOutputs } from "../logic/generatedOutputHydration";
import { resolveVideoPosterRepairsForOutputs } from "../logic/videoPosterRepair";

const CANONICAL_GENERATED_OUTPUT_SYNC_INTERVAL_MS = 5_000;
const CANONICAL_GENERATED_OUTPUT_SYNC_IDLE_GRACE_MS = 120_000;
const CANONICAL_GENERATED_OUTPUT_SYNC_BATCH_SIZE = 6;
const CANONICAL_GENERATED_OUTPUT_RECONCILE_MIN_INTERVAL_MS = 60_000;
const AUDIO_COMPANION_ART_SYNC_INTERVAL_MS = 5_000;
const AUDIO_COMPANION_ART_SYNC_IDLE_GRACE_MS = 120_000;
const AUDIO_COMPANION_ART_SYNC_BATCH_SIZE = 6;
const GENERATED_VIDEO_POSTER_REPAIR_BATCH_SIZE = 4;
const STORAGE_VIDEO_POSTER_REPAIR_BATCH_SIZE = 12;
const POSTER_REPAIR_IDLE_TIMEOUT_MS = 1_500;
const POSTER_REPAIR_FALLBACK_DELAY_MS = 250;
const CANONICAL_GENERATED_OUTPUT_ID_PREFIX = "generated:";

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

const schedulePosterRepairWork = (run: () => void): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(run, {
      timeout: POSTER_REPAIR_IDLE_TIMEOUT_MS,
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  const timeoutId = window.setTimeout(run, POSTER_REPAIR_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(timeoutId);
};

const asTrimmedText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasStringEntries = (value: readonly string[] | null | undefined): boolean =>
  Array.isArray(value) && value.some((entry) => Boolean(asTrimmedText(entry)));

const resolveCanonicalGeneratedOutputGenerationId = (output: StudioOutput): string | null => {
  const generationId = asTrimmedText(output.generationId);
  if (generationId) return generationId;
  const outputId = asTrimmedText(output.id);
  if (!outputId?.startsWith(CANONICAL_GENERATED_OUTPUT_ID_PREFIX)) return null;
  const candidate = outputId.slice(CANONICAL_GENERATED_OUTPUT_ID_PREFIX.length).trim();
  return candidate.length > 0 ? candidate : null;
};

const hasGeneratedOutputDisplayPayload = (output: StudioOutput): boolean => {
  if (hasStringEntries(output.savedMediaIds) || hasStringEntries(output.resultUrls)) return true;
  return [
    output.previewUrl,
    output.previewPosterUrl,
    output.previewStoragePath,
    output.previewPosterStoragePath,
    output.fullStoragePath,
  ].some((value) => Boolean(asTrimmedText(value)));
};

const isCanonicalGeneratedOutputSyncCandidate = (output: StudioOutput): boolean => {
  const hasGenerationIdentity = Boolean(
    resolveCanonicalGeneratedOutputGenerationId(output) || output.taskId || output.sourceRef
  );
  if (output.mediaSource !== "generated" && !hasGenerationIdentity) return false;
  if (output.companionArtStatus === "pending" || output.companionArtStatus === "processing") {
    return hasGenerationIdentity || Boolean(output.sourceRef);
  }
  if (
    output.taskState !== "fail" &&
    hasGenerationIdentity &&
    !hasGeneratedOutputDisplayPayload(output)
  ) {
    return true;
  }
  if (output.taskState !== "pending" && output.taskState !== "running") return false;
  return hasGenerationIdentity || Boolean(output.sourceRef);
};

const isRefreshableAudioCompanionArtCandidate = (output: StudioOutput): boolean => {
  if (output.mode !== "audio") return false;
  if (output.mediaSource !== "generated" && !output.generationId && !output.taskId) return false;
  if (output.companionArtStatus === "pending" || output.companionArtStatus === "processing") {
    return true;
  }
  if (output.companionArtStatus === "failed") return false;
  if (output.companionArtStoragePath?.trim() && !output.companionArtUrl?.trim()) return true;

  const createdAtMs = output.createdAt ? Date.parse(output.createdAt) : Number.NaN;
  const isRecentAudioOutput =
    output.timestamp === "Just now" ||
    (Number.isFinite(createdAtMs) &&
      Date.now() - createdAtMs <= AUDIO_COMPANION_ART_SYNC_IDLE_GRACE_MS);
  return (
    isRecentAudioOutput &&
    output.taskState === "success" &&
    !output.companionArtUrl?.trim() &&
    !output.companionArtStoragePath?.trim()
  );
};

const isGeneratedVideoPosterRepairCandidate = (output: StudioOutput): boolean => {
  if (output.mode !== "video") return false;
  if (output.taskState && output.taskState !== "success") return false;
  if (output.previewPosterUrl?.trim()) return false;
  if (output.mediaSource !== "generated" && !output.generationId && !output.taskId) return false;
  return Boolean(output.generationId || output.taskId);
};

const buildGeneratedVideoPosterRepairKey = (output: StudioOutput): string =>
  [
    output.id,
    output.generationId ?? "",
    output.taskId ?? "",
    output.previewUrl ?? "",
    output.previewPosterStoragePath ?? "",
    output.previewStoragePath ?? "",
    output.fullStoragePath ?? "",
    output.resultUrls?.join("|") ?? "",
  ].join("::");

const isStorageVideoPosterRepairCandidate = (output: StudioOutput): boolean => {
  if (output.mode !== "video") return false;
  if (output.previewPosterUrl?.trim()) return false;
  if (output.previewPosterStoragePath?.trim()) return true;
  if (output.savedMediaIds?.some((id) => id.trim().length > 0)) return true;
  return Boolean(output.previewStoragePath?.trim() || output.fullStoragePath?.trim());
};

const buildStorageVideoPosterRepairKey = (output: StudioOutput): string =>
  [
    output.id,
    output.previewPosterUrl ?? "",
    output.previewPosterStoragePath ?? "",
    output.previewStoragePath ?? "",
    output.fullStoragePath ?? "",
    output.previewUrl ?? "",
    output.resultUrls?.join("|") ?? "",
    output.savedMediaIds?.join("|") ?? "",
  ].join("::");

const toCanonicalGeneratedOutputSyncRuntimeIdentity = (
  output: StudioOutput
): VisibleGeneratedOutputRuntimeIdentity | null => {
  if (!isCanonicalGeneratedOutputSyncCandidate(output)) return null;
  const generationId = resolveCanonicalGeneratedOutputGenerationId(output);
  const requestId = output.taskId?.trim() || null;
  const sourceRef = output.sourceRef?.trim() || null;
  if (!generationId && !requestId && !sourceRef) return null;
  return {
    generationId,
    requestId,
    sourceRef,
  };
};

const listCanonicalGeneratedOutputSyncRuntimeIdentities = (
  outputs: StudioOutput[]
): VisibleGeneratedOutputRuntimeIdentity[] =>
  outputs
    .map((output) => toCanonicalGeneratedOutputSyncRuntimeIdentity(output))
    .filter((value): value is VisibleGeneratedOutputRuntimeIdentity => Boolean(value))
    .slice(0, CANONICAL_GENERATED_OUTPUT_SYNC_BATCH_SIZE);

const buildCanonicalGeneratedOutputSyncSignature = (
  runtimeIdentities: VisibleGeneratedOutputRuntimeIdentity[]
): string =>
  runtimeIdentities
    .map((runtimeIdentity) =>
      [
        runtimeIdentity.generationId ?? "",
        runtimeIdentity.requestId ?? "",
        runtimeIdentity.sourceRef ?? "",
      ].join(":")
    )
    .sort()
    .join("|");

const buildRuntimeIdentityKey = (runtimeIdentity: VisibleGeneratedOutputRuntimeIdentity): string =>
  [
    runtimeIdentity.generationId ?? "",
    runtimeIdentity.requestId ?? "",
    runtimeIdentity.sourceRef ?? "",
  ].join(":");

const requestVisibleGenerationReconcile = async (
  runtimeIdentities: VisibleGeneratedOutputRuntimeIdentity[]
): Promise<void> => {
  if (!runtimeIdentities.length) return;
  await fetchWithAuth("/api/generation/reconcile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runtimeIdentities }),
    shortpulseLogScope: "generation",
    shortpulseRetryNetworkOnce: true,
  });
};

const requestVisibleProjectGenerationReconcile = async (
  projectId: string | null
): Promise<void> => {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) return;
  await fetchWithAuth("/api/generation/reconcile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId: normalizedProjectId }),
    shortpulseLogScope: "generation",
    shortpulseRetryNetworkOnce: true,
  });
};

type UseAiStudioGeneratedOutputMaintenanceParams = {
  baseRuntimeAuthorityKey: string;
  hasPendingWorkflowRestore: boolean;
  outputs: StudioOutput[];
  projectId: string | null;
  projectRouteRequested: boolean;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  workspaceRuntimeKey?: string | null;
};

type UseAiStudioGeneratedOutputMaintenanceResult = {
  canonicalGeneratedHydrationSettled: boolean;
};

/**
 * Runs generated-output hydration, sync, and poster repair maintenance for AI Studio state.
 */
export const useAiStudioGeneratedOutputMaintenance = ({
  baseRuntimeAuthorityKey,
  hasPendingWorkflowRestore,
  outputs,
  projectId,
  projectRouteRequested,
  setOutputsState,
  workspaceRuntimeKey = null,
}: UseAiStudioGeneratedOutputMaintenanceParams): UseAiStudioGeneratedOutputMaintenanceResult => {
  const shouldHydrateProjectGeneratedOutputs = Boolean(projectId) && !hasPendingWorkflowRestore;
  const shouldHydratePlainSessionGeneratedOutputs =
    !projectRouteRequested &&
    !projectId &&
    Boolean(workspaceRuntimeKey) &&
    !hasPendingWorkflowRestore;
  const shouldRunCanonicalGeneratedOutputSync =
    !hasPendingWorkflowRestore && (!projectRouteRequested || Boolean(projectId));
  const canonicalGeneratedOutputSyncRuntimeIdentities = useMemo(
    () =>
      shouldRunCanonicalGeneratedOutputSync
        ? listCanonicalGeneratedOutputSyncRuntimeIdentities(outputs)
        : [],
    [outputs, shouldRunCanonicalGeneratedOutputSync]
  );
  const refreshableAudioCompanionArtCandidates = useMemo(
    () =>
      hasPendingWorkflowRestore
        ? []
        : outputs
            .filter(isRefreshableAudioCompanionArtCandidate)
            .slice(0, AUDIO_COMPANION_ART_SYNC_BATCH_SIZE),
    [hasPendingWorkflowRestore, outputs]
  );
  const canonicalGeneratedOutputSyncSignature = useMemo(
    () => buildCanonicalGeneratedOutputSyncSignature(canonicalGeneratedOutputSyncRuntimeIdentities),
    [canonicalGeneratedOutputSyncRuntimeIdentities]
  );
  const [canonicalGeneratedHydrationSettled, setCanonicalGeneratedHydrationSettled] = useState(
    !(shouldHydrateProjectGeneratedOutputs || shouldHydratePlainSessionGeneratedOutputs)
  );
  const canonicalGeneratedHydrationRunKeySetRef = useRef<Set<string>>(new Set());
  const canonicalGeneratedOutputSyncInFlightRef = useRef(false);
  const audioCompanionArtSyncInFlightRef = useRef(false);
  const canonicalGeneratedOutputSyncLastActiveAtRef = useRef<number | null>(null);
  const canonicalGeneratedOutputSyncRuntimeIdentitiesRef = useRef<
    VisibleGeneratedOutputRuntimeIdentity[]
  >([]);
  const canonicalGeneratedOutputServerReconcileLastAttemptAtRef = useRef<Map<string, number>>(
    new Map()
  );
  const generatedVideoPosterRepairKeySetRef = useRef<Set<string>>(new Set());
  const storageVideoPosterRepairKeySetRef = useRef<Set<string>>(new Set());
  const activeBaseRuntimeAuthorityKeyRef = useRef(baseRuntimeAuthorityKey);
  const [documentVisible, setDocumentVisible] = useState(isDocumentVisible);

  useEffect(() => {
    if (activeBaseRuntimeAuthorityKeyRef.current === baseRuntimeAuthorityKey) return;
    activeBaseRuntimeAuthorityKeyRef.current = baseRuntimeAuthorityKey;
    canonicalGeneratedHydrationRunKeySetRef.current.clear();
    canonicalGeneratedOutputSyncInFlightRef.current = false;
    audioCompanionArtSyncInFlightRef.current = false;
    canonicalGeneratedOutputSyncLastActiveAtRef.current = null;
    canonicalGeneratedOutputSyncRuntimeIdentitiesRef.current = [];
    canonicalGeneratedOutputServerReconcileLastAttemptAtRef.current.clear();
    generatedVideoPosterRepairKeySetRef.current.clear();
    storageVideoPosterRepairKeySetRef.current.clear();
  }, [baseRuntimeAuthorityKey]);

  const canonicalGeneratedHydrationRunKey = useMemo(() => {
    if (!shouldHydrateProjectGeneratedOutputs && !shouldHydratePlainSessionGeneratedOutputs) {
      return null;
    }
    const authorityScope = shouldHydrateProjectGeneratedOutputs
      ? `project:${projectId ?? ""}`
      : `workspace:${workspaceRuntimeKey ?? ""}`;
    const unresolvedRuntimeSignature = canonicalGeneratedOutputSyncSignature || "startup";
    return [baseRuntimeAuthorityKey, authorityScope, unresolvedRuntimeSignature].join("|");
  }, [
    baseRuntimeAuthorityKey,
    canonicalGeneratedOutputSyncSignature,
    projectId,
    shouldHydratePlainSessionGeneratedOutputs,
    shouldHydrateProjectGeneratedOutputs,
    workspaceRuntimeKey,
  ]);

  useEffect(() => {
    setCanonicalGeneratedHydrationSettled(
      !(shouldHydrateProjectGeneratedOutputs || shouldHydratePlainSessionGeneratedOutputs)
    );
  }, [shouldHydratePlainSessionGeneratedOutputs, shouldHydrateProjectGeneratedOutputs]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateDocumentVisible = () => {
      setDocumentVisible(isDocumentVisible());
    };
    updateDocumentVisible();
    document.addEventListener("visibilitychange", updateDocumentVisible);
    return () => {
      document.removeEventListener("visibilitychange", updateDocumentVisible);
    };
  }, []);

  useEffect(() => {
    if (!canonicalGeneratedHydrationRunKey) {
      return;
    }
    if (canonicalGeneratedHydrationRunKeySetRef.current.has(canonicalGeneratedHydrationRunKey)) {
      return;
    }
    canonicalGeneratedHydrationRunKeySetRef.current.add(canonicalGeneratedHydrationRunKey);
    setCanonicalGeneratedHydrationSettled(false);
    let cancelled = false;

    void (async () => {
      try {
        const hydratedOutputs = await listVisibleGeneratedOutputs({
          projectId: projectId ?? null,
          workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
        });
        if (!cancelled && hydratedOutputs.length > 0) {
          setOutputsState((currentOutputs) =>
            mergeCanonicalGeneratedOutputs(currentOutputs, hydratedOutputs)
          );
        }
        if (cancelled || !shouldHydrateProjectGeneratedOutputs || !projectId) return;

        await requestVisibleProjectGenerationReconcile(projectId).catch(() => undefined);
        if (cancelled) return;
        const reconciledOutputs = await listVisibleGeneratedOutputs({
          projectId,
          workspaceRuntimeKey: null,
        });
        if (cancelled || reconciledOutputs.length === 0) return;
        setOutputsState((currentOutputs) =>
          mergeCanonicalGeneratedOutputs(currentOutputs, reconciledOutputs)
        );
      } catch {
        // Preserve the current runtime collection when the canonical refresh is unavailable.
      } finally {
        if (!cancelled) {
          setCanonicalGeneratedHydrationSettled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canonicalGeneratedHydrationRunKey,
    projectId,
    setOutputsState,
    shouldHydratePlainSessionGeneratedOutputs,
    shouldHydrateProjectGeneratedOutputs,
    workspaceRuntimeKey,
  ]);

  useEffect(() => {
    if (!shouldRunCanonicalGeneratedOutputSync) {
      canonicalGeneratedOutputSyncLastActiveAtRef.current = null;
      canonicalGeneratedOutputSyncRuntimeIdentitiesRef.current = [];
      return;
    }

    canonicalGeneratedOutputSyncRuntimeIdentitiesRef.current =
      canonicalGeneratedOutputSyncRuntimeIdentities;
    const hasActiveGeneratedOutput = canonicalGeneratedOutputSyncRuntimeIdentities.length > 0;
    if (hasActiveGeneratedOutput) {
      canonicalGeneratedOutputSyncLastActiveAtRef.current = Date.now();
    }
  }, [canonicalGeneratedOutputSyncRuntimeIdentities, shouldRunCanonicalGeneratedOutputSync]);

  useEffect(() => {
    if (!shouldRunCanonicalGeneratedOutputSync) return;
    if (!documentVisible) return;
    if (canonicalGeneratedOutputSyncRuntimeIdentities.length === 0) return;
    let cancelled = false;

    const syncCanonicalGeneratedOutputs = async () => {
      if (cancelled || canonicalGeneratedOutputSyncInFlightRef.current) return;
      const lastActiveAt = canonicalGeneratedOutputSyncLastActiveAtRef.current;
      const withinIdleGrace =
        lastActiveAt != null &&
        Date.now() - lastActiveAt <= CANONICAL_GENERATED_OUTPUT_SYNC_IDLE_GRACE_MS;
      if (!withinIdleGrace) return;
      const runtimeIdentities = canonicalGeneratedOutputSyncRuntimeIdentitiesRef.current;
      if (!runtimeIdentities.length) return;

      canonicalGeneratedOutputSyncInFlightRef.current = true;
      try {
        const now = Date.now();
        const reconcileIdentities = runtimeIdentities.filter((runtimeIdentity) => {
          const key = buildRuntimeIdentityKey(runtimeIdentity);
          if (!key.trim()) return false;
          const lastAttemptAt =
            canonicalGeneratedOutputServerReconcileLastAttemptAtRef.current.get(key) ?? 0;
          if (now - lastAttemptAt < CANONICAL_GENERATED_OUTPUT_RECONCILE_MIN_INTERVAL_MS) {
            return false;
          }
          canonicalGeneratedOutputServerReconcileLastAttemptAtRef.current.set(key, now);
          return true;
        });
        if (reconcileIdentities.length) {
          void requestVisibleGenerationReconcile(reconcileIdentities).catch(() => undefined);
        }
        const hydratedOutputs = await listVisibleGeneratedOutputs({
          projectId: projectId ?? null,
          workspaceRuntimeKey: projectId ? null : workspaceRuntimeKey,
          limit: runtimeIdentities.length,
          runtimeIdentities,
        });
        if (cancelled || hydratedOutputs.length === 0) return;
        setOutputsState((currentOutputs) =>
          mergeCanonicalGeneratedOutputs(currentOutputs, hydratedOutputs)
        );
      } finally {
        canonicalGeneratedOutputSyncInFlightRef.current = false;
      }
    };

    const intervalId = globalThis.setInterval(
      syncCanonicalGeneratedOutputs,
      CANONICAL_GENERATED_OUTPUT_SYNC_INTERVAL_MS
    );
    void syncCanonicalGeneratedOutputs();

    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
    };
  }, [
    canonicalGeneratedOutputSyncSignature,
    canonicalGeneratedOutputSyncRuntimeIdentities.length,
    documentVisible,
    projectId,
    setOutputsState,
    shouldRunCanonicalGeneratedOutputSync,
    workspaceRuntimeKey,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!documentVisible) return;
    if (refreshableAudioCompanionArtCandidates.length === 0) return;
    let cancelled = false;

    const syncPendingAudioCompanionArt = async () => {
      if (cancelled || audioCompanionArtSyncInFlightRef.current) return;

      audioCompanionArtSyncInFlightRef.current = true;
      try {
        const reconciles = await Promise.all(
          refreshableAudioCompanionArtCandidates.map(async (output) => ({
            outputId: output.id,
            reconcile: await resolveVisibleGenerationReconcile({
              generationId: output.generationId ?? null,
              requestId: output.taskId ?? null,
              ...(output.sourceRef ? { sourceRef: output.sourceRef } : {}),
              projectId: projectId ?? null,
            }),
          }))
        );
        if (cancelled) return;

        const reconcileByOutputId = new Map(
          reconciles
            .filter(({ reconcile }) => Boolean(reconcile))
            .map(({ outputId, reconcile }) => [outputId, reconcile])
        );
        if (reconcileByOutputId.size === 0) return;

        setOutputsState((currentOutputs) => {
          let changed = false;
          const nextOutputs = currentOutputs.map((output) => {
            const reconcile = reconcileByOutputId.get(output.id);
            if (!reconcile) return output;
            const nextCompanionArtUrl = reconcile.companionArtUrl ?? output.companionArtUrl ?? null;
            const nextCompanionArtStoragePath =
              reconcile.companionArtStoragePath ?? output.companionArtStoragePath ?? null;
            const nextCompanionArtStatus =
              reconcile.companionArtStatus ?? output.companionArtStatus ?? null;
            if (
              nextCompanionArtUrl === output.companionArtUrl &&
              nextCompanionArtStoragePath === output.companionArtStoragePath &&
              nextCompanionArtStatus === output.companionArtStatus
            ) {
              return output;
            }
            changed = true;
            return {
              ...output,
              companionArtUrl: nextCompanionArtUrl,
              companionArtStoragePath: nextCompanionArtStoragePath,
              companionArtStatus: nextCompanionArtStatus,
            };
          });
          return changed ? nextOutputs : currentOutputs;
        });
      } finally {
        audioCompanionArtSyncInFlightRef.current = false;
      }
    };

    const intervalId = globalThis.setInterval(
      syncPendingAudioCompanionArt,
      AUDIO_COMPANION_ART_SYNC_INTERVAL_MS
    );
    void syncPendingAudioCompanionArt();

    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
    };
  }, [
    documentVisible,
    hasPendingWorkflowRestore,
    refreshableAudioCompanionArtCandidates,
    projectId,
    setOutputsState,
  ]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!documentVisible) return;
    const repairCandidates = outputs
      .filter(isGeneratedVideoPosterRepairCandidate)
      .map((output) => ({
        output,
        repairKey: buildGeneratedVideoPosterRepairKey(output),
      }))
      .filter(({ repairKey }) => !generatedVideoPosterRepairKeySetRef.current.has(repairKey))
      .slice(0, GENERATED_VIDEO_POSTER_REPAIR_BATCH_SIZE);
    if (!repairCandidates.length) return;

    repairCandidates.forEach(({ repairKey }) => {
      generatedVideoPosterRepairKeySetRef.current.add(repairKey);
    });

    let cancelled = false;
    let repairStarted = false;
    const clearRepairKeys = () => {
      repairCandidates.forEach(({ repairKey }) => {
        generatedVideoPosterRepairKeySetRef.current.delete(repairKey);
      });
    };
    const cancelScheduledRepair = schedulePosterRepairWork(() => {
      if (cancelled) {
        clearRepairKeys();
        return;
      }
      repairStarted = true;
      void (async () => {
        const repairs = await Promise.all(
          repairCandidates.map(async ({ output, repairKey }) => {
            const reconcile = await resolveVisibleGenerationReconcile({
              generationId: output.generationId ?? null,
              requestId: output.taskId ?? null,
              ...(output.sourceRef ? { sourceRef: output.sourceRef } : {}),
              projectId: projectId ?? null,
            });
            return {
              outputId: output.id,
              generationId: output.generationId ?? null,
              taskId: output.taskId ?? null,
              repairKey,
              reconcile,
            };
          })
        );
        if (cancelled) return;

        const repairByOutputId = new Map(
          repairs
            .filter((repair) => repair.reconcile?.previewPosterUrl)
            .map((repair) => [repair.outputId, repair])
        );
        if (repairByOutputId.size === 0) return;

        setOutputsState((currentOutputs) => {
          let changed = false;
          const patchedOutputs = currentOutputs.map((output) => {
            const repair = repairByOutputId.get(output.id);
            if (!repair?.reconcile?.previewPosterUrl) return output;
            if (output.previewPosterUrl?.trim()) return output;
            if (repair.generationId && output.generationId !== repair.generationId) return output;
            if (!repair.generationId && repair.taskId && output.taskId !== repair.taskId) {
              return output;
            }
            changed = true;
            return {
              ...output,
              previewPosterUrl: repair.reconcile.previewPosterUrl,
              previewPosterStoragePath:
                repair.reconcile.previewPosterStoragePath ??
                output.previewPosterStoragePath ??
                null,
              previewStoragePath:
                repair.reconcile.previewStoragePath ?? output.previewStoragePath ?? null,
              fullStoragePath: repair.reconcile.fullStoragePath ?? output.fullStoragePath ?? null,
              previewUrl: repair.reconcile.previewUrl ?? output.previewUrl,
              resultUrls:
                repair.reconcile.resultUrls.length > 0
                  ? repair.reconcile.resultUrls
                  : output.resultUrls,
            };
          });
          return changed ? patchedOutputs : currentOutputs;
        });
      })().catch(() => {
        clearRepairKeys();
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledRepair();
      if (!repairStarted) {
        clearRepairKeys();
      }
    };
  }, [documentVisible, hasPendingWorkflowRestore, outputs, projectId, setOutputsState]);

  useEffect(() => {
    if (hasPendingWorkflowRestore) return;
    if (!documentVisible) return;
    const repairCandidates = outputs
      .filter(isStorageVideoPosterRepairCandidate)
      .map((output) => ({
        output,
        repairKey: buildStorageVideoPosterRepairKey(output),
      }))
      .filter(({ repairKey }) => !storageVideoPosterRepairKeySetRef.current.has(repairKey))
      .slice(0, STORAGE_VIDEO_POSTER_REPAIR_BATCH_SIZE);
    if (!repairCandidates.length) return;

    repairCandidates.forEach(({ repairKey }) => {
      storageVideoPosterRepairKeySetRef.current.add(repairKey);
    });

    let cancelled = false;
    let repairStarted = false;
    const clearRepairKeys = () => {
      repairCandidates.forEach(({ repairKey }) => {
        storageVideoPosterRepairKeySetRef.current.delete(repairKey);
      });
    };
    const cancelScheduledRepair = schedulePosterRepairWork(() => {
      if (cancelled) {
        clearRepairKeys();
        return;
      }
      repairStarted = true;
      void (async () => {
        const repairs = await resolveVideoPosterRepairsForOutputs(
          repairCandidates.map(({ output }) => output)
        );
        if (cancelled || repairs.size === 0) return;

        const repairKeyByOutputId = new Map(
          repairCandidates.map(({ output, repairKey }) => [output.id, repairKey])
        );

        setOutputsState((currentOutputs) => {
          let changed = false;
          const patchedOutputs = currentOutputs.map((output) => {
            const repair = repairs.get(output.id);
            if (!repair) return output;
            if (output.previewPosterUrl?.trim()) return output;
            const baselineRepairKey = repairKeyByOutputId.get(output.id);
            if (
              baselineRepairKey &&
              buildStorageVideoPosterRepairKey(output) !== baselineRepairKey
            ) {
              return output;
            }

            changed = true;
            return {
              ...output,
              previewPosterUrl: repair.previewPosterUrl,
              previewPosterStoragePath: repair.previewPosterStoragePath,
              previewStoragePath: repair.previewStoragePath,
              fullStoragePath: repair.fullStoragePath ?? output.fullStoragePath ?? null,
              previewUrl: repair.previewUrl ?? output.previewUrl,
              resultUrls: repair.resultUrls ?? output.resultUrls,
            };
          });
          return changed ? patchedOutputs : currentOutputs;
        });
      })().catch(() => {
        clearRepairKeys();
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledRepair();
      if (!repairStarted) {
        clearRepairKeys();
      }
    };
  }, [documentVisible, hasPendingWorkflowRestore, outputs, setOutputsState]);
  return {
    canonicalGeneratedHydrationSettled,
  };
};
