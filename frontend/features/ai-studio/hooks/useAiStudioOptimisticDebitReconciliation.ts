/**
 * Optimistic debit reconciliation hook for AI Studio.
 * Tracks pending/settled/failure output transitions and keeps optimistic debit entries in sync.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { StudioOutput } from "../types";

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
};

type UseAiStudioOptimisticDebitReconciliationParams = {
  outputs: StudioOutput[];
  setOptimisticDebitEntries: Dispatch<SetStateAction<OptimisticDebitEntry[]>>;
  refreshBalance: (options?: {
    silent?: boolean;
    preferLedger?: boolean;
  }) => Promise<number | null>;
  setDetailOutputId: Dispatch<SetStateAction<string | null>>;
};

/**
 * Returns failure UI state and handlers while reconciling optimistic debit entries with output lifecycle.
 */
export const useAiStudioOptimisticDebitReconciliation = ({
  outputs,
  setOptimisticDebitEntries,
  refreshBalance,
  setDetailOutputId,
}: UseAiStudioOptimisticDebitReconciliationParams) => {
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const settledGenerationSignaturesRef = useRef<Set<string>>(new Set());
  const seenOutputIdsRef = useRef<Set<string>>(new Set());

  const failedOutputs = useMemo(
    () => outputs.filter((item) => item.taskState === "fail" && item.errorMessage),
    [outputs]
  );

  const visibleFailures = useMemo(
    () => failedOutputs.filter((item) => !dismissedFailureIds.has(item.id)),
    [dismissedFailureIds, failedOutputs]
  );

  useEffect(() => {
    setDismissedFailureIds((prev) => {
      if (!prev.size) return prev;
      const activeIds = new Set(failedOutputs.map((item) => item.id));
      const filtered = Array.from(prev).filter((id) => activeIds.has(id));
      if (filtered.length === prev.size) return prev;
      return new Set(filtered);
    });
  }, [failedOutputs]);

  useEffect(() => {
    const newlySeenOutputIds: string[] = [];
    outputs.forEach((output) => {
      if (!seenOutputIdsRef.current.has(output.id)) {
        newlySeenOutputIds.push(output.id);
      }
      seenOutputIdsRef.current.add(output.id);
    });
    if (!newlySeenOutputIds.length) return;

    setOptimisticDebitEntries((prev) => {
      if (!prev.some((entry) => entry.outputId == null)) return prev;
      const assignedOutputIds = new Set(
        prev.map((entry) => entry.outputId).filter((id): id is string => Boolean(id))
      );
      const newlyPendingOutputIds = newlySeenOutputIds.filter((id) => {
        const item = outputs.find((output) => output.id === id);
        return Boolean(
          item &&
          item.id.startsWith("out-") &&
          item.taskState === "pending" &&
          !assignedOutputIds.has(item.id)
        );
      });
      const fallbackPendingOutputIds = outputs
        .filter(
          (item) =>
            item.id.startsWith("out-") &&
            item.taskState === "pending" &&
            !assignedOutputIds.has(item.id) &&
            !newlyPendingOutputIds.includes(item.id)
        )
        .map((item) => item.id);
      const availableOutputIds = [...newlyPendingOutputIds, ...fallbackPendingOutputIds];
      if (!availableOutputIds.length) return prev;

      let nextIndex = 0;
      let changed = false;
      const next = prev.map((entry) => {
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
  }, [outputs, setOptimisticDebitEntries]);

  useEffect(() => {
    const failedOutputIds = new Set(
      outputs.filter((item) => item.taskState === "fail").map((item) => item.id)
    );
    if (!failedOutputIds.size) return;

    setOptimisticDebitEntries((prev) => {
      const next = prev.filter((entry) => !(entry.outputId && failedOutputIds.has(entry.outputId)));
      return next.length === prev.length ? prev : next;
    });
  }, [outputs, setOptimisticDebitEntries]);

  useEffect(() => {
    const settledOutputs = outputs.filter(
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
      const refreshedBalance = await refreshBalance({ silent: true, preferLedger: true });
      if (refreshedBalance == null || !successfulOutputIds.size) return;
      setOptimisticDebitEntries((prev) => {
        const next = prev.filter(
          (entry) => !(entry.outputId && successfulOutputIds.has(entry.outputId))
        );
        return next.length === prev.length ? prev : next;
      });
    })();
  }, [outputs, refreshBalance, setOptimisticDebitEntries]);

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
