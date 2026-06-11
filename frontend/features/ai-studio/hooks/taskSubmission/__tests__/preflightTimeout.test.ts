/**
 * Unit coverage for submit preflight timeout budgeting across reference/inpaint shapes.
 */
import { describe, expect, it } from "vitest";
import { resolvePrepareReferenceTimeoutBudget } from "../preflightTimeout";
import {
  FETCH_LOCAL_IMAGE_TIMEOUT_MS,
  REFERENCE_IMAGE_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "../../../utils/imageUploadTimeouts";

describe("resolvePrepareReferenceTimeoutBudget", () => {
  it("returns the base timeout budget when no preflight work units are present", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({ imageInputs: [] });

    expect(budget).toEqual({
      workUnitCount: 0,
      timeoutMs: 14_000,
    });
  });

  it("keeps single-input prep on the base timeout budget", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["https://cdn.example.com/reference-1.png"],
    });

    expect(budget).toEqual({
      workUnitCount: 1,
      timeoutMs: 14_000,
    });
  });

  it("scales timeout for inpaint base+mask prep work", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["https://cdn.example.com/reference-1.png"],
      inpaintOverride: {
        baseImageInput: "https://cdn.example.com/inpaint-base.png",
        maskInput: "https://cdn.example.com/inpaint-mask.png",
      },
    });

    expect(budget).toEqual({
      workUnitCount: 3,
      timeoutMs: 38_000,
    });
  });

  it("caps timeout budget for large multi-input preflight batches", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: Array.from(
        { length: 10 },
        (_, index) => `https://cdn.example.com/ref-${index}.png`
      ),
      inpaintOverride: {
        baseImageInput: "https://cdn.example.com/inpaint-base.png",
        maskInput: "https://cdn.example.com/inpaint-mask.png",
      },
    });

    expect(budget).toEqual({
      workUnitCount: 12,
      timeoutMs: 120_000,
    });
  });

  it("adds local-upload bonus budget for blob/data preflight inputs", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["blob:reference-1", "data:image/png;base64,abc"],
    });

    expect(budget).toEqual({
      workUnitCount: 2,
      timeoutMs: 120_000,
    });
  });

  it("lets local staged-reference prep use the full preflight ceiling", () => {
    const budget = resolvePrepareReferenceTimeoutBudget({
      imageInputs: ["blob:reference-1"],
    });

    expect(budget.workUnitCount).toBe(1);
    expect(budget.timeoutMs).toBe(120_000);
    expect(budget.timeoutMs).toBeLessThan(
      FETCH_LOCAL_IMAGE_TIMEOUT_MS + REFERENCE_IMAGE_UPLOAD_PIPELINE_TIMEOUT_MS
    );
  });
});
