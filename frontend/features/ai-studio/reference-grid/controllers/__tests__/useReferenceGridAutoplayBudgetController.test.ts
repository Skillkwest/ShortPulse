/**
 * Unit coverage for autoplay budget controller.
 * Verifies modal-open suspension and resume behavior for budget refresh work.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReferenceGridAutoplayBudgetController } from "../useReferenceGridAutoplayBudgetController";

describe("useReferenceGridAutoplayBudgetController", () => {
  it("skips budget work while suspended and resumes after unsuspend", () => {
    const matchMediaStub = vi.fn(() => ({
      matches: false,
      media: "(max-width: 900px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMediaStub,
    });

    const setDesiredVideoAttachBudget = vi.fn();
    const setAutoplayEnabledIds = vi.fn();
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const recomputeAutoplayBudget = vi.fn();

    const desiredVideoAttachBudgetRef = { current: 0 };
    const autoplayEnabledIdsStateRef = { current: [] as string[] };
    const recomputeAutoplayBudgetRef = { current: recomputeAutoplayBudget };

    const { rerender } = renderHook(
      ({ suspendAutoplayBudget }: { suspendAutoplayBudget: boolean }) =>
        useReferenceGridAutoplayBudgetController({
          smallScreenQuery: "(max-width: 900px)",
          suspendAutoplayBudget,
          autoplayMaxDesktop: 6,
          autoplayMaxSmallScreen: 3,
          autoplayMaxConstrained: 1,
          desiredVideoAttachBudgetRef,
          autoplayEnabledIdsStateRef,
          recomputeAutoplayBudgetRef,
          setDesiredVideoAttachBudget,
          setAutoplayEnabledIds,
          runNonUrgentUpdate,
        }),
      {
        initialProps: {
          suspendAutoplayBudget: true,
        },
      }
    );

    expect(setDesiredVideoAttachBudget).not.toHaveBeenCalled();
    expect(recomputeAutoplayBudget).not.toHaveBeenCalled();

    rerender({ suspendAutoplayBudget: false });

    expect(setDesiredVideoAttachBudget).toHaveBeenCalledWith(6);
    expect(recomputeAutoplayBudget).toHaveBeenCalled();
  });
});
