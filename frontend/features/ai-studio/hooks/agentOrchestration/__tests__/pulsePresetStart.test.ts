import { describe, expect, it, vi } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../../prefabs/agent";
import {
  resolveCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulsePresetById,
} from "../../../components/create/createPulsePresets";
import { startPulsePreset } from "../pulsePresetStart";
import { restartCreatePulsePreset } from "../../createAgentRuntime/pulsePresetRestart";

const resolvedPreset = resolveCreatePulsePresetById(
  "story_builder",
  [],
  resolveCreatePulseBuiltInPresetDefinitions()
);

if (!resolvedPreset) {
  throw new Error("Expected built-in story_builder Pulse preset for tests.");
}

const buildWorkflowSession = (): AgentPulseWorkflowSession => ({
  presetId: resolvedPreset.presetId,
  status: "awaiting_input",
  currentStepIndex: 1,
  currentStepLabel: "Step 1",
  currentStepPrompt: "Tell me more.",
  collectedInputs: [],
  lastArtifact: null,
  finalArtifactSource: null,
});

describe("pulsePresetStart", () => {
  it("fails closed without late prompt or workflow writes when activation becomes stale", async () => {
    let activationCurrent = true;
    const setLatestAgentPrompt = vi.fn();
    const setSharedPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const trackAgentUiEvent = vi.fn();

    const result = await startPulsePreset({
      preset: resolvedPreset,
      options: {
        deferWorkflowSessionCommit: true,
        activationIsCurrent: () => activationCurrent,
      },
      agentBootstrapReady: true,
      agentIsSending: false,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: null,
      resolvePulseSessionNamespace: vi.fn(() => "ai-studio:session-1::pulse:story_builder:test"),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent: vi.fn(async () => {
        activationCurrent = false;
        return {
          response: { message: "Pulse ready." },
          actions: { applyPrompt: "  Refined pulse prompt  " },
          workflowSession: buildWorkflowSession(),
        };
      }),
      trackAgentUiEvent,
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt,
      setSharedPrompt,
      setPromptOrigin,
    });

    expect(result).toEqual({
      status: "failed",
      reason: "scope_discarded",
      message: "Pulse session changed before kickoff completed. Try again.",
    });
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
    expect(setLatestAgentPrompt).not.toHaveBeenCalled();
    expect(setSharedPrompt).not.toHaveBeenCalled();
    expect(setPromptOrigin).not.toHaveBeenCalled();
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_pulse_start_failed", {
      preset_id: "story_builder",
      reason: "activation_invalidated",
    });
  });
});

describe("pulsePresetRestart", () => {
  it("forwards activation validity into the restarted Pulse kickoff", async () => {
    const activationIsCurrent = vi.fn(() => true);
    const startPulsePresetMock = vi.fn(async () => ({ status: "started" as const }));

    await restartCreatePulsePreset({
      preset: resolvedPreset,
      restartPulse: () => ({
        presetId: resolvedPreset.presetId,
        sessionInstanceId: "pulse-session-restarted",
      }),
      resetAgentChat: vi.fn(),
      resetAgentComposer: vi.fn(),
      setLatestAgentPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
      setPulseWorkflowSession: vi.fn(),
      setUiNotice: vi.fn(),
      trackAgentUiEvent: vi.fn(),
      startPulsePreset: startPulsePresetMock,
      activationIsCurrent,
    });

    expect(startPulsePresetMock).toHaveBeenCalledWith(
      resolvedPreset,
      expect.objectContaining({
        pulseSessionInstanceId: "pulse-session-restarted",
        activationIsCurrent,
      })
    );
  });
});
