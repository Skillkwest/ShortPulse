import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCreatePulsePresetPageRuntime } from "../useCreatePulsePresetPageRuntime";

const createParams = (
  overrides: Partial<Parameters<typeof useCreatePulsePresetPageRuntime>[0]> = {}
): Parameters<typeof useCreatePulsePresetPageRuntime>[0] => ({
  selectedTool: "create",
  expertCreateMode: "pulse",
  activeCreatePulsePresetId: "story_builder",
  pulseSessionInstanceId: "pulse-session-1",
  pulseWorkflowSession: null,
  getAgentContext: vi.fn(() => ({})),
  clearPulseRuntime: vi.fn(),
  clearPulsePrompt: vi.fn(),
  handleExpertCreateModeChange: vi.fn(),
  handleActiveCreatePulsePresetIdChange: vi.fn(),
  ...overrides,
});

describe("useCreatePulsePresetPageRuntime", () => {
  it("recovers a restored built-in Pulse snapshot from the active preset id", () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ clearPulseRuntime, clearPulsePrompt }))
    );

    expect(result.current.hasActivePulseSession).toBe(true);
    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("story_builder");
    expect(clearPulseRuntime).not.toHaveBeenCalled();
    expect(clearPulsePrompt).not.toHaveBeenCalled();
  });

  it("builds Pulse agent context from a restored built-in Pulse snapshot", () => {
    const getAgentContext = vi.fn(() => ({}));
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ getAgentContext }))
    );

    const context = result.current.pulseCreateAgentContextResolver({
      lastAssistantMessage: null,
    });

    expect(context.pulse?.presetId).toBe("story_builder");
    expect(context.pulse?.runtimeMode).toBe("workflow_gpt");
    expect(context.pulse?.instructions).toContain("Story Circle Scene-Prompt GPT");
  });

  it("recovers a restored custom Pulse snapshot from saved presets", () => {
    const getAgentContext = vi.fn(() => ({}));
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "pulse_custom_video",
          getAgentContext,
          savedPresets: [
            {
              presetId: "pulse_custom_video",
              label: "Custom Video Pulse",
              description: "Guided custom video prompt.",
              systemInstructions: "Guide the user through a custom video prompt workflow.",
              runtimeMode: "workflow_gpt",
              activationMode: "activate_and_start",
              starterAssistantMessage: "Start with an image.",
              workflowStageHints: ["Image", "Motion", "Final"],
              outputMode: "chat_reply",
              artifactTarget: "video_prompt",
              memoryPolicy: "session",
              createdAt: "2026-05-01T00:00:00.000Z",
            },
          ],
        })
      )
    );

    const context = result.current.pulseCreateAgentContextResolver({
      lastAssistantMessage: null,
    });

    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("pulse_custom_video");
    expect(context.pulse?.presetId).toBe("pulse_custom_video");
    expect(context.pulse?.artifactTarget).toBe("video_prompt");
    expect(context.pulse?.source).toBe("custom");
  });

  it("clears unknown restored Pulse runtimes that cannot resolve a preset snapshot", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "unknown_restored_pulse",
          clearPulseRuntime,
          clearPulsePrompt,
        })
      )
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for saved Pulse catalog loading before clearing unknown restored Pulse runtimes", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({
          activeCreatePulsePresetId: "pulse_custom_pending",
          clearPulseRuntime,
          clearPulsePrompt,
          isSavedPresetCatalogReady: false,
        }),
      }
    );

    await Promise.resolve();

    expect(clearPulseRuntime).not.toHaveBeenCalled();
    expect(clearPulsePrompt).not.toHaveBeenCalled();

    rerender(
      createParams({
        activeCreatePulsePresetId: "pulse_custom_pending",
        clearPulseRuntime,
        clearPulsePrompt,
        isSavedPresetCatalogReady: true,
      })
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("clears Pulse prompt state when clearing the page Pulse runtime", () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ clearPulseRuntime, clearPulsePrompt }))
    );
    clearPulseRuntime.mockClear();
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.clearPulseRuntimeForPage();
    });

    expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
    expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
  });

  it("clears Pulse prompt state when switching back to Standard mode", () => {
    const clearPulsePrompt = vi.fn();
    const handleExpertCreateModeChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleExpertCreateModeChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleExpertCreateModeChangeForPage("standard");
    });

    expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    expect(handleExpertCreateModeChange).toHaveBeenCalledWith("standard");
  });

  it("clears Pulse prompt state when changing or deactivating the active Pulse", () => {
    const clearPulsePrompt = vi.fn();
    const handleActiveCreatePulsePresetIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleActiveCreatePulsePresetIdChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("multi_shot");
    });
    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage(null);
    });

    expect(clearPulsePrompt).toHaveBeenCalledTimes(2);
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenNthCalledWith(
      1,
      "multi_shot",
      undefined
    );
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenNthCalledWith(2, null, undefined);
  });

  it("preserves Pulse prompt state when reselecting the current active Pulse", () => {
    const clearPulsePrompt = vi.fn();
    const handleActiveCreatePulsePresetIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleActiveCreatePulsePresetIdChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("story_builder");
    });

    expect(clearPulsePrompt).not.toHaveBeenCalled();
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenCalledWith("story_builder", undefined);
  });

  it("preserves the staged snapshot when committing a started Pulse session", () => {
    const clearPulsePrompt = vi.fn();
    const customPreset = {
      presetId: "pulse_custom_video",
      label: "Custom Video Pulse",
      description: null,
      systemInstructions: "Guide a custom video workflow.",
      runtimeMode: "workflow_gpt" as const,
      activationMode: "activate_and_start" as const,
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply" as const,
      artifactTarget: "video_prompt" as const,
      memoryPolicy: "session" as const,
      isCustom: true,
      isBuiltIn: false,
      isEditable: true,
      hasUserOverride: true,
    };
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({ clearPulsePrompt }),
      }
    );

    act(() => {
      result.current.setActiveCreatePulsePresetSnapshot(customPreset);
    });
    clearPulsePrompt.mockClear();
    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("pulse_custom_video", {
        forceNewSession: true,
        sessionInstanceIdOverride: "pulse-session-2",
        preserveWorkflowSession: true,
      });
    });
    rerender(
      createParams({
        activeCreatePulsePresetId: "pulse_custom_video",
        pulseSessionInstanceId: "pulse-session-2",
        clearPulsePrompt,
      })
    );

    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("pulse_custom_video");
    expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
  });
});
