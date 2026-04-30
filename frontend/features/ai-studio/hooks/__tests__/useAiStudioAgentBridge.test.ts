import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioAgentBridge } from "../useAiStudioAgentBridge";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { StudioMode, ToolId, StudioOutput } from "../../types";
import type { AgentMessage, AgentPulseWorkflowSession } from "../../../../prefabs/agent";

const useAiAgentMock = vi.fn();
const useAiStudioAgentComposerMock = vi.fn();
const useAiStudioAgentOrchestrationMock = vi.fn();
const useAiStudioAgentInteractionsMock = vi.fn();

vi.mock("../../../ai-agent/useCreateAgentStateCore", () => ({
  useCreateAgentStateCore: (options: Record<string, unknown> = {}) => useAiAgentMock(options),
}));

vi.mock("../../../ai-agent/client/pulseStudioAgentTransport", () => ({
  sendPulseCreateAgentTurn: vi.fn(),
}));

vi.mock("../../../ai-agent/client/standardStudioAgentTransport", () => ({
  sendStandardCreateAgentTurn: vi.fn(),
}));

vi.mock("../../../ai-agent/client/pulseTransportResultResolution", () => ({
  resolvePulseCreateAgentTransportSuccess: vi.fn(),
}));

vi.mock("../../../ai-agent/client/standardTransportResultResolution", () => ({
  resolveStandardCreateAgentTransportSuccess: vi.fn(),
}));

vi.mock("../../../ai-agent/logic/pulseCreateAgentContextBuilder", () => ({
  buildPulseCreateAgentContext: vi.fn(),
}));

