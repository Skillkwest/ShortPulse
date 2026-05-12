import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveExpertEditSubmissionDispatch } from "../expertEditSubmissionDispatch";

vi.mock("../../../logic/inpaintSubmission", () => ({
  INPAINT_FLUX_FILL_MODEL_ID: "flux-fill",
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID: "nano-banana",
  isMarkupModelLockEnabled: () => true,
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

  it("returns an error when inpaint mode lacks a mask", () => {
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
      status: "error",
      message: "Mask selection is required for inpaint.",
    });
  });

  it("builds FLUX Fill options for inpaint mode", () => {
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
        inpaintOverride: {
          modelId: "flux-fill",
          baseImageInput: "blob:flatten-1",
          maskInput: "blob:mask-1",
          outputFormat: "png",
          imageWidth: 2048,
          imageHeight: 1024,
        },
        referenceInputsMode: "replace",
        displayPromptOverride: "Use @main",
        submissionPromptOverride: "Figure 1 = primary base image.",
      },
    });
  });

  it("always adds the canonical markup model override for markup submissions", () => {
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
        modelIdOverride: "nano-banana",
        referenceInputsMode: "replace",
      },
    });
  });
});
