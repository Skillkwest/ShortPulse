import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const loadPersistModule = async (remoteEnabled: boolean) => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = remoteEnabled
    ? "true"
    : "false";
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = remoteEnabled
    ? "true"
    : "false";
  return (await import("../sessionShadowPersistence")).persistAiStudioSessionShadow;
};

describe("sessionShadowPersistence", () => {
  const originalRemoteFlag = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
  const originalLegacyFlag = process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (typeof originalRemoteFlag === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = originalRemoteFlag;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
    }
    if (typeof originalLegacyFlag === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = originalLegacyFlag;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;
    }
  });

  it("always persists local shadow", async () => {
    const persist = await loadPersistModule(false);
    await persist("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot());
    expect(saveLocalMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).not.toHaveBeenCalled();
  });

  it("mirrors to remote when the legacy persistence master flag enables remote shadow", async () => {
    saveRemoteMock.mockResolvedValue(undefined);
    const persist = await loadPersistModule(true);
    await persist("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot(), { keepalive: true });
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
    const persist = await loadPersistModule(true);
    await expect(persist("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a", createSnapshot())).resolves.toBe(
      undefined
    );
    expect(saveLocalMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).toHaveBeenCalledTimes(1);
  });
});
