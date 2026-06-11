import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveExpertEditSubmissionDispatch } from "../expertEditSubmissionDispatch";

vi.mock("../../../logic/inpaintSubmission", () => ({
  INPAINT_FLUX_FILL_MODEL_ID: "flux-fill",
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID: "nano-banana",
  isInpaintGenerationEnabled: () => false,
  isMarkupGenerationEnabled: () => false,
  isMarkupModelLockEnabled: () => false,
}));

describe("resolveExpertEditSubmissionDispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to regenerate for standard mode when no submission handler exists", () => {
    expect(
      resolveExpertEditSubmissionDispatch({
        editSubmitIntent: "standard",
        hasSubmissionHandler: false,
        hasSelectedLayerMask: false,
        flattenedUrl: null,
        inpaintMaskUrl: null,
        referenceInputs: ["blob:flatten-1"],
      })
    ).toEqual({
      status: "fallback_regenerate",
    });
  });

  it("normalizes hidden inpaint intent to the standard edit submission path", () => {
    expect(
      resolveExpertEditSubmissionDispatch({
        editSubmitIntent: "inpaint",
        hasSubmissionHandler: true,
        hasSelectedLayerMask: false,
        flattenedUrl: "blob:flatten-1",
        inpaintMaskUrl: null,
        referenceInputs: ["blob:flatten-1"],
      })
    ).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-1"],
      options: {
        modelIdOverride: undefined,
        referenceInputsMode: "replace",
        referenceInputsLimit: 11,
      },
    });
  });

  it("ignores hidden inpaint overrides and keeps a standard regenerate payload", () => {
    expect(
      resolveExpertEditSubmissionDispatch({
        editSubmitIntent: "inpaint",
        hasSubmissionHandler: true,
        hasSelectedLayerMask: true,
        flattenedUrl: "blob:flatten-1",
        inpaintMaskUrl: "blob:mask-1",
        flattenedDimensions: { width: 2048, height: 1024 },
        referenceInputs: ["blob:flatten-1"],
        promptOverrideOptions: {
          displayPromptOverride: "Use @main",
          submissionPromptOverride: "Figure 1 = primary base image.",
        },
      })
    ).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-1"],
      options: {
        displayPromptOverride: "Use @main",
        modelIdOverride: undefined,
        submissionPromptOverride: "Figure 1 = primary base image.",
        referenceInputsMode: "replace",
        referenceInputsLimit: 11,
      },
    });
  });

  it("normalizes hidden markup intent to standard edit submit behavior", () => {
    expect(
      resolveExpertEditSubmissionDispatch({
        editSubmitIntent: "markup",
        hasSubmissionHandler: true,
        hasSelectedLayerMask: false,
        flattenedUrl: "blob:flatten-1",
        inpaintMaskUrl: null,
        referenceInputs: ["blob:flatten-1", "blob:markup-1"],
      })
    ).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-1", "blob:markup-1"],
      options: {
        modelIdOverride: undefined,
        referenceInputsMode: "replace",
        referenceInputsLimit: 11,
      },
    });
  });
});
