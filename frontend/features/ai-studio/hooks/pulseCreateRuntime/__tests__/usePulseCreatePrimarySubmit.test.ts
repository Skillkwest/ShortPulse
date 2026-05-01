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
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("  Completed Pulse artifact  "),
        artifactTarget: "image_prompt",
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: 12,
        currentCostCredits: 20,
        handleGenerate,
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
    expect(setUiNotice).not.toHaveBeenCalled();
  });

  it("routes video Pulse artifacts to video generation", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("  Video prompt  "),
        artifactTarget: "video_prompt",
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: 12,
        currentCostCredits: 20,
        handleGenerate,
        setUiNotice,
      })
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).toHaveBeenCalledWith("Video prompt", {
      modeOverride: "video",
      toolOverride: "video",
      costOverrideCredits: 12,
      suppressStyle: true,
    });
    expect(setUiNotice).not.toHaveBeenCalled();
  });

  it("fails closed for completed text artifacts until export exists", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("Final text artifact"),
        artifactTarget: "text_artifact",
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: null,
        currentCostCredits: 20,
        handleGenerate,
        setUiNotice,
      })
    );

    expect(result.current.pulseArtifactGenerateDisabled).toBe(true);

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith(
      "This Pulse creates a text artifact. Generation is not available for this artifact target yet."
    );
  });

  it("fails closed when a completed Pulse has no resolved artifact target", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("Final artifact"),
        artifactTarget: null,
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: null,
        currentCostCredits: 20,
        handleGenerate,
        setUiNotice,
      })
    );

    expect(result.current.pulseArtifactGenerateDisabled).toBe(true);
    expect(result.current.pulseArtifactGenerateGuardrail).toBe(
      "This Pulse does not have a valid artifact target. Restart the Pulse or choose another Pulse."
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith(
      "This Pulse does not have a valid artifact target. Restart the Pulse or choose another Pulse."
    );
  });

  it("blocks Pulse generation until the workflow has an artifact", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseWorkflowSession: createCompletedWorkflowSession("   "),
        artifactTarget: "image_prompt",
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: null,
        currentCostCredits: 20,
        handleGenerate,
        setUiNotice,
      })
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Complete the active Pulse before generating.");
  });
});
