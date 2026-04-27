import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  prepareExpertEditSubmission,
  validateExpertEditSubmissionPrompt,
} from "../expertEditSubmissionPreparation";

const analyzeExpertEditPromptTokensMock = vi.fn();
const buildExpertEditSubmissionReferenceInputsMock = vi.fn();
const compileExpertEditSubmissionPromptMock = vi.fn();

vi.mock("../../../logic/expertEditPromptReferences", () => ({
  analyzeExpertEditPromptTokens: (...args: unknown[]) => analyzeExpertEditPromptTokensMock(...args),
  buildExpertEditSubmissionReferenceInputs: (...args: unknown[]) =>
    buildExpertEditSubmissionReferenceInputsMock(...args),
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
    buildExpertEditSubmissionReferenceInputsMock.mockReturnValue(["blob:flatten-1", "ref-2"]);
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
    expect(buildExpertEditSubmissionReferenceInputsMock).not.toHaveBeenCalled();
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
    expect(buildExpertEditSubmissionReferenceInputsMock).not.toHaveBeenCalled();
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
      promptOverrideOptions: undefined,
    });
    expect(buildExpertEditSubmissionReferenceInputsMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      secondarySlots: [null, "https://example.com/ref-2.png", null],
      referencedSlotIndexes: [1],
    });
  });

  it("returns prompt override options when compiled prompt uses token references", () => {
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
      referenceInputs: ["blob:flatten-1", "ref-2"],
      linkedSecondaryReferenceInputs: [],
      promptOverrideOptions: {
        displayPromptOverride: "Use @main",
        submissionPromptOverride: "Figure 1 = primary base image.",
      },
    });
  });

  it("falls back to all populated secondary refs for standard submits when no secondary tokens are linked", () => {
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

    expect(buildExpertEditSubmissionReferenceInputsMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: null,
      secondarySlots: ["https://example.com/ref-1.png", null, "https://example.com/ref-3.png"],
      referencedSlotIndexes: [0, 2],
    });
  });

  it("falls back to all populated secondary refs for markup submits when no secondary tokens are linked", () => {
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

    expect(buildExpertEditSubmissionReferenceInputsMock).toHaveBeenCalledWith({
      flattenedPrimaryUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      secondarySlots: ["https://example.com/ref-1.png", "https://example.com/ref-2.png", null],
      referencedSlotIndexes: [0, 1],
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

    expect(buildExpertEditSubmissionReferenceInputsMock).toHaveBeenCalledWith({
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
    expect(buildExpertEditSubmissionReferenceInputsMock).not.toHaveBeenCalled();
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
});
