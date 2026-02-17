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
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance,
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() => expect(setOptimisticDebitEntries).toHaveBeenCalled());
    await waitFor(() =>
      expect(refreshBalance).toHaveBeenCalledWith({ silent: true, preferLedger: true })
    );

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
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(setOptimisticDebitEntries),
        refreshBalance,
        setDetailOutputId: asDispatch<string | null>(vi.fn()),
      })
    );

    await waitFor(() =>
      expect(refreshBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          silent: true,
          preferLedger: true,
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
        outputs: [makeOutput("out-fail", "fail", { errorMessage: "Failure" })],
        setOptimisticDebitEntries: asDispatch<OptimisticDebitEntry[]>(vi.fn()),
        refreshBalance: vi.fn(async () => 10),
        setDetailOutputId: asDispatch<string | null>(setDetailOutputId),
      })
    );

    expect(result.current.visibleFailures.map((item) => item.id)).toEqual(["out-fail"]);

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
});
