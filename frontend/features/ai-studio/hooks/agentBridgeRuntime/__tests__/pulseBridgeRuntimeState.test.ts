import { describe, expect, it } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../../prefabs/agent";
import {
  pruneInactivePulseBridgeRuntimeStates,
  resolvePulseAgentSessionNamespace,
  resolvePulseWorkflowArtifactPrompt,
} from "../pulseBridgeRuntimeState";

describe("pulseBridgeRuntimeState", () => {
  it("builds pending and concrete Pulse agent namespaces", () => {
    expect(
      resolvePulseAgentSessionNamespace({
        sessionId: "session-1",
        presetId: "story_builder",
      })
    ).toBe("ai-studio:session-1::pulse:story_builder:pending");
    expect(
      resolvePulseAgentSessionNamespace({
        sessionId: null,
        presetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-1",
      })
    ).toBe("ai-studio:none::pulse:story_builder:pulse-session-1");
  });

  it("prunes stale Pulse state entries while preserving Standard and active Pulse state", () => {
    const current = {
      "session-1::standard": "standard-state",
      "session-1::pulse:story_builder:pulse-session-1": "active-pulse-state",
      "session-1::pulse:story_builder:pulse-session-old": "stale-pulse-state",
      "other-session::pulse:story_builder:pulse-session-old": "other-session-pulse-state",
    };

    expect(
      pruneInactivePulseBridgeRuntimeStates({
        current,
        sessionId: "session-1",
        hasStoredPulseSession: true,
        pulseRuntimeScopeKey: "pulse:story_builder:pulse-session-1",
      })
    ).toEqual({
      "session-1::standard": "standard-state",
      "session-1::pulse:story_builder:pulse-session-1": "active-pulse-state",
      "other-session::pulse:story_builder:pulse-session-old": "other-session-pulse-state",
    });
  });

  it("returns the current Pulse artifact only for visible Pulse sessions", () => {
    const workflowSession: AgentPulseWorkflowSession = {
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 3,
      currentStepLabel: "Final",
      currentStepPrompt: null,
      collectedInputs: [],
      lastArtifact: "  final pulse prompt  ",
      finalArtifactSource: "apply_prompt",
    };

    expect(
      resolvePulseWorkflowArtifactPrompt({
        hasVisiblePulseSession: true,
        pulseWorkflowSession: workflowSession,
      })
    ).toBe("final pulse prompt");
    expect(
      resolvePulseWorkflowArtifactPrompt({
        hasVisiblePulseSession: false,
        pulseWorkflowSession: workflowSession,
      })
    ).toBeNull();
  });
});
