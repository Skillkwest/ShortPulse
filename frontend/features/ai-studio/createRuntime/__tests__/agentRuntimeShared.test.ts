/**
 * Shared Create-runtime artifact authority tests.
 * Prevents restored refusal/error metadata from becoming reusable prompt state.
 */
import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../../../prefabs/agent";
import { canUseAssistantMessageAsPrompt } from "../agentRuntimeShared";

const reusableMessage = (overrides: Partial<AgentMessage> = {}): AgentMessage => ({
  role: "assistant",
  content: "Completed prompt",
  outputPrompt: "Completed prompt",
  canUseAsPrompt: true,
  decision: "allow",
  outcomeClass: "success_prompt",
  ...overrides,
});

describe("canUseAssistantMessageAsPrompt", () => {
  it("preserves successful reusable prompt artifacts", () => {
    expect(canUseAssistantMessageAsPrompt(reusableMessage())).toBe(true);
  });

  it.each([
    { decision: "refuse" as const },
    { decision: "error" as const },
    { outcomeClass: "refusal_safety" as const },
    { outcomeClass: "refusal_model" as const },
    { outcomeClass: "upstream_error" as const },
    { outcomeClass: "route_error" as const },
  ])("rejects restored machine failures with stale reusable metadata: %o", (failure) => {
    expect(canUseAssistantMessageAsPrompt(reusableMessage(failure))).toBe(false);
  });
});
