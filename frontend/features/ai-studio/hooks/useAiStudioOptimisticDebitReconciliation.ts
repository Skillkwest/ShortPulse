/**
 * Optimistic debit reconciliation hook for AI Studio.
 * Tracks pending/settled/failure output transitions and keeps optimistic debit entries in sync.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { StudioOutput } from "../types";
import { useOutputSelector } from "./aiStudioOutputStore";

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
  createdAtMs?: number;
};

const STALE_UNASSIGNED_OPTIMISTIC_DEBIT_MS = 2 * 60 * 1000;

type UseAiStudioOptimisticDebitReconciliationParams = {
  outputs?: StudioOutput[];
  optimisticDebitEntries: OptimisticDebitEntry[];
  setOptimisticDebitEntries: Dispatch<SetStateAction<OptimisticDebitEntry[]>>;
  refreshBalance: (options?: {
    silent?: boolean;
    preferLedger?: boolean;
    beforeCommit?: (snapshot: {
      cents: number;
      updatedAt: string | null;
      reservedCents?: number | null;
      source?: "snapshot" | "fallback";
    }) => void;
  }) => Promise<number | null>;
  setDetailOutputId: Dispatch<SetStateAction<string | null>>;
};

type ReconciliationOutputLite = Pick<StudioOutput, "id" | "taskId" | "taskState" | "errorMessage">;
const EMPTY_OUTPUTS: StudioOutput[] = [];
const EMPTY_OUTPUT_LITE: ReconciliationOutputLite[] = [];

const areOutputLiteListsEqual = (
  left: ReconciliationOutputLite[],
  right: ReconciliationOutputLite[]
) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const rhs = right[index];
    return (
      item.id === rhs?.id &&
      item.taskId === rhs?.taskId &&
      item.taskState === rhs?.taskState &&
      item.errorMessage === rhs?.errorMessage
    );
  });
};

/**
 * Returns failure UI state and handlers while reconciling optimistic debit entries with output lifecycle.
 */
