/**
 * Unit coverage for Expert Edit submission preparation.
 * Uses focused mocks to lock the preparation seam's validation and planning responsibilities.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  prepareExpertEditSubmission,
  validateExpertEditSubmissionPrompt,
} from "../expertEditSubmissionPreparation";

const analyzeExpertEditPromptTokensMock = vi.fn();
const buildExpertEditSubmissionReferencePlanMock = vi.fn();
const compileExpertEditSubmissionPromptMock = vi.fn();

vi.mock("../../../logic/expertEditPromptReferences", () => ({
  analyzeExpertEditPromptTokens: (...args: unknown[]) => analyzeExpertEditPromptTokensMock(...args),
  buildExpertEditSubmissionReferencePlan: (...args: unknown[]) =>
    buildExpertEditSubmissionReferencePlanMock(...args),
  compileExpertEditSubmissionPrompt: (...args: unknown[]) =>
    compileExpertEditSubmissionPromptMock(...args),
}));

describe("prepareExpertEditSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: false,
      inlineError: null,
      referencedSlotIndexes: [1],
    });
    buildExpertEditSubmissionReferencePlanMock.mockReturnValue({
      referenceInputs: ["blob:flatten-1", "ref-2"],
      primaryReferenceInputIndex: 0,
      markupReferenceInputIndex: null,
      secondaryFigureNumbersBySlotIndex: { 1: 2 },
      secondaryReferenceInputIndexesBySlotIndex: { 1: 1 },
    });
    compileExpertEditSubmissionPromptMock.mockReturnValue({
      hasTokenReferences: false,
      submissionPrompt: "Refine the scene",
    });
  });

  it("returns an invalid token result without building submission inputs", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: true,
      inlineError: "@img2 has no image in secondary slot 2.",
      referencedSlotIndexes: [],
    });

    const result = prepareExpertEditSubmission({
      promptText: "Use @img2",
      extraImageUrls: [null, null, null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
    });

    expect(result).toEqual({
      status: "invalid_tokens",
      message: "@img2 has no image in secondary slot 2.",
    });
    expect(buildExpertEditSubmissionReferencePlanMock).not.toHaveBeenCalled();
    expect(compileExpertEditSubmissionPromptMock).not.toHaveBeenCalled();
  });

  it("exposes prompt validation without requiring export artifacts", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: true,
      inlineError: "@img2 has no image in secondary slot 2.",
      referencedSlotIndexes: [],
    });

    expect(
      validateExpertEditSubmissionPrompt({
        promptText: "Use @img2",
        extraImageUrls: [null, null, null],
      })
    ).toEqual({
      status: "invalid_tokens",
      message: "@img2 has no image in secondary slot 2.",
    });
    expect(buildExpertEditSubmissionReferencePlanMock).not.toHaveBeenCalled();
    expect(compileExpertEditSubmissionPromptMock).not.toHaveBeenCalled();
  });

  it("returns reference inputs without prompt overrides when no token references are compiled", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Refine the scene",
      extraImageUrls: [null, "https://example.com/ref-2.png", null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-1", "ref-2"],
      linkedSecondaryReferenceInputs: ["https://example.com/ref-2.png"],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [{ slotIndex: 1, referenceInputIndex: 1 }],
        restoreSecondarySlots: [{ slotIndex: 1, sourceUrl: "https://example.com/ref-2.png" }],
      },
      promptOverrideOptions: undefined,
    });
    expect(buildExpertEditSubmissionReferencePlanMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      secondarySlots: [null, "https://example.com/ref-2.png", null],
      referencedSlotIndexes: [1],
    });
  });

  it("returns prompt override options when compiled prompt uses token references", () => {
    buildExpertEditSubmissionReferencePlanMock.mockReturnValue({
      referenceInputs: ["blob:flatten-1", "blob:markup-1"],
      primaryReferenceInputIndex: 0,
      markupReferenceInputIndex: 1,
      secondaryFigureNumbersBySlotIndex: {},
      secondaryReferenceInputIndexesBySlotIndex: {},
    });
    compileExpertEditSubmissionPromptMock.mockReturnValue({
      hasTokenReferences: true,
      submissionPrompt: "Figure 1 = primary base image.",
    });

    const result = prepareExpertEditSubmission({
      promptText: "Use @main",
      extraImageUrls: [null, null, null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-1", "blob:markup-1"],
      linkedSecondaryReferenceInputs: [],
      promptOverrideOptions: {
        displayPromptOverride: "Use @main",
        submissionPromptOverride: "Figure 1 = primary base image.",
      },
    });
    expect(compileExpertEditSubmissionPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secondaryFigureNumbersBySlotIndex: {},
      })
    );
  });

  it("omits unlinked secondary refs for standard submits when no secondary tokens are linked", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: false,
      inlineError: null,
      referencedSlotIndexes: [],
    });

    prepareExpertEditSubmission({
      promptText: "Refine the scene",
      extraImageUrls: ["https://example.com/ref-1.png", null, "https://example.com/ref-3.png"],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(buildExpertEditSubmissionReferencePlanMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      secondarySlots: ["https://example.com/ref-1.png", null, "https://example.com/ref-3.png"],
      referencedSlotIndexes: [],
    });
  });

  it("omits unlinked secondary refs for markup submits when no secondary tokens are linked", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: false,
      inlineError: null,
      referencedSlotIndexes: [],
    });

    prepareExpertEditSubmission({
      promptText: "Refine the scene",
      extraImageUrls: ["https://example.com/ref-1.png", "https://example.com/ref-2.png", null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      editSubmitIntent: "markup",
    });

    expect(buildExpertEditSubmissionReferencePlanMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      secondarySlots: ["https://example.com/ref-1.png", "https://example.com/ref-2.png", null],
      referencedSlotIndexes: [],
    });
  });

  it("does not fall back to populated secondary refs for inpaint when no secondary tokens are linked", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: false,
      inlineError: null,
      referencedSlotIndexes: [],
    });

    prepareExpertEditSubmission({
      promptText: "Use @main",
      extraImageUrls: ["https://example.com/ref-1.png", "https://example.com/ref-2.png", null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "inpaint",
    });

    expect(buildExpertEditSubmissionReferencePlanMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      secondarySlots: ["https://example.com/ref-1.png", "https://example.com/ref-2.png", null],
      referencedSlotIndexes: [],
    });
  });

  it("blocks secondary prompt tokens when secondary references are disabled", () => {
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: true,
      inlineError:
        "Inpaint only supports @main. Secondary references are not sent to the inpaint model.",
      referencedSlotIndexes: [],
    });

    const result = prepareExpertEditSubmission({
      promptText: "Use @img1",
      extraImageUrls: ["https://example.com/ref-1.png", null, null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      allowSecondaryReferenceTokens: false,
    });

    expect(analyzeExpertEditPromptTokensMock).toHaveBeenCalledWith(
      "Use @img1",
      ["https://example.com/ref-1.png", null, null],
      { allowSecondaryTokens: false }
    );
    expect(result).toEqual({
      status: "invalid_tokens",
      message:
        "Inpaint only supports @main. Secondary references are not sent to the inpaint model.",
    });
    expect(buildExpertEditSubmissionReferencePlanMock).not.toHaveBeenCalled();
    expect(compileExpertEditSubmissionPromptMock).not.toHaveBeenCalled();
  });

  it("passes the max secondary reference limit into prompt analysis", () => {
    prepareExpertEditSubmission({
      promptText: "Use @img1",
      extraImageUrls: ["https://example.com/ref-1.png", null, null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      allowSecondaryReferenceTokens: true,
      maxSecondaryReferenceTokens: 1,
    });

    expect(analyzeExpertEditPromptTokensMock).toHaveBeenCalledWith(
      "Use @img1",
      ["https://example.com/ref-1.png", null, null],
      { allowSecondaryTokens: true, maxSecondaryReferences: 1 }
    );
  });

  it("reuses a single prompt analysis pass during submission preparation", () => {
    prepareExpertEditSubmission({
      promptText: "Use @img1",
      extraImageUrls: ["https://example.com/ref-1.png", null, null],
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
    });

    expect(analyzeExpertEditPromptTokensMock).toHaveBeenCalledTimes(1);
  });
});
