import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useAiStudioAgentOrchestration } from "../useAiStudioAgentOrchestration";
import { postGeneratePrompt } from "../../logic/promptGeneration";
import type { StudioOutput } from "../../types";
import type { AgentAttachment } from "../../../../prefabs/agent";

vi.mock("../../logic/promptGeneration", () => ({
  postGeneratePrompt: vi.fn(),
}));

const postGeneratePromptMock = vi.mocked(postGeneratePrompt);

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentOrchestration>[0]> = {}
): Parameters<typeof useAiStudioAgentOrchestration>[0] => ({
  agentIsSending: false,
  agentUiBusyRef: { current: false } as MutableRefObject<boolean>,
  setAgentUiBusy: asDispatch<boolean>(vi.fn()),
  agentSessionEnabled: true,
  setAgentSessionEnabled: asDispatch<boolean>(vi.fn()),
  agentInput: "",
  setAgentInput: asDispatch<string>(vi.fn()),
  agentAttachments: [],
  setAgentAttachments: asDispatch<AgentAttachment[]>(vi.fn()),
  setAgentAttachmentError: asDispatch<string | null>(vi.fn()),
  markAttachmentDelivery: vi.fn(),
  prompt: "",
  latestAgentPrompt: null,
  setLatestAgentPrompt: asDispatch<string | null>(vi.fn()),
  setAgentActions: asDispatch<unknown>(vi.fn()),
  selectedTool: "create",
  setSharedPrompt: vi.fn(),
  setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(vi.fn()),
  sendToAgent: vi.fn(async () => ({ response: null, actions: undefined })),
  appendUserMessage: vi.fn(() => "msg-1"),
  getAgentContext: vi.fn(() => ({})),
  trackAgentUiEvent: vi.fn(),
  addAgentPromptReference: vi.fn(),
  editReferenceText: "",
  setEditReferenceText: vi.fn(),
  videoReferenceText: "",
  setVideoReferenceText: vi.fn(),
  outputs: [],
  aspect: "1:1",
  model: null,
  setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  lastAssistantMessage: null,
  setUiNotice: asDispatch<string | null>(vi.fn()),
  ...overrides,
});

describe("useAiStudioAgentOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early for empty outbound send", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const appendUserMessage = vi.fn(() => "msg-1");
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      prompt: "   ",
      agentInput: "   ",
      sendToAgent,
      appendUserMessage,
      trackAgentUiEvent,
    });

    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(appendUserMessage).not.toHaveBeenCalled();
    expect(trackAgentUiEvent).not.toHaveBeenCalled();
  });

  it("enhances video reference prompt and routes to video setter", async () => {
    postGeneratePromptMock.mockResolvedValue({ prompt: "Refined video prompt" } as never);
    const setVideoReferenceText = vi.fn();
    const setEditReferenceText = vi.fn();
    const setPromptOrigin = vi.fn();

    const params = createParams({
      selectedTool: "video",
      videoReferenceText: "Base video prompt",
      setVideoReferenceText,
      setEditReferenceText,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleReferencePromptEnhance();
    });

    expect(postGeneratePromptMock).toHaveBeenCalledWith("Base video prompt");
    expect(setVideoReferenceText).toHaveBeenCalledWith("Refined video prompt");
    expect(setEditReferenceText).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
  });
});
