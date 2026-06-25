import { describe, expect, it, vi } from "vitest";
import { buildPulseCreateRuntimeResult } from "../buildPulseCreateRuntimeResult";
import type {
  PulseCreateAgentRuntimeActions,
  PulseCreateAgentRuntimeState,
  PulseCreateRuntimeProps,
} from "../contracts";

describe("buildPulseCreateRuntimeResult", () => {
  it("preserves active Pulse session props for the rendered panel", () => {
    const workflowSession = {
      sessionId: "workflow-session-1",
      presetId: "pulse_custom_video",
      stage: "started",
    } as never;
    const props: PulseCreateRuntimeProps = {
      pulsePrompt: "Prompt",
      hasActiveSession: true,
      activePresetId: "pulse_custom_video",
      activePresetLabel: "Custom Video Pulse",
      activePresetKind: "custom_gpt",
      workflowSession,
      createIsGenerating: false,
      onPulsePromptChange: vi.fn(),
      onActivePresetIdChange: vi.fn(),
    };
    const agentRuntime: PulseCreateAgentRuntimeState = {
      agentEnabled: true,
      agentBootstrapReady: true,
      agentMessages: [],
      agentInput: "",
      agentBusy: false,
      agentIsSending: false,
      agentUiBusy: false,
      agentAttachmentError: null,
      agentAttachments: [],
      isAgentDropActive: false,
      workflowSession,
      persistedAgentRuntime: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: workflowSession,
      },
    };
    const actions: PulseCreateAgentRuntimeActions = {
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      onAgentAttachmentDrop: vi.fn(),
      onAgentAttachmentDragOver: vi.fn(),
      onAgentAttachmentDragEnter: vi.fn(),
      onAgentAttachmentDragLeave: vi.fn(),
      onAgentComposerDirectDrop: vi.fn(),
      onRemoveAgentAttachment: vi.fn(),
      onClearAgentAttachments: vi.fn(),
      onAssistantMessageEdit: vi.fn(),
      onClearAgentChat: vi.fn(),
      onPresetRestart: vi.fn(async () => undefined),
      onPresetStart: vi.fn(async () => ({ status: "started" as const })),
    };

    const result = buildPulseCreateRuntimeResult({ props, agentRuntime, actions });

    expect(result.panelProps.activePulsePresetId).toBe("pulse_custom_video");
    expect(result.panelProps.activePulsePresetLabel).toBe("Custom Video Pulse");
    expect(result.panelProps.activePulsePresetKind).toBe("custom_gpt");
    expect(result.panelProps.hasActivePulseSession).toBe(true);
    expect(result.panelProps.pulseWorkflowSession).toBe(workflowSession);
    expect(result.panelProps.onActivePulsePresetIdChange).toBe(props.onActivePresetIdChange);
    expect(result.panelProps.onPulsePresetStart).toBe(actions.onPresetStart);
  });
});
