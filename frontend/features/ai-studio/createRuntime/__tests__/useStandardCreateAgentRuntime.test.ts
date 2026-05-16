import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStandardCreateAgentRuntime } from "../useStandardCreateAgentRuntime";

const mockSend = vi.fn();
const mockAppendUserMessage = vi.fn();
const mockUpdateMessageById = vi.fn();
const mockReplaceMessages = vi.fn();
const mockResetAgentChat = vi.fn();
const mockHandleAgentInputChange = vi.fn();
const mockSetAgentInput = vi.fn();
const mockSetAgentAttachments = vi.fn();
const mockSetAgentAttachmentError = vi.fn();
const mockResetAgentComposer = vi.fn();
const mockHandleClearAgentChat = vi.fn();
const mockResetProjectAgentConversation = vi.fn();

vi.mock("../../../ai-agent/useCreateAgentStateCore", () => ({
  useCreateAgentStateCore: () => ({
    messages: [],
    isSending: false,
    error: null,
    send: mockSend,
    appendUserMessage: mockAppendUserMessage,
    updateMessageById: mockUpdateMessageById,
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

vi.mock("../../hooks/agentOrchestration/runStandardCreateAgentSend", () => ({
  runStandardCreateAgentSend: vi.fn(),
}));

vi.mock("../../hooks/createAgentRuntime/standardCreateAgentRuntimeBinding", () => ({
  standardCreateAgentRuntimeBinding: {
    buildAgentContext: vi.fn(),
    sendAgentTurn: vi.fn(),
    resolveTransportSuccess: vi.fn(),
  },
}));

vi.mock("../../../ai-agent/client/messageEditing", () => ({
  resolveAssistantMessageEditCommit: vi.fn(),
}));

describe("useStandardCreateAgentRuntime", () => {
  const baseParams = {
    sessionId: "session-1",
    mode: "text" as const,
    selectedTool: "create" as const,
    prompt: "existing prompt",
    projectId: null,
    projectRouteRequested: false,
    getAgentContext: vi.fn(() => ({ messages: [] })),
    setStandardCreatePrompt: vi.fn(),
    addAgentPromptReference: vi.fn(),
    editReferenceText: "",
    setEditReferenceText: vi.fn(),
    videoReferenceText: "",
    setVideoReferenceText: vi.fn(),
    findOutputById: vi.fn(() => null),
    resolvePanelOutputPreviewUrl: vi.fn(() => null),
    resolveInternalImageDropSource: undefined,
    aspect: "9:16",
    model: "seedream",
    setOutputs: vi.fn(),
    setActiveOutputId: vi.fn(),
    setUiNotice: vi.fn(),
    trackAgentUiEvent: vi.fn(),
  };

  beforeEach(() => {
    mockSend.mockReset();
    mockAppendUserMessage.mockReset();
    mockUpdateMessageById.mockReset();
    mockReplaceMessages.mockReset();
    mockResetAgentChat.mockReset();
    mockHandleAgentInputChange.mockReset();
    mockSetAgentInput.mockReset();
    mockSetAgentAttachments.mockReset();
    mockSetAgentAttachmentError.mockReset();
    mockResetAgentComposer.mockReset();
    mockHandleClearAgentChat.mockReset();
    mockResetProjectAgentConversation.mockReset();
  });

  it("mirrors Standard chat composer edits into shared prompt state", async () => {
    const setStandardCreatePrompt = vi.fn();
    const { result } = renderHook(() =>
      useStandardCreateAgentRuntime({
        ...baseParams,
        setStandardCreatePrompt,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.handleAgentInputChange("new visible composer text");
    });

    expect(mockHandleAgentInputChange).toHaveBeenCalledWith("new visible composer text");
    expect(setStandardCreatePrompt).toHaveBeenCalledWith("new visible composer text");
  });

  it("hydrates legacy Standard chat sessions into the visible composer lane", async () => {
    const setStandardCreatePrompt = vi.fn();
    const { result } = renderHook(() =>
      useStandardCreateAgentRuntime({
        ...baseParams,
        setStandardCreatePrompt,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "standard",
          standardPrompt: "Recovered workspace prompt",
        } as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: "Older agent suggestion",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulseSessionInstanceId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
      });
    });

    expect(mockSetAgentInput).toHaveBeenCalledWith("Recovered workspace prompt");
    expect(setStandardCreatePrompt).toHaveBeenCalledWith("Recovered workspace prompt");
  });
});
