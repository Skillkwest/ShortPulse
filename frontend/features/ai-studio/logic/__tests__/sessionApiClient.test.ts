import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAiStudioSessionSnapshotViaApi,
  saveAiStudioSessionSnapshotViaApi,
} from "../sessionApiClient";

const fetchWithAuthMock = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
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

describe("sessionApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts snapshot payload through authenticated fetch", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: "user-1",
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        title: null,
        schemaVersion: 1,
        saveSeq: 3,
        updatedAt: "2026-03-02T01:00:00.000Z",
        expiresAt: "2026-08-29T01:00:00.000Z",
      }),
    });

    const result = await saveAiStudioSessionSnapshotViaApi({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      snapshot: createSnapshot(),
      keepalive: true,
    });

    expect(result.saveSeq).toBe(3);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/ai/sessions/save",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      })
    );
  });

  it("throws mapped error message on non-ok response", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "bad request" }),
    });
    await expect(
      saveAiStudioSessionSnapshotViaApi({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        snapshot: createSnapshot(),
      })
    ).rejects.toThrow("bad request");
  });

  it("loads one session snapshot by sid", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        userId: "user-1",
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        title: null,
        schemaVersion: 1,
        saveSeq: 4,
        snapshot: createSnapshot(),
        updatedAt: "2026-03-02T01:00:00.000Z",
        expiresAt: "2026-08-29T01:00:00.000Z",
      }),
    });

    const result = await getAiStudioSessionSnapshotViaApi({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
    });

    expect(result?.saveSeq).toBe(4);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/ai/sessions/f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("returns null when session is not found", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Session not found" }),
    });

    await expect(
      getAiStudioSessionSnapshotViaApi({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      })
    ).resolves.toBeNull();
  });

  it("throws mapped error message on get failure", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "server exploded" }),
    });

    await expect(
      getAiStudioSessionSnapshotViaApi({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      })
    ).rejects.toThrow("server exploded");
  });
});
