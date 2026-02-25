import { describe, expect, it } from "vitest";
import { agentPrompts } from "../agentPromptsConfig";

describe("agentPromptsConfig", () => {
  it("keeps formatter prompt on apply_prompt-only action contract", () => {
    const formatterPrompt = agentPrompts.STUDIO_AGENT_FORMATTER;

    expect(formatterPrompt).toContain('"apply_prompt"');
    expect(formatterPrompt).not.toContain('"variations"');
    expect(formatterPrompt).not.toContain('"describe_targets"');
    expect(formatterPrompt).not.toContain('"reference_card"');
  });

  it("keeps ordered prompt-structure policy across active prompt paths", () => {
    const activePromptPolicies = [
      agentPrompts.STUDIO_AGENT_SYSTEM,
      agentPrompts.STUDIO_AGENT_THINKER,
      agentPrompts.OPENAI_PROMPT_SYSTEM,
    ];

    activePromptPolicies.forEach((promptPolicy) => {
      expect(promptPolicy).toContain(
        "style+subject -> action/pose -> environment -> lighting -> composition/camera -> texture/color"
      );
      expect(promptPolicy).toContain("photorealistic editorial");
      expect(promptPolicy).toContain("40-90 words");
      expect(promptPolicy).toContain('"Colors:"');
      expect(promptPolicy).toContain('"Textures visible:"');
      expect(promptPolicy).toContain('"Summary:"');
      expect(promptPolicy).toContain('"The prompt now includes..."');
    });
  });

  it("preserves refusal wording constraints", () => {
    expect(agentPrompts.STUDIO_AGENT_SYSTEM).toContain("Refusal text must be exactly:");
    expect(agentPrompts.STUDIO_AGENT_SYSTEM).toContain("I cannot describe this.");
    expect(agentPrompts.OPENAI_PROMPT_SYSTEM).toContain('"I cannot rewrite this."');
  });
});
