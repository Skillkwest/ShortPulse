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
        pulseKind: "guided_workflow",
        pulseWorkflowSession: createCompletedWorkflowSession("  Completed Pulse artifact  "),
        latestAgentPrompt: null,
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
        pulseKind: "guided_workflow",
        pulseWorkflowSession: createCompletedWorkflowSession("  Video prompt  "),
        latestAgentPrompt: null,
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
      costOverrideCredits: 20,
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
        pulseKind: "guided_workflow",
        pulseWorkflowSession: createCompletedWorkflowSession("Final text artifact"),
        latestAgentPrompt: null,
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
        pulseKind: "guided_workflow",
        pulseWorkflowSession: createCompletedWorkflowSession("Final artifact"),
        latestAgentPrompt: null,
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
        pulseKind: "guided_workflow",
        pulseWorkflowSession: createCompletedWorkflowSession("   "),
        latestAgentPrompt: null,
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

  it("generates custom Pulses from the latest generated prompt without artifact routing", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseKind: "custom_gpt",
        pulseWorkflowSession: null,
        latestAgentPrompt: "  Dreamy dusk skyline with cinematic lighting  ",
        artifactTarget: null,
        effectiveGenerationGuardrail: null,
        promptReferenceGenerateCostCredits: 12,
        currentCostCredits: 20,
        handleGenerate,
        setUiNotice,
      })
    );

    expect(result.current.pulseArtifactGenerateDisabled).toBe(false);

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).toHaveBeenCalledWith("Dreamy dusk skyline with cinematic lighting", {
      modeOverride: undefined,
      toolOverride: undefined,
      costOverrideCredits: 20,
      suppressStyle: true,
    });
    expect(setUiNotice).not.toHaveBeenCalled();
  });

  it("keeps custom Pulses chat-only until they produce a generation-ready prompt", () => {
    const handleGenerate = vi.fn();
    const setUiNotice = vi.fn();

    const { result } = renderHook(() =>
      usePulseCreatePrimarySubmit({
        hasActivePulseSession: true,
        pulseKind: "custom_gpt",
        pulseWorkflowSession: null,
        latestAgentPrompt: "   ",
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
      "This Pulse has not produced a generation-ready prompt yet."
    );

    act(() => {
      result.current.handlePulseCreatePrimarySubmit();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith(
      "This Pulse has not produced a generation-ready prompt yet."
    );
  });
});
