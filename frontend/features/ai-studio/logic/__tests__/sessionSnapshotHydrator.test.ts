import { describe, expect, it } from "vitest";
import { buildAiStudioSessionHydrationPayload } from "../sessionSnapshotHydrator";
import type { AiStudioSessionSnapshot, AiStudioSessionSnapshotV1 } from "../sessionSnapshot";

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
    model: "fal:foo",
    aspect: "1:1",
    referenceImageUrl: "https://example.com/ref.png",
    extraImageUrls: ["https://example.com/1.png", null, null],
    editReferenceText: "edit",
    videoReferenceText: "video",
    videoReferenceMode: "standard",
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "neg",
    klingCfgScale: 0.5,
    klingShotType: "customize",
    klingVoiceIds: ["", ""],
    klingMultiPrompts: [],
    klingElements: [],
    motionReferenceVideoUrl: null,
  },
  outputs: {
    active: [
      {
        id: "out-1",
        prompt: "one",
        mode: "image",
        aspect: "1:1",
        model: "fal:foo",
        status: "ready",
        timestamp: "t1",
      },
    ],
    archived: [
      {
        id: "out-2",
        prompt: "two",
        mode: "image",
        aspect: "1:1",
        model: "fal:foo",
        status: "ready",
        timestamp: "t2",
      },
    ],
    activeOutputId: "out-1",
    curatedReferenceIds: ["out-1", "out-unknown"],
    removedFromAllRefsIds: ["out-2", "nope"],
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

describe("sessionSnapshotHydrator", () => {
  it("builds normalized payload for valid snapshot", () => {
    const payload = buildAiStudioSessionHydrationPayload(createSnapshot());

    expect(payload.workspace.mode).toBe("image");
    expect(payload.workspace.selectedTool).toBe("create");
    expect(payload.outputs.activeOutputId).toBe("out-1");
    expect(payload.outputs.curatedReferenceIds).toEqual(["out-1"]);
    expect(payload.outputs.removedFromAllRefsIds).toEqual(["out-2"]);
    expect(payload.agent.promptOrigin).toBe("manual");
    expect(payload.agent.chatModeEnabled).toBe(true);
    expect(payload.canvas).toBeNull();
  });

  it("hydrates canvas payload for schema v2 snapshots", () => {
    const snapshotV2: AiStudioSessionSnapshot = {
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: "2026-03-02T00:00:00.000Z",
        checksum: "fnv1a32:1234abcd",
      },
      canvas: {
        scene: {
          items: [
            {
              id: "canvas-text-1",
              kind: "text",
              x: 12,
              y: 24,
              z: 1,
              selected: true,
              outputId: null,
              sourceSurface: null,
              text: "Draft note",
              width: 260,
            },
          ],
        },
        viewports: {
          main: { x: 1, y: 2, zoom: 1.2 },
          rail: { x: -4, y: 8, zoom: 0.8 },
        },
        transient: {
          draftTextEntry: { x: 10, y: 20, value: "typing" },
          textEditSession: { itemId: "canvas-text-1", value: "editing" },
          draftOwnerInstanceId: "rail",
          textEditOwnerInstanceId: "main",
        },
        meta: {
          schemaVersion: 1,
          itemCount: 1,
          truncatedItemCount: 0,
          skippedNonDurableImageCount: 0,
        },
      },
    };

    const payload = buildAiStudioSessionHydrationPayload(snapshotV2);
    expect(payload.canvas).not.toBeNull();
    expect(payload.canvas?.items).toHaveLength(1);
    expect(payload.canvas?.mainCamera.zoom).toBe(1.2);
    expect(payload.canvas?.railCamera.zoom).toBe(0.8);
    expect(payload.canvas?.draftOwnerInstanceId).toBe("rail");
    expect(payload.canvas?.textEditSession?.itemId).toBe("canvas-text-1");
  });

  it("keeps styles as a valid restored selected tool", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedTool: "styles",
        },
      })
    );

    expect(payload.workspace.selectedTool).toBe("styles");
  });

  it("keeps presets as a valid restored selected tool", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedTool: "presets",
        },
      })
    );

    expect(payload.workspace.selectedTool).toBe("presets");
  });

  it("keeps media-library as a valid restored selected tool", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedTool: "media-library",
        },
      })
    );

    expect(payload.workspace.selectedTool).toBe("media-library");
  });

  it("falls back for malformed workspace values", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...(createSnapshot().workspace as AiStudioSessionSnapshotV1["workspace"]),
          mode: "bad" as unknown as AiStudioSessionSnapshotV1["workspace"]["mode"],
          selectedTool:
            "invalid" as unknown as AiStudioSessionSnapshotV1["workspace"]["selectedTool"],
          videoDurationSeconds:
            Number.NaN as unknown as AiStudioSessionSnapshotV1["workspace"]["videoDurationSeconds"],
          extraImageUrls: [
            "a",
          ] as unknown as AiStudioSessionSnapshotV1["workspace"]["extraImageUrls"],
        },
      })
    );

    expect(payload.workspace.mode).toBe("text");
    expect(payload.workspace.selectedTool).toBeNull();
    expect(payload.workspace.videoDurationSeconds).toBe(6);
    expect(payload.workspace.extraImageUrls).toEqual(["a", null, null]);
  });

  it("strips local blob/data workspace references during hydration", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          referenceImageUrl: "blob:http://localhost/workspace-ref",
          extraImageUrls: ["data:image/png;base64,abc", "https://example.com/extra.png", null],
          motionReferenceVideoUrl: "blob:http://localhost/motion-video",
          klingElements: [
            {
              id: "k1",
              frontalImageUrl: "data:image/png;base64,abc",
              referenceImageUrls: "blob:http://localhost/ref-1, https://example.com/ref-2.png",
              videoUrl: "blob:http://localhost/video-1",
            },
          ],
        },
      })
    );

    expect(payload.workspace.referenceImageUrl).toBeNull();
    expect(payload.workspace.extraImageUrls).toEqual([null, "https://example.com/extra.png", null]);
    expect(payload.workspace.motionReferenceVideoUrl).toBeNull();
    expect(payload.workspace.klingElements[0]).toEqual({
      id: "k1",
      frontalImageUrl: "",
      referenceImageUrls: "https://example.com/ref-2.png",
      videoUrl: "",
    });
  });

  it("dedupes outputs and nulls invalid activeOutputId", () => {
    const snapshot = createSnapshot({
      outputs: {
        ...createSnapshot().outputs,
        active: [
          {
            id: "out-1",
            prompt: "one",
            mode: "image",
            aspect: "1:1",
            model: "fal:foo",
            status: "ready",
            timestamp: "t1",
          },
          {
            id: "out-1",
            prompt: "one-duplicate",
            mode: "image",
            aspect: "1:1",
            model: "fal:foo",
            status: "ready",
            timestamp: "t1b",
          },
        ],
        activeOutputId: "missing",
      },
    });

    const payload = buildAiStudioSessionHydrationPayload(snapshot);
    expect(payload.outputs.active).toHaveLength(1);
    expect(payload.outputs.activeOutputId).toBeNull();
  });

  it("normalizes agent snapshot fields and guarantees message ids", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        agent: {
          messages: [
            { id: "fixed-id", role: "assistant", content: "A" },
            { id: "fixed-id", role: "assistant", content: "B" },
            { id: null, role: "user", content: "  user message  " },
            { id: null, role: "assistant", content: "   " },
            { id: "bad-role", role: "invalid" as never, content: "skip me" },
          ],
          input: "draft",
          latestAgentPrompt: "latest",
          promptOrigin: "invalid" as never,
          chatModeEnabled: "invalid" as never,
        },
      })
    );

    expect(payload.agent.messages).toEqual([
      { id: "fixed-id", role: "assistant", content: "A" },
      { id: "fixed-id-1", role: "assistant", content: "B" },
      { id: "agent-user-restored-2", role: "user", content: "user message" },
    ]);
    expect(payload.agent.input).toBe("draft");
    expect(payload.agent.latestAgentPrompt).toBe("latest");
    expect(payload.agent.promptOrigin).toBe("manual");
    expect(payload.agent.chatModeEnabled).toBe(true);
  });

  it("hydrates queue lifecycle metadata for queued generation restore paths", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        outputs: {
          ...createSnapshot().outputs,
          active: [
            {
              id: "out-queued",
              prompt: "queued",
              mode: "video",
              aspect: "16:9",
              model: "fal-ai/veo3.1/image-to-video",
              status: "ready",
              timestamp: "Submitting...",
              generationId: "gen-queued-restore",
              queueState: "queued",
              queueEnqueuedAtMs: 1_700_000_456_000,
              taskState: "pending",
              generationTraceId: "trace-queued-restore",
            },
          ],
          activeOutputId: "out-queued",
        },
      })
    );

    expect(payload.outputs.active[0]?.generationId).toBe("gen-queued-restore");
    expect(payload.outputs.active[0]?.queueState).toBe("queued");
    expect(payload.outputs.active[0]?.queueEnqueuedAtMs).toBe(1_700_000_456_000);
    expect(payload.outputs.active[0]?.generationTraceId).toBe("trace-queued-restore");
    expect(payload.outputs.active[0]?.timestamp).toBe("Waiting in queue...");
    expect(payload.outputs.active[0]?.taskState).toBe("pending");
  });

  it("normalizes unresolved restored terminal output into server-recovery posture", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        outputs: {
          ...createSnapshot().outputs,
          active: [
            {
              id: "out-terminal-restore",
              prompt: "restore me",
              mode: "image",
              aspect: "1:1",
              model: "fal:foo",
              status: "ready",
              timestamp: "Complete",
              generationId: "gen-terminal-restore",
              sourceRef: "src-terminal-restore",
              queueState: "dispatched",
              taskState: "success",
              errorMessage: "old client error",
              errorMessageShort: "old short error",
            },
          ],
          activeOutputId: "out-terminal-restore",
        },
      })
    );

    expect(payload.outputs.active[0]).toEqual(
      expect.objectContaining({
        generationId: "gen-terminal-restore",
        sourceRef: "src-terminal-restore",
        queueState: "dispatched",
        taskState: "pending",
        timestamp: "Waiting for server recovery...",
        errorMessage: null,
        errorMessageShort: null,
      })
    );
  });

  it("keeps restored settled outputs intact when canonical media is already present", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        outputs: {
          ...createSnapshot().outputs,
          active: [
            {
              id: "out-settled-restore",
              prompt: "done",
              mode: "image",
              aspect: "1:1",
              model: "fal:foo",
              status: "ready",
              timestamp: "Complete",
              generationId: "gen-settled-restore",
              sourceRef: "src-settled-restore",
              queueState: "dispatched",
              taskState: "success",
              resultUrls: ["https://cdn.example.com/result.png"],
              previewUrl: "https://cdn.example.com/result.png",
            },
          ],
          activeOutputId: "out-settled-restore",
        },
      })
    );

    expect(payload.outputs.active[0]).toEqual(
      expect.objectContaining({
        taskState: "success",
        timestamp: "Complete",
        resultUrls: ["https://cdn.example.com/result.png"],
        previewUrl: "https://cdn.example.com/result.png",
      })
    );
  });
});