export const useAiStudioOptimisticDebitReconciliation = ({
  outputs: outputsOverride,
  optimisticDebitEntries,
  setOptimisticDebitEntries,
  refreshBalance,
  setDetailOutputId,
}: UseAiStudioOptimisticDebitReconciliationParams) => {
  const selectorOutputs = useOutputSelector(
    (snapshot) => {
      if (outputsOverride) return EMPTY_OUTPUTS;
      return snapshot.outputOrder
        .map((id) => snapshot.outputById[id])
        .filter((item): item is StudioOutput => Boolean(item));
    },
    (left, right) =>
      left.length === right.length && left.every((item, index) => item === right[index])
  );
  const outputs = outputsOverride ?? selectorOutputs;
  const outputLite = useOutputSelector((snapshot) => {
    if (outputsOverride) return EMPTY_OUTPUT_LITE;
    return snapshot.outputOrder
      .map((id) => snapshot.outputById[id])
      .filter((item): item is StudioOutput => Boolean(item))
      .map((item) => ({
        id: item.id,
        taskId: item.taskId,
        taskState: item.taskState,
        errorMessage: item.errorMessage ?? null,
      }));
  }, areOutputLiteListsEqual);
  const overrideOutputLite = useMemo<ReconciliationOutputLite[]>(
    () =>
      outputs.map((item) => ({
        id: item.id,
        taskId: item.taskId,
        taskState: item.taskState,
        errorMessage: item.errorMessage ?? null,
      })),
    [outputs]
  );
  const effectiveOutputLite = outputsOverride ? overrideOutputLite : outputLite;
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const settledGenerationSignaturesRef = useRef<Set<string>>(new Set());
  const seenOutputIdsRef = useRef<Set<string>>(new Set());

  const failedOutputs = useMemo(
    () => outputs.filter((item) => item.taskState === "fail" && item.errorMessage),
    [outputs]
  );
  const failedOutputIdsKey = useMemo(
    () =>
      failedOutputs
        .map((item) => item.id)
        .sort()
        .join("|"),
    [failedOutputs]
  );

  const visibleFailures = useMemo(
    () => failedOutputs.filter((item) => !dismissedFailureIds.has(item.id)),
    [dismissedFailureIds, failedOutputs]
  );

  useEffect(() => {
    if (!dismissedFailureIds.size) return;
    setDismissedFailureIds((prev) => {
      if (!prev.size) return prev;
      const activeIds = new Set(failedOutputs.map((item) => item.id));
      const filtered = Array.from(prev).filter((id) => activeIds.has(id));
      if (filtered.length === prev.size) return prev;
      return new Set(filtered);
    });
  }, [dismissedFailureIds, failedOutputIdsKey, failedOutputs]);

  useEffect(() => {
    const newlySeenOutputIds: string[] = [];
    effectiveOutputLite.forEach((output) => {
      if (!seenOutputIdsRef.current.has(output.id)) {
        newlySeenOutputIds.push(output.id);
      }
      seenOutputIdsRef.current.add(output.id);
    });

    const now = Date.now();
    const hasUnassignedEntry = optimisticDebitEntries.some((entry) => entry.outputId == null);
    const hasStaleUnassignedEntry = optimisticDebitEntries.some((entry) => {
      if (entry.outputId != null) return false;
      const createdAtMs = entry.createdAtMs;
      return (
        typeof createdAtMs === "number" &&
        createdAtMs > 0 &&
        now - createdAtMs > STALE_UNASSIGNED_OPTIMISTIC_DEBIT_MS
      );
    });
    if (!hasUnassignedEntry && !hasStaleUnassignedEntry) return;
    if (!newlySeenOutputIds.length && !hasStaleUnassignedEntry) return;
    const assignedOutputIds = new Set(
      optimisticDebitEntries
        .map((entry) => entry.outputId)
        .filter((id): id is string => Boolean(id))
    );
    const assignableOutputIds = newlySeenOutputIds.filter((id) => {
      const item = effectiveOutputLite.find((output) => output.id === id);
      return Boolean(
        item &&
        item.id.startsWith("out-") &&
        (item.taskState === "pending" || item.taskState === "running") &&
        !assignedOutputIds.has(item.id)
      );
    });
    if (!hasStaleUnassignedEntry && !assignableOutputIds.length) return;

    setOptimisticDebitEntries((prev) => {
      let changed = false;
      const activeEntries = prev.filter((entry) => {
        if (entry.outputId != null) return true;
        const createdAtMs = entry.createdAtMs;
        const isStale =
          typeof createdAtMs === "number" &&
          createdAtMs > 0 &&
          now - createdAtMs > STALE_UNASSIGNED_OPTIMISTIC_DEBIT_MS;
        if (isStale) {
          changed = true;
          return false;
        }
        return true;
      });
      if (!activeEntries.some((entry) => entry.outputId == null)) {
        return changed ? activeEntries : prev;
      }
      if (!newlySeenOutputIds.length) {
        return changed ? activeEntries : prev;
      }
      const activeAssignedOutputIds = new Set(
        activeEntries.map((entry) => entry.outputId).filter((id): id is string => Boolean(id))
      );
      const availableOutputIds = assignableOutputIds.filter(
        (id) => !activeAssignedOutputIds.has(id)
      );
      if (!availableOutputIds.length) return changed ? activeEntries : prev;

      let nextIndex = 0;
      const next = activeEntries.map((entry) => {
        if (entry.outputId != null || nextIndex >= availableOutputIds.length) {
          return entry;
        }
        changed = true;
        return {
          ...entry,
          outputId: availableOutputIds[nextIndex++] ?? null,
        };
      });
      return changed ? next : prev;
    });
  }, [effectiveOutputLite, optimisticDebitEntries, setOptimisticDebitEntries]);

  useEffect(() => {
    const failedOutputIds = new Set(
      effectiveOutputLite.filter((item) => item.taskState === "fail").map((item) => item.id)
    );
    if (!failedOutputIds.size) return;

    setOptimisticDebitEntries((prev) => {
      const next = prev.filter((entry) => !(entry.outputId && failedOutputIds.has(entry.outputId)));
      return next.length === prev.length ? prev : next;
    });
  }, [effectiveOutputLite, setOptimisticDebitEntries]);

  useEffect(() => {
    const hasInFlightOutput = effectiveOutputLite.some(
      (item) => item.taskState === "pending" || item.taskState === "running"
    );
    if (hasInFlightOutput) return;
    const now = Date.now();
    const hasUnassignedEntry = optimisticDebitEntries.some((entry) => entry.outputId == null);
    if (!hasUnassignedEntry) return;
    const hasFreshUnassignedEntry = optimisticDebitEntries.some((entry) => {
      if (entry.outputId != null) return false;
      const createdAtMs = entry.createdAtMs;
      if (typeof createdAtMs !== "number" || createdAtMs <= 0) return true;
      return now - createdAtMs <= STALE_UNASSIGNED_OPTIMISTIC_DEBIT_MS;
    });
    if (hasFreshUnassignedEntry) return;
    setOptimisticDebitEntries((prev) => {
      const next = prev.filter((entry) => {
        if (entry.outputId != null) return true;
        const createdAtMs = entry.createdAtMs;
        if (typeof createdAtMs !== "number" || createdAtMs <= 0) return false;
        return now - createdAtMs <= STALE_UNASSIGNED_OPTIMISTIC_DEBIT_MS;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [effectiveOutputLite, optimisticDebitEntries, setOptimisticDebitEntries]);

  useEffect(() => {
    const settledOutputs = effectiveOutputLite.filter(
      (item) => item.taskState === "success" || item.taskState === "fail"
    );
    const settledSignatures = settledOutputs.map(
      (item) => `${item.id}:${item.taskState}:${item.taskId ?? ""}`
    );
    const nextSignatures = new Set(settledSignatures);
    const newlySettledOutputs = settledOutputs.filter(
      (item) =>
        !settledGenerationSignaturesRef.current.has(
          `${item.id}:${item.taskState}:${item.taskId ?? ""}`
        )
    );
    settledGenerationSignaturesRef.current = nextSignatures;
    if (!newlySettledOutputs.length) return;

    const successfulOutputIds = new Set(
      newlySettledOutputs.filter((item) => item.taskState === "success").map((item) => item.id)
    );
    void (async () => {
      const removeSuccessfulOptimisticEntries = () => {
        setOptimisticDebitEntries((prev) => {
          const next = prev.filter(
            (entry) => !(entry.outputId && successfulOutputIds.has(entry.outputId))
          );
          return next.length === prev.length ? prev : next;
        });
      };

      let removedBeforeBalanceCommit = false;
      const refreshedBalance = await refreshBalance({
        silent: true,
        ...(successfulOutputIds.size
          ? {
              beforeCommit: () => {
                removedBeforeBalanceCommit = true;
                removeSuccessfulOptimisticEntries();
              },
            }
          : {}),
      });
      if (refreshedBalance == null || !successfulOutputIds.size || removedBeforeBalanceCommit) {
        return;
      }
      removeSuccessfulOptimisticEntries();
    })();
  }, [effectiveOutputLite, refreshBalance, setOptimisticDebitEntries]);

  const dismissFailure = (id: string) => {
    setDismissedFailureIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const focusFailure = (id: string) => {
    setDetailOutputId(id);
  };

  return {
    visibleFailures,
    dismissFailure,
    focusFailure,
  };
};
