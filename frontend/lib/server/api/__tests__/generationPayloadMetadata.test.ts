import { describe, expect, it } from "vitest";
import { resolveGenerationPromptFromPayload } from "../generationPayloadMetadata";
import {
  HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS,
  VIDEO_SHOT_MODE_PROMPT_SEPARATOR,
} from "../../../model-runtime/videoShotModePromptVisibility";

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

  it("prefers workflow reload display prompt over hidden video shot-mode payload text", () => {
    const providerPrompt = `${HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS.seedance.single}${VIDEO_SHOT_MODE_PROMPT_SEPARATOR}A flooded fantasy stage performance`;

    expect(
      resolveGenerationPromptFromPayload("kie-seedance-2", {
        prompt: providerPrompt,
        workflow_reload: {
          prompt: {
            display: "A flooded fantasy stage performance",
            submission: providerPrompt,
          },
        },
      })
    ).toBe("A flooded fantasy stage performance");
  });

  it("strips hidden video shot-mode prefixes when provider prompt is the only fallback", () => {
    const providerPrompt = `${HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS.kling.multi}${VIDEO_SHOT_MODE_PROMPT_SEPARATOR}A neon rooftop chase`;

    expect(
      resolveGenerationPromptFromPayload("kie-kling-submit", {
        prompt: providerPrompt,
      })
    ).toBe("A neon rooftop chase");
  });
});
