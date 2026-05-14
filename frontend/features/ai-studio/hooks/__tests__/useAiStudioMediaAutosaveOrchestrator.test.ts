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
        enabled: true,
        outputs: [createOutput()],
        mediaAutosaveEnabled: false,
        mediaAutosaveSyncState: "ready",
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
          enabled: true,
          outputs,
          mediaAutosaveEnabled: true,
          mediaAutosaveSyncState: "ready",
          saveReferenceToLibrary,
        }),
      {
        initialProps: {
          outputs: [createOutput({ id: "out-1" })],
        },
      }
    );

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("out-1", { intent: "auto" });

    rerender({
      outputs: [createOutput({ id: "out-1" })],
    });
    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
  });

  it("skips storage-backed library items and prompt-only references", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        enabled: true,
        outputs: [
          createOutput({
            id: "library-1",
            mediaSource: "library",
            previewStoragePath: "user-1/media-library/library-1.png",
            fullStoragePath: "user-1/media-library/library-1.png",
          }),
          createOutput({
            id: "library-2",
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
        mediaAutosaveSyncState: "ready",
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("autosaves restored generated outputs when they still need media-id backfill", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        enabled: true,
        outputs: [
          createOutput({
            id: "generated-restored-1",
            mediaSource: "generated",
            savedMediaIds: undefined,
            saveState: "failed",
            previewStoragePath: "user-1/media/generated-restored-1.png",
            fullStoragePath: "user-1/media/generated-restored-1.png",
          }),
        ],
        mediaAutosaveEnabled: true,
        mediaAutosaveSyncState: "ready",
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("generated-restored-1", {
      intent: "auto",
    });
  });

  it("allows a preview-only library ref to attempt one autosave repair", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        enabled: true,
        outputs: [
          createOutput({
            id: "library-repair-1",
            mediaSource: "library",
            previewStoragePath: undefined,
            fullStoragePath: undefined,
            savedMediaIds: undefined,
          }),
        ],
        mediaAutosaveEnabled: true,
        mediaAutosaveSyncState: "ready",
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("library-repair-1", { intent: "auto" });
  });

  it("does not autosave outputs that are already saving", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        enabled: true,
        outputs: [
          createOutput({
            id: "saving-1",
            saveState: "saving",
          }),
        ],
        mediaAutosaveEnabled: true,
        mediaAutosaveSyncState: "ready",
        saveReferenceToLibrary,
      })
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("does not autosave generated outputs until durable generation identity exists", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    renderHook(() =>
      useAiStudioMediaAutosaveOrchestrator({
        enabled: true,
        outputs: [
          createOutput({
            id: "generated-missing-id-1",
            mediaSource: "generated",
            generationId: undefined,
            taskId: "req-generated-missing-id",
          }),
        ],
        mediaAutosaveEnabled: true,
        mediaAutosaveSyncState: "ready",
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
          enabled: true,
          outputs,
          mediaAutosaveEnabled: true,
          mediaAutosaveSyncState: "ready",
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

  it("waits for preference authority before autosaving", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    const { rerender } = renderHook(
      ({ mediaAutosaveSyncState }: { mediaAutosaveSyncState: "loading" | "ready" }) =>
        useAiStudioMediaAutosaveOrchestrator({
          enabled: true,
          outputs: [createOutput({ id: "pref-race-1" })],
          mediaAutosaveEnabled: true,
          mediaAutosaveSyncState,
          saveReferenceToLibrary,
        }),
      {
        initialProps: {
          mediaAutosaveSyncState: "loading" as "loading" | "ready",
        },
      }
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();

    rerender({
      mediaAutosaveSyncState: "ready",
    });

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("pref-race-1", { intent: "auto" });
  });

  it("waits for the runtime gate before autosaving", () => {
    const saveReferenceToLibrary = vi.fn().mockResolvedValue(createPersistResult());
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAiStudioMediaAutosaveOrchestrator({
          enabled,
          outputs: [createOutput({ id: "bootstrap-gate-1" })],
          mediaAutosaveEnabled: true,
          mediaAutosaveSyncState: "ready",
          saveReferenceToLibrary,
        }),
      {
        initialProps: {
          enabled: false,
        },
      }
    );

    expect(saveReferenceToLibrary).not.toHaveBeenCalled();

    rerender({
      enabled: true,
    });

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("bootstrap-gate-1", { intent: "auto" });
  });
});
