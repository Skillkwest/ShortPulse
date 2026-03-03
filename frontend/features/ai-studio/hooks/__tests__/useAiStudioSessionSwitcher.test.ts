import { act, renderHook, waitFor } from "@testing-library/react";
import { useRouter } from "next/router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionSwitcher } from "../useAiStudioSessionSwitcher";
import type { AiStudioSessionSnapshotV1 } from "../../logic/sessionSnapshot";

const listSessionsMock = vi.fn();
const persistSessionMock = vi.fn();
const loadRestoreCandidateMock = vi.fn();

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

vi.mock("../../logic/sessionApiClient", () => ({
  listAiStudioSessionsViaApi: (...args: unknown[]) => listSessionsMock(...args),
}));

vi.mock("../../logic/sessionShadowPersistence", () => ({
  persistAiStudioSessionShadow: (...args: unknown[]) => persistSessionMock(...args),
}));

vi.mock("../../logic/sessionRestoreCandidate", () => ({
  loadAiStudioSessionRestoreCandidate: (...args: unknown[]) => loadRestoreCandidateMock(...args),
}));

const mockedUseRouter = vi.mocked(useRouter);
let routerMock: {
  pathname: string;
  query: Record<string, unknown>;
  replace: ReturnType<typeof vi.fn>;
};

const createSnapshot = (
  overrides: Partial<AiStudioSessionSnapshotV1> = {}
): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T00:00:00.000Z",
  workspace: {
    mode: "image",
    selectedTool: "create",
    prompt: "Current prompt",
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

const makeSessionItem = (sessionId: string) => ({
  sessionId,
  title: "Session",
  schemaVersion: 1,
  saveSeq: 2,
  updatedAt: "2026-03-02T00:00:00.000Z",
  expiresAt: "2026-08-29T00:00:00.000Z",
});

describe("useAiStudioSessionSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMock = {
      pathname: "/ai-studio",
      query: {},
      replace: vi.fn().mockResolvedValue(true),
    };
    mockedUseRouter.mockReturnValue(routerMock as never);
  });

  it("loads recent sessions when modal opens", async () => {
    listSessionsMock.mockResolvedValue({
      sessions: [makeSessionItem("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a")],
      nextCursor: "cursor-1",
    });
    const hydrateFromSessionSnapshot = vi.fn();
    const hydrateFromSessionAgentSnapshot = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioSessionSwitcher({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionSnapshot: createSnapshot(),
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        setSkipRestoreApplyForSessionId: vi.fn(),
      })
    );

    act(() => {
      result.current.handleOpenSessionsModal();
    });

    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.nextCursor).toBe("cursor-1");
  });

  it("switches sessions via save then hydrate then URL replace", async () => {
    listSessionsMock.mockResolvedValue({
      sessions: [makeSessionItem("a7f45245-f204-4ece-8f9e-c9a66a9d8d2a")],
      nextCursor: null,
    });
    persistSessionMock.mockResolvedValue(undefined);
    const targetSnapshot = createSnapshot({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T01:00:00.000Z",
    });
    loadRestoreCandidateMock.mockResolvedValue({
      snapshot: targetSnapshot,
      source: "remote",
    });
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue({
      workspace: {},
      outputs: {},
      agent: {
        messages: [],
        input: "draft",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
      },
    });
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const setSkipRestoreApplyForSessionId = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioSessionSwitcher({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionSnapshot: createSnapshot(),
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        setSkipRestoreApplyForSessionId,
      })
    );

    act(() => {
      result.current.handleRequestSessionSwitch(
        makeSessionItem("a7f45245-f204-4ece-8f9e-c9a66a9d8d2a")
      );
    });
    await waitFor(() => {
      expect(result.current.pendingSessionSwitch?.sessionId).toBe(
        "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
      );
    });

    await act(async () => {
      await result.current.handleConfirmSessionSwitch();
    });

    expect(persistSessionMock).toHaveBeenCalledTimes(1);
    expect(loadRestoreCandidateMock).toHaveBeenCalledWith({
      sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      remoteEnabled: true,
    });
    expect(hydrateFromSessionSnapshot).toHaveBeenCalledWith(targetSnapshot);
    expect(hydrateFromSessionAgentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ input: "draft" })
    );
    expect(setSkipRestoreApplyForSessionId).toHaveBeenCalledWith(
      "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
    );
    expect(routerMock.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ sid: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a" }),
      }),
      undefined,
      expect.objectContaining({ shallow: true, scroll: false })
    );
  });

  it("surfaces save failures and aborts switch", async () => {
    persistSessionMock.mockRejectedValue(new Error("save failed"));
    const { result } = renderHook(() =>
      useAiStudioSessionSwitcher({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionSnapshot: createSnapshot(),
        hydrateFromSessionSnapshot: vi.fn(),
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setSkipRestoreApplyForSessionId: vi.fn(),
      })
    );

    act(() => {
      result.current.handleRequestSessionSwitch(
        makeSessionItem("a7f45245-f204-4ece-8f9e-c9a66a9d8d2a")
      );
    });

    await act(async () => {
      await result.current.handleConfirmSessionSwitch();
    });

    expect(loadRestoreCandidateMock).not.toHaveBeenCalled();
    expect(result.current.switchError).toContain("save failed");
  });

  it("surfaces missing target snapshot errors", async () => {
    persistSessionMock.mockResolvedValue(undefined);
    loadRestoreCandidateMock.mockResolvedValue({
      snapshot: null,
      source: "none",
    });
    const { result } = renderHook(() =>
      useAiStudioSessionSwitcher({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionSnapshot: createSnapshot(),
        hydrateFromSessionSnapshot: vi.fn(),
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setSkipRestoreApplyForSessionId: vi.fn(),
      })
    );

    act(() => {
      result.current.handleRequestSessionSwitch(
        makeSessionItem("a7f45245-f204-4ece-8f9e-c9a66a9d8d2a")
      );
    });

    await act(async () => {
      await result.current.handleConfirmSessionSwitch();
    });

    expect(result.current.switchError).toContain("unavailable");
  });

  it("prevents duplicate confirm submits while a switch is in flight", async () => {
    let resolvePersist: (() => void) | null = null;
    persistSessionMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePersist = resolve;
      })
    );
    loadRestoreCandidateMock.mockResolvedValue({
      snapshot: createSnapshot({
        sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      }),
      source: "remote",
    });
    const { result } = renderHook(() =>
      useAiStudioSessionSwitcher({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionSnapshot: createSnapshot(),
        hydrateFromSessionSnapshot: vi.fn().mockReturnValue({
          workspace: {},
          outputs: {},
          agent: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
          },
        }),
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setSkipRestoreApplyForSessionId: vi.fn(),
      })
    );

    act(() => {
      result.current.handleRequestSessionSwitch(
        makeSessionItem("a7f45245-f204-4ece-8f9e-c9a66a9d8d2a")
      );
    });

    act(() => {
      void result.current.handleConfirmSessionSwitch();
      void result.current.handleConfirmSessionSwitch();
    });

    expect(persistSessionMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePersist?.();
      await Promise.resolve();
    });
  });
});
