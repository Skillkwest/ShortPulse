import { describe, expect, it } from "vitest";
import { resolveAiStudioSessionSnapshotTitle } from "../sessionSnapshotTitle";
import type { AiStudioSessionSnapshotV1 } from "../sessionSnapshot";

const createSnapshot = (
  overrides: Partial<AiStudioSessionSnapshotV1> = {}
): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T00:00:00.000Z",
  workspace: {
    mode: "image",
    selectedTool: "create",
    prompt: "",
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

describe("resolveAiStudioSessionSnapshotTitle", () => {
  it("prefers workspace prompt and normalizes whitespace", () => {
    const snapshot = createSnapshot({
      workspace: {
        ...createSnapshot().workspace,
        prompt: "   Hero   scene   at sunset   ",
      },
    });
    expect(resolveAiStudioSessionSnapshotTitle(snapshot)).toBe("Hero scene at sunset");
  });

  it("falls back through alternate fields", () => {
    const fromEdit = createSnapshot({
      workspace: { ...createSnapshot().workspace, editReferenceText: "Edit this portrait" },
    });
    expect(resolveAiStudioSessionSnapshotTitle(fromEdit)).toBe("Edit this portrait");

    const fromAgent = createSnapshot({
      agent: { ...createSnapshot().agent, latestAgentPrompt: "Agent suggested prompt" },
    });
    expect(resolveAiStudioSessionSnapshotTitle(fromAgent)).toBe("Agent suggested prompt");

    const fromOutput = createSnapshot({
      outputs: {
        ...createSnapshot().outputs,
        active: [
          {
            id: "out-1",
            prompt: "Output prompt",
            mode: "image",
            aspect: "9:16",
            model: "model",
            status: "ready",
            timestamp: "Now",
          },
        ],
      },
    });
    expect(resolveAiStudioSessionSnapshotTitle(fromOutput)).toBe("Output prompt");
  });

  it("returns null when no title candidates exist", () => {
    expect(resolveAiStudioSessionSnapshotTitle(createSnapshot())).toBeNull();
  });

  it("truncates long titles to 120 chars", () => {
    const longTitle = "x".repeat(160);
    const snapshot = createSnapshot({
      workspace: { ...createSnapshot().workspace, prompt: longTitle },
    });
    expect(resolveAiStudioSessionSnapshotTitle(snapshot)).toBe("x".repeat(120));
  });
});
