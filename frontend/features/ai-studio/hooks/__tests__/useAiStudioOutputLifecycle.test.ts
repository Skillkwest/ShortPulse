import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRef, useState } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioOutputLifecycle } from "../useAiStudioOutputLifecycle";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: "Original prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  previewText: "Original prompt",
  ...overrides,
});

const useHarness = (initialOutputs: StudioOutput[], initialActiveOutputId: string | null) => {
  const [outputs, setOutputs] = useState<StudioOutput[]>(initialOutputs);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(initialActiveOutputId);
  const [uiError, setUiError] = useState<string | null>(null);
  const pendingAutoSavesRef = useRef<Record<string, { taskId: string }>>({
    "out-1": { taskId: "task-1" },
  });

  const lifecycle = useAiStudioOutputLifecycle({
    outputs,
    setOutputs,
    activeOutputId,
    setActiveOutputId,
    pendingAutoSavesRef,
    setUiError,
  });

  return {
    outputs,
    activeOutputId,
    uiError,
    pendingAutoSavesRef,
    ...lifecycle,
  };
};

describe("useAiStudioOutputLifecycle", () => {
  it("normalizes failure output state and emits a UI error", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1", { taskState: "running" })], "out-1")
    );

    act(() => {
      result.current.notifyGenerationFailure("out-1", "Provider failure", "Detailed reason");
    });

    expect(result.current.outputs[0]?.taskState).toBe("fail");
    expect(result.current.outputs[0]?.timestamp).toBe("Failed");
    expect(result.current.outputs[0]?.errorMessage).toBe("Provider failure");
    expect(result.current.outputs[0]?.errorDetail).toBe("Detailed reason");
    expect(result.current.uiError).toContain("failed");
    expect(result.current.pendingAutoSavesRef.current["out-1"]).toBeUndefined();
  });

  it("updates prompts with trimmed text and ignores empty updates", () => {
    const { result } = renderHook(() => useHarness([makeOutput("out-1")], "out-1"));

    act(() => {
      result.current.updateOutputPrompt("out-1", "   ");
    });
    expect(result.current.outputs[0]?.prompt).toBe("Original prompt");

    act(() => {
      result.current.updateOutputPrompt("out-1", "  Updated prompt  ");
    });
    expect(result.current.outputs[0]?.prompt).toBe("Updated prompt");
    expect(result.current.outputs[0]?.previewText).toBe("Updated prompt");
    expect(result.current.outputs[0]?.timestamp).toBe("Edited");
  });

  it("deletes outputs and clears the active selection when needed", () => {
    const { result } = renderHook(() =>
      useHarness([makeOutput("out-1"), makeOutput("out-2")], "out-1")
    );

    act(() => {
      result.current.deleteOutput("out-1");
    });

    expect(result.current.outputs.map((item) => item.id)).toEqual(["out-2"]);
    expect(result.current.activeOutputId).toBeNull();
    expect(result.current.pendingAutoSavesRef.current["out-1"]).toBeUndefined();
  });
});
