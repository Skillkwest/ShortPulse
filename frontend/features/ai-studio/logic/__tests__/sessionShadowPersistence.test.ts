import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistAiStudioSessionShadow } from "../sessionShadowPersistence";

const saveLocalMock = vi.fn();
const saveRemoteMock = vi.fn();

vi.mock("../sessionSnapshotStorage", () => ({
  saveAiStudioSessionShadow: (...args: unknown[]) => saveLocalMock(...args),
}));

vi.mock("../sessionApiClient", () => ({
  saveAiStudioSessionSnapshotViaApi: (...args: unknown[]) => saveRemoteMock(...args),
}));

const createSnapshot = () => ({
  schemaVersion: 1 as const,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T00:00:00.000Z",
  workspace: {
    mode: "image" as const,
    selectedTool: "create" as const,
    prompt: "prompt",
    model: null,
    aspect: "9:16",
    referenceImageUrl: null,
    extraImageUrls: [null, null, null] as [null, null, null],
    editReferenceText: "",
    videoReferenceText: "",
    videoReferenceMode: "standard" as const,
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingShotType: "customize" as const,
    klingVoiceIds: ["", ""] as [string, string],
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
    promptOrigin: "manual" as const,
    chatModeEnabled: true,
  },
});

describe("sessionShadowPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always persists local shadow", async () => {
    await persistAiStudioSessionShadow("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot());
    expect(saveLocalMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).not.toHaveBeenCalled();
  });

  it("mirrors to remote when explicitly requested by the controller", async () => {
    saveRemoteMock.mockResolvedValue(undefined);
    await persistAiStudioSessionShadow("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot(), {
      keepalive: true,
      mirrorRemote: true,
    });
    expect(saveLocalMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keepalive: true,
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      })
    );
  });

  it("swallows remote shadow failures because local shadow remains authoritative", async () => {
    saveRemoteMock.mockRejectedValue(new Error("server failed"));
    await expect(
      persistAiStudioSessionShadow("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot(), {
        mirrorRemote: true,
      })
    ).resolves.toBe(undefined);
    expect(saveLocalMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).toHaveBeenCalledTimes(1);
  });
});
