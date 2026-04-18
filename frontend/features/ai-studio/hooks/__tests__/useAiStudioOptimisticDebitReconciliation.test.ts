import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioOptimisticDebitReconciliation } from "../useAiStudioOptimisticDebitReconciliation";

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
};

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const makeOutput = (
  id: string,
  taskState: StudioOutput["taskState"],
  overrides: Partial<StudioOutput> = {}
): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  taskState,
  ...overrides,
});

const updaterFns = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls
    .map((call) => call[0])
    .filter(
      (value): value is (prev: OptimisticDebitEntry[]) => OptimisticDebitEntry[] =>
        typeof value === "function"
    );

describe("useAiStudioOptimisticDebitReconciliation", () => {
  it("assigns newly seen pending output ids to optimistic debit placeholders", async () => {
    const setOptimisticDebitEntries = vi.fn();
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [makeOutput("out-1", "pending")],
        optimisticDebitEntries: [{ credits: 3, outputId: null }],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());

    const assigner = updaterFns(setOptimisticDebitEntries)[0];
    expect(assigner).toBeTypeOf("function");
    expect(assigner?.([{ credits: 3, outputId: null }])).toEqual([
      { credits: 3, outputId: "out-1" },
    ]);
  });

  it("assigns newly seen running output ids to optimistic debit placeholders", async () => {
    const setOptimisticDebitEntries = vi.fn();
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [makeOutput("out-7", "running")],
        optimisticDebitEntries: [{ credits: 6, outputId: null }],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());

    const assigner = updaterFns(setOptimisticDebitEntries)[0];
    expect(assigner).toBeTypeOf("function");
    expect(assigner?.([{ credits: 6, outputId: null }])).toEqual([
      { credits: 6, outputId: "out-7" },
    ]);
  });

  it("removes failed output ids from optimistic debit entries", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const refreshBalance = vi.fn(async () => 20);
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [makeOutput("out-2", "fail", { errorMessage: "Generation failed" })],
        optimisticDebitEntries: [{ credits: 5, outputId: "out-2", createdAtMs: Date.now() }],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance,
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());
    await waitFor(() => expect(refreshBalance).toHaveBeenCalledWith({ silent: true }));

    const removedFailure = updaterFns(setOptimisticDebitEntries).some((updater) => {
      const next = updater([
        { credits: 5, outputId: "out-2" },
        { credits: 1, outputId: "out-3" },
      ]);
      return next.length === 1 && next[0]?.outputId === "out-3";
    });

    expect(removedFailure).toBe(true);
  });

  it("settles successful outputs after balance refresh", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const refreshBalance = vi.fn(async () => 50);
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [makeOutput("out-1", "success")],
        optimisticDebitEntries: [],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance,
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() =>
      expect(refreshBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          silent: true,
          beforeCommit: expect.any(Function),
        })
      )
    );
    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());

    const removedSuccessful = updaterFns(setOptimisticDebitEntries).some((updater) => {
      const next = updater([
        { credits: 4, outputId: "out-1" },
        { credits: 2, outputId: "out-9" },
      ]);
      return next.length === 1 && next[0]?.outputId === "out-9";
    });

    expect(removedSuccessful).toBe(true);
  });

  it("dismisses and focuses failure rows", () => {
    const setDetailOutputId = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [
          makeOutput("out-fail", "fail", {
            errorMessage: "Failure",
            errorMessageShort: "Content not allowed",
          }),
        ],
        optimisticDebitEntries: [],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(vi.fn()),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(setDetailOutputId),
      })
    );

    expect(result.current.visibleFailures.map((item) => item.id)).toEqual(["out-fail"]);
    expect(result.current.visibleFailures[0]?.errorMessageShort).toBe("Content not allowed");

    act(() => {
      result.current.dismissFailure("out-fail");
    });
    expect(result.current.visibleFailures).toEqual([]);

    act(() => {
      result.current.focusFailure("out-fail");
    });
    expect(setDetailOutputId).toHaveBeenCalledWith("out-fail");
  });

  it("drops stale unassigned optimistic debits instead of assigning them to unrelated new outputs", async () => {
    const setOptimisticDebitEntries = vi.fn();
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [makeOutput("out-new", "pending")],
        optimisticDebitEntries: [{ credits: 4, outputId: null }],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());

    const staleEntry = {
      credits: 4,
      outputId: null,
      createdAtMs: Date.now() - 10 * 60 * 1000,
    } as unknown as OptimisticDebitEntry;
    const removedStaleOrphans = updaterFns(setOptimisticDebitEntries).some((updater) => {
      const next = updater([staleEntry]);
      return next.length === 0;
    });

    expect(removedStaleOrphans).toBe(true);
  });

  it("keeps fresh unassigned optimistic debits while no outputs are in flight", async () => {
    const setOptimisticDebitEntries = vi.fn();
    renderHook(() =>
      useAiStudioOptimisticDebitReconciliation({
        outputs: [],
        optimisticDebitEntries: [{ credits: 4, outputId: null, createdAtMs: Date.now() }],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(setOptimisticDebitEntries).not.toHaveBeenCalled();
  });

  it("does not repeatedly reconcile failed optimistic debits on identical rerenders", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const stableFailedOutputs = [makeOutput("out-failed-stable", "fail", { errorMessage: "Fail" })];
    const stableEntries = [
      { credits: 4, outputId: "out-failed-stable", createdAtMs: Date.now() - 1_000 },
    ];

    const { rerender } = renderHook(
      ({ outputs, optimisticEntries }) =>
        useAiStudioOptimisticDebitReconciliation({
          outputs,
          optimisticDebitEntries: optimisticEntries,
          setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
          refreshBalance: vi.fn(async () => 10),
          setDetailOutputId: asDispatch<string | null>(vi.fn()),
        }),
      {
        initialProps: {
          outputs: stableFailedOutputs,
          optimisticEntries: stableEntries,
        },
      }
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalledTimes(1));

    rerender({
      outputs: stableFailedOutputs,
      optimisticEntries: stableEntries,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setOptimisticDebitEntries).toHaveBeenCalledTimes(1);
  });

  it("does not re-run optimistic debit reconciliation on parent rerenders when outputs are unchanged", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const stableOutputs = [makeOutput("out-stable", "pending")];
    const { rerender } = renderHook(
      ({ outputs }) =>
        useAiStudioOptimisticDebitReconciliation({
          outputs,
          optimisticDebitEntries: [{ credits: 2, outputId: null }],
          setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
          refreshBalance: vi.fn(async () => 10),
          setDetailOutputId: asDispatch<string | null>(vi.fn()),
        }),
      {
        initialProps: {
          outputs: stableOutputs,
        },
      }
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());
    const initialCallCount = setOptimisticDebitEntries.mock.calls.length;

    rerender({ outputs: stableOutputs });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setOptimisticDebitEntries.mock.calls.length).toBe(initialCallCount);
  });
});
