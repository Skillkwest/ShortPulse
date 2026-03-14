import { renderHook, waitFor } from "@testing-library/react";
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
  trackAgentUiEvent: vi.fn(),
  ...overrides,
});

describe("useAiStudioAgentBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears staged attachments when session context changes", async () => {
    const resetAgentComposer = vi.fn();

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
      handleAgentDescribeTargets: vi.fn(),
    });
    useAiStudioAgentInteractionsMock.mockReturnValue({
      handleAgentApplyPrompt: vi.fn(),
      handleAgentSelectVariation: vi.fn(),
      handleExpandChat: vi.fn(),
      handleAgentAddToGrid: vi.fn(),
      handleClearAgentChat: vi.fn(),
      handleCloseAgentChat: vi.fn(),
    });

    const base = createBridgeParams();
    const { rerender } = renderHook(
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

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "create" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(2);
    });

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "text" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(3);
    });

    rerender({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image" as StudioMode,
      selectedTool: "edit" as ToolId,
    });
    await waitFor(() => {
      expect(resetAgentComposer).toHaveBeenCalledTimes(4);
    });

    resetAgentComposer.mock.calls.forEach((args) => {
      expect(args[0]).toEqual({ preserveInput: true, preserveAttachments: false });
    });
  });
});
