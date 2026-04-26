import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioAgentBridge } from "../useAiStudioAgentBridge";
import type { AgentActions } from "../../../../prefabs/agent";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { StudioMode, ToolId, StudioOutput } from "../../types";
import { readChatModeFromStorage } from "../../logic/chatModePreference";

const useAiAgentMock = vi.fn();
const useAiStudioAgentComposerMock = vi.fn();
const useAiStudioAgentOrchestrationMock = vi.fn();
const useAiStudioAgentInteractionsMock = vi.fn();

vi.mock("../../../ai-agent/useAiAgent", () => ({
  useAiAgent: (...args: unknown[]) => useAiAgentMock(...args),
}));

vi.mock("../useAiStudioAgentComposer", () => ({
  useAiStudioAgentComposer: (...args: unknown[]) => useAiStudioAgentComposerMock(...args),
}));

vi.mock("../useAiStudioAgentOrchestration", () => ({
  useAiStudioAgentOrchestration: (...args: unknown[]) => useAiStudioAgentOrchestrationMock(...args),
}));

vi.mock("../useAiStudioAgentInteractions", () => ({
  useAiStudioAgentInteractions: (...args: unknown[]) => useAiStudioAgentInteractionsMock(...args),
}));

vi.mock("../../logic/chatModePreference", () => ({
  readChatModeFromStorage: vi.fn(() => true),
  writeChatModeToStorage: vi.fn(),
}));

const readChatModeFromStorageMock = vi.mocked(readChatModeFromStorage);

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createBridgeParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentBridge>[0]> = {}
): Parameters<typeof useAiStudioAgentBridge>[0] => ({
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  mode: "text",
  selectedTool: "create",
  expertCreateMode: "standard",
  activePulsePresetId: null,
  prompt: "",
  setSharedPrompt: vi.fn(),
  getAgentContext: vi.fn(() => ({})),
  addAgentPromptReference: vi.fn(),
  editReferenceText: "",
  setEditReferenceText: vi.fn(),
  videoReferenceText: "",
  setVideoReferenceText: vi.fn(),
  findOutputById: vi.fn(() => null),
  resolvePanelOutputPreviewUrl: vi.fn(() => null),
  aspect: "1:1",
  model: null,
  setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  setUiNotice: asDispatch<string | null>(vi.fn()),
  setPulseWorkflowSession: asDispatch(vi.fn()),
  trackAgentUiEvent: vi.fn(),
  ...overrides,
});

