import { describe, expect, it } from "vitest";
import { buildAiStudioSessionSnapshot } from "../sessionSnapshot";
import type { StudioOutput } from "../../types";
import type { AiStudioSessionCanvasState } from "../sessionSnapshotCanvas";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "prompt",
  mode: "image",
  aspect: "9:16",
  model: "model",
  status: "ready",
  timestamp: "2026-03-02T00:00:00.000Z",
  ...overrides,
});

const createCanvasState = (): AiStudioSessionCanvasState => ({
  items: [],
  draftTextEntry: null,
  textEditSession: null,
  draftOwnerInstanceId: null,
  textEditOwnerInstanceId: null,
  mainCamera: { x: 0, y: 0, zoom: 1 },
  railCamera: { x: 0, y: 0, zoom: 1 },
});

describe("sessionSnapshot", () => {
  it("builds schema-versioned snapshot payload with core workspace state", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "A cinematic portrait",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
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
      outputs: [createOutput()],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: ["out-1"],
      removedFromAllRefsIds: [],
      agentMessages: [{ id: "a-1", role: "assistant", content: "Here is your prompt." }],
      agentInput: "",
      latestAgentPrompt: "Here is your prompt.",
      promptOrigin: "agent",
      chatModeEnabled: true,
      canvasState: createCanvasState(),
    });

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.sessionId).toBe("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a");
    expect(snapshot.workspace.prompt).toBe("A cinematic portrait");
    expect(snapshot.outputs.active[0]?.id).toBe("out-1");
    expect(snapshot.agent.messages[0]?.role).toBe("assistant");
    expect(snapshot.canvas.viewports.main.zoom).toBe(1);
    expect(snapshot.meta.checksum.startsWith("fnv1a32:")).toBe(true);
  });

  it("strips local blob/data preview URLs from persisted output payloads", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
      outputs: [
        createOutput({
          previewUrl: "blob:http://localhost/preview-1",
          resultUrls: ["https://cdn.shortpulse.dev/output.png", "data:image/png;base64,abc"],
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      canvasState: createCanvasState(),
    });

    expect(snapshot.outputs.active[0]?.previewUrl).toBeUndefined();
    expect(snapshot.outputs.active[0]?.resultUrls).toEqual([
      "https://cdn.shortpulse.dev/output.png",
    ]);
  });

  it("persists queue lifecycle metadata for restore-safe polling semantics", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "video",
      selectedTool: "video",
      prompt: "A woman in the desert",
      model: "fal-ai/veo3.1/image-to-video",
      aspect: "16:9",
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      editReferenceText: "",
      videoReferenceText: "",
      videoReferenceMode: "standard",
      videoDurationSeconds: 8,
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
      outputs: [
        createOutput({
          generationId: "gen-queued-1",
          queueState: "queued",
          queueEnqueuedAtMs: 1_700_000_123_000,
          taskState: "pending",
          generationTraceId: "trace-queued-1",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    expect(snapshot.outputs.active[0]?.generationId).toBe("gen-queued-1");
    expect(snapshot.outputs.active[0]?.queueState).toBe("queued");
    expect(snapshot.outputs.active[0]?.queueEnqueuedAtMs).toBe(1_700_000_123_000);
    expect(snapshot.outputs.active[0]?.generationTraceId).toBe("trace-queued-1");
  });
});
