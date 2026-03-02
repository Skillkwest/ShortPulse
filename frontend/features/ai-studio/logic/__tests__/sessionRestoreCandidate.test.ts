import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAiStudioSessionRestoreCandidate,
  parseAiStudioSessionSnapshotV1,
  selectAiStudioSessionRestoreSnapshot,
} from "../sessionRestoreCandidate";
import type { AiStudioSessionSnapshotV1 } from "../sessionSnapshot";

const loadLocalMock = vi.fn();
const loadRemoteMock = vi.fn();

vi.mock("../sessionSnapshotStorage", () => ({
  loadAiStudioSessionShadow: (...args: unknown[]) => loadLocalMock(...args),
}));

vi.mock("../sessionApiClient", () => ({
  getAiStudioSessionSnapshotViaApi: (...args: unknown[]) => loadRemoteMock(...args),
}));

const SESSION_ID = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";

const createSnapshot = (updatedAt: string): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1 as const,
  sessionId: SESSION_ID,
  updatedAt,
  workspace: {
    mode: "image" as const,
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
});

describe("sessionRestoreCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses only valid v1 snapshots for the expected session", () => {
    const valid = parseAiStudioSessionSnapshotV1(
      createSnapshot("2026-03-02T00:00:00.000Z"),
      SESSION_ID
    );
    const wrongSession = parseAiStudioSessionSnapshotV1(
      { ...createSnapshot("2026-03-02T00:00:00.000Z"), sessionId: "other" },
      SESSION_ID
    );
    const invalid = parseAiStudioSessionSnapshotV1({ schemaVersion: 2 }, SESSION_ID);

    expect(valid).not.toBeNull();
    expect(wrongSession).toBeNull();
    expect(invalid).toBeNull();
  });

  it("picks local snapshot when remote is missing", () => {
    const localSnapshot = createSnapshot("2026-03-02T00:00:00.000Z");
    const selected = selectAiStudioSessionRestoreSnapshot({
      localSnapshot,
      remoteSnapshot: null,
    });

    expect(selected.source).toBe("local");
    expect(selected.snapshot).toEqual(localSnapshot);
  });

  it("picks remote snapshot when remote is newer", () => {
    const localSnapshot = createSnapshot("2026-03-02T00:00:00.000Z");
    const remoteSnapshot = createSnapshot("2026-03-02T00:00:01.000Z");
    const selected = selectAiStudioSessionRestoreSnapshot({
      localSnapshot,
      remoteSnapshot,
    });

    expect(selected.source).toBe("remote");
    expect(selected.snapshot).toEqual(remoteSnapshot);
  });

  it("loads local + remote and returns freshest candidate", async () => {
    loadLocalMock.mockResolvedValue(createSnapshot("2026-03-02T00:00:00.000Z"));
    loadRemoteMock.mockResolvedValue({
      snapshot: createSnapshot("2026-03-02T00:00:05.000Z"),
    });

    const candidate = await loadAiStudioSessionRestoreCandidate({
      sessionId: SESSION_ID,
      remoteEnabled: true,
    });

    expect(candidate.source).toBe("remote");
    expect(loadLocalMock).toHaveBeenCalledWith(SESSION_ID);
    expect(loadRemoteMock).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it("fails soft to local snapshot when remote load fails", async () => {
    const localSnapshot = createSnapshot("2026-03-02T00:00:00.000Z");
    loadLocalMock.mockResolvedValue(localSnapshot);
    loadRemoteMock.mockRejectedValue(new Error("server down"));

    const candidate = await loadAiStudioSessionRestoreCandidate({
      sessionId: SESSION_ID,
      remoteEnabled: true,
    });

    expect(candidate.source).toBe("local");
    expect(candidate.snapshot).toEqual(localSnapshot);
  });
});
