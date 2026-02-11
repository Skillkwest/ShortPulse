import type { AgentContext } from "../../../../prefabs/agent";
import { pickSelectedReferencesForThinker } from "../studioAgentReferenceSelection";

const baseContext: AgentContext = {
  references: [
    {
      id: "ref-image-1",
      kind: "image",
      promptSnippet: "first image prompt",
      caption: "first caption",
      aspect: "9:16",
    },
    {
      id: "ref-prompt-2",
      kind: "prompt",
      promptSnippet: "second prompt text",
      caption: null,
      aspect: null,
    },
    {
      id: "ref-image-3",
      kind: "image",
      promptSnippet: "third image prompt",
      caption: "third caption",
      aspect: "1:1",
    },
  ],
};

describe("pickSelectedReferencesForThinker", () => {
  it("prioritizes selectedReferenceIds when provided", () => {
    const selected = pickSelectedReferencesForThinker({
      ...baseContext,
      selectedReferenceIds: ["ref-prompt-2", "ref-image-3"],
      modeHint: "reference",
    });
    expect(selected.map((item) => item.id)).toEqual(["ref-prompt-2", "ref-image-3"]);
  });

  it("falls back to focusedReferenceId when nothing is explicitly selected", () => {
    const selected = pickSelectedReferencesForThinker({
      ...baseContext,
      selectedReferenceIds: [],
      focusedReferenceId: "ref-image-3",
    });
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("ref-image-3");
  });

  it("falls back to top references when modeHint is reference", () => {
    const selected = pickSelectedReferencesForThinker({
      ...baseContext,
      selectedReferenceIds: [],
      focusedReferenceId: null,
      modeHint: "reference",
    });
    expect(selected).toHaveLength(3);
    expect(selected[0]?.id).toBe("ref-image-1");
  });

  it("clips long prompt/caption text", () => {
    const longText = "x".repeat(500);
    const selected = pickSelectedReferencesForThinker({
      references: [
        {
          id: "ref-long",
          kind: "prompt",
          promptSnippet: longText,
          caption: longText,
          aspect: null,
        },
      ],
      modeHint: "reference",
    });
    expect(selected[0]?.promptSnippet?.length).toBe(320);
    expect(selected[0]?.caption?.length).toBe(320);
    expect(selected[0]?.promptSnippet?.endsWith("…")).toBe(true);
  });
});
