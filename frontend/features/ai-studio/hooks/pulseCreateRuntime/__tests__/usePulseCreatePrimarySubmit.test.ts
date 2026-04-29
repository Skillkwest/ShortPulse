import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../../prefabs/agent";
import { usePulseCreatePrimarySubmit } from "../usePulseCreatePrimarySubmit";

const createCompletedWorkflowSession = (
  lastArtifact: string | null = "Completed Pulse artifact"
): AgentPulseWorkflowSession => ({
  presetId: "story_builder",
  status: "completed",
  currentStepIndex: 3,
  currentStepLabel: "Final",
  currentStepPrompt: null,
  collectedInputs: ["tone", "scene"],
  lastArtifact,
  finalArtifactSource: "chat_reply",
});

describe("usePulseCreatePrimarySubmit", () => {
  it("generates only from a completed Pulse artifact", () => {
    const handleGenerate = vi.fn();
    const handleProviderPrimarySubmit = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        mode: "text",
        selectedTool: "create",
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("  Completed Pulse artifact  "),
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: 12,
        currentCostCredits: 20,
        handleGenerate,
        handleProviderPrimarySubmit,
        setUiNotice,
      })
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).toHaveBeenCalledWith("Completed Pulse artifact", {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: 12,
      suppressStyle: true,
    });
    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalled();
  });

  it("blocks Pulse generation until the workflow has an artifact", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        mode: "text",
        selectedTool: "create",
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("   "),
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: null,
        currentCostCredits: 20,
        handleGenerate,
        handleProviderPrimarySubmit: vi.fn(),
        setUiNotice,
      })
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Complete the active Pulse before generating.");
  });

  it("uses the neutral provider submit for non-Create tools", () => {
    const handleProviderPrimarySubmit = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        mode: "image",
        selectedTool: "edit",
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession(),
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: null,
        currentCostCredits: 20,
        handleGenerate: vi.fn(),
        handleProviderPrimarySubmit,
        setUiNotice: vi.fn(),
      })
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleProviderPrimarySubmit).toHaveBeenCalledTimes(1);
  });
});
