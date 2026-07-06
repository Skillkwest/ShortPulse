import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../../../prefabs/agent";
import { usePulseCreateAgentRuntime } from "../usePulseCreateAgentRuntime";
import { CREATE_PULSE_SCHEMA_VERSION } from "../../components/create/createPulsePresets";
import { runPulsePresetStartRuntime } from "../../hooks/agentOrchestration/runPulsePresetStartRuntime";

const mockSend = vi.fn();
const mockAppendUserMessage = vi.fn();
const mockUpdateMessageById = vi.fn();
const mockRemoveMessageById = vi.fn();
const mockReplaceMessages = vi.fn();
const mockResetAgentChat = vi.fn();
const mockHandleAgentInputChange = vi.fn();
const mockSetAgentInput = vi.fn();
const mockSetAgentAttachments = vi.fn();
const mockSetAgentAttachmentError = vi.fn();
const mockResetAgentComposer = vi.fn();
const mockHandleClearAgentChat = vi.fn();
const mockResetProjectAgentConversation = vi.fn();
let mockAgentMessages: AgentMessage[] = [];

vi.mock("../../../ai-agent/useCreateAgentStateCore", () => ({
  useCreateAgentStateCore: () => ({
    messages: mockAgentMessages,
    isSending: false,
    error: null,
    send: mockSend,
    appendUserMessage: mockAppendUserMessage,
    updateMessageById: mockUpdateMessageById,
    removeMessageById: mockRemoveMessageById,
    replaceMessages: mockReplaceMessages,
    reset: mockResetAgentChat,
  }),
}));

vi.mock("../../hooks/useAiStudioAgentComposer", () => ({
  useAiStudioAgentComposer: () => ({
    agentInput: "",
    setAgentInput: mockSetAgentInput,
    handleAgentInputChange: mockHandleAgentInputChange,
    agentAttachmentError: null,
    setAgentAttachmentError: mockSetAgentAttachmentError,
    agentAttachments: [],
    setAgentAttachments: mockSetAgentAttachments,
    isAgentDropActive: false,
    handleAgentAttachmentDragOver: vi.fn(),
    handleAgentAttachmentDragEnter: vi.fn(),
    handleAgentAttachmentDragLeave: vi.fn(),
    handleAgentAttachmentDrop: vi.fn(),
    acceptAgentComposerDropPayload: vi.fn(),
    handleRemoveAgentAttachment: vi.fn(),
    handleClearAgentAttachments: vi.fn(),
    resetAgentComposer: mockResetAgentComposer,
  }),
}));

vi.mock("../../hooks/useAiStudioAgentInteractions", () => ({
  useAiStudioAgentInteractions: () => ({
    handleClearAgentChat: mockHandleClearAgentChat,
    resetProjectAgentConversation: mockResetProjectAgentConversation,
  }),
}));

vi.mock("../../hooks/createPulsePageRuntime/usePulseWorkflowSessionReconciliation", () => ({
  usePulseWorkflowSessionReconciliation: vi.fn(),
}));

vi.mock("../../hooks/agentOrchestration/runPulseCreateAgentSend", () => ({
  runPulseCreateAgentSend: vi.fn(),
}));

vi.mock("../../hooks/agentOrchestration/runPulsePresetStartRuntime", () => ({
  runPulsePresetStartRuntime: vi.fn(),
}));

vi.mock("../../hooks/createAgentRuntime/pulseCreateAgentRuntimeBinding", () => ({
  pulseCreateAgentRuntimeBinding: {
    buildAgentContext: vi.fn(),
    sendAgentTurn: vi.fn(),
    resolveTransportSuccess: vi.fn(),
  },
}));

vi.mock("../../../ai-agent/client/messageEditing", () => ({
  resolveAssistantMessageEditCommit: vi.fn(),
}));

const runPulsePresetStartRuntimeMock = vi.mocked(runPulsePresetStartRuntime);

describe("usePulseCreateAgentRuntime", () => {
  const baseParams = {
    sessionId: "session-1",
    mode: "text" as const,
    selectedTool: "create" as const,
    prompt: "",
    activePresetSnapshot: null,
    activePresetId: null,
    sessionInstanceId: null,
    workflowSession: null as AgentPulseWorkflowSession | null,
    setWorkflowSession: vi.fn(),
    clearRuntime: vi.fn(),
    restartPulse: vi.fn(),
    getAgentContext: vi.fn((): AgentContext => ({})),
    setPulseCreatePrompt: vi.fn(),
    findOutputById: vi.fn(() => null),
    resolvePanelOutputPreviewUrl: vi.fn(() => null),
    resolveInternalImageDropSource: undefined,
    setUiNotice: vi.fn(),
    trackAgentUiEvent: vi.fn(),
  };

  beforeEach(() => {
    mockSend.mockReset();
    mockAppendUserMessage.mockReset();
    mockUpdateMessageById.mockReset();
    mockRemoveMessageById.mockReset();
    mockReplaceMessages.mockReset();
    mockResetAgentChat.mockReset();
    mockHandleAgentInputChange.mockReset();
    mockSetAgentInput.mockReset();
    mockSetAgentAttachments.mockReset();
    mockSetAgentAttachmentError.mockReset();
    mockResetAgentComposer.mockReset();
    mockHandleClearAgentChat.mockReset();
    mockResetProjectAgentConversation.mockReset();
    runPulsePresetStartRuntimeMock.mockReset();
    mockAgentMessages = [];
  });

  it("appends a recovered starter message when built-in kickoff falls back locally", async () => {
    runPulsePresetStartRuntimeMock.mockResolvedValue({
      status: "started",
      latestAgentPrompt: null,
      starterAssistantMessage: "paste the prompt you want to modify",
    });
    const { result } = renderHook(() => usePulseCreateAgentRuntime(baseParams));

    await act(async () => {
      await result.current.handlePulsePresetStart({
        presetId: "prompt_modifier",
        label: "Prompt Modifier",
        description: "Modify prompts",
        systemInstructions: "You are a prompt modification assistant.",
        pulseKind: "guided_workflow",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "paste the prompt you want to modify",
        workflowStageHints: ["paste the prompt you want to modify"],
        outputMode: "chat_reply",
        artifactTarget: "video_prompt",
        memoryPolicy: "session",
        schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
        isCustom: false,
        isBuiltIn: true,
        isEditable: true,
        hasUserOverride: false,
      });
    });

    expect(mockReplaceMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "assistant",
        content: "paste the prompt you want to modify",
        canUseAsPrompt: false,
      }),
    ]);
  });
});