vi.mock("../../../ai-agent/logic/standardContextBuilder", () => ({
  buildStandardCreateAgentContext: vi.fn(),
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

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

type BridgeParams = Parameters<typeof useAiStudioAgentBridge>[0];
type BridgeRuntimeKind = BridgeParams["createAgentRuntime"]["kind"];
type BridgeContextResolver = BridgeParams["createAgentRuntime"]["getAgentContext"];

type BridgeParamOverrides = Partial<Omit<BridgeParams, "createAgentRuntime">> & {
  expertCreateMode?: BridgeRuntimeKind;
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  standardChatModeEnabled?: boolean;
  defaultStandardChatModeEnabled?: boolean;
  setStandardChatModeEnabled?: Dispatch<SetStateAction<boolean>>;
  standardPrompt?: string;
  pulsePrompt?: string;
  setPulseWorkflowSession?: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  clearPulseRuntime?: () => void;
  restartPulse?: () => { presetId: string; sessionInstanceId: string } | null;
  getAgentContext?: BridgeContextResolver;
};

const createBridgeParams = (overrides: BridgeParamOverrides = {}): BridgeParams => {
  const expertCreateMode = overrides.expertCreateMode ?? "standard";
  const activePulsePresetId = overrides.activePulsePresetId ?? null;
  const pulseSessionInstanceId = Object.prototype.hasOwnProperty.call(
    overrides,
    "pulseSessionInstanceId"
  )
    ? (overrides.pulseSessionInstanceId ?? null)
    : activePulsePresetId
      ? "pulse-session-1"
      : null;
  const createAgentRuntime: BridgeParams["createAgentRuntime"] =
    expertCreateMode === "pulse"
      ? {
          kind: "pulse",
          prompt: overrides.pulsePrompt ?? "",
          activePresetId: activePulsePresetId,
          sessionInstanceId: pulseSessionInstanceId,
          workflowSession: overrides.pulseWorkflowSession ?? null,
          setWorkflowSession: overrides.setPulseWorkflowSession ?? asDispatch(vi.fn()),
          clearRuntime: overrides.clearPulseRuntime,
          restart: overrides.restartPulse,
          getAgentContext: overrides.getAgentContext ?? vi.fn(() => ({})),
        }
      : {
          kind: "standard",
          prompt: overrides.standardPrompt ?? "",
          chatModeEnabled: overrides.standardChatModeEnabled,
          defaultChatModeEnabled: overrides.defaultStandardChatModeEnabled,
          setChatModeEnabled: overrides.setStandardChatModeEnabled,
          getAgentContext: overrides.getAgentContext ?? vi.fn(() => ({})),
        };
  const baseParams: Parameters<typeof useAiStudioAgentBridge>[0] = {
    sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
    mode: "text",
    selectedTool: "create",
    createAgentRuntime,
    setSharedPrompt: vi.fn(),
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
    trackAgentUiEvent: vi.fn(),
  };
  return {
    ...baseParams,
    ...overrides,
    createAgentRuntime,
  };
};

describe("useAiStudioAgentBridge", () => {
  const mockBridgeForAssistantEdit = (message: AgentMessage, setSharedPrompt = vi.fn()) => {
    let updatedMessage: AgentMessage | null = null;
    const updateMessageById = vi.fn(
      (messageId: string, updater: (message: AgentMessage) => AgentMessage) => {
        if (messageId !== message.id) return false;
        updatedMessage = updater(message);
        return true;
      }
    );

    useAiAgentMock.mockReturnValue({
      messages: [message],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById,
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
      handleClearAgentChat: vi.fn(),
    });

    return {
      getUpdatedMessage: () => updatedMessage,
      setSharedPrompt,
      updateMessageById,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not loop when live agent state is semantically unchanged but reallocated", async () => {
    useAiAgentMock.mockImplementation(() => ({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Existing assistant reply",
        },
      ],
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
      reset: vi.fn(),
    }));
    useAiStudioAgentComposerMock.mockImplementation(() => ({
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
    }));
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
      handleClearAgentChat: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    await waitFor(() => {
      expect(result.current.agentMessages).toHaveLength(1);
    });

    rerender();

    await waitFor(() => {
      expect(result.current.agentMessages[0]?.content).toBe("Existing assistant reply");
    });
  });

  it("does not hydrate an empty Pulse snapshot over a fresh kickoff reply", async () => {
    const replaceMessages = vi.fn();
    const pulseMessages: AgentMessage[] = [
      {
        id: "assistant-pulse-1",
        role: "assistant",
        content:
          "This prompt now includes a sharper product angle. What product should anchor the first shot?",
      },
    ];

    useAiAgentMock.mockReturnValue({
      messages: pulseMessages,
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages,
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "pulse_custom",
          pulseSessionInstanceId: "pulse-session-fast",
        })
      )
    );

    await waitFor(() => {
      expect(replaceMessages).toHaveBeenCalledWith(pulseMessages);
    });
    expect(replaceMessages).not.toHaveBeenCalledWith([]);
    expect(result.current.agentMessages).toEqual(pulseMessages);
  });

  it("does not promote edited legacy assistant messages without prompt metadata", () => {
    const legacyMessage = {
      id: "legacy-assistant",
      role: "assistant" as const,
      content: "Legacy assistant answer",
    };
    const setSharedPrompt = vi.fn();
    const { getUpdatedMessage } = mockBridgeForAssistantEdit(legacyMessage, setSharedPrompt);

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(createBridgeParams({ setSharedPrompt }))
    );

    let didCommit = false;
    act(() => {
      didCommit = result.current.handleAssistantMessageEdit({
        messageId: legacyMessage.id,
        content: "Edited legacy answer",
      });
    });

    expect(didCommit).toBe(true);
    expect(getUpdatedMessage()).toEqual({
      ...legacyMessage,
      content: "Edited legacy answer",
    });
    expect(getUpdatedMessage()).not.toHaveProperty("outputPrompt");
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(setSharedPrompt).not.toHaveBeenCalled();
  });

  it("promotes edited assistant messages only when they are explicit prompt output", () => {
    const promptMessage = {
      id: "prompt-assistant",
      role: "assistant" as const,
      content: "Original prompt answer",
      outputPrompt: "Original prompt answer",
      canUseAsPrompt: true,
    };
    const setSharedPrompt = vi.fn();
    const { getUpdatedMessage } = mockBridgeForAssistantEdit(promptMessage, setSharedPrompt);

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(createBridgeParams({ setSharedPrompt }))
    );

    let didCommit = false;
    act(() => {
      didCommit = result.current.handleAssistantMessageEdit({
        messageId: promptMessage.id,
        content: "Edited prompt output",
      });
    });

    expect(didCommit).toBe(true);
    expect(getUpdatedMessage()).toEqual({
      ...promptMessage,
      content: "Edited prompt output",
      outputPrompt: "Edited prompt output",
    });
    expect(result.current.latestAgentPrompt).toBe("Edited prompt output");
    expect(setSharedPrompt).toHaveBeenCalledWith("Edited prompt output");
  });

  it("clears staged attachments when session context changes", async () => {
    const resetAgentComposer = vi.fn();
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;

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
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
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
    expect(useAiAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
    });

    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");

    act(() => {
      setLatestAgentPromptFromInteractions?.("Applied prompt");
      setPromptOriginFromInteractions?.("agent");
    });

    expect(result.current.latestAgentPrompt).toBe("Applied prompt");
    expect(result.current.promptOrigin).toBe("agent");

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "create" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(2);
    });
    expect(useAiAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");

    act(() => {
      setLatestAgentPromptFromInteractions?.("Persist across tool switch");
      setPromptOriginFromInteractions?.("agent");
    });

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(3);
    });
    expect(useAiAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBe("Persist across tool switch");
    expect(result.current.promptOrigin).toBe("agent");

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(4);
    });
    expect(useAiAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionNamespace: "ai-studio:a7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard",
      })
    );
    expect(result.current.latestAgentPrompt).toBe("Persist across tool switch");
    expect(result.current.promptOrigin).toBe("agent");

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
      handleClearAgentChat: vi.fn(),
    });

    const base = createBridgeParams({ sessionId: null });
    const initialProps: { sessionId: string | null } = { sessionId: null };
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) =>
        useAiStudioAgentBridge({
          ...base,
          sessionId,
        }),
      {
        initialProps,
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    expect(useAiAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ directOpenAiBypassEnabled: true, requestRuntimeMode: "standard" })
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
      handleClearAgentChat: vi.fn(),
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
      expect.objectContaining({ directOpenAiBypassEnabled: false, requestRuntimeMode: "pulse" })
    );
    expect(result.current.directOpenAiBypassEnabled).toBe(false);
  });

  it("restores Standard-owned bridge state after returning from Pulse mode", async () => {
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;

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
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const bridgeModeProps: {
      expertCreateMode: "standard" | "pulse";
      activePulsePresetId: string | null;
      pulseSessionInstanceId: string | null;
    } = {
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    };
    const { result, rerender } = renderHook(
      ({
        expertCreateMode,
        activePulsePresetId,
        pulseSessionInstanceId,
      }: {
        expertCreateMode: "standard" | "pulse";
        activePulsePresetId: string | null;
        pulseSessionInstanceId: string | null;
      }) =>
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode,
            activePulsePresetId,
            pulseSessionInstanceId,
          })
        ),
      {
        initialProps: bridgeModeProps,
      }
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Standard prompt");
      setPromptOriginFromInteractions?.("agent");
    });

    expect(result.current.latestAgentPrompt).toBe("Standard prompt");
    expect(result.current.promptOrigin).toBe("agent");

    rerender({
      expertCreateMode: "pulse" as const,
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });

    expect(
      useAiAgentMock.mock.calls.some(
        ([params]) =>
          (params as { sessionNamespace?: string }).sessionNamespace ===
          "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::pulse:story_builder:pulse-session-1"
      )
    ).toBe(true);
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");

    act(() => {
      setLatestAgentPromptFromInteractions?.("Pulse prompt");
      setPromptOriginFromInteractions?.("agent");
    });

    expect(result.current.latestAgentPrompt).toBe("Pulse prompt");

    rerender({
      expertCreateMode: "standard" as const,
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });

    expect(
      useAiAgentMock.mock.calls.some(
        ([params]) =>
          (params as { sessionNamespace?: string }).sessionNamespace ===
          "ai-studio:f7f45245-f204-4ece-8f9e-c9a66a9d8d2a::standard"
      )
    ).toBe(true);
    expect(result.current.latestAgentPrompt).toBe("Standard prompt");
    expect(result.current.promptOrigin).toBe("agent");
  });

  it("surfaces the completed Pulse artifact as the effective latest prompt for chat-reply workflows", () => {
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
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
        })
      )
    );

    expect(result.current.latestAgentPrompt).toBe(
      "Scene 1: cinematic wide shot of the knight entering the ruined hall."
    );
    expect(result.current.promptOrigin).toBe("agent");
  });

  it("does not rehydrate stale Standard history over a newly arrived assistant response", async () => {
    const replaceMessages = vi.fn();
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
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const { rerender } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    await waitFor(() => {
      expect(replaceMessages).toHaveBeenCalledWith([]);
    });

    replaceMessages.mockClear();
    currentMessages = [{ id: "user-1", role: "user", content: "Make it cinematic." }];
    rerender();

    expect(replaceMessages).not.toHaveBeenCalled();

    replaceMessages.mockClear();
    currentMessages = [
      { id: "user-1", role: "user", content: "Make it cinematic." },
      { id: "assistant-1", role: "assistant", content: "Cinematic golden-hour portrait." },
    ];
    rerender();

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  it("preserves newly arrived assistant history when UI-state setters run before runtime sync catches up", async () => {
    let currentMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [
      { id: "user-1", role: "user", content: "Make it cinematic." },
    ];

    useAiAgentMock.mockImplementation(() => ({
      messages: currentMessages,
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
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
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const { result, rerender } = renderHook(() => useAiStudioAgentBridge(createBridgeParams()));

    await waitFor(() => {
      expect(result.current.persistedAgentRuntimes.standard.messages).toEqual(currentMessages);
    });

    act(() => {
      currentMessages = [
        { id: "user-1", role: "user", content: "Make it cinematic." },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Cinematic golden-hour portrait.",
        },
      ];
      rerender();
    });

    await waitFor(() => {
      expect(result.current.agentMessages).toEqual(currentMessages);
      expect(result.current.persistedAgentRuntimes.standard.messages).toEqual(currentMessages);
    });
  });

  it("preserves the visible Standard runtime when toggling into Pulse before sync catches up", async () => {
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
      | undefined;
    let standardMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [
      { id: "user-1", role: "user", content: "Make it cinematic." },
    ];
    const pulseMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];

    useAiAgentMock.mockImplementation((params?: { sessionNamespace?: string }) => ({
      messages: params?.sessionNamespace?.endsWith("::standard") ? standardMessages : pulseMessages,
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
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
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      setPromptOriginFromInteractions = params.setPromptOrigin;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const initialRuntimeProps: {
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
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode,
            activePulsePresetId,
          })
        ),
      {
        initialProps: initialRuntimeProps,
      }
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Cinematic golden-hour portrait.");
      setPromptOriginFromInteractions?.("agent");
      standardMessages = [
        { id: "user-1", role: "user", content: "Make it cinematic." },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Cinematic golden-hour portrait.",
        },
      ];
      rerender({ expertCreateMode: "standard", activePulsePresetId: null });
    });

    await waitFor(() => {
      expect(result.current.agentMessages).toEqual(standardMessages);
      expect(result.current.stagedAgentPrompt).toBe("Cinematic golden-hour portrait.");
    });

    rerender({
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
    });

    await waitFor(() => {
      expect(result.current.persistedAgentRuntimes.standard.messages).toEqual(standardMessages);
      expect(result.current.agentMessages).toEqual(pulseMessages);
      expect(result.current.stagedAgentPrompt).toBeNull();
    });

    rerender({ expertCreateMode: "standard", activePulsePresetId: null });

    await waitFor(() => {
      expect(result.current.agentMessages).toEqual(standardMessages);
      expect(result.current.stagedAgentPrompt).toBe("Cinematic golden-hour portrait.");
    });
  });

  it("restarts an active Pulse without clearing Pulse ownership", async () => {
    const resetAgentChat = vi.fn();
    const resetAgentComposer = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const handlePulsePresetStart = vi.fn().mockResolvedValue(undefined);
    const restartPulse = vi.fn(() => ({
      presetId: "story_builder",
      sessionInstanceId: "pulse-session-restart",
    }));
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    let setPromptOriginFromInteractions:
      | Dispatch<SetStateAction<"manual" | "agent" | "reference">>
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
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
          restartPulse,
        })
      )
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
      expect(setPromptOriginFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Completed artifact");
      setPromptOriginFromInteractions?.("agent");
    });
    expect(result.current.latestAgentPrompt).toBe("Completed artifact");
    expect(result.current.promptOrigin).toBe("agent");

    await act(async () => {
      await result.current.handlePulsePresetRestart?.({
        presetId: "story_builder",
        label: "DFY Story Builder",
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
        hasUserOverride: false,
        isCustom: false,
      });
    });

    expect(resetAgentChat).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledWith({ preserveAttachments: false });
    expect(setPulseWorkflowSession).toHaveBeenCalledWith(null);
    expect(restartPulse).toHaveBeenCalledTimes(1);
    expect(handlePulsePresetStart).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: "story_builder" }),
      {
        pulseSessionInstanceId: "pulse-session-restart",
      }
    );
    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
  });

  it("does not restart a Pulse without a fresh session namespace", async () => {
    const resetAgentChat = vi.fn();
    const resetAgentComposer = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const setUiNotice = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const handlePulsePresetStart = vi.fn().mockResolvedValue(undefined);

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
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
          setUiNotice: asDispatch(setUiNotice),
          trackAgentUiEvent,
        })
      )
    );

    await act(async () => {
      await result.current.handlePulsePresetRestart?.({
        presetId: "story_builder",
        label: "DFY Story Builder",
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
        hasUserOverride: false,
        isCustom: false,
      });
    });

    expect(resetAgentChat).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledWith({ preserveAttachments: false });
    expect(setPulseWorkflowSession).toHaveBeenCalledWith(null);
    expect(handlePulsePresetStart).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith(
      "Pulse restart could not create a fresh session. Start the Pulse again."
    );
    expect(trackAgentUiEvent).toHaveBeenCalledWith(
      "studio_agent_pulse_restart_blocked_missing_session",
      { preset_id: "story_builder" }
    );
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
        handleClearAgentChat: vi.fn(),
      };
    });

    const { result, rerender } = renderHook(
      ({
        activePulsePresetId,
        pulseSessionInstanceId,
      }: {
        activePulsePresetId: string | null;
        pulseSessionInstanceId: string | null;
      }) =>
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode: "pulse",
            activePulsePresetId,
            pulseSessionInstanceId,
          })
        ),
      {
        initialProps: {
          activePulsePresetId: "story_builder",
          pulseSessionInstanceId: "pulse-session-1",
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

    rerender({
      activePulsePresetId: "shot_designer",
      pulseSessionInstanceId: "pulse-session-2",
    });
    expect(result.current.latestAgentPrompt).toBeNull();

    rerender({
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-3",
    });
    expect(result.current.latestAgentPrompt).toBeNull();
  });

  it("clears bridge ui busy state when switching away from an active pulse scope", async () => {
    let setAgentUiBusyFromOrchestration: Dispatch<SetStateAction<boolean>> | undefined;

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
    useAiStudioAgentOrchestrationMock.mockImplementation((params) => {
      setAgentUiBusyFromOrchestration = params.setAgentUiBusy;
      return {
        isPromptRefining: false,
        isReferencePromptEnhancing: false,
        describeInFlightCount: 0,
        handleAgentSend: vi.fn(),
        handlePulsePresetStart: vi.fn(),
        handleAgentEnhanceSend: vi.fn(),
        handleReferencePromptEnhance: vi.fn(),
      };
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleClearAgentChat: vi.fn(),
    });

    const initialBusyProps: {
      expertCreateMode: "standard" | "pulse";
      activePulsePresetId: string | null;
    } = {
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
    };
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
          })
        ),
      {
        initialProps: initialBusyProps,
      }
    );

    await waitFor(() => {
      expect(setAgentUiBusyFromOrchestration).toBeDefined();
    });

    act(() => {
      setAgentUiBusyFromOrchestration?.(true);
    });
    expect(result.current.agentBusy).toBe(true);

    rerender({
      expertCreateMode: "standard" as const,
      activePulsePresetId: null,
    });

    await waitFor(() => {
      expect(result.current.agentBusy).toBe(false);
    });
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          pulseSessionInstanceId: "pulse-session-restore-1",
          setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
        })
      )
    );

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          pulseSessionInstanceId: "pulse-session-restore-1",
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

  it("drops stored Pulse workflow session state when restore re-enters in Standard mode", async () => {
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
      handleClearAgentChat: vi.fn(),
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
          pulseSessionInstanceId: "pulse-session-restore-1",
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

    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
  });

  it("does not restore hidden Pulse runtime after a Standard-first restore", async () => {
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
      handleClearAgentChat: vi.fn(),
    });

    const initialHydrationProps: {
      expertCreateMode: "standard" | "pulse";
      activePulsePresetId: string | null;
      pulseSessionInstanceId: string | null;
    } = {
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    };
    const { result, rerender } = renderHook(
      ({
        expertCreateMode,
        activePulsePresetId,
        pulseSessionInstanceId,
      }: {
        expertCreateMode: "standard" | "pulse";
        activePulsePresetId: string | null;
        pulseSessionInstanceId: string | null;
      }) =>
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode,
            activePulsePresetId,
            pulseSessionInstanceId,
            setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
          })
        ),
      {
        initialProps: initialHydrationProps,
      }
    );

    act(() => {
      result.current.hydrateFromSessionAgentSnapshot({
        workspace: {
          expertCreateMode: "standard",
          activePulsePresetId: "story_builder",
          pulseSessionInstanceId: "pulse-session-restore-1",
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
      pulseSessionInstanceId: "pulse-session-restore-1",
    });

    expect(result.current.latestAgentPrompt).toBeNull();
    expect(result.current.promptOrigin).toBe("manual");
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
  });

  it("drops hidden Pulse runtime state across Standard mode switches", async () => {
    let setLatestAgentPromptFromInteractions: Dispatch<SetStateAction<string | null>> | undefined;
    const pulseMessages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [
      {
        id: "pulse-assistant-1",
        role: "assistant",
        content: "Step 1 - Upload your characters. Please upload 1-3+ character images.",
      },
    ];

    useAiAgentMock.mockImplementation((params?: { sessionNamespace?: string }) => ({
      messages: params?.sessionNamespace?.endsWith("::standard") ? [] : pulseMessages,
      isSending: false,
      error: null,
      send: vi.fn(),
      appendUserMessage: vi.fn(),
      updateMessageById: vi.fn(() => false),
      replaceMessages: vi.fn(),
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
      setLatestAgentPromptFromInteractions = params.setLatestAgentPrompt;
      return {
        handleAgentApplyPrompt: vi.fn(),
        handleClearAgentChat: vi.fn(),
      };
    });

    const initialModeProps: {
      expertCreateMode: "standard" | "pulse";
      activePulsePresetId: string | null;
      pulseSessionInstanceId: string | null;
    } = {
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    };
    const { result, rerender } = renderHook(
      ({
        expertCreateMode,
        activePulsePresetId,
        pulseSessionInstanceId,
      }: {
        expertCreateMode: "standard" | "pulse";
        activePulsePresetId: string | null;
        pulseSessionInstanceId: string | null;
      }) =>
        useAiStudioAgentBridge(
          createBridgeParams({
            expertCreateMode,
            activePulsePresetId,
            pulseSessionInstanceId,
          })
        ),
      {
        initialProps: initialModeProps,
      }
    );

    await waitFor(() => {
      expect(setLatestAgentPromptFromInteractions).toBeDefined();
    });

    act(() => {
      setLatestAgentPromptFromInteractions?.("Pulse prompt");
    });

    expect(result.current.latestAgentPrompt).toBe("Pulse prompt");
    expect(result.current.agentMessages).toEqual(pulseMessages);

    rerender({
      expertCreateMode: "standard",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });
    await waitFor(() => {
      expect(result.current.latestAgentPrompt).toBeNull();
      expect(result.current.agentMessages).toEqual([]);
    });

    rerender({
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });
    await waitFor(() => {
      expect(result.current.latestAgentPrompt).toBeNull();
      expect(result.current.agentMessages).toEqual([]);
    });
  });

  it("blocks Standard enhancement handlers while Pulse runtime is active", async () => {
    const handleAgentEnhanceSend = vi.fn();
    const handleReferencePromptEnhance = vi.fn();
    const setUiNotice = vi.fn();
    const trackAgentUiEvent = vi.fn();

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
      handleAgentEnhanceSend,
      handleReferencePromptEnhance,
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          setUiNotice: asDispatch<string | null>(setUiNotice),
          trackAgentUiEvent,
        })
      )
    );

    act(() => {
      result.current.handleAgentEnhanceSend();
      result.current.handleReferencePromptEnhance();
    });

    expect(handleAgentEnhanceSend).not.toHaveBeenCalled();
    expect(handleReferencePromptEnhance).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Use the Pulse workflow to continue.");
    expect(trackAgentUiEvent).toHaveBeenCalledWith(
      "studio_agent_standard_action_blocked_in_pulse_mode"
    );
  });

  it("keeps Pulse chat mode enabled even when page-owned Standard preference is off", async () => {
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
          standardChatModeEnabled: false,
          defaultStandardChatModeEnabled: false,
        })
      )
    );

    expect(result.current.chatModeEnabled).toBe(true);
    expect(result.current.persistedAgentRuntimes.standard.chatModeEnabled).toBe(true);
    expect(result.current.persistedAgentRuntimes.pulse.chatModeEnabled).toBe(true);
  });

  it("uses page-owned Standard chat-mode preference", async () => {
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
      handleClearAgentChat: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAiStudioAgentBridge(
        createBridgeParams({
          standardChatModeEnabled: false,
          defaultStandardChatModeEnabled: false,
        })
      )
    );

    await waitFor(() => {
      expect(result.current.chatModeEnabled).toBe(false);
    });
  });
});
