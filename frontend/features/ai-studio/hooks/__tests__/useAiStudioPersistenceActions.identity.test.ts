import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";

const resolveGenerationIdForRequestIdMock = vi.hoisted(() => vi.fn());
const associateGenerationWithProjectMock = vi.hoisted(() => vi.fn());
const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const associatePromptWithProjectMock = vi.hoisted(() => vi.fn());
const saveMediaUrlToLibraryMock = vi.hoisted(() => vi.fn());

vi.mock("../../logic/mediaLibraryPersistence", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPersistence");
  return {
    ...actual,
    associateGenerationWithProject: associateGenerationWithProjectMock,
    associateMediaFilesWithProject: associateMediaFilesWithProjectMock,
    associatePromptWithProject: associatePromptWithProjectMock,
    resolveGenerationIdForRequestId: resolveGenerationIdForRequestIdMock,
    saveMediaUrlToLibrary: saveMediaUrlToLibraryMock,
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
    saveMediaUrlToLibraryMock.mockResolvedValue({
      mediaFileId: "media-new",
      storagePath: "user-1/generations/images/out-1.png",
      delivery: null,
    });
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
    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith("req-1", null);
    expect(outputs.get("out-1")?.generationId).toBe("gen-from-projection");
    expect(updateOutputById).toHaveBeenCalled();
  });

  it("associates resolved generation ids to the active project", async () => {
    const outputs = new Map<string, StudioOutput>([["out-1", makeOutput()]]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue("gen-from-project-route");

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
      await result.current.ensureGenerationRecord({
        outputId: "out-1",
        provider: "fal",
        taskId: "req-1",
      });
    });

    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith("req-1", "project-1");
    expect(associateGenerationWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: "gen-from-project-route",
    });
  });

  it("associates submit-provided generation ids to the active project without lookup", async () => {
    const outputs = new Map<string, StudioOutput>([
      ["out-1", makeOutput({ generationId: "gen-existing-project" })],
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

    let resolvedGenerationId: string | null = null;
    await act(async () => {
      resolvedGenerationId = await result.current.ensureGenerationRecord({
        outputId: "out-1",
        provider: "fal",
        taskId: "req-1",
      });
    });

    expect(resolvedGenerationId).toBe("gen-existing-project");
    expect(resolveGenerationIdForRequestIdMock).not.toHaveBeenCalled();
    expect(associateGenerationWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: "gen-existing-project",
    });
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

  it("still marks already-saved media as saved when project association fails", async () => {
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
    associateMediaFilesWithProjectMock.mockRejectedValueOnce(new Error("association failed"));

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

    let persistResult: Awaited<ReturnType<typeof result.current.persistOutputSave>> | null = null;
    await act(async () => {
      persistResult = await result.current.persistOutputSave("out-1");
    });

    expect(persistResult).toEqual(
      expect.objectContaining({
        ok: true,
        mediaFileIds: ["media-1", "media-2"],
      })
    );
    expect(outputs.get("out-1")?.saveState).toBe("saved");
  });

  it("associates only the requested saved image id for indexed image saves", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          resultUrls: [
            "https://cdn.example.com/result-0.png",
            "https://cdn.example.com/result-1.png",
          ],
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
      await result.current.persistOutputSave("out-1", { imageIndex: 1 });
    });

    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      mediaFileIds: ["media-2"],
    });
    expect(saveMediaUrlToLibraryMock).not.toHaveBeenCalled();
    expect(outputs.get("out-1")?.savedMediaIds).toEqual(["media-1", "media-2"]);
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

  it("keeps raw library-save failures in save state while sanitizing the banner", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          mediaSource: "upload",
          generationId: undefined,
          taskId: undefined,
          previewUrl: "https://cdn.shortpulse.test/restored-ref.png",
        }),
      ],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    const setUiError = vi.fn();
    saveMediaUrlToLibraryMock.mockRejectedValue(new Error("Signed URL expired."));

    const { result } = renderHook(() =>
      useAiStudioPersistenceActions({
        findOutputById: (id) => outputs.get(id) ?? null,
        updateOutputById,
        setUiError,
        setOutputs: vi.fn(),
        setSaved: vi.fn(),
        activeOutputId: "out-1",
        model: "model-id",
        aspect: "1:1",
        prompt: "prompt",
      })
    );

    let persistResult: Awaited<ReturnType<typeof result.current.persistOutputSave>> | null = null;
    await act(async () => {
      persistResult = await result.current.persistOutputSave("out-1");
    });

    expect(persistResult).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Signed URL expired.",
      })
    );
    expect(setUiError).toHaveBeenCalledWith(
      "Unable to save media to the library right now. Please try again."
    );
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: "failed",
        saveError: "Signed URL expired.",
      })
    );
  });

  it("clears the prior generic library banner after a later save succeeds", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          mediaSource: "upload",
          generationId: undefined,
          taskId: undefined,
          previewUrl: "https://cdn.shortpulse.test/restored-ref.png",
        }),
      ],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    const setUiError = vi.fn();
    saveMediaUrlToLibraryMock
      .mockRejectedValueOnce(new Error("Signed URL expired."))
      .mockResolvedValueOnce({
        mediaFileId: "media-restored",
        storagePath: "user-1/uploads/images/restored.png",
        delivery: null,
      });

    const { result } = renderHook(() =>
      useAiStudioPersistenceActions({
        findOutputById: (id) => outputs.get(id) ?? null,
        updateOutputById,
        setUiError,
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
    await act(async () => {
      await result.current.persistOutputSave("out-1");
    });

    expect(setUiError).toHaveBeenNthCalledWith(
      1,
      "Unable to save media to the library right now. Please try again."
    );
    const clearCall = setUiError.mock.calls.at(-1)?.[0];
    expect(typeof clearCall).toBe("function");
    expect(
      clearCall("Unable to save media to the library right now. Please try again.")
    ).toBeNull();
    expect(clearCall("Other unrelated issue")).toBe("Other unrelated issue");
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: "saved",
        saveError: null,
        savedMediaIds: ["media-restored"],
      })
    );
  });
});
