/**
 * Unit coverage for submit preflight timeout budgeting across reference/inpaint shapes.
 */
import { describe, expect, it } from "vitest";
import { resolvePrepareReferenceTimeoutBudget } from "../preflightTimeout";

describe("resolvePrepareReferenceTimeoutBudget", () => {
  it("returns the base timeout budget when no preflight work units are present", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({ imageInputs: [] });

    expect(budget).toEqual({
      workUnitCount: 0,
      timeoutMs: 10_000,
    });
  });

  it("keeps single-input prep on the base timeout budget", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["blob:reference-1"],
    });

    expect(budget).toEqual({
      workUnitCount: 1,
      timeoutMs: 10_000,
    });
  });

  it("scales timeout for inpaint base+mask prep work", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["blob:reference-1"],
      inpaintOverride: {
        baseImageInput: "blob:inpaint-base",
        maskInput: "blob:inpaint-mask",
      },
    });

    expect(budget).toEqual({
      workUnitCount: 3,
      timeoutMs: 26_000,
    });
  });

  it("caps timeout budget for large multi-input preflight batches", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: Array.from({ length: 10 }, (_, index) => `blob:reference-${index}`),
      inpaintOverride: {
        baseImageInput: "blob:inpaint-base",
        maskInput: "blob:inpaint-mask",
      },
    });

    expect(budget).toEqual({
      workUnitCount: 12,
      timeoutMs: 45_000,
    });
  });
});
