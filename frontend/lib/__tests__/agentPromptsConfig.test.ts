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
});
