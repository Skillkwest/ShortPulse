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
const videoPromptPreset = resolveCreatePulsePresetById(
  "image",
  [],
  resolveCreatePulseBuiltInPresetDefinitions()
);

if (!resolvedPreset || !videoPromptPreset) {
  throw new Error("Expected built-in Pulse presets for tests.");
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
  it("allows replacing an active pulse even while the current pulse is busy", async () => {
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Pulse ready." },
      actions: { applyPrompt: "Replacement prompt" },
      workflowSession: buildWorkflowSession(),
    }));
    const setPulseWorkflowSession = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setSharedPrompt = vi.fn();
    const setPromptOrigin = vi.fn();

    const result = await startPulsePreset({
      preset: resolvedPreset,
      options: {
        allowInterruptCurrentPulse: true,
      },
      agentBootstrapReady: true,
      agentIsSending: true,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: "pulse-session-current",
      resolvePulseSessionNamespace: vi.fn(
        () => "ai-studio:session-1::pulse:story_builder:pulse-session-replacement"
      ),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent,
      trackAgentUiEvent: vi.fn(),
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt,
      setSharedPrompt,
      setPromptOrigin,
    });

    expect(result).toEqual({
      status: "started",
      latestAgentPrompt: "Replacement prompt",
    });
    expect(sendToAgent).toHaveBeenCalledTimes(1);
    expect(setLatestAgentPrompt).toHaveBeenCalledWith("Replacement prompt");
    expect(setSharedPrompt).not.toHaveBeenCalled();
    expect(setPromptOrigin).not.toHaveBeenCalled();
    expect(setPulseWorkflowSession).toHaveBeenCalledWith(buildWorkflowSession());
  });

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

  it("starts from the configured starter when a guided kickoff response is blank", async () => {
    const setPulseWorkflowSession = vi.fn();
    const trackAgentUiEvent = vi.fn();

    const result = await startPulsePreset({
      preset: videoPromptPreset,
      options: {
        deferWorkflowSessionCommit: true,
        activationIsCurrent: () => true,
      },
      agentBootstrapReady: true,
      agentIsSending: false,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: null,
      resolvePulseSessionNamespace: vi.fn(() => "ai-studio:session-1::pulse:image:test"),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent: vi.fn(async () => ({
        response: { message: "   " },
        actions: undefined,
        workflowSession: null,
      })),
      trackAgentUiEvent,
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt: vi.fn(),
      setSharedPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
    });

    expect(result).toEqual({
      status: "started",
      latestAgentPrompt: null,
      starterAssistantMessage: videoPromptPreset.starterAssistantMessage,
    });
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        presetId: "image",
        status: "awaiting_input",
        currentStepPrompt: videoPromptPreset.starterAssistantMessage,
      })
    );
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_pulse_start_succeeded", {
      preset_id: "image",
      workflow_status: "awaiting_input",
      has_apply_prompt: false,
      fallback_reason: "starter_workflow_session",
    });
  });

  it("returns the configured starter for recovery when the server kickoff succeeds deterministically", async () => {
    const setPulseWorkflowSession = vi.fn();
    const workflowSession: AgentPulseWorkflowSession = {
      presetId: videoPromptPreset.presetId,
      status: "awaiting_input",
      currentStepIndex: 1,
      currentStepLabel: videoPromptPreset.workflowStageHints?.[0] ?? null,
      currentStepPrompt: videoPromptPreset.starterAssistantMessage,
      collectedInputs: [],
      lastArtifact: null,
      finalArtifactSource: null,
    };

    const result = await startPulsePreset({
      preset: videoPromptPreset,
      options: {
        deferWorkflowSessionCommit: true,
        activationIsCurrent: () => true,
      },
      agentBootstrapReady: true,
      agentIsSending: false,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: null,
      resolvePulseSessionNamespace: vi.fn(() => "ai-studio:session-1::pulse:image:test"),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent: vi.fn(async () => ({
        response: { message: videoPromptPreset.starterAssistantMessage ?? "" },
        actions: undefined,
        workflowSession,
      })),
      trackAgentUiEvent: vi.fn(),
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt: vi.fn(),
      setSharedPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
    });

    expect(result).toEqual({
      status: "started",
      latestAgentPrompt: null,
      starterAssistantMessage: videoPromptPreset.starterAssistantMessage,
    });
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(workflowSession);
  });

  it("starts from the configured starter when a guided kickoff returns no response object", async () => {
    const setPulseWorkflowSession = vi.fn();

    const result = await startPulsePreset({
      preset: videoPromptPreset,
      options: {
        deferWorkflowSessionCommit: true,
        activationIsCurrent: () => true,
      },
      agentBootstrapReady: true,
      agentIsSending: false,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: null,
      resolvePulseSessionNamespace: vi.fn(() => "ai-studio:session-1::pulse:image:test"),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent: vi.fn(async () => ({
        response: null,
        actions: undefined,
        workflowSession: null,
      })),
      trackAgentUiEvent: vi.fn(),
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt: vi.fn(),
      setSharedPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
    });

    expect(result).toEqual({
      status: "started",
      latestAgentPrompt: null,
      starterAssistantMessage: videoPromptPreset.starterAssistantMessage,
    });
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        presetId: "image",
        status: "awaiting_input",
        currentStepPrompt: videoPromptPreset.starterAssistantMessage,
      })
    );
  });

  it("fails closed when a guided kickoff has no response and no starter workflow prompt", async () => {
    const starterlessPreset = {
      ...videoPromptPreset,
      starterAssistantMessage: null,
      workflowStageHints: null,
    };
    const setPulseWorkflowSession = vi.fn();
    const trackAgentUiEvent = vi.fn();

    const result = await startPulsePreset({
      preset: starterlessPreset,
      options: {
        deferWorkflowSessionCommit: true,
        activationIsCurrent: () => true,
      },
      agentBootstrapReady: true,
      agentIsSending: false,
      agentSessionEnabled: true,
      agentUiBusyRef: { current: false },
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      selectedTool: "create",
      pulseSessionInstanceId: null,
      resolvePulseSessionNamespace: vi.fn(() => "ai-studio:session-1::pulse:image:test"),
      getAgentContext: vi.fn(() => ({})),
      notifyBootstrapPending: vi.fn(),
      sendToAgent: vi.fn(async () => ({
        response: { message: "   " },
        actions: undefined,
        workflowSession: null,
      })),
      trackAgentUiEvent,
      setAgentSessionEnabled: vi.fn(),
      setAgentAttachmentError: vi.fn(),
      setAgentUiBusy: vi.fn(),
      setPulseWorkflowSession,
      setLatestAgentPrompt: vi.fn(),
      setSharedPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
    });

    expect(result).toEqual({
      status: "failed",
      reason: "empty_response",
      message: "Unable to start Video Prompt Magic. Pulse returned no kickoff response.",
    });
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_pulse_start_failed", {
      preset_id: "image",
      reason: "empty_response",
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

  it("does not show a restart notice when the restart has already been invalidated", async () => {
    const setUiNotice = vi.fn();
    const startPulsePresetMock = vi.fn(async () => ({ status: "started" as const }));

    await restartCreatePulsePreset({
      preset: resolvedPreset,
      restartPulse: () => null,
      resetAgentChat: vi.fn(),
      resetAgentComposer: vi.fn(),
      setLatestAgentPrompt: vi.fn(),
      setPromptOrigin: vi.fn(),
      setPulseWorkflowSession: vi.fn(),
      setUiNotice,
      trackAgentUiEvent: vi.fn(),
      startPulsePreset: startPulsePresetMock,
      activationIsCurrent: () => false,
    });

    expect(setUiNotice).not.toHaveBeenCalled();
    expect(startPulsePresetMock).not.toHaveBeenCalled();
  });

  it("restores the previous Pulse state when restarted kickoff fails", async () => {
    const previousMessages = [
      {
        id: "assistant-previous",
        role: "assistant" as const,
        content: "Previous Pulse question",
      },
    ];
    const previousWorkflowSession = buildWorkflowSession();
    const restoreAgentMessages = vi.fn();
    const setAgentInput = vi.fn();
    const setAgentAttachments = vi.fn();
    const setAgentAttachmentError = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const setUiNotice = vi.fn();

    await restartCreatePulsePreset({
      preset: resolvedPreset,
      restartPulse: () => ({
        presetId: resolvedPreset.presetId,
        sessionInstanceId: "pulse-session-restarted",
      }),
      resetAgentChat: vi.fn(),
      resetAgentComposer: vi.fn(),
      setLatestAgentPrompt,
      setPromptOrigin,
      setPulseWorkflowSession,
      setUiNotice,
      restoreAgentMessages,
      setAgentInput,
      setAgentAttachments,
      setAgentAttachmentError,
      currentAgentMessages: previousMessages,
      currentAgentInput: "previous draft",
      currentAgentAttachments: [],
      currentAgentAttachmentError: "previous attachment warning",
      currentLatestAgentPrompt: "previous prompt",
      currentPromptOrigin: "agent",
      currentPulseWorkflowSession: previousWorkflowSession,
      trackAgentUiEvent: vi.fn(),
      startPulsePreset: vi.fn(async () => ({
        status: "failed" as const,
        reason: "transport_error" as const,
        message: "Unable to restart Pulse.",
      })),
      activationIsCurrent: () => true,
    });

    expect(restoreAgentMessages).toHaveBeenCalledWith(previousMessages);
    expect(setAgentInput).toHaveBeenCalledWith("previous draft");
    expect(setAgentAttachments).toHaveBeenCalledWith([]);
    expect(setAgentAttachmentError).toHaveBeenCalledWith("previous attachment warning");
    expect(setLatestAgentPrompt).toHaveBeenLastCalledWith("previous prompt");
    expect(setPromptOrigin).toHaveBeenLastCalledWith("agent");
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(previousWorkflowSession);
    expect(setUiNotice).toHaveBeenCalledWith("Unable to restart Pulse.");
  });
});
