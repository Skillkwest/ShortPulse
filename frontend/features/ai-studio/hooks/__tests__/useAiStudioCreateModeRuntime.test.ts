import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import { useAiStudioCreateModeRuntime } from "../useAiStudioCreateModeRuntime";
import type { CreatePulseSavedPreset } from "../../components/create/createPulsePresets";

const ACTIVE_PULSE_ID = "story_builder";
const NEXT_PULSE_ID = "multi_shot";
const TEST_PULSE_SESSION_ID = "pulse-session-story-builder";
const CUSTOM_PULSE_ID = "custom-story";

const buildSavedPreset = (presetId: string): CreatePulseSavedPreset => ({
  presetId,
  label: `Pulse ${presetId}`,
  description: null,
  systemInstructions: "Follow the hidden Pulse contract.",
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  starterAssistantMessage: null,
  outputMode: "chat_reply",
  memoryPolicy: "session",
  workflowStageHints: null,
  createdAt: null,
});

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
  it("clears Pulse runtime when switching back to standard mode through the UI handler", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID],
        savedCreatePulsePresets: [],
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
    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseSessionInstanceId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("re-enters Pulse mode without restoring the prior hidden runtime after Standard", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID],
        savedCreatePulsePresets: [],
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
    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseSessionInstanceId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("clears stale workflow state when the active Pulse changes through the UI handler", () => {
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID, NEXT_PULSE_ID],
        savedCreatePulsePresets: [],
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

  it("preserves workflow state when the same Pulse remains active", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID],
        savedCreatePulsePresets: [],
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

  it("clears Pulse runtime when the active preset disappears from the available rail set", () => {
    const { result, rerender } = renderHook(
      ({ selectedCreatePulsePresetIds }: { selectedCreatePulsePresetIds: string[] }) =>
        useAiStudioCreateModeRuntime({
          selectedCreatePulsePresetIds,
          savedCreatePulsePresets: [],
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
          initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
          initialPulseWorkflowSession: buildWorkflowSession(ACTIVE_PULSE_ID),
        }),
      {
        initialProps: {
          selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID],
        },
      }
    );

    rerender({
      selectedCreatePulsePresetIds: [],
    });

    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("preserves a restored active Pulse on project routes even when it is not in the user rail set", () => {
    const workflowSession = buildWorkflowSession(ACTIVE_PULSE_ID);
    const { result, rerender } = renderHook(
      ({
        projectId,
        selectedCreatePulsePresetIds,
      }: {
        projectId: string | null;
        selectedCreatePulsePresetIds: string[];
      }) =>
        useAiStudioCreateModeRuntime({
          projectId,
          selectedCreatePulsePresetIds,
          savedCreatePulsePresets: [],
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: ACTIVE_PULSE_ID,
          initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
          initialPulseWorkflowSession: workflowSession,
        }),
      {
        initialProps: {
          projectId: "project-1",
          selectedCreatePulsePresetIds: [ACTIVE_PULSE_ID],
        },
      }
    );

    rerender({
      projectId: "project-1",
      selectedCreatePulsePresetIds: [],
    });

    expect(result.current.activeCreatePulsePresetId).toBe(ACTIVE_PULSE_ID);
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("still clears a restored project Pulse when the preset definition no longer exists", () => {
    const { result, rerender } = renderHook(
      ({
        projectId,
        savedCreatePulsePresets,
      }: {
        projectId: string | null;
        savedCreatePulsePresets: CreatePulseSavedPreset[];
      }) =>
        useAiStudioCreateModeRuntime({
          projectId,
          selectedCreatePulsePresetIds: [],
          savedCreatePulsePresets,
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: CUSTOM_PULSE_ID,
          initialPulseSessionInstanceId: TEST_PULSE_SESSION_ID,
          initialPulseWorkflowSession: buildWorkflowSession(CUSTOM_PULSE_ID),
        }),
      {
        initialProps: {
          projectId: "project-1",
          savedCreatePulsePresets: [buildSavedPreset(CUSTOM_PULSE_ID)],
        },
      }
    );

    rerender({
      projectId: "project-1",
      savedCreatePulsePresets: [],
    });

    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });
});
