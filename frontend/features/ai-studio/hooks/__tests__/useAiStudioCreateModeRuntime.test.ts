import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import { useAiStudioCreateModeRuntime } from "../useAiStudioCreateModeRuntime";

const ACTIVE_PULSE_ID = "story_builder";
const NEXT_PULSE_ID = "multi_shot";
const TEST_PULSE_SESSION_ID = "pulse-session-story-builder";

const buildWorkflowSession = (presetId: string): AgentPulseWorkflowSession => ({
  presetId,
  status: "awaiting_input",
  currentStepIndex: 1,
  currentStepLabel: "Step 1",
  currentStepPrompt: "Tell me more.",
  collectedInputs: ["seed input"],
  lastArtifact: null,
  finalArtifactSource: null,
});

describe("useAiStudioCreateModeRuntime", () => {
  it("drops retired Pulse preset state during initialization", () => {
    const workflowSession = buildWorkflowSession("single_shot");
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: "single_shot",
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    expect(result.current.expertCreateMode).toBe("pulse");
    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseSessionInstanceId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("preserves the hidden Pulse runtime when switching back to standard mode through the UI handler", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleExpertCreateModeChange("standard");
    });

    expect(result.current.expertCreateMode).toBe("standard");
    expect(result.current.activeCreatePulsePresetId).toBe(ACTIVE_PULSE_ID);
    expect(result.current.pulseSessionInstanceId).toBe(TEST_PULSE_SESSION_ID);
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("re-enters Pulse mode with the prior hidden runtime after Standard", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleExpertCreateModeChange("standard");
    });

    act(() => {
      result.current.handleExpertCreateModeChange("pulse");
    });

    expect(result.current.expertCreateMode).toBe("pulse");
    expect(result.current.activeCreatePulsePresetId).toBe(ACTIVE_PULSE_ID);
    expect(result.current.pulseSessionInstanceId).toBe(TEST_PULSE_SESSION_ID);
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("keeps explicit Pulse deactivation destructive without changing back to Standard", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.deactivatePulse();
    });

    expect(result.current.expertCreateMode).toBe("pulse");
    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseSessionInstanceId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("clears stale workflow state when the active Pulse changes through the UI handler", () => {
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: buildWorkflowSession(ACTIVE_PULSE_ID),
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange(NEXT_PULSE_ID);
    });

    expect(result.current.activeCreatePulsePresetId).toBe(NEXT_PULSE_ID);
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("rejects retired Pulse preset ids through the UI handler", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange("single_shot");
    });

    expect(result.current.expertCreateMode).toBe("pulse");
    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseSessionInstanceId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("preserves workflow state when the same Pulse remains active", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange(ACTIVE_PULSE_ID);
    });

    expect(result.current.activeCreatePulsePresetId).toBe(ACTIVE_PULSE_ID);
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("can force a fresh session for the same Pulse during activation rollback", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
        initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange(ACTIVE_PULSE_ID, {
        forceNewSession: true,
      });
    });

    expect(result.current.activeCreatePulsePresetId).toBe(ACTIVE_PULSE_ID);
    expect(result.current.pulseSessionInstanceId).not.toBe(TEST_PULSE_SESSION_ID);
    expect(result.current.pulseWorkflowSession).toBeNull();
  });
});
