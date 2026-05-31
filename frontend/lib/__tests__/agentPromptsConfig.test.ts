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
      agentPrompts.STUDIO_AGENT_THINKER,
      agentPrompts.OPENAI_PROMPT_SYSTEM,
    ];

    activePromptPolicies.forEach((promptPolicy) => {
      expect(promptPolicy).toContain(
        "style+subject -> action/pose -> environment -> lighting -> composition/camera -> texture/color"
      );
      expect(promptPolicy).toContain("40-150 words");
      expect(promptPolicy).toContain('"Colors:"');
      expect(promptPolicy).toContain('"Textures visible:"');
      expect(promptPolicy).toContain('"Summary:"');
      expect(promptPolicy).toContain('"The prompt now includes..."');
      expect(promptPolicy).toContain("editing process");
    });
  });

  it("keeps the Standard runtime on direct-response behavior instead of forced prompt rewriting", () => {
    const standardPrompt = agentPrompts.STUDIO_AGENT_SYSTEM;

    expect(standardPrompt).toContain("Respond directly to the user's request in plain text.");
    expect(standardPrompt).toContain("Prefer structured, readable writing for ordinary replies");
    expect(standardPrompt).toContain("return that prompt as one plain text block paragraph");
    expect(standardPrompt).toContain(
      "Do not rewrite the user's request into a prompt unless they explicitly ask you to do that."
    );
    expect(standardPrompt).not.toContain(
      "style+subject -> action/pose -> environment -> lighting -> composition/camera -> texture/color"
    );
  });

  it("preserves refusal wording constraints", () => {
    expect(agentPrompts.STUDIO_AGENT_SYSTEM).toContain("Refusal text must be exactly:");
    expect(agentPrompts.STUDIO_AGENT_SYSTEM).toContain("I cannot describe this.");
    expect(agentPrompts.OPENAI_PROMPT_SYSTEM).toContain('"I cannot rewrite this."');
  });

  it("requires a hard style class anchor in style extraction output ordering", () => {
    const styleExtractPrompt = agentPrompts.OPENAI_PROMPT_STYLE_EXTRACT;
    expect(styleExtractPrompt).toContain("HARD STYLE CLASS ANCHOR (REQUIRED)");
    expect(styleExtractPrompt).toContain("descriptor #1");
    expect(styleExtractPrompt).toContain("hard style class, descriptor");
  });
});
