import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionAutosave } from "../useAiStudioSessionAutosave";
import { prepareAiStudioSessionAutosaveSnapshot } from "../../logic/sessionAutosaveSerialization";
import type {
  AiStudioSessionSnapshotV1,
  AiStudioSessionSnapshotV2,
} from "../../logic/sessionSnapshot";

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

const createSnapshotV2 = (
  overrides: Partial<AiStudioSessionSnapshotV2> = {}
): AiStudioSessionSnapshotV2 => ({
  schemaVersion: 2,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T00:00:00.000Z",
  meta: {
    generatedAt: "2026-03-02T00:00:00.000Z",
    checksum: "fnv1a32:aaaaaaaa",
  },
  workspace: createSnapshot().workspace,
  outputs: createSnapshot().outputs,
  agent: createSnapshot().agent,
  ...overrides,
});

describe("useAiStudioSessionAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("debounces snapshot writes", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
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
    expect(persistSnapshot).toHaveBeenCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({
        keepalive: false,
      })
    );
  });

  it("flushes immediately when visibility becomes hidden", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
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
    expect(persistSnapshot).toHaveBeenCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({
        keepalive: true,
      })
    );
  });

  it("flushes on pagehide event", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
        persistSnapshot,
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await vi.runAllTimersAsync();
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
    expect(persistSnapshot).toHaveBeenCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({
        keepalive: true,
      })
    );
  });

  it("flushes by max dirty timeout even when debounce keeps being reset", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const sid = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";
    const { rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshotV1 }) =>
        useAiStudioSessionAutosave({
          sessionId: sid,
          snapshot,
          enabled: true,
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

  it("keeps the original debounce when only snapshot timestamps change", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const sid = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";
    const { rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshotV2 }) =>
        useAiStudioSessionAutosave({
          sessionId: sid,
          snapshot,
          enabled: true,
          persistSnapshot,
        }),
      {
        initialProps: {
          snapshot: createSnapshotV2(),
        },
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    rerender({
      snapshot: createSnapshotV2({
        updatedAt: "2026-03-02T00:00:01.000Z",
        meta: {
          generatedAt: "2026-03-02T00:00:01.000Z",
          checksum: "fnv1a32:bbbbbbbb",
        },
      }),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(persistSnapshot).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not queue a duplicate save while the same semantic snapshot is in flight", async () => {
    let resolvePersist: (() => void) | null = null;
    const persistSnapshot = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePersist = resolve;
        })
    );
    const sid = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";
    const { rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshotV2 }) =>
        useAiStudioSessionAutosave({
          sessionId: sid,
          snapshot,
          enabled: true,
          persistSnapshot,
        }),
      {
        initialProps: {
          snapshot: createSnapshotV2(),
        },
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);

    rerender({
      snapshot: createSnapshotV2({
        updatedAt: "2026-03-02T00:00:02.000Z",
        meta: {
          generatedAt: "2026-03-02T00:00:02.000Z",
          checksum: "fnv1a32:cccccccc",
        },
      }),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePersist?.();
      await Promise.resolve();
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses a compact semantic hash that ignores volatile timestamp metadata", () => {
    const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(createSnapshotV2(), {
      title: "Prepared Project",
    });
    const preparedTimestampOnlyChange = prepareAiStudioSessionAutosaveSnapshot(
      createSnapshotV2({
        updatedAt: "2026-03-02T00:00:02.000Z",
        meta: {
          generatedAt: "2026-03-02T00:00:02.000Z",
          checksum: "fnv1a32:cccccccc",
        },
      }),
      {
        title: "Prepared Project",
      }
    );

    expect(preparedSnapshot.hash).toMatch(/^fnv1a32:/);
    expect(preparedSnapshot.hash).toBe(preparedTimestampOnlyChange.hash);
    expect(preparedSnapshot.hash?.length ?? 0).toBeLessThan(32);
  });

  it("uses a prepared autosave snapshot when one is supplied", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshotV2();
    const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(snapshot, {
      title: "Prepared Project",
    });
    const resolveSnapshotTitle = vi.fn(() => "Should not be used");

    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
        persistSnapshot,
        resolveSnapshotTitle,
        preparedSnapshot,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(resolveSnapshotTitle).not.toHaveBeenCalled();
    expect(persistSnapshot).toHaveBeenCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({
        title: "Prepared Project",
      })
    );
  });

  it("reports oversize snapshots and skips persistence", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const onPersistError = vi.fn();
    const snapshot = createSnapshot({
      workspace: {
        ...createSnapshot().workspace,
        prompt: "x".repeat(10_000),
      },
    });

    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
        maxSnapshotBytes: 1024,
        persistSnapshot,
        onPersistError,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(persistSnapshot).not.toHaveBeenCalled();
    expect(onPersistError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        reason: "snapshot_too_large",
        maxSnapshotBytes: 1024,
      })
    );
  });

  it("retries one failed persistence attempt and then pauses repeated failures for the same snapshot", async () => {
    const persistSnapshot = vi.fn().mockRejectedValue(new Error("workspace down"));
    const onPersistError = vi.fn();
    const snapshot = createSnapshot();

    renderHook(() =>
      useAiStudioSessionAutosave({
        sessionId: snapshot.sessionId,
        snapshot,
        enabled: true,
        persistSnapshot,
        maxPersistRetries: 1,
        onPersistError,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
    expect(onPersistError).toHaveBeenNthCalledWith(
      1,
      expect.any(Error),
      expect.objectContaining({
        reason: "persist_failed",
        attempt: 1,
        maxAttempts: 2,
        willRetry: true,
        remainingRetries: 1,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(2);
    expect(onPersistError).toHaveBeenNthCalledWith(
      2,
      expect.any(Error),
      expect.objectContaining({
        reason: "persist_failed",
        attempt: 2,
        maxAttempts: 2,
        willRetry: false,
        remainingRetries: 0,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(2);
  });

  it("persists when only the resolved title changes", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const snapshot = createSnapshot();
    const { rerender } = renderHook(
      ({ resolveSnapshotTitle }: { resolveSnapshotTitle: () => string | null }) =>
        useAiStudioSessionAutosave({
          sessionId: snapshot.sessionId,
          snapshot,
          enabled: true,
          persistSnapshot,
          resolveSnapshotTitle,
        }),
      {
        initialProps: {
          resolveSnapshotTitle: () => "Project Alpha",
        },
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(1);
    expect(persistSnapshot).toHaveBeenLastCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({ title: "Project Alpha" })
    );

    rerender({ resolveSnapshotTitle: () => "Project Beta" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(2);
    expect(persistSnapshot).toHaveBeenLastCalledWith(
      snapshot.sessionId,
      snapshot,
      expect.objectContaining({ title: "Project Beta" })
    );
  });

  it("does not skip a save for a different session when the snapshot content is identical", async () => {
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const sharedSnapshot = createSnapshotV2();
    const { rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useAiStudioSessionAutosave({
          sessionId,
          snapshot: sharedSnapshot,
          enabled: true,
          persistSnapshot,
        }),
      {
        initialProps: {
          sessionId: "project-1",
        },
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    rerender({
      sessionId: "project-2",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(persistSnapshot).toHaveBeenCalledTimes(2);
    expect(persistSnapshot).toHaveBeenNthCalledWith(
      1,
      "project-1",
      sharedSnapshot,
      expect.objectContaining({ keepalive: false })
    );
    expect(persistSnapshot).toHaveBeenNthCalledWith(
      2,
      "project-2",
      sharedSnapshot,
      expect.objectContaining({ keepalive: false })
    );
  });
});