describe("useAiStudioAgentBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("clears staged attachments when session context changes", async () => {
    const resetAgentComposer = vi.fn();
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;
    let setAgentActionsFromInteractions:
      | Dispatch<SetStateAction<AgentActions | undefined>>
      | undefined;
    let setIsAgentChatOpenFromInteractions: Dispatch<SetStateAction<boolean>> | undefined;

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer,
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockImplementation((params) => {
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      setPromptOriginFromInteractions = params.setPromptOrigin;
      setAgentActionsFromInteractions = params.setAgentActions;
      setIsAgentChatOpenFromInteractions = params.setIsAgentChatOpen;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleExpandChat: vi.fn(),
        handleAgentAddToGrid: vi.fn(),
        handleClearAgentChat: vi.fn(),
        handleCloseAgentChat: vi.fn(),
      };
    });

    const base = createBridgeParams();
    const { result, rerender } = renderHook(
      ({
        sessionId,
        mode,
        selectedTool,
      }: {
        sessionId: string | null;
        mode: StudioMode;
        selectedTool: ToolId | null;
      }) =>
        useAiStudioAgentBridge({
          ...base,
          sessionId,
          mode,
          selectedTool,
        }),
      {
        initialProps: {
          sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          mode: "text" as StudioMode,
          selectedTool: "create" as ToolId,
        },
      }
    );

    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(1);
    });
    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
      expect(setAgentActionsFromInteractions).toBeDefined();
      expect(setIsAgentChatOpenFromInteractions).toBeDefined();
    });

    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
    expect(result.current.agentActions).toBeUndefined();
    expect(result.current.isAgentChatOpen).toBe(false);

    act(() => {
      setLatestAgentPromptFromInteractions?.("Applied prompt");
      setPromptOriginFromInteractions?.("agent");
      setAgentActionsFromInteractions?.({ applyPrompt: "Applied prompt" } as AgentActions);
      setIsAgentChatOpenFromInteractions?.(true);
    });

    expect(result.current.latestAgentPrompt).toBe("Applied prompt");
    expect(result.current.promptOrigin).toBe("agent");
    expect(result.current.agentActions).toEqual({ applyPrompt: "Applied prompt" });
    expect(result.current.isAgentChatOpen).toBe(true);

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "create" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(2);
    });
    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
    expect(result.current.agentActions).toBeUndefined();
    expect(result.current.isAgentChatOpen).toBe(false);

    act(() => {
      setLatestAgentPromptFromInteractions?.("Persist across tool switch");
      setPromptOriginFromInteractions?.("agent");
      setAgentActionsFromInteractions?.({
        applyPrompt: "Persist across tool switch",
      } as AgentActions);
      setIsAgentChatOpenFromInteractions?.(true);
    });

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(3);
    });
    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBe("Persist across tool switch");
    expect(result.current.promptOrigin).toBe("agent");
    expect(result.current.agentActions).toEqual({ applyPrompt: "Persist across tool switch" });
    expect(result.current.isAgentChatOpen).toBe(true);

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(4);
    });
    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBe("Persist across tool switch");
    expect(result.current.promptOrigin).toBe("agent");
    expect(result.current.agentActions).toEqual({ applyPrompt: "Persist across tool switch" });
    expect(result.current.isAgentChatOpen).toBe(true);

    resetAgentComposer.mock.calls.forEach((args) => {
      expect(args[0]).toEqual({ preserveInput: true, preserveAttachments: false });
    });
  });

  it("reports bootstrap readiness from session identity availability", () => {
    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
      handlePulsePresetStart: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const base = createBridgeParams({ sessionId: null });
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) =>
        useAiStudioAgentBridge({
          ...base,
          sessionId,
        }),
      {
        initialProps: { sessionId: null },
      }
    );

    expect(result.current.agentBootstrapReady).toBe(false);

    rerender({ sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a" });

    expect(result.current.agentBootstrapReady).toBe(true);
  });

  it("enables direct OpenAI bypass automatically when the backend gate is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED", "true");

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ directOpenAiBypassEnabled: true })
    );
    expect(result.current.directOpenAiBypassEnabled).toBe(true);
  });

  it("disables direct OpenAI bypass while Pulse mode is active", async () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED", "true");

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
        })
      )
    );

    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ directOpenAiBypassEnabled: false })
    );
    expect(result.current.directOpenAiBypassEnabled).toBe(false);
  });

  it("restores Standard-owned bridge state after returning from Pulse mode", async () => {
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;
    let setAgentActionsFromInteractions:
      | Dispatch<SetStateAction<AgentActions | undefined>>
      | undefined;
    let setIsAgentChatOpenFromInteractions: Dispatch<SetStateAction<boolean>> | undefined;

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockImplementation((params) => {
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      setPromptOriginFromInteractions = params.setPromptOrigin;
      setAgentActionsFromInteractions = params.setAgentActions;
      setIsAgentChatOpenFromInteractions = params.setIsAgentChatOpen;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleExpandChat: vi.fn(),
        handleAgentAddToGrid: vi.fn(),
        handleClearAgentChat: vi.fn(),
        handleCloseAgentChat: vi.fn(),
      };
    });

    const base = createBridgeParams();
    const bridgeModeProps: {
      expertCreateMode: "standard" | "pulse";
      activePulsePresetId: string | null;
    } = {
      expertCreateMode: "standard",
      activePulsePresetId: null,
    };

    const { result, rerender } = renderHook(
      ({
        expertCreateMode,
        activePulsePresetId,
      }: {
        expertCreateMode: "standard" | "pulse";
        activePulsePresetId: string | null;
      }) =>
        useAiStudioAgentBridge({
          ...base,
          expertCreateMode,
          activePulsePresetId,
        }),
      {
        initialProps: bridgeModeProps,
      }
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
      expect(setAgentActionsFromInteractions).toBeDefined();
      expect(setIsAgentChatOpenFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Standard prompt");
      setPromptOriginFromInteractions?.("agent");
      setAgentActionsFromInteractions?.({ applyPrompt: "Standard prompt" } as AgentActions);
      setIsAgentChatOpenFromInteractions?.(true);
    });

    expect(result.current.latestAgentPrompt).toBe("Standard prompt");
    expect(result.current.promptOrigin).toBe("agent");
    expect(result.current.agentActions).toEqual({ applyPrompt: "Standard prompt" });
    expect(result.current.isAgentChatOpen).toBe(true);

    rerender({
      expertCreateMode: "pulse" as const,
      activePulsePresetId: "story_builder",
    });

    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::pulse:story_builder",
      })
    );
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
    expect(result.current.agentActions).toBeUndefined();
    expect(result.current.isAgentChatOpen).toBe(false);

    act(() => {
      setLatestAgentPromptFromInteractions?.("Pulse prompt");
      setPromptOriginFromInteractions?.("agent");
      setAgentActionsFromInteractions?.({ applyPrompt: "Pulse prompt" } as AgentActions);
      setIsAgentChatOpenFromInteractions?.(true);
    });

    expect(result.current.latestAgentPrompt).toBe("Pulse prompt");

    rerender({
      expertCreateMode: "standard" as const,
      activePulsePresetId: null,
    });

    expect(useAiAgentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBe("Standard prompt");
    expect(result.current.promptOrigin).toBe("agent");
    expect(result.current.agentActions).toEqual({ applyPrompt: "Standard prompt" });
    expect(result.current.isAgentChatOpen).toBe(true);
  });

  it("does not rehydrate stale Standard history over a newly arrived assistant response", async () => {
    const replaceMessages = vi.fn();
    let setAgentActionsFromInteractions:
      | Dispatch<SetStateAction<AgentActions | undefined>>
      | undefined;
    let currentMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];

    useAiAgentMock.mockImplementation(() => ({
      messages: currentMessages,
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages,
      reset: vi.fn(),
    }));
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockImplementation((params) => {
      setAgentActionsFromInteractions = params.setAgentActions;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleExpandChat: vi.fn(),
        handleAgentAddToGrid: vi.fn(),
        handleClearAgentChat: vi.fn(),
        handleCloseAgentChat: vi.fn(),
      };
    });

    const { rerender } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    await waitFor(() => {
      expect(replaceMessages).toHaveBeenCalledWith([]);
      expect(setAgentActionsFromInteractions).toBeDefined();
    });

    replaceMessages.mockClear();
    currentMessages = [{ id: "user-1", role: "user", content: "Make it cinematic." }];
    rerender();

    await waitFor(() => {
      expect(replaceMessages).toHaveBeenLastCalledWith(currentMessages);
    });

    replaceMessages.mockClear();
    currentMessages = [
      { id: "user-1", role: "user", content: "Make it cinematic." },
      { id: "assistant-1", role: "assistant", content: "Cinematic golden-hour portrait." },
    ];
    rerender();

    act(() => {
      setAgentActionsFromInteractions?.({
        applyPrompt: "Cinematic golden-hour portrait.",
      } as AgentActions);
    });

    await waitFor(() => {
      expect(replaceMessages).toHaveBeenCalled();
      expect(replaceMessages).toHaveBeenLastCalledWith(currentMessages);
    });
  });

  it("restarts an active Pulse without clearing Pulse ownership", async () => {
    const resetAgentChat = vi.fn();
    const resetAgentComposer = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const handlePulsePresetStart = vi.fn().mockResolvedValue(undefined);
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;
    let setAgentActionsFromInteractions:
      | Dispatch<SetStateAction<AgentActions | undefined>>
      | undefined;

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: resetAgentChat,
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer,
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart,
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockImplementation((params) => {
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      setPromptOriginFromInteractions = params.setPromptOrigin;
      setAgentActionsFromInteractions = params.setAgentActions;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleExpandChat: vi.fn(),
        handleAgentAddToGrid: vi.fn(),
        handleClearAgentChat: vi.fn(),
        handleCloseAgentChat: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
        })
      )
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
      expect(setAgentActionsFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Completed artifact");
      setPromptOriginFromInteractions?.("agent");
      setAgentActionsFromInteractions?.({ applyPrompt: "Completed artifact" } as AgentActions);
    });
    expect(result.current.latestAgentPrompt).toBe("Completed artifact");
    expect(result.current.promptOrigin).toBe("agent");

    await act(async () => {
      await result.current.handlePulsePresetRestart?.({
        presetId: "story_builder",
        label: "Story Builder",
        description: "Guided story workflow.",
        systemInstructions: "Guide the user through story setup.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "Upload your characters first.",
        workflowStageHints: ["Upload Characters"],
        outputMode: "chat_reply",
        memoryPolicy: "session",
        isBuiltIn: true,
        isEditable: true,
        isCustom: false,
      });
    });

    expect(resetAgentChat).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledWith({ preserveAttachments: false });
    expect(setPulseWorkflowSession).toHaveBeenCalledWith(null);
    expect(handlePulsePresetStart).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: "story_builder" })
    );
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
  });

  it("drops stale Pulse bridge state when the active Pulse changes", async () => {
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockImplementation((params) => {
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleExpandChat: vi.fn(),
        handleAgentAddToGrid: vi.fn(),
        handleClearAgentChat: vi.fn(),
        handleCloseAgentChat: vi.fn(),
      };
    });

    const base = createBridgeParams({
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
    });
    const { result, rerender } = renderHook(
      ({ activePulsePresetId }: { activePulsePresetId: string | null }) =>
        useAiStudioAgentBridge({
          ...base,
          activePulsePresetId,
        }),
      {
        initialProps: {
          activePulsePresetId: "story_builder",
        },
      }
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Pulse A prompt");
    });
    expect(result.current.latestAgentPrompt).toBe("Pulse A prompt");

    rerender({ activePulsePresetId: "shot_designer" });
    expect(result.current.latestAgentPrompt).toBeNull();

    rerender({ activePulsePresetId: "story_builder" });
    expect(result.current.latestAgentPrompt).toBeNull();
  });

  it("rehydrates a completed pulse workflow session from persisted agent snapshot state", async () => {
    const setPulseWorkflowSession = vi.fn();

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
        })
      )
    );

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "standard",
          activePulsePresetId: "story_builder",
        } as AiStudioSessionHydrationPayload["workspace"],
        agent: {
          messages: [
            {
              id: "agent-assistant-restored-0",
              role: "assistant",
              content: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
            },
          ],
          input: "",
          latestAgentPrompt: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "completed",
            currentStepIndex: 6,
            currentStepLabel: "Image Prompts",
            currentStepPrompt: null,
            collectedInputs: ["grimdark tone", "10 min runtime"],
            lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
            finalArtifactSource: "chat_reply",
          },
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: "story_builder",
          pulse: {
            messages: [
              {
                id: "agent-assistant-restored-0",
                role: "assistant",
                content: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              },
            ],
            input: "",
            latestAgentPrompt:
              "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: {
              presetId: "story_builder",
              status: "completed",
              currentStepIndex: 6,
              currentStepLabel: "Image Prompts",
              currentStepPrompt: null,
              collectedInputs: ["grimdark tone", "10 min runtime"],
              lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              finalArtifactSource: "chat_reply",
            },
          },
        },
      });
    });

    expect(setPulseWorkflowSession).toHaveBeenCalledWith({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["grimdark tone", "10 min runtime"],
      lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
      finalArtifactSource: "chat_reply",
    });
  });

  it("preserves a stored Pulse workflow session when restore re-enters in Standard mode", async () => {
    const setPulseWorkflowSession = vi.fn();

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
        })
      )
    );

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "standard",
          activePulsePresetId: "story_builder",
        } as AiStudioSessionHydrationPayload["workspace"],
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: "Standard draft prompt",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: "Standard draft prompt",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: "story_builder",
          pulse: {
            messages: [
              {
                id: "agent-assistant-restored-0",
                role: "assistant",
                content: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              },
            ],
            input: "",
            latestAgentPrompt:
              "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: {
              presetId: "story_builder",
              status: "completed",
              currentStepIndex: 6,
              currentStepLabel: "Image Prompts",
              currentStepPrompt: null,
              collectedInputs: ["grimdark tone", "10 min runtime"],
              lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              finalArtifactSource: "chat_reply",
            },
          },
        },
      });
    });

    expect(setPulseWorkflowSession).toHaveBeenCalledWith({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["grimdark tone", "10 min runtime"],
      lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
      finalArtifactSource: "chat_reply",
    });
  });

  it("restores a saved Pulse runtime after re-entering Pulse from a Standard-first restore", async () => {
    const setPulseWorkflowSession = vi.fn();

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result, rerender } = renderHook(
      ({
        expertCreateMode,
        activePulsePresetId,
      }: {
        expertCreateMode: "standard" | "pulse";
        activePulsePresetId: string | null;
      }) =>
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode,
            activePulsePresetId,
            setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
          })
        ),
      {
        initialProps: {
          expertCreateMode: "standard" as const,
          activePulsePresetId: null,
        },
      }
    );

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "standard",
          activePulsePresetId: "story_builder",
        } as AiStudioSessionHydrationPayload["workspace"],
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: "Standard draft prompt",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: "Standard draft prompt",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: "story_builder",
          pulse: {
            messages: [
              {
                id: "agent-assistant-restored-0",
                role: "assistant",
                content: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              },
            ],
            input: "",
            latestAgentPrompt:
              "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: {
              presetId: "story_builder",
              status: "completed",
              currentStepIndex: 6,
              currentStepLabel: "Image Prompts",
              currentStepPrompt: null,
              collectedInputs: ["grimdark tone", "10 min runtime"],
              lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
              finalArtifactSource: "chat_reply",
            },
          },
        },
      });
    });

    expect(result.current.latestAgentPrompt).toBe("Standard draft prompt");
    expect(result.current.promptOrigin).toBe("agent");

    rerender({
      expertCreateMode: "pulse" as const,
      activePulsePresetId: "story_builder",
    });

    expect(result.current.latestAgentPrompt).toBe(
      "Scene 1: cinematic wide shot of the knight entering the ruined hall."
    );
    expect(result.current.promptOrigin).toBe("agent");
    expect(setPulseWorkflowSession).toHaveBeenCalledWith({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["grimdark tone", "10 min runtime"],
      lastArtifact: "Scene 1: cinematic wide shot of the knight entering the ruined hall.",
      finalArtifactSource: "chat_reply",
    });
  });

  it("skips local chat-mode preference hydration while a project route is pending", async () => {
    readChatModeFromStorageMock.mockReturnValue(false);

    useAiAgentMock.mockReturnValue({
      messages: [],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    });
    useAiStudioAgentComposerMock.mockReturnValue({
      agentInput: "",
      setAgentInput: vi.fn(),
      handleAgentInputChange: vi.fn(),
      agentAttachmentError: null,
      setAgentAttachmentError: vi.fn(),
      agentAttachments: [],
      setAgentAttachments: vi.fn(),
      linkedPromptReferenceIds: [],
      isAgentDropActive: false,
      markAttachmentDelivery: vi.fn(),
      handleAgentAttachmentDragOver: vi.fn(),
      handleAgentAttachmentDragEnter: vi.fn(),
      handleAgentAttachmentDragLeave: vi.fn(),
      handleAgentAttachmentDrop: vi.fn(),
      handleRemoveAgentAttachment: vi.fn(),
      handleClearAgentAttachments: vi.fn(),
      resetAgentComposer: vi.fn(),
    });
    useAiStudioAgentOrchestrationMock.mockReturnValue({
      isPromptRefining: false,
      isReferencePromptEnhancing: false,
      describeInFlightCount: 0,
      handleAgentSend: vi.fn(),
      handlePulsePresetStart: vi.fn(),
      handleAgentEnhanceSend: vi.fn(),
      handleReferencePromptEnhance: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          projectRouteRequested: true,
        })
      )
    );

    await waitFor(() => {
      expect(result.current.chatModeEnabled).toBe(true);
    });

    expect(readChatModeFromStorageMock).not.toHaveBeenCalled();
  });
});
