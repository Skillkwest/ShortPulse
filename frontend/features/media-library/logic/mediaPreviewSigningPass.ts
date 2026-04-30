import { canAttemptMediaPreviewSignBatch } from "../../../lib/mediaPreviewRuntimePolicy";
import type { MediaSignBudget } from "./mediaLibraryPageHelpers";
import {
  buildMediaSignCandidateEntries,
  type MediaSignCandidateEntry,
} from "./mediaPreviewSigningBatch";

type PreparedSigningRowLike = {
  id: string;
  storage_path: string;
  source?: string | null;
  status?: "uploading" | "ready";
  signedUrl?: string | null;
};

export type PreparedSignState<TRow extends PreparedSigningRowLike> = {
  sourceRows: TRow[];
  currentUserId: string | null;
  signCandidateCap: number;
  readyRows: TRow[];
  signCandidateEntryById: Map<string, MediaSignCandidateEntry>;
  rowById: Map<string, TRow>;
  readyIds: Set<string>;
};

type QueueState = "urgent" | "deferred" | "in_flight";

export type MediaSignQueueState = {
  urgentQueue: string[];
  deferredQueue: string[];
  queueStateById: Record<string, QueueState>;
};

export type MediaSignQueuePassResult<TRow extends PreparedSigningRowLike> = {
  queueState: MediaSignQueueState;
  signBatch: TRow[];
  drainPriority: "urgent" | "deferred" | null;
};

export const prepareMediaSigningState = <TRow extends PreparedSigningRowLike>(params: {
  sourceRows: TRow[];
  currentUserId: string | null;
  signCandidateCap: number;
}): PreparedSignState<TRow> => {
  const { sourceRows, currentUserId, signCandidateCap } = params;
  const readyRows = sourceRows.filter((row) => row.status !== "uploading");
  const signCandidateEntries = buildMediaSignCandidateEntries(
    readyRows,
    currentUserId,
    signCandidateCap
  );

  return {
    sourceRows,
    currentUserId,
    signCandidateCap,
    readyRows,
    signCandidateEntryById: new Map(
      signCandidateEntries.map((entry) => [entry.id, entry] as const)
    ),
    rowById: new Map(readyRows.map((row) => [row.id, row] as const)),
    readyIds: new Set(readyRows.map((row) => row.id)),
  };
};

export const resolveMediaSignQueuePass = <TRow extends PreparedSigningRowLike>(params: {
  preparedState: PreparedSignState<TRow>;
  existingState: MediaSignQueueState;
  signBudget: MediaSignBudget;
  visibleMediaIds: Set<string>;
  isSignPrefetchEnabled: boolean;
  isDeferredDrainArmed: boolean;
  signAttemptCounts: Record<string, number>;
  blockedSignAttemptIds?: Set<string>;
  maxSignAttemptsPerItem?: number;
}): MediaSignQueuePassResult<TRow> => {
  const {
    preparedState,
    existingState,
    signBudget,
    visibleMediaIds,
    isSignPrefetchEnabled,
    isDeferredDrainArmed,
    signAttemptCounts,
    blockedSignAttemptIds,
    maxSignAttemptsPerItem,
  } = params;
  const { readyRows, signCandidateEntryById, rowById, readyIds } = preparedState;

  const hasPreviewCandidate = (row: TRow) => {
    const entry = signCandidateEntryById.get(row.id);
    if (!entry) return false;
    return entry.candidates.length > 0 || Boolean(entry.directUrl);
  };

  const nextQueueStateById = { ...existingState.queueStateById };
  for (const queuedId of Object.keys(nextQueueStateById)) {
    const queuedRow = rowById.get(queuedId);
    if (!queuedRow || queuedRow.signedUrl || !hasPreviewCandidate(queuedRow)) {
      delete nextQueueStateById[queuedId];
    }
  }

  let nextUrgentQueue = existingState.urgentQueue.filter((id) => {
    if (!readyIds.has(id)) return false;
    return nextQueueStateById[id] === "urgent";
  });
  let nextDeferredQueue = existingState.deferredQueue.filter((id) => {
    if (!readyIds.has(id)) return false;
    return nextQueueStateById[id] === "deferred";
  });

  const removeQueuedId = (id: string) => {
    nextUrgentQueue = nextUrgentQueue.filter((queuedId) => queuedId !== id);
    nextDeferredQueue = nextDeferredQueue.filter((queuedId) => queuedId !== id);
    if (nextQueueStateById[id] !== "in_flight") {
      delete nextQueueStateById[id];
    }
  };

  const enqueue = (row: TRow | undefined, priority: "urgent" | "deferred") => {
    if (!row) return;
    if (blockedSignAttemptIds?.has(row.id)) return;
    if (
      typeof maxSignAttemptsPerItem === "number" &&
      Number.isFinite(maxSignAttemptsPerItem) &&
      !canAttemptMediaPreviewSignBatch(signAttemptCounts[row.id] ?? 0, maxSignAttemptsPerItem)
    ) {
      return;
    }
    if (!hasPreviewCandidate(row) || row.signedUrl) {
      removeQueuedId(row.id);
      return;
    }
    const currentState = nextQueueStateById[row.id];
    if (currentState === "in_flight") return;
    if (priority === "urgent") {
      if (currentState === "urgent") return;
      removeQueuedId(row.id);
      nextUrgentQueue.push(row.id);
      nextQueueStateById[row.id] = "urgent";
      return;
    }
    if (currentState === "urgent" || currentState === "deferred") return;
    nextDeferredQueue.push(row.id);
    nextQueueStateById[row.id] = "deferred";
  };

  for (const row of readyRows.slice(0, signBudget.initialSignLimit)) {
    enqueue(row, "urgent");
  }

  if (isSignPrefetchEnabled) {
    const visibleIndexes: number[] = [];
    for (let idx = 0; idx < readyRows.length; idx += 1) {
      if (visibleMediaIds.has(readyRows[idx].id)) {
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

  const urgentBatch = selectQueuedRows(nextUrgentQueue);
  const deferredBatch =
    urgentBatch.length || !isDeferredDrainArmed ? [] : selectQueuedRows(nextDeferredQueue);
  const signBatch = urgentBatch.length ? urgentBatch : deferredBatch;
  const drainPriority = urgentBatch.length ? "urgent" : deferredBatch.length ? "deferred" : null;

  if (signBatch.length) {
    const scheduledIds = new Set(signBatch.map((row) => row.id));
    nextUrgentQueue = nextUrgentQueue.filter((id) => !scheduledIds.has(id));
    nextDeferredQueue = nextDeferredQueue.filter((id) => !scheduledIds.has(id));
    for (const rowId of scheduledIds) {
      nextQueueStateById[rowId] = "in_flight";
    }
  }

  return {
    queueState: {
      urgentQueue: nextUrgentQueue,
      deferredQueue: nextDeferredQueue,
      queueStateById: nextQueueStateById,
    },
    signBatch,
    drainPriority,
  };
};
