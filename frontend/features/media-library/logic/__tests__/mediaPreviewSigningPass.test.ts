import { describe, expect, it } from "vitest";
import {
  prepareMediaSigningState,
  resolveMediaSignQueuePass,
  resolveVisibleScopedSigningSourceRows,
} from "../mediaPreviewSigningPass";

const makeRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    storage_path: `user/images/${index}.png`,
  }));

describe("mediaPreviewSigningPass", () => {
  it("bounds visible-scoped signing source rows to initial rows and the visible prefetch window", () => {
    const rows = makeRows(40);
    const selectedRows = resolveVisibleScopedSigningSourceRows({
      sourceRows: rows,
      signBudget: {
        initialSignLimit: 3,
        prefetchWindow: 6,
        signBatchSize: 4,
      },
      visibleMediaIds: new Set(["row-25", "row-26"]),
      includePrefetchWindow: true,
    });

    expect(selectedRows.map((row) => row.id)).toEqual([
      "row-0",
      "row-1",
      "row-2",
      "row-23",
      "row-24",
      "row-25",
      "row-26",
      "row-27",
      "row-28",
      "row-29",
      "row-30",
      "row-31",
      "row-32",
    ]);
  });

  it("returns only initial rows when visible prefetch is unavailable", () => {
    const rows = makeRows(12);

    expect(
      resolveVisibleScopedSigningSourceRows({
        sourceRows: rows,
        signBudget: {
          initialSignLimit: 4,
          prefetchWindow: 6,
          signBatchSize: 4,
        },
        visibleMediaIds: new Set(["row-8"]),
        includePrefetchWindow: false,
      }).map((row) => row.id)
    ).toEqual(["row-0", "row-1", "row-2", "row-3"]);
  });

  it("prunes stale deferred queue entries when the prefetch budget collapses", () => {
    const rows = makeRows(12);
    const preparedState = prepareMediaSigningState({
      sourceRows: rows,
      currentUserId: "user-1",
      signCandidateCap: 4,
    });

    const result = resolveMediaSignQueuePass({
      preparedState,
      existingState: {
        urgentQueue: [],
        deferredQueue: ["row-8", "row-9"],
        queueStateById: {
          "row-8": "deferred",
          "row-9": "deferred",
        },
      },
      signBudget: {
        initialSignLimit: 1,
        prefetchWindow: 0,
        signBatchSize: 1,
      },
      visibleMediaIds: new Set(["row-6", "row-7"]),
      isSignPrefetchEnabled: true,
      allowDeferredPrefetch: true,
      isDeferredDrainArmed: true,
      signAttemptCounts: {},
    });

    expect(result.queueState.deferredQueue).toEqual([]);
    expect(result.queueState.queueStateById["row-8"]).toBeUndefined();
    expect(result.queueState.queueStateById["row-9"]).toBeUndefined();
    expect(result.signBatch.map((row) => row.id)).toEqual(["row-0"]);
    expect(result.drainPriority).toBe("urgent");
  });
});
