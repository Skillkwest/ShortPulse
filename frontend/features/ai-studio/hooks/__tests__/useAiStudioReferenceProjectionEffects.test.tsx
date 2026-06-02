import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import type { ReferenceProjectionState } from "../../reference-projections";
import type { StudioOutput } from "../../types";
import { useAiStudioReferenceProjectionEffects } from "../useAiStudioReferenceProjectionEffects";

const runningIds = Array.from({ length: 7 }, (_, index) => `out-${index + 1}`);
const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: id,
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  ...overrides,
});
const createCollectionState = (ids: string[]) => ({
  order: ids,
  byId: Object.fromEntries(ids.map((id) => [id, makeOutput(id)])),
});

const createArgs = (
  overrides: Partial<Parameters<typeof useAiStudioReferenceProjectionEffects>[0]> = {}
): Parameters<typeof useAiStudioReferenceProjectionEffects>[0] => {
  const fallbackProjectionState: ReferenceProjectionState = {
    quickSlotIds: runningIds.slice(0, 3),
    removedFromAllRefsIds: [],
  };
  const referenceProjectionState = overrides.referenceProjectionState ?? fallbackProjectionState;

  return {
    referenceProjectionState,
    setReferenceProjectionState: overrides.setReferenceProjectionState ?? vi.fn(),
    referenceProjectionStateRef:
      overrides.referenceProjectionStateRef ??
      ({
        current: referenceProjectionState,
      } as MutableRefObject<ReferenceProjectionState>),
    activeOutputState: overrides.activeOutputState ?? createCollectionState(runningIds),
    archivedOutputState: overrides.archivedOutputState ?? createCollectionState([]),
    curatedReferenceIds: overrides.curatedReferenceIds ?? runningIds.slice(0, 3),
    deferProjectionPrune: overrides.deferProjectionPrune ?? false,
    setActiveOutputState: overrides.setActiveOutputState ?? vi.fn(),
    setArchivedOutputState: overrides.setArchivedOutputState ?? vi.fn(),
  };
};

describe("useAiStudioReferenceProjectionEffects", () => {
  it("avoids redundant projection state writes during high-concurrency rerenders", () => {
    const setReferenceProjectionState = vi.fn();
    const args = createArgs({ setReferenceProjectionState });

    const { rerender } = renderHook(
      (props: Parameters<typeof useAiStudioReferenceProjectionEffects>[0]) =>
        useAiStudioReferenceProjectionEffects(props),
      {
        initialProps: args,
      }
    );

    for (let index = 0; index < 8; index += 1) {
      rerender({
        ...args,
        activeOutputState: createCollectionState([...runningIds]),
        archivedOutputState: createCollectionState([]),
        curatedReferenceIds: [...runningIds.slice(0, 3)],
      });
    }

    expect(setReferenceProjectionState).not.toHaveBeenCalled();
  });

  it("migrates quick-slot ids through generated-output aliases before pruning", () => {
    const setReferenceProjectionState = vi.fn();
    const args = createArgs({
      setReferenceProjectionState,
      referenceProjectionState: {
        quickSlotIds: ["generated:gen-1"],
        removedFromAllRefsIds: ["source-1"],
      },
      activeOutputState: {
        order: ["local-1"],
        byId: {
          "local-1": makeOutput("local-1", {
            generationId: "gen-1",
            sourceRef: "source-1",
          }),
        },
      },
      archivedOutputState: createCollectionState([]),
      curatedReferenceIds: ["generated:gen-1"],
    });

    renderHook(
      (props: Parameters<typeof useAiStudioReferenceProjectionEffects>[0]) =>
        useAiStudioReferenceProjectionEffects(props),
      {
        initialProps: args,
      }
    );

    expect(setReferenceProjectionState).toHaveBeenCalledWith({
      quickSlotIds: ["local-1"],
      removedFromAllRefsIds: ["local-1"],
    });
  });

  it("preserves unresolved generated quick-slot ids until canonical hydration settles", () => {
    const setReferenceProjectionState = vi.fn();
    const baseArgs = createArgs({
      setReferenceProjectionState,
      deferProjectionPrune: true,
      referenceProjectionState: {
        quickSlotIds: ["generated:gen-1"],
        removedFromAllRefsIds: [],
      },
      activeOutputState: createCollectionState([]),
      archivedOutputState: createCollectionState([]),
      curatedReferenceIds: ["generated:gen-1"],
    });

    const { rerender } = renderHook(
      (props: Parameters<typeof useAiStudioReferenceProjectionEffects>[0]) =>
        useAiStudioReferenceProjectionEffects(props),
      {
        initialProps: baseArgs,
      }
    );

    expect(setReferenceProjectionState).not.toHaveBeenCalled();

    rerender({
      ...baseArgs,
      activeOutputState: {
        order: ["local-1"],
        byId: {
          "local-1": makeOutput("local-1", {
            generationId: "gen-1",
            mediaSource: "generated",
          }),
        },
      },
    });

    expect(setReferenceProjectionState).toHaveBeenCalledWith({
      quickSlotIds: ["local-1"],
      removedFromAllRefsIds: [],
    });
  });

  it("does not prune restored quick-slot ids while output authority is temporarily empty", () => {
    const setReferenceProjectionState = vi.fn();
    const baseArgs = createArgs({
      setReferenceProjectionState,
      referenceProjectionState: {
        quickSlotIds: ["out-restored-1"],
        removedFromAllRefsIds: [],
      },
      activeOutputState: createCollectionState([]),
      archivedOutputState: createCollectionState([]),
      curatedReferenceIds: ["out-restored-1"],
    });

    const { rerender } = renderHook(
      (props: Parameters<typeof useAiStudioReferenceProjectionEffects>[0]) =>
        useAiStudioReferenceProjectionEffects(props),
      {
        initialProps: baseArgs,
      }
    );

    expect(setReferenceProjectionState).not.toHaveBeenCalled();

    rerender({
      ...baseArgs,
      activeOutputState: createCollectionState(["out-restored-1"]),
    });

    expect(setReferenceProjectionState).not.toHaveBeenCalled();
  });
});
