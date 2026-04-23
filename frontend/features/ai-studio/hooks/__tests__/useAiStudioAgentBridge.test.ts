import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioAgentBridge } from "../useAiStudioAgentBridge";
import type { AgentActions } from "../../../../prefabs/agent";
import type { StudioMode, ToolId, StudioOutput } from "../../types";

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

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createBridgeParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentBridge>[0]> = {}
): Parameters<typeof useAiStudioAgentBridge>[0] => ({
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  mode: "text",
  selectedTool: "create",
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
        sessionNamespace: "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
    });
  });
});
