import { describe, expect, it } from "vitest";
import {
  EXPERT_EDIT_PROMPT_TOKEN_TRANSFER_MIME,
  analyzeExpertEditPromptTokens,
  buildExpertEditSubmissionReferenceInputs,
  buildExpertEditPromptHighlightSegments,
  compileExpertEditSubmissionPrompt,
  extractExpertEditPromptTokenFromTransfer,
  insertExpertEditPromptTokenAtSelection,
  resolveExpertEditPromptTokenSlotIndex,
  setExpertEditPromptTokenDragData,
} from "../expertEditPromptReferences";

const createTransfer = (seed?: Record<string, string>) => {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? "",
  } as unknown as DataTransfer;
};

describe("expertEditPromptReferences", () => {
  it("detects valid @img1..@img3 tokens when corresponding slots are populated", () => {
    const analysis = analyzeExpertEditPromptTokens("Use @img1 and @img3.", [
      "https://example.com/a.png",
      null,
      "https://example.com/c.png",
    ]);

    expect(analysis.hasTokenReferences).toBe(true);
    expect(analysis.hasInvalidTokens).toBe(false);
    expect(analysis.referencedSlotIndexes).toEqual([0, 2]);
    expect(analysis.inlineError).toBeNull();
  });

  it("flags invalid tokens for missing index, out of range, and empty slots", () => {
    const missingIndex = analyzeExpertEditPromptTokens("Apply @img to the background.", [
      "https://example.com/a.png",
      null,
      null,
    ]);
    expect(missingIndex.hasInvalidTokens).toBe(true);
    expect(missingIndex.inlineError).toMatch(/Use @img1, @img2, or @img3/i);

    const outOfRange = analyzeExpertEditPromptTokens("Use @img4 for hair.", [
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ]);
    expect(outOfRange.hasInvalidTokens).toBe(true);
    expect(outOfRange.inlineError).toMatch(/out of range/i);

    const emptySlot = analyzeExpertEditPromptTokens("Use @img2 for hair.", [
      "https://example.com/a.png",
      null,
      "https://example.com/c.png",
    ]);
    expect(emptySlot.hasInvalidTokens).toBe(true);
    expect(emptySlot.inlineError).toMatch(/slot 2/i);
  });

  it("builds highlight segments for plain, valid-token, and invalid-token text", () => {
    const analysis = analyzeExpertEditPromptTokens("Blend @img1 then @img4.", [
      "https://example.com/a.png",
      null,
      null,
    ]);
    const segments = buildExpertEditPromptHighlightSegments(
      "Blend @img1 then @img4.",
      analysis.diagnostics
    );

    expect(segments.map((segment) => segment.kind)).toEqual([
      "plain",
      "valid-token",
      "plain",
      "invalid-token",
      "plain",
    ]);
    expect(segments[1]?.text).toBe("@img1");
    expect(segments[3]?.text).toBe("@img4");
  });

  it("compiles tokenized prompts to figure references and appends mapping", () => {
    const compiled = compileExpertEditSubmissionPrompt({
      displayPrompt: "Put @img2 in the background. Match @img1 hair.",
      secondarySlots: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
      referenceInputs: [
        "https://example.com/primary.png",
        "https://example.com/slot-1.png",
        "https://example.com/slot-2.png",
      ],
    });

    expect(compiled.hasTokenReferences).toBe(true);
    expect(compiled.submissionPrompt).toContain("Put Figure 3 in the background.");
    expect(compiled.submissionPrompt).toContain("Match Figure 2 hair.");
    expect(compiled.submissionPrompt).toContain("Reference map:");
    expect(compiled.submissionPrompt).toContain("Figure 1 = primary base image.");
    expect(compiled.submissionPrompt).toContain("Figure 2 = @img1 secondary reference.");
    expect(compiled.submissionPrompt).toContain("Figure 3 = @img2 secondary reference.");
    expect(compiled.submissionPrompt).toContain(
      "Treat all secondary references as edits to Figure 1 unless explicitly overridden."
    );
  });

  it("builds submission reference inputs from the primary image and explicitly linked secondary slots only", () => {
    const inputs = buildExpertEditSubmissionReferenceInputs({
      flattenedPrimaryUrl: "https://example.com/flattened-primary.png",
      flattenedMarkupReferenceUrl: "https://example.com/flattened-markup.png",
      secondarySlots: [
        "https://example.com/slot-1.png",
        "https://example.com/slot-2.png",
        "https://example.com/slot-3.png",
      ],
      referencedSlotIndexes: [1],
    });

    expect(inputs).toEqual([
      "https://example.com/flattened-primary.png",
      "https://example.com/flattened-markup.png",
      "https://example.com/slot-2.png",
    ]);
  });

  it("keeps figure mapping stable with missing middle slot and duplicate urls", () => {
    const compiled = compileExpertEditSubmissionPrompt({
      displayPrompt: "Use @img1 and @img3.",
      secondarySlots: ["https://example.com/shared.png", null, "https://example.com/shared.png"],
      referenceInputs: ["https://example.com/primary.png", "https://example.com/shared.png"],
    });

    expect(compiled.submissionPrompt).toContain("Use Figure 2 and Figure 2.");
    expect(compiled.submissionPrompt).toContain("Figure 2 = @img1 secondary reference.");
    expect(compiled.submissionPrompt).toContain("Figure 2 = @img3 secondary reference.");
  });

  it("extracts and sets drag token payloads for secondary slots", () => {
    const transfer = createTransfer();
    const token = setExpertEditPromptTokenDragData(transfer, 1);
    expect(token).toBe("@img2");
    expect(transfer.getData(EXPERT_EDIT_PROMPT_TOKEN_TRANSFER_MIME)).toBe("@img2");
    expect(transfer.getData("text/plain")).toBe("@img2");
    expect(extractExpertEditPromptTokenFromTransfer(transfer)).toBe("@img2");
    expect(resolveExpertEditPromptTokenSlotIndex("@img2")).toBe(1);
  });

  it("inserts token at selection with spacing-safe behavior", () => {
    const inserted = insertExpertEditPromptTokenAtSelection({
      prompt: "Place subject here",
      token: "@img1",
      selectionStart: 6,
      selectionEnd: 13,
    });

    expect(inserted.prompt).toBe("Place @img1 here");
    expect(inserted.caret).toBe("Place @img1".length);
  });
});
