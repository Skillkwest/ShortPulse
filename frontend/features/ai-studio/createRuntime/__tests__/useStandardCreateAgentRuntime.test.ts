import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStandardCreateAgentRuntime } from "../useStandardCreateAgentRuntime";
import type { AgentAttachment, AgentContext } from "../../../../prefabs/agent";
import { runStandardCreateAgentSend } from "../../hooks/agentOrchestration/runStandardCreateAgentSend";

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
const mockHandleClearAgentAttachments = vi.fn();
const mockHandleAgentAttachmentDrop = vi.fn();
const mockAcceptAgentComposerDropPayload = vi.fn();
const mockHandleClearAgentChat = vi.fn();
const mockResetProjectAgentConversation = vi.fn();
let mockAgentAttachments: AgentAttachment[] = [];

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
    agentAttachments: mockAgentAttachments,
    setAgentAttachments: mockSetAgentAttachments,
    isAgentDropActive: false,
    handleAgentAttachmentDragOver: vi.fn(),
    handleAgentAttachmentDragEnter: vi.fn(),
    handleAgentAttachmentDragLeave: vi.fn(),
    handleAgentAttachmentDrop: mockHandleAgentAttachmentDrop,
    acceptAgentComposerDropPayload: mockAcceptAgentComposerDropPayload,
    handleRemoveAgentAttachment: vi.fn(),
    handleClearAgentAttachments: mockHandleClearAgentAttachments,
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
    getAgentContext: vi.fn((): AgentContext => ({})),
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
    mockHandleClearAgentAttachments.mockReset();
    mockHandleAgentAttachmentDrop.mockReset();
    mockAcceptAgentComposerDropPayload.mockReset();
    mockHandleClearAgentChat.mockReset();
    mockResetProjectAgentConversation.mockReset();
    vi.mocked(runStandardCreateAgentSend).mockReset();
    mockAgentAttachments = [];
  });

  it("clears staged chat attachments when Standard Chat Mode turns off", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setChatModeEnabled(true);
    });
    act(() => {
      result.current.setChatModeEnabled(false);
    });

    expect(mockResetAgentComposer).toHaveBeenCalledWith({
      preserveInput: true,
      preserveAttachments: false,
    });
    expect(result.current.chatModeEnabled).toBe(false);
  });

  it("does not dispatch the Standard agent while Chat Mode is off", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));

    await act(async () => {
      await Promise.resolve();
      await result.current.handleAgentSend();
    });

    expect(runStandardCreateAgentSend).not.toHaveBeenCalled();
  });

  it("blocks direct and event-based attachment intake while Chat Mode is off", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));
    const preventDefault = vi.fn();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.handleAgentAttachmentDrop({ preventDefault } as never);
      result.current.acceptAgentComposerDropPayload({
        kind: "image",
        internalPayload: null,
        composerImagePayload: null,
      });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mockHandleAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(mockAcceptAgentComposerDropPayload).not.toHaveBeenCalled();
  });

  it("preserves attachment intake and agent dispatch while Chat Mode is on", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));
    const payload = {
      kind: "image" as const,
      internalPayload: null,
      composerImagePayload: null,
    };

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.setChatModeEnabled(true);
    });
    await act(async () => {
      result.current.acceptAgentComposerDropPayload(payload);
      await result.current.handleAgentSend();
    });

    expect(mockAcceptAgentComposerDropPayload).toHaveBeenCalledWith(payload);
    expect(runStandardCreateAgentSend).toHaveBeenCalledTimes(1);
  });

  it("revokes callbacks retained from the chat-on render as soon as Chat Mode turns off", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.setChatModeEnabled(true);
    });
    const retainedSend = result.current.handleAgentSend;
    const retainedDirectDrop = result.current.acceptAgentComposerDropPayload;

    await act(async () => {
      result.current.setChatModeEnabled(false);
      retainedDirectDrop({
        kind: "image",
        internalPayload: null,
        composerImagePayload: null,
      });
      await retainedSend();
    });

    expect(mockAcceptAgentComposerDropPayload).not.toHaveBeenCalled();
    expect(runStandardCreateAgentSend).not.toHaveBeenCalled();
  });

  it("keeps an originating send revoked after Chat Mode is turned back on", async () => {
    const { result } = renderHook(() => useStandardCreateAgentRuntime(baseParams));

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.setChatModeEnabled(true);
    });
    await act(async () => {
      await result.current.handleAgentSend();
    });
    const originalAuthorization = vi.mocked(runStandardCreateAgentSend).mock.calls[0]?.[0]
      .isSendAuthorized;
    expect(originalAuthorization?.()).toBe(true);

    act(() => {
      result.current.setChatModeEnabled(false);
    });
    act(() => {
      result.current.setChatModeEnabled(true);
    });

    expect(originalAuthorization?.()).toBe(false);
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

  it("prepares Standard composer for workflow reload without owning the restored prompt write", async () => {
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
      result.current.setChatModeEnabled(true);
      result.current.setPromptOrigin("agent");
    });

    expect(result.current.chatModeEnabled).toBe(true);
    expect(result.current.promptOrigin).toBe("agent");

    act(() => {
      result.current.prepareForWorkflowReload("Restored workflow prompt");
    });

    expect(result.current.chatModeEnabled).toBe(false);
    expect(result.current.promptOrigin).toBe("manual");
    expect(setStandardCreatePrompt).not.toHaveBeenCalledWith("Restored workflow prompt");
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
