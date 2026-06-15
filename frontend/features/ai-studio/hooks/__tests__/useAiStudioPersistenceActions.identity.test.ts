import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../../../../lib/mediaStorageQuota";

const resolveGenerationIdForRequestIdMock = vi.hoisted(() => vi.fn());
const associateGenerationWithProjectMock = vi.hoisted(() => vi.fn());
const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const associatePromptWithProjectMock = vi.hoisted(() => vi.fn());
const reportAppErrorMock = vi.hoisted(() => vi.fn());
const saveMediaUrlToLibraryMock = vi.hoisted(() => vi.fn());
const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: reportAppErrorMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

import { useAiStudioPersistenceActions } from "../useAiStudioPersistenceActions";

const RESOLVED_GENERATION_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_GENERATION_ID = "22222222-2222-4222-8222-222222222222";
const EXISTING_GENERATION_ID = "33333333-3333-4333-8333-333333333333";
const CURRENT_USER_ID = "user-1";

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
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: CURRENT_USER_ID } } as never,
      user: { id: CURRENT_USER_ID } as never,
    });
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
    resolveGenerationIdForRequestIdMock.mockResolvedValue(RESOLVED_GENERATION_ID);

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

    expect(resolvedGenerationId).toBe(RESOLVED_GENERATION_ID);
    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith(
      "req-1",
      null,
      CURRENT_USER_ID
    );
    expect(outputs.get("out-1")?.generationId).toBe(RESOLVED_GENERATION_ID);
    expect(updateOutputById).toHaveBeenCalled();
  });

  it("associates resolved generation ids to the active project", async () => {
    const outputs = new Map<string, StudioOutput>([["out-1", makeOutput()]]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue(PROJECT_GENERATION_ID);

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

    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith(
      "req-1",
      "project-1",
      CURRENT_USER_ID
    );
    expect(associateGenerationWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: PROJECT_GENERATION_ID,
      userId: CURRENT_USER_ID,
    });
  });

  it("associates submit-provided canonical generation ids to the active project without lookup", async () => {
    const outputs = new Map<string, StudioOutput>([
      ["out-1", makeOutput({ generationId: EXISTING_GENERATION_ID })],
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

    expect(resolvedGenerationId).toBe(EXISTING_GENERATION_ID);
    expect(resolveGenerationIdForRequestIdMock).not.toHaveBeenCalled();
    expect(associateGenerationWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: EXISTING_GENERATION_ID,
      userId: CURRENT_USER_ID,
    });
  });

  it("re-resolves stale non-canonical generation ids before associating them to the active project", async () => {
    const outputs = new Map<string, StudioOutput>([
      ["out-1", makeOutput({ generationId: "gen-stale-project" })],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue(PROJECT_GENERATION_ID);

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

    expect(resolvedGenerationId).toBe(PROJECT_GENERATION_ID);
    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith(
      "req-1",
      "project-1",
      CURRENT_USER_ID
    );
    expect(outputs.get("out-1")?.generationId).toBe(PROJECT_GENERATION_ID);
    expect(associateGenerationWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      generationId: PROJECT_GENERATION_ID,
      userId: CURRENT_USER_ID,
    });
  });

  it("canonicalizes stale generation ids before generated media saves", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          generationId: "gen-stale-project",
          previewUrl: "https://cdn.example.com/generated.png",
          resultUrls: ["https://cdn.example.com/generated.png"],
        }),
      ],
    ]);
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      const current = outputs.get(id);
      if (!current) return;
      outputs.set(id, updater(current));
    });
    resolveGenerationIdForRequestIdMock.mockResolvedValue(PROJECT_GENERATION_ID);

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

    expect(resolveGenerationIdForRequestIdMock).toHaveBeenCalledWith(
      "req-1",
      "project-1",
      CURRENT_USER_ID
    );
    expect(saveMediaUrlToLibraryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: PROJECT_GENERATION_ID,
        userId: CURRENT_USER_ID,
      })
    );
    expect(outputs.get("out-1")?.generationId).toBe(PROJECT_GENERATION_ID);
  });

  it("persists generated music lyrics and mode metadata on manual library save", async () => {
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          mode: "audio",
          resultUrls: ["https://signed.example/music.mp3"],
          generationId: EXISTING_GENERATION_ID,
          lyricsText: "City lights on the water\nWe keep moving through the night",
          musicMode: "vocal",
          audioSourceMode: "music",
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

    expect(saveMediaUrlToLibraryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: EXISTING_GENERATION_ID,
        metadata: expect.objectContaining({
          lyrics_text: "City lights on the water\nWe keep moving through the night",
          music_mode: "vocal",
          source_mode: "music",
        }),
      })
    );
  });

  it("persists workflow reload and replay metadata mirrors on manual library save", async () => {
    const workflowReload = {
      version: 1,
      source: "ai_studio_generation",
      capturedAt: "2026-06-15T10:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      restoreBehavior: "navigate_and_hydrate",
      prompt: { display: "A glass lighthouse" },
      model: { id: "fal-ai/imagen4/preview" },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "16:9",
        imageResolution: "1K",
        referenceInputs: [],
        internalMediaRefs: [],
      },
    };
    const generationReplay = {
      version: 1,
      source: "ai_studio_generation",
      submitTool: "create",
      prompt: "A glass lighthouse",
      model: "fal-ai/imagen4/preview",
      aspect: "16:9",
      referenceInputs: [],
    };
    const outputs = new Map<string, StudioOutput>([
      [
        "out-1",
        makeOutput({
          resultUrls: ["https://signed.example/generated.png"],
          generationId: EXISTING_GENERATION_ID,
          workflowReload,
          generationReplay,
          styleContext: { styleId: "style-1", stylePrompt: "studio glass lighting" },
        } as Partial<StudioOutput>),
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

    expect(saveMediaUrlToLibraryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: EXISTING_GENERATION_ID,
        metadata: expect.objectContaining({
          workflow_reload: workflowReload,
          generation_replay: generationReplay,
          style_context: { styleId: "style-1", stylePrompt: "studio glass lighting" },
        }),
      })
    );
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
      userId: CURRENT_USER_ID,
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
      userId: CURRENT_USER_ID,
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
      userId: CURRENT_USER_ID,
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
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.media_library_save_failure",
        message: "Signed URL expired.",
        metadata: expect.objectContaining({
          output_id: "out-1",
          persist_intent: "manual",
          ui_error_message: "Unable to save media to the library right now. Please try again.",
        }),
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

  it("keeps generic background autosave failures out of the page banner and card state while still reporting telemetry", async () => {
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

    await act(async () => {
      await result.current.persistOutputSave("out-1", { intent: "auto" });
    });

    expect(setUiError).not.toHaveBeenCalled();
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: undefined,
        saveError: undefined,
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.media_library_save_failure",
        message: "Signed URL expired.",
        metadata: expect.objectContaining({
          output_id: "out-1",
          persist_intent: "auto",
          ui_error_message: null,
        }),
      })
    );
  });

  it("normalizes quota failures into blocked_storage with friendly copy", async () => {
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
    saveMediaUrlToLibraryMock.mockRejectedValue(
      new Error(
        "Media storage limit exceeded. Delete media, upgrade your plan, or add recurring storage before saving more files."
      )
    );

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

    expect(setUiError).toHaveBeenCalledWith(
      "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files."
    );
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: "blocked_storage",
        saveError:
          "Media storage limit exceeded. Delete media, upgrade your plan, or add recurring storage before saving more files.",
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          ui_error_message:
            "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
        }),
      })
    );
  });

  it("treats the canonical friendly storage-full message as blocked_storage", async () => {
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
    saveMediaUrlToLibraryMock.mockRejectedValue(new Error(MEDIA_STORAGE_FULL_USER_MESSAGE));

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

    expect(setUiError).toHaveBeenCalledWith(MEDIA_STORAGE_FULL_USER_MESSAGE);
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: "blocked_storage",
        saveError: MEDIA_STORAGE_FULL_USER_MESSAGE,
      })
    );
  });

  it("reruns a manual save after an in-flight autosave fails so manual UX is preserved", async () => {
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
    let rejectAutoSave: ((reason?: unknown) => void) | null = null;
    saveMediaUrlToLibraryMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectAutoSave = reject;
          })
      )
      .mockRejectedValueOnce(new Error("Manual save failed."));

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

    let autoPromise!: Promise<Awaited<ReturnType<typeof result.current.persistOutputSave>>>;
    let manualPromise!: Promise<Awaited<ReturnType<typeof result.current.persistOutputSave>>>;
    act(() => {
      autoPromise = result.current.persistOutputSave("out-1", { intent: "auto" });
      manualPromise = result.current.persistOutputSave("out-1");
    });

    await waitFor(() => expect(rejectAutoSave).not.toBeNull());

    await act(async () => {
      rejectAutoSave?.(new Error("Auto save failed."));
      await autoPromise;
    });

    let manualResult: Awaited<ReturnType<typeof result.current.persistOutputSave>> | null = null;
    await act(async () => {
      manualResult = await manualPromise;
    });

    await waitFor(() => expect(saveMediaUrlToLibraryMock).toHaveBeenCalledTimes(2));
    expect(saveMediaUrlToLibraryMock).toHaveBeenCalledTimes(2);
    expect(manualResult).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Manual save failed.",
      })
    );
    expect(setUiError).toHaveBeenCalledWith(
      "Unable to save media to the library right now. Please try again."
    );
    expect(outputs.get("out-1")).toEqual(
      expect.objectContaining({
        saveState: "failed",
        saveError: "Manual save failed.",
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.media_library_save_failure",
        message: "Manual save failed.",
        metadata: expect.objectContaining({
          output_id: "out-1",
          persist_intent: "manual",
          ui_error_message: "Unable to save media to the library right now. Please try again.",
        }),
      })
    );
  });
});
