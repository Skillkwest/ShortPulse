import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentOutputBubbleMediaState } from "../../../../prefabs/agent";
import type { StudioOutput } from "../../types";
import { useAiStudioAgentOutputGenerationBridge } from "../useAiStudioAgentOutputGenerationBridge";

const registerOutputLinkMock = vi.fn();
const assistantBubbleMediaMock: Record<string, AgentOutputBubbleMediaState> = {
  "msg-existing": {
    outputId: "out-existing",
    thumbnailUrl: null,
    state: "pending",
  },
};

vi.mock("../agentOrchestration/useAgentOutputBubbleLinking", () => ({
  useAgentOutputBubbleLinking: () => ({
    assistantBubbleMedia: assistantBubbleMediaMock,
    registerOutputLink: registerOutputLinkMock,
  }),
}));

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentOutputGenerationBridge>[0]> = {}
): Parameters<typeof useAiStudioAgentOutputGenerationBridge>[0] => ({
  outputs: [] as StudioOutput[],
  mode: "image",
  selectedTool: "create",
  isGenerateDisabled: false,
  isGenerateClickLocked: false,
  hasSufficientCreditsForOutputGenerate: true,
  model: "seedream-4.5",
  characterModeEnabled: false,
  selectedCharacterId: "",
  currentCostCredits: 4,
  promptReferenceGenerateCostCredits: 7,
  setVideoReferenceText: vi.fn(),
  setEditReferenceText: vi.fn(),
  setSharedPrompt: vi.fn(),
  setSelectedToolWithEditIntentReset: vi.fn(),
  setMode: vi.fn(),
  setPromptOrigin: vi.fn(),
  handleGenerate: vi.fn().mockResolvedValue({
    accepted: true,
    optimisticOutputId: "out-123",
  }),
  ...overrides,
});

describe("useAiStudioAgentOutputGenerationBridge", () => {
  beforeEach(() => {
    registerOutputLinkMock.mockReset();
  });

  it("routes create workflow prompts into shared prompt + create mode generation", async () => {
    const params = createParams({
      selectedTool: "styles",
    });
    const { result } = renderHook(() => useAiStudioAgentOutputGenerationBridge(params));

    await act(async () => {
      result.current.handleGenerateFromAgentOutputPrompt({
        messageId: "msg-1",
        prompt: "  refined prompt  ",
        source: "history",
      });
      await Promise.resolve();
    });

    expect(params.setSharedPrompt).toHaveBeenCalledWith("refined prompt");
    expect(params.setSelectedToolWithEditIntentReset).toHaveBeenCalledWith("create");
    expect(params.setMode).toHaveBeenCalledWith("image");
    expect(params.setPromptOrigin).toHaveBeenCalledWith("agent");
    expect(params.handleGenerate).toHaveBeenCalledWith("refined prompt", {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: 7,
    });
    expect(registerOutputLinkMock).toHaveBeenCalledWith({
      messageId: "msg-1",
      optimisticOutputId: "out-123",
    });
  });

  it("routes video and edit workflows into their reference prompts without retargeting create", async () => {
    const videoParams = createParams({
      selectedTool: "video",
    });
    const videoHook = renderHook(() => useAiStudioAgentOutputGenerationBridge(videoParams));

    await act(async () => {
      videoHook.result.current.handleGenerateFromAgentOutputPrompt({
        messageId: "msg-video",
        prompt: "video prompt",
        source: "history",
      });
      await Promise.resolve();
    });

    expect(videoParams.setVideoReferenceText).toHaveBeenCalledWith("video prompt");
    expect(videoParams.setSharedPrompt).not.toHaveBeenCalled();
    expect(videoParams.handleGenerate).toHaveBeenCalledWith("video prompt", {
      modeOverride: "video",
      toolOverride: "video",
      costOverrideCredits: 7,
    });

    const editParams = createParams({
      selectedTool: "image",
    });
    const editHook = renderHook(() => useAiStudioAgentOutputGenerationBridge(editParams));

    await act(async () => {
      editHook.result.current.handleGenerateFromAgentOutputPrompt({
        messageId: "msg-edit",
        prompt: "edit prompt",
        source: "history",
      });
      await Promise.resolve();
    });

    expect(editParams.setEditReferenceText).toHaveBeenCalledWith("edit prompt");
    expect(editParams.setSelectedToolWithEditIntentReset).not.toHaveBeenCalled();
    expect(editParams.handleGenerate).toHaveBeenCalledWith("edit prompt", {
      modeOverride: "image",
      toolOverride: "edit",
      costOverrideCredits: 7,
    });
  });

  it("ignores invalid requests and exposes the current bubble media state", () => {
    const params = createParams();
    const { result } = renderHook(() => useAiStudioAgentOutputGenerationBridge(params));

    act(() => {
      result.current.handleGenerateFromAgentOutputPrompt({
        messageId: "   ",
        prompt: "   ",
        source: "history",
      });
    });

    expect(params.handleGenerate).not.toHaveBeenCalled();
    expect(result.current.assistantBubbleMedia).toBe(assistantBubbleMediaMock);
  });

  it("computes the disable guard for agent-output generation", () => {
    const { result } = renderHook(() =>
      useAiStudioAgentOutputGenerationBridge(
        createParams({
          selectedTool: "create",
          model: null,
          characterModeEnabled: true,
          selectedCharacterId: "",
        })
      )
    );

    expect(result.current.disableAgentOutputGenerate).toBe(true);
  });
});
