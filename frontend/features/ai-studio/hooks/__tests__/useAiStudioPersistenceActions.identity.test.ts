import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";

const resolveGenerationIdForRequestIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../logic/mediaLibraryPersistence", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPersistence");
  return {
    ...actual,
    resolveGenerationIdForRequestId: resolveGenerationIdForRequestIdMock,
  };
});

import { useAiStudioPersistenceActions } from "../useAiStudioPersistenceActions";

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "prompt",
    mode: "image",
    aspect: "1:1",
    model: "model",
    status: "ready",
    timestamp: "now",
    mediaSource: "generated",
    taskId: "req-1",
    ...overrides,
  }) as StudioOutput;

describe("useAiStudioPersistenceActions ensureGenerationRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recovers generation id from request-backed lookup when output lacks one", async () => {
    const outputs = new Map<string, StudioOutput>([["out-1", makeOutput()]]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue("gen-from-projection");

    const { result } = renderHook(() =>
      useAiStudioPersistenceActions({
        findOutputById: (id) => outputs.get(id) ?? null,
        updateOutputById,
        setUiError: vi.fn(),
        setOutputs: vi.fn(),
        setSaved: vi.fn(),
        activeOutputId: "out-1",
        model: "model-id",
        aspect: "1:1",
        prompt: "prompt",
      })
    );

    let resolvedGenerationId: string | null = null;
    await act(async () => {
      resolvedGenerationId = await result.current.ensureGenerationRecord({
        outputId: "out-1",
        provider: "fal",
        taskId: "req-1",
      });
    });

    expect(resolvedGenerationId).toBe("gen-from-projection");
    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith("req-1");
    expect(outputs.get("out-1")?.generationId).toBe("gen-from-projection");
    expect(updateOutputById).toHaveBeenCalled();
  });
});
