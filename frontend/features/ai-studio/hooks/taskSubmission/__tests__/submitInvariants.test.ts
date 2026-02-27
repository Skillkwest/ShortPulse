/**
 * Unit coverage for submit-start invariant helpers used by task submission flow.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeSubmissionTool,
  resolveSubmissionStartUiError,
  shouldSkipTextCreateSubmission,
} from "../submitInvariants";

describe("submitInvariants", () => {
  it("normalizes legacy tool aliases", () => {
    expect(normalizeSubmissionTool("edit")).toBe("image");
    expect(normalizeSubmissionTool("kling")).toBe("video");
    expect(normalizeSubmissionTool("video")).toBe("video");
    expect(normalizeSubmissionTool(null)).toBeNull();
  });

  it("skips create/text submissions in text mode", () => {
    expect(shouldSkipTextCreateSubmission("create", "text")).toBe(true);
    expect(shouldSkipTextCreateSubmission("text", "text")).toBe(true);
    expect(shouldSkipTextCreateSubmission("create", "image")).toBe(false);
    expect(shouldSkipTextCreateSubmission("video", "text")).toBe(false);
  });

  it("resolves submit-start UI errors in precedence order", () => {
    expect(
      resolveSubmissionStartUiError({
        cleanedSubmissionPrompt: "",
        isEditWorkflow: false,
        hasReferenceImages: true,
        finalModel: "fal/flux-2",
        requiresImageToImageReferences: false,
      })
    ).toBe("Add a prompt to start a generation.");

    expect(
      resolveSubmissionStartUiError({
        cleanedSubmissionPrompt: "hello",
        isEditWorkflow: true,
        hasReferenceImages: false,
        finalModel: null,
        requiresImageToImageReferences: false,
      })
    ).toBe("Add a reference image before generating.");

    expect(
      resolveSubmissionStartUiError({
        cleanedSubmissionPrompt: "hello",
        isEditWorkflow: false,
        hasReferenceImages: true,
        finalModel: null,
        requiresImageToImageReferences: false,
      })
    ).toBe("Pick a model to generate.");

    expect(
      resolveSubmissionStartUiError({
        cleanedSubmissionPrompt: "hello",
        isEditWorkflow: false,
        hasReferenceImages: false,
        finalModel: "fal/flux-2/edit",
        requiresImageToImageReferences: true,
      })
    ).toBe("Add a reference image before generating.");

    expect(
      resolveSubmissionStartUiError({
        cleanedSubmissionPrompt: "hello",
        isEditWorkflow: false,
        hasReferenceImages: true,
        finalModel: "fal/flux-2",
        requiresImageToImageReferences: false,
      })
    ).toBeNull();
  });
});
