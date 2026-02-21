import { describe, expect, it } from "vitest";
import {
  buildAgentPromptReferenceOutput,
  buildPastedMediaReferenceOutput,
  buildPastedPromptReferenceOutput,
} from "../agentReferenceOutputs";

describe("agentReferenceOutputs", () => {
  it("builds agent prompt references with prompt preview metadata", () => {
    const output = buildAgentPromptReferenceOutput({
      id: "prompt-1",
      promptText: "A cinematic portrait",
      aspect: "9:16",
      model: null,
    });

    expect(output.mode).toBe("text");
    expect(output.timestamp).toBe("Agent");
    expect(output.previewText).toBe("A cinematic portrait");
    expect(output.mediaSource).toBe("prompt");
  });

  it("builds pasted prompt references with clipboard timestamp", () => {
    const output = buildPastedPromptReferenceOutput({
      id: "prompt-2",
      promptText: "A moody landscape",
      aspect: "1:1",
      model: "fal-ai/seedream",
    });

    expect(output.mode).toBe("text");
    expect(output.timestamp).toBe("Clipboard");
    expect(output.prompt).toBe("A moody landscape");
  });

  it("builds pasted media output with inferred mode and filename fallback", () => {
    const output = buildPastedMediaReferenceOutput({
      id: "media-1",
      url: "https://cdn.test/media/clip.mp4",
      aspect: "16:9",
      model: null,
    });

    expect(output.mode).toBe("video");
    expect(output.prompt).toBe("clip.mp4");
    expect(output.mediaSource).toBe("clipboard");
    expect(output.previewTier).toBe("preview_loop");
  });
});
