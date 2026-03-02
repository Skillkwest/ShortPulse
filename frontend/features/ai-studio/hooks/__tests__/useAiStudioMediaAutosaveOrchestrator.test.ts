import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioMediaAutosaveOrchestrator } from "../useAiStudioMediaAutosaveOrchestrator";
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
  previewUrl: "https://cdn.shortpulse.test/out.png",
  saveState: "idle",
  ...overrides,
});

describe("useAiStudioMediaAutosaveOrchestrator", () => {
  it("does not autosave when media autosave preference is off", () => {
    const saveReferenceToLibrary = vi.fn();
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
    const saveReferenceToLibrary = vi.fn();
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
    const saveReferenceToLibrary = vi.fn();
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
});
