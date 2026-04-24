import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";

const resolveGenerationIdForRequestIdMock = vi.hoisted(() => vi.fn());
const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const associatePromptWithProjectMock = vi.hoisted(() => vi.fn());

vi.mock("../../logic/mediaLibraryPersistence", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPersistence");
  return {
    ...actual,
    associateMediaFilesWithProject: associateMediaFilesWithProjectMock,
    associatePromptWithProject: associatePromptWithProjectMock,
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

  it("associates already-saved media with the active project without reuploading", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          savedMediaIds: ["media-1", "media-2"],
        }),
      ],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });

    const { result } = renderHook(() =>
      useAiStudioPersistenceActions({
        projectId: "project-1",
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

    await act(async () => {
      await result.current.persistOutputSave("out-1");
    });

    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      mediaFileIds: ["media-1", "media-2"],
    });
    expect(outputs.get("out-1")?.saveState).toBe("saved");
  });

  it("associates already-saved prompt references with the active project", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          previewUrl: undefined,
          previewText: "Saved prompt text",
          promptId: "prompt-1",
          savedMediaIds: undefined,
        }),
      ],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });

    const { result } = renderHook(() =>
      useAiStudioPersistenceActions({
        projectId: "project-1",
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

    await act(async () => {
      await result.current.persistOutputSave("out-1");
    });

    expect(associatePromptWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      promptId: "prompt-1",
    });
    expect(outputs.get("out-1")?.saveState).toBe("saved");
  });
});
