import { act, renderHook } from "@testing-library/react";
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
});
