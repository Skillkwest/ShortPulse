import { describe, expect, it } from "vitest";
import { resolveCreateAgentOrchestrationRuntimePolicy } from "../createAgentOrchestrationRuntimePolicy";
import type { AgentContext } from "../../../../../prefabs/agent";

describe("resolveCreateAgentOrchestrationRuntimePolicy", () => {
  it("keeps Standard orchestration closed to Pulse context and workflow state", () => {
    const policy = resolveCreateAgentOrchestrationRuntimePolicy({
      expertCreateMode: "standard",
      activePulsePresetId: "custom-pulse",
      pulseSessionInstanceId: "pulse-session-1",
    });
    const context: AgentContext = {
      pulse: {
        presetId: "custom-pulse",
        label: "Custom Pulse",
        instructions: "custom user instructions",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
        source: "custom",
      },
    };

    expect(policy.kind).toBe("standard");
    expect(policy.includeActiveOutput).toBe(false);
    expect(policy.resolveSelectedOverride(undefined)).toBeNull();
    expect(policy.resolveWorkflowPulse(context)).toBeNull();
    expect(policy.hasPromptApplyPulseContext(context)).toBe(false);
  });

  it("opens Pulse orchestration only when an active Pulse session exists", () => {
    const policy = resolveCreateAgentOrchestrationRuntimePolicy({
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });
    const context: AgentContext = {
      pulse: {
        presetId: "story_builder",
        label: "DFY Story Builder",
        instructions: "workflow instructions",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
        source: "builtin",
      },
    };

    expect(policy.kind).toBe("pulse");
    expect(policy.hasActivePulseSession).toBe(true);
    expect(policy.includeActiveOutput).toBe(true);
    expect(policy.resolveSelectedOverride(undefined)).toBeUndefined();
    expect(policy.resolveWorkflowPulse(context)?.presetId).toBe("story_builder");
    expect(policy.hasPromptApplyPulseContext(context)).toBe(true);
  });
});
