import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionWriteShadow } from "../useAiStudioSessionWriteShadow";
import type { AiStudioSessionSnapshotV1 } from "../../logic/sessionSnapshot";

const createSnapshot = (
  overrides: Partial<AiStudioSessionSnapshotV1> = {}
): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T00:00:00.000Z",
  workspace: {
    mode: "image",
    selectedTool: "create",
    prompt: "prompt",
    model: null,
    aspect: "9:16",
    referenceImageUrl: null,
    extraImageUrls: [null, null, null],
    editReferenceText: "",
    videoReferenceText: "",
    videoReferenceMode: "standard",
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingShotType: "customize",
    klingVoiceIds: ["", ""],
    klingMultiPrompts: [],
    klingElements: [],
    motionReferenceVideoUrl: null,
  },
  outputs: {
    active: [],
    archived: [],
    activeOutputId: null,
    curatedReferenceIds: [],
    removedFromAllRefsIds: [],
  },
  agent: {
    messages: [],
    input: "",
    latestAgentPrompt: null,
    promptOrigin: "manual",
    chatModeEnabled: true,
  },
  ...overrides,
});

describe("useAiStudioSessionWriteShadow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("debounces snapshot writes", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionWriteShadow({
        sessionId: snapshot.sessionId,
        snapshot,
        persistSnapshot,
      })
    );

    expect(persistSnapshot).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2499);
    });
    expect(persistSnapshot).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it("flushes immediately when visibility becomes hidden", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionWriteShadow({
        sessionId: snapshot.sessionId,
        snapshot,
        persistSnapshot,
      })
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.runAllTimersAsync();
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it("flushes on pagehide event", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionWriteShadow({
        sessionId: snapshot.sessionId,
        snapshot,
        persistSnapshot,
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await vi.runAllTimersAsync();
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it("flushes by max dirty timeout even when debounce keeps being reset", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const sid = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";
    const { rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshotV1 }) =>
        useAiStudioSessionWriteShadow({
          sessionId: sid,
          snapshot,
          persistSnapshot,
        }),
      { initialProps: { snapshot: createSnapshot({ updatedAt: "2026-03-02T00:00:00.000Z" }) } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      rerender({ snapshot: createSnapshot({ updatedAt: "2026-03-02T00:00:01.000Z" }) });
      await vi.advanceTimersByTimeAsync(1000);
      rerender({ snapshot: createSnapshot({ updatedAt: "2026-03-02T00:00:02.000Z" }) });
      await vi.advanceTimersByTimeAsync(13000);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });
});
