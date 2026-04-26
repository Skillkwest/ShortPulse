import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import { useAiStudioCreateModeRuntime } from "../useAiStudioCreateModeRuntime";
import type { CreatePulseSavedPreset } from "../../components/create/createPulsePresets";

const buildSavedPreset = (presetId: string): CreatePulseSavedPreset => ({
  presetId,
  label: `Pulse ${presetId}`,
  description: null,
  systemInstructions: "Follow the hidden Pulse contract.",
  runtimeMode: "prompt_editor",
  activationMode: "activate_only",
  starterAssistantMessage: null,
  outputMode: "apply_prompt",
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
  it("preserves Pulse runtime when switching back to standard mode through the UI handler", () => {
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: ["pulse-a"],
        savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: "pulse-a",
        initialPulseWorkflowSession: buildWorkflowSession("pulse-a"),
      })
    );

    act(() => {
      result.current.handleExpertCreateModeChange("standard");
    });

    expect(result.current.expertCreateMode).toBe("standard");
    expect(result.current.activeCreatePulsePresetId).toBe("pulse-a");
    expect(result.current.pulseWorkflowSession).toEqual(buildWorkflowSession("pulse-a"));
  });

  it("restores the same Pulse runtime when toggling back from standard mode", () => {
    const workflowSession = buildWorkflowSession("pulse-a");
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: ["pulse-a"],
        savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: "pulse-a",
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleExpertCreateModeChange("standard");
      result.current.handleExpertCreateModeChange("pulse");
    });

    expect(result.current.expertCreateMode).toBe("pulse");
    expect(result.current.activeCreatePulsePresetId).toBe("pulse-a");
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("clears stale workflow state when the active Pulse changes through the UI handler", () => {
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: ["pulse-a", "pulse-b"],
        savedCreatePulsePresets: [buildSavedPreset("pulse-a"), buildSavedPreset("pulse-b")],
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: "pulse-a",
        initialPulseWorkflowSession: buildWorkflowSession("pulse-a"),
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange("pulse-b");
    });

    expect(result.current.activeCreatePulsePresetId).toBe("pulse-b");
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("preserves workflow state when the same Pulse remains active", () => {
    const workflowSession = buildWorkflowSession("pulse-a");
    const { result } = renderHook(() =>
      useAiStudioCreateModeRuntime({
        selectedCreatePulsePresetIds: ["pulse-a"],
        savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        initialExpertCreateMode: "pulse",
        initialActiveCreatePulsePresetId: "pulse-a",
        initialPulseWorkflowSession: workflowSession,
      })
    );

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChange("pulse-a");
    });

    expect(result.current.activeCreatePulsePresetId).toBe("pulse-a");
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("clears Pulse runtime when the active preset disappears from the available rail set", () => {
    const { result, rerender } = renderHook(
      ({
        selectedCreatePulsePresetIds,
        savedCreatePulsePresets,
      }: {
        selectedCreatePulsePresetIds: string[];
        savedCreatePulsePresets: CreatePulseSavedPreset[];
      }) =>
        useAiStudioCreateModeRuntime({
          selectedCreatePulsePresetIds,
          savedCreatePulsePresets,
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: "pulse-a",
          initialPulseWorkflowSession: buildWorkflowSession("pulse-a"),
        }),
      {
        initialProps: {
          selectedCreatePulsePresetIds: ["pulse-a"],
          savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        },
      }
    );

    rerender({
      selectedCreatePulsePresetIds: [],
      savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
    });

    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });

  it("preserves a restored active Pulse on project routes even when it is not in the user rail set", () => {
    const workflowSession = buildWorkflowSession("pulse-a");
    const { result, rerender } = renderHook(
      ({
        projectId,
        selectedCreatePulsePresetIds,
        savedCreatePulsePresets,
      }: {
        projectId: string | null;
        selectedCreatePulsePresetIds: string[];
        savedCreatePulsePresets: CreatePulseSavedPreset[];
      }) =>
        useAiStudioCreateModeRuntime({
          projectId,
          selectedCreatePulsePresetIds,
          savedCreatePulsePresets,
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: "pulse-a",
          initialPulseWorkflowSession: workflowSession,
        }),
      {
        initialProps: {
          projectId: "project-1",
          selectedCreatePulsePresetIds: ["pulse-a"],
          savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        },
      }
    );

    rerender({
      projectId: "project-1",
      selectedCreatePulsePresetIds: [],
      savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
    });

    expect(result.current.activeCreatePulsePresetId).toBe("pulse-a");
    expect(result.current.pulseWorkflowSession).toEqual(workflowSession);
  });

  it("still clears a restored project Pulse when the preset definition no longer exists", () => {
    const { result, rerender } = renderHook(
      ({
        projectId,
        selectedCreatePulsePresetIds,
        savedCreatePulsePresets,
      }: {
        projectId: string | null;
        selectedCreatePulsePresetIds: string[];
        savedCreatePulsePresets: CreatePulseSavedPreset[];
      }) =>
        useAiStudioCreateModeRuntime({
          projectId,
          selectedCreatePulsePresetIds,
          savedCreatePulsePresets,
          initialExpertCreateMode: "pulse",
          initialActiveCreatePulsePresetId: "pulse-a",
          initialPulseWorkflowSession: buildWorkflowSession("pulse-a"),
        }),
      {
        initialProps: {
          projectId: "project-1",
          selectedCreatePulsePresetIds: [],
          savedCreatePulsePresets: [buildSavedPreset("pulse-a")],
        },
      }
    );

    rerender({
      projectId: "project-1",
      selectedCreatePulsePresetIds: [],
      savedCreatePulsePresets: [],
    });

    expect(result.current.activeCreatePulsePresetId).toBeNull();
    expect(result.current.pulseWorkflowSession).toBeNull();
  });
});
