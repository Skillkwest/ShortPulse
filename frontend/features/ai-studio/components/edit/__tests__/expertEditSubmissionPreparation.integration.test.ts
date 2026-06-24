/**
 * Integration coverage for Expert Edit submission preparation.
 * Verifies real prompt-token planning and reference ordering without depending on the full panel runtime.
 */
import { describe, expect, it } from "vitest";

import { prepareExpertEditSubmission } from "../expertEditSubmissionPreparation";

describe("prepareExpertEditSubmission integration", () => {
  it("keeps linked-only secondary references and compiles prompt overrides for tokenized standard submits", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Put @img1 in the background.",
      extraImageUrls: [
        "https://example.com/linked-extra.png",
        "https://example.com/unlinked-extra.png",
        null,
      ],
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-primary", "https://example.com/linked-extra.png"],
      linkedSecondaryReferenceInputs: ["https://example.com/linked-extra.png"],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [{ slotIndex: 0, referenceInputIndex: 1 }],
        restoreSecondarySlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/linked-extra.png" },
          { slotIndex: 1, sourceUrl: "https://example.com/unlinked-extra.png" },
        ],
      },
      promptOverrideOptions: {
        displayPromptOverride: "Put @img1 in the background.",
        submissionPromptOverride: expect.stringContaining("Put Figure 2 in the background."),
      },
    });
    if (result.status !== "ready") {
      return;
    }
    expect(result.referenceInputs).not.toContain("https://example.com/unlinked-extra.png");
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain("Reference map:");
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 2 = @img1 secondary reference."
    );
  });

  it("persists primary canvas layer references separately from provider inputs", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Blend the primary canvas with @img1.",
      extraImageUrls: ["https://example.com/secondary-ref.png", null, null],
      primaryCanvasImageUrls: [
        "https://example.com/canvas-layer-1.png",
        "https://example.com/canvas-layer-2.png",
      ],
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-primary", "https://example.com/secondary-ref.png"],
      linkedSecondaryReferenceInputs: ["https://example.com/secondary-ref.png"],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        restorePrimaryCanvasSlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/canvas-layer-1.png" },
          { slotIndex: 1, sourceUrl: "https://example.com/canvas-layer-2.png" },
        ],
        secondarySlots: [{ slotIndex: 0, referenceInputIndex: 1 }],
        restoreSecondarySlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/secondary-ref.png" },
        ],
      },
      promptOverrideOptions: {
        displayPromptOverride: "Blend the primary canvas with @img1.",
        submissionPromptOverride: expect.stringContaining(
          "Blend the primary canvas with Figure 2."
        ),
      },
    });
  });

  it("keeps linked tenth secondary reference in slot order for tokenized standard submits", () => {
    const extraImageUrls = Array.from({ length: 10 }, (_, index) =>
      index === 9 ? "https://example.com/ref-10.png" : null
    );

    const result = prepareExpertEditSubmission({
      promptText: "Use @img10 as the wardrobe reference.",
      extraImageUrls,
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-primary", "https://example.com/ref-10.png"],
      linkedSecondaryReferenceInputs: ["https://example.com/ref-10.png"],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [{ slotIndex: 9, referenceInputIndex: 1 }],
        restoreSecondarySlots: [{ slotIndex: 9, sourceUrl: "https://example.com/ref-10.png" }],
      },
      promptOverrideOptions: {
        displayPromptOverride: "Use @img10 as the wardrobe reference.",
        submissionPromptOverride: expect.stringContaining(
          "Use Figure 2 as the wardrobe reference."
        ),
      },
    });
    if (result.status !== "ready") {
      return;
    }
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 2 = @img10 secondary reference."
    );
  });

  it("keeps the flattened primary plus all ten linked secondary references", () => {
    const extraImageUrls = Array.from(
      { length: 10 },
      (_, index) => `https://example.com/ref-${index + 1}.png`
    );

    const result = prepareExpertEditSubmission({
      promptText: "Use @img1 @img2 @img3 @img4 @img5 @img6 @img7 @img8 @img9 and @img10.",
      extraImageUrls,
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.referenceInputs).toEqual(["blob:flatten-primary", ...extraImageUrls]);
    expect(result.linkedSecondaryReferenceInputs).toEqual(extraImageUrls);
    expect(result.workflowReloadExpertEditReferences?.secondarySlots).toEqual(
      extraImageUrls.map((_, index) => ({
        slotIndex: index,
        referenceInputIndex: index + 1,
      }))
    );
    expect(result.workflowReloadExpertEditReferences?.restoreSecondarySlots).toEqual(
      extraImageUrls.map((sourceUrl, index) => ({
        slotIndex: index,
        sourceUrl,
      }))
    );
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 11 = @img10 secondary reference."
    );
  });

  it("submits only the flattened primary when no secondary tokens are linked", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Refine the background and styling.",
      extraImageUrls: [
        "https://example.com/extra-one.png",
        "https://example.com/extra-two.png",
        null,
      ],
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-primary"],
      linkedSecondaryReferenceInputs: [],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [],
        restoreSecondarySlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/extra-one.png" },
          { slotIndex: 1, sourceUrl: "https://example.com/extra-two.png" },
        ],
      },
      promptOverrideOptions: undefined,
    });
  });

  it("keeps local restore-only secondary refs for submit preflight without provider inputs", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Refine the background and styling.",
      extraImageUrls: ["blob:local-secondary", null, null],
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: null,
      editSubmitIntent: "standard",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: ["blob:flatten-primary"],
      linkedSecondaryReferenceInputs: [],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [],
        restoreSecondarySlots: [{ slotIndex: 0, sourceUrl: "blob:local-secondary" }],
      },
      promptOverrideOptions: undefined,
    });
  });

  it("keeps the primary image first and markup composite second for markup submissions", () => {
    const result = prepareExpertEditSubmission({
      promptText: "Apply @main with @img1, @img2, and @img3.",
      extraImageUrls: [
        "https://example.com/ref-1.png",
        "https://example.com/ref-2.png",
        "https://example.com/ref-3.png",
      ],
      flattenedPrimaryUrl: "blob:flatten-primary",
      flattenedMarkupReferenceUrl: "blob:flatten-markup",
      editSubmitIntent: "markup",
    });

    expect(result).toEqual({
      status: "ready",
      referenceInputs: [
        "blob:flatten-primary",
        "blob:flatten-markup",
        "https://example.com/ref-1.png",
        "https://example.com/ref-2.png",
        "https://example.com/ref-3.png",
      ],
      linkedSecondaryReferenceInputs: [
        "https://example.com/ref-1.png",
        "https://example.com/ref-2.png",
        "https://example.com/ref-3.png",
      ],
      workflowReloadExpertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [
          { slotIndex: 0, referenceInputIndex: 2 },
          { slotIndex: 1, referenceInputIndex: 3 },
          { slotIndex: 2, referenceInputIndex: 4 },
        ],
        restoreSecondarySlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/ref-1.png" },
          { slotIndex: 1, sourceUrl: "https://example.com/ref-2.png" },
          { slotIndex: 2, sourceUrl: "https://example.com/ref-3.png" },
        ],
      },
      promptOverrideOptions: {
        displayPromptOverride: "Apply @main with @img1, @img2, and @img3.",
        submissionPromptOverride: expect.stringContaining(
          "Apply Figure 1 with Figure 3, Figure 4, and Figure 5."
        ),
      },
    });
    if (result.status !== "ready") {
      return;
    }
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 3 = @img1 secondary reference."
    );
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 4 = @img2 secondary reference."
    );
    expect(result.promptOverrideOptions?.submissionPromptOverride).toContain(
      "Figure 5 = @img3 secondary reference."
    );
  });
});
