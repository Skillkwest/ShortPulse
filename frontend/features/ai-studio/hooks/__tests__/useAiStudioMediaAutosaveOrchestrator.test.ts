import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioMediaAutosaveOrchestrator } from "../useAiStudioMediaAutosaveOrchestrator";
import type { PersistOutputSaveResult } from "../persistenceActionContracts";
import type { StudioOutput } from "../../types";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "test",
  mode: "image",
  aspect: "9:16",
  model: "model",
  status: "ready",
  timestamp: "now",
  mediaSource: "generated",
  generationId: "gen-1",
  previewUrl: "https://cdn.shortpulse.test/out.png",
  saveState: "idle",
  ...overrides,
});

const createPersistResult = (
  overrides: Partial<PersistOutputSaveResult> = {}
): PersistOutputSaveResult => ({
  ok: true,
  mediaFileIds: ["media-1"],
  promptId: null,
  delivery: null,
  error: null,
  ...overrides,
});

describe("useAiStudioMediaAutosaveOrchestrator", () => {
  it("does not autosave when media autosave preference is off", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        outputs: [createOutput()],
        mediaAutosaveEnabled: false,
        saveReferenceToLibrary,
      })
    );
    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("autosaves eligible unsaved media once and avoids rerender loops", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    const { rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useAiStudioMediaAutosaveOrchestrator({
          outputs,
          mediaAutosaveEnabled: true,
          saveReferenceToLibrary,
        }),
      {
        initialProps: {
          outputs: [createOutput({ id: "out-1" })],
        },
      }
    );

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("out-1");

    rerender({
      outputs: [createOutput({ id: "out-1" })],
    });
    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
  });

  it("skips library items already carrying savedMediaIds and prompt-only references", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        outputs: [
          createOutput({
            id: "library-1",
            mediaSource: "library",
            savedMediaIds: ["media-1"],
          }),
          createOutput({
            id: "prompt-only-1",
            mediaSource: "prompt",
            previewUrl: undefined,
            resultUrls: [],
            previewText: "Prompt only",
          }),
        ],
        mediaAutosaveEnabled: true,
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("does not autosave outputs that are already saving", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        outputs: [
          createOutput({
            id: "saving-1",
            saveState: "saving",
          }),
        ],
        mediaAutosaveEnabled: true,
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("does not autosave generated outputs until durable generation identity exists", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        outputs: [
          createOutput({
            id: "generated-missing-id-1",
            mediaSource: "generated",
            generationId: undefined,
            taskId: "req-generated-missing-id",
          }),
        ],
        mediaAutosaveEnabled: true,
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("retries a failed autosave once and then stops after the retry budget is exhausted", async () => {
    const saveReferenceToLibrary = vi
      .fn()
      .mockResolvedValueOnce(createPersistResult({ ok: false, mediaFileIds: [], error: "fail-1" }))
      .mockResolvedValueOnce(createPersistResult({ ok: false, mediaFileIds: [], error: "fail-2" }));
    const { rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useAiStudioMediaAutosaveOrchestrator({
          outputs,
          mediaAutosaveEnabled: true,
          saveReferenceToLibrary,
        }),
      {
        initialProps: {
          outputs: [createOutput({ id: "retry-1", saveState: "idle" })],
        },
      }
    );

    await waitFor(() => expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1));

    rerender({
      outputs: [createOutput({ id: "retry-1", saveState: "failed", saveError: "fail-1" })],
    });
    await waitFor(() => expect(saveReferenceToLibrary).toHaveBeenCalledTimes(2));

    rerender({
      outputs: [createOutput({ id: "retry-1", saveState: "failed", saveError: "fail-2" })],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(2);
  });
});
