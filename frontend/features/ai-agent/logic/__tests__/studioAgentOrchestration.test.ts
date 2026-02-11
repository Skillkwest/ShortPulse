/**
 * Tests deterministic orchestration flow classification for the studio-agent route.
 */
import { describe, expect, it } from "vitest";
import { buildStudioAgentOrchestration } from "../studioAgentOrchestration";

describe("buildStudioAgentOrchestration", () => {
  it("classifies text-only turns when there is no media context", () => {
    const orchestration = buildStudioAgentOrchestration({
      context: {},
      messages: [{ role: "user", content: "a futuristic city in heavy rain" }],
      selectedReferences: [],
      effectiveCanonical: null,
    });

    expect(orchestration.flow).toBe("TEXT_ONLY");
    expect(orchestration.shouldRunTextExpansion).toBe(true);
    expect(orchestration.shouldRunVisionDescription).toBe(false);
    expect(orchestration.shouldRunFusion).toBe(false);
    expect(orchestration.contextType).toBe("chat");
  });

  it("classifies image-only describe requests when text is directive-only", () => {
    const orchestration = buildStudioAgentOrchestration({
      context: {
        media: [{ id: "img-1", kind: "image", url: "https://example.com/image.png" }],
      },
      messages: [{ role: "user", content: "Describe this image" }],
      selectedReferences: [
        {
          id: "img-1",
          kind: "image",
          promptSnippet: null,
          caption: null,
          aspect: null,
        },
      ],
      effectiveCanonical: null,
    });

    expect(orchestration.flow).toBe("IMAGE_ONLY");
    expect(orchestration.shouldRunTextExpansion).toBe(false);
    expect(orchestration.shouldRunVisionDescription).toBe(true);
    expect(orchestration.shouldRunFusion).toBe(false);
    expect(orchestration.contextType).toBe("image");
  });

  it("classifies mixed turns when media is present with substantive text", () => {
    const orchestration = buildStudioAgentOrchestration({
      context: {
        media: [{ id: "img-1", kind: "image", url: "https://example.com/image.png" }],
      },
      messages: [{ role: "user", content: "Keep the pose but switch wardrobe to silver armor." }],
      selectedReferences: [
        {
          id: "img-1",
          kind: "image",
          promptSnippet: null,
          caption: null,
          aspect: null,
        },
      ],
      effectiveCanonical: "hero portrait in red outfit",
    });

    expect(orchestration.flow).toBe("MIXED");
    expect(orchestration.shouldRunTextExpansion).toBe(true);
    expect(orchestration.shouldRunVisionDescription).toBe(true);
    expect(orchestration.shouldRunFusion).toBe(true);
    expect(orchestration.textInput).toContain("switch wardrobe");
  });
});
