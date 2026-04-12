import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { KIE_KLING_30_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { useAiStudioState } from "../useAiStudioState";
import { useAiStudioWorkspaceActions } from "../useAiStudioWorkspaceActions";

const useHarness = () => {
  const state = useAiStudioState();
  const workspace = useAiStudioWorkspaceActions({
    selectedTool: state.selectedTool,
    setSelectedTool: state.setSelectedTool,
    setMode: state.setMode,
    setShowCreateTools: state.setShowCreateTools,
    setVideoReferenceText: state.setVideoReferenceText,
    setEditReferenceText: state.setEditReferenceText,
    setSharedPrompt: state.setSharedPrompt,
    setPromptOrigin: (() => undefined) as never,
    openModelModal: state.openModelModal,
    closeModelModal: state.closeModelModal,
    setModel: (value: string) => state.setModel(value),
    addCharacterReferences: () => undefined,
    addOutputsFromFiles: () => undefined,
    setActiveOutputId: state.setActiveOutputId,
  });

  return {
    ...state,
    ...workspace,
  };
};

describe("AI Studio model session persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("restores the selected create model after switching to edit and back", async () => {
    const { result } = renderHook(() => useHarness());

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("create");
      expect(result.current.mode).toBe("image");
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    });

    act(() => {
      result.current.setModel("fal-ai/nano-banana-pro");
    });

    await waitFor(() => {
      expect(result.current.model).toBe("fal-ai/nano-banana-pro");
    });

    act(() => {
      result.current.handleToolSelect("edit");
    });

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("edit");
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    });

    act(() => {
      result.current.handleToolSelect("create");
    });

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("create");
      expect(result.current.model).toBe("fal-ai/nano-banana-pro");
    });
  });

  it("restores a create video model after switching workflows and back", async () => {
    const { result } = renderHook(() => useHarness());

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("create");
      expect(result.current.mode).toBe("image");
    });

    act(() => {
      result.current.setMode("video");
      result.current.setModel(KIE_KLING_30_MODEL_ID);
    });

    await waitFor(() => {
      expect(result.current.mode).toBe("video");
      expect(result.current.model).toBe(KIE_KLING_30_MODEL_ID);
    });

    act(() => {
      result.current.handleToolSelect("edit");
    });

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("edit");
      expect(result.current.mode).toBe("image");
    });

    act(() => {
      result.current.handleToolSelect("create");
    });

    await waitFor(() => {
      expect(result.current.selectedTool).toBe("create");
      expect(result.current.mode).toBe("video");
      expect(result.current.model).toBe(KIE_KLING_30_MODEL_ID);
    });
  });
});
