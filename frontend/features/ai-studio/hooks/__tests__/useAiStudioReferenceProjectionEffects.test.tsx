import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import type { ReferenceProjectionState } from "../../reference-projections";
import { useAiStudioReferenceProjectionEffects } from "../useAiStudioReferenceProjectionEffects";

const runningIds = Array.from({ length: 7 }, (_, index) => `out-${index + 1}`);

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
    activeOutputOrder: overrides.activeOutputOrder ?? runningIds,
    archivedOutputOrder: overrides.archivedOutputOrder ?? [],
    curatedReferenceIds: overrides.curatedReferenceIds ?? runningIds.slice(0, 3),
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
        activeOutputOrder: [...runningIds],
        archivedOutputOrder: [],
        curatedReferenceIds: [...runningIds.slice(0, 3)],
      });
    }

    expect(setReferenceProjectionState).not.toHaveBeenCalled();
  });
});
