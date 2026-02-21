import { describe, expect, it } from "vitest";
import { buildAiStudioAgentContext } from "../agentContextAdapter";

describe("buildAiStudioAgentContext", () => {
  it("defaults to agent-output focus when no selection exists", () => {
    const context = buildAiStudioAgentContext({
      selected: null,
      model: "gpt-test",
      mode: "image",
      lastAssistantMessage: "latest assistant prompt",
      modeHint: "chat",
    });

    expect(context.focusedSource).toBe("agent-output");
    expect(context.activePrompt).toBe("latest assistant prompt");
    expect(context.lastAssistantMessage).toBe("latest assistant prompt");
    expect(context.selectedReferenceIds).toEqual([]);
  });

  it("projects selected image output into media-first context", () => {
    const context = buildAiStudioAgentContext({
      selected: {
        id: "out-1",
        prompt: "silver armor",
        mode: "image",
        aspect: "1:1",
        model: "Seedream",
        status: "ready",
        timestamp: "now",
        previewUrl: "https://cdn.test/image.png",
      },
      model: "gpt-test",
      mode: "image",
    });

    expect(context.focusedSource).toBe("image");
    expect(context.focusedReferenceId).toBe("out-1");
    expect(context.media?.[0]?.url).toBe("https://cdn.test/image.png");
    expect(context.references?.[0]?.promptSnippet).toBe("silver armor");
  });
});
