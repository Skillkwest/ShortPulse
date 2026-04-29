import { describe, expect, it } from "vitest";
import { resolveCreateAgentBridgeRuntime } from "../createAgentBridgeRuntime";

describe("resolveCreateAgentBridgeRuntime", () => {
  it("resolves Standard scope and policy defaults", () => {
    const runtime = resolveCreateAgentBridgeRuntime({
      sessionId: "session-1",
      expertCreateMode: "standard",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });

    expect(runtime.kind).toBe("standard");
    expect(runtime.agentBridgeSessionKey).toBe("session-1::standard");
    expect(runtime.standardAgentSessionNamespace).toBe("ai-studio:session-1::standard");
    expect(runtime.hasVisiblePulseSession).toBe(false);
    expect(runtime.defaultRuntimeStateOptions).toBeUndefined();
    expect(runtime.effectiveChatMode(false)).toBe(false);
    expect(runtime.shouldHydrateStandardChatMode).toBe(true);
    expect(runtime.shouldMirrorAssistantPromptToSharedPrompt("create")).toBe(true);
  });

  it("resolves active Pulse scope and forced chat policy", () => {
    const runtime = resolveCreateAgentBridgeRuntime({
      sessionId: "session-1",
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });

    expect(runtime.kind).toBe("pulse");
    expect(runtime.agentBridgeSessionKey).toBe("session-1::pulse:story_builder:pulse-session-1");
    expect(runtime.pulseAgentSessionNamespace).toBe(
      "ai-studio:session-1::pulse:story_builder:pulse-session-1"
    );
    expect(runtime.hasStoredPulseSession).toBe(true);
    expect(runtime.hasVisiblePulseSession).toBe(true);
    expect(runtime.defaultRuntimeStateOptions).toEqual({ forceChatModeEnabled: true });
    expect(runtime.effectiveChatMode(false)).toBe(true);
    expect(runtime.shouldHydrateStandardChatMode).toBe(false);
    expect(runtime.shouldMirrorAssistantPromptToSharedPrompt("create")).toBe(false);
  });

  it("keeps inactive Pulse scope isolated from active Pulse sessions", () => {
    const runtime = resolveCreateAgentBridgeRuntime({
      sessionId: null,
      expertCreateMode: "pulse",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    });

    expect(runtime.kind).toBe("pulse");
    expect(runtime.pulseRuntimeScopeKey).toBe("pulse:inactive");
    expect(runtime.agentBridgeSessionKey).toBe("none::pulse:inactive");
    expect(runtime.hasStoredPulseSession).toBe(false);
    expect(runtime.hasVisiblePulseSession).toBe(false);
  });
});
