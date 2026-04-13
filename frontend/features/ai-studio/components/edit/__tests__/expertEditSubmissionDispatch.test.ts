import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveExpertEditSubmissionDispatch } from "../expertEditSubmissionDispatch";

const isMarkupModelLockEnabledMock = vi.fn();

vi.mock("../../../logic/inpaintSubmission", () => ({
  INPAINT_FLUX_FILL_MODEL_ID: "flux-fill",
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID: "nano-banana",
  isMarkupModelLockEnabled: () => isMarkupModelLockEnabledMock(),
}));

describe("resolveExpertEditSubmissionDispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMarkupModelLockEnabledMock.mockReturnValue(false);
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
        },
        referenceInputsMode: "replace",
        displayPromptOverride: "Use @main",
        submissionPromptOverride: "Figure 1 = primary base image.",
      },
    });
  });

  it("adds markup model override only when the lock is enabled", () => {
    isMarkupModelLockEnabledMock.mockReturnValue(true);

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
