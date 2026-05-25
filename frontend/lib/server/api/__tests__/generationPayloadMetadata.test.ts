import { describe, expect, it } from "vitest";
import { resolveGenerationPromptFromPayload } from "../generationPayloadMetadata";

describe("resolveGenerationPromptFromPayload", () => {
  it("prefers the replay display prompt over provider submission prompt text", () => {
    expect(
      resolveGenerationPromptFromPayload("fal-nano-banana-2", {
        prompt: "Apply Figure 1 styling.\n\nReference map:\n- Figure 1 = primary base image.",
        generation_replay: {
          displayPrompt: "Apply @img1 styling.",
          submissionPrompt:
            "Apply Figure 1 styling.\n\nReference map:\n- Figure 1 = primary base image.",
        },
      })
    ).toBe("Apply @img1 styling.");
  });

  it("accepts camelCase replay metadata when present", () => {
    expect(
      resolveGenerationPromptFromPayload("fal-nano-banana-2", {
        prompt: "Compiled submission prompt",
        generationReplay: {
          displayPrompt: "Visible prompt",
        },
      })
    ).toBe("Visible prompt");
  });
});
