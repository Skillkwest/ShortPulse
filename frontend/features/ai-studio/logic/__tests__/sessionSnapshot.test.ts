import { describe, expect, it } from "vitest";
import {
  buildAiStudioSessionSnapshot,
  createAiStudioProjectWorkspaceSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotExpertEdit,
  patchAiStudioSessionSnapshotWorkspace,
} from "../sessionSnapshot";
import type { AiStudioSessionSnapshotV2 } from "../sessionSnapshot";
import type { StudioOutput } from "../../types";
import type { AiStudioSessionCanvasState } from "../sessionSnapshotCanvas";
import type { ExpertEditSessionState } from "../../components/edit/expertEditSessionState";

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

const createExpertEditSessionState = (): ExpertEditSessionState => ({
  version: 2,
  layers: {
    layerIdCounter: 3,
    foundationLayerId: "layer-1",
    selectedLayerIndex: 1,
    layers: [
      {
        id: "layer-1",
        name: "layer 1",
        imageUrl: "https://cdn.shortpulse.dev/base.png",
        opacity: 100,
        isAutoNamed: true,
        ownsImageUrl: false,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
      {
        id: "layer-2",
        name: "layer 2",
        imageUrl: "blob:http://localhost/local-layer",
        opacity: 100,
        isAutoNamed: true,
        ownsImageUrl: true,
        transform: {
          translateXRatio: 0.1,
          translateYRatio: -0.1,
          scale: 1.2,
          rotationDeg: 8,
        },
      },
    ],
  },
  markup: {
    strokes: [
      {
        id: "markup-stroke-1",
        color: "#f43f5e",
        sizeRatio: 0.01,
        points: [
          { sceneX: -0.1, sceneY: -0.1 },
          { sceneX: 0.1, sceneY: 0.1 },
        ],
      },
    ],
  },
  inpaint: {
    snapshot: {
      layers: [
        {
          layerId: "layer-1",
          width: 2,
          height: 2,
          alpha: new Uint8ClampedArray([0, 255, 255, 0]),
        },
      ],
    },
  },
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
      expertCreateMode: "pulse",
      activePulsePresetId: "multi_shot",
      pulseSessionInstanceId: "pulse-session-multi-shot",
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
      klingWorkflowMode: "multi",
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
      pulseWorkflowSession: {
        presetId: "multi_shot",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Action",
        currentStepPrompt: "Step 2 — Action: What should happen next?",
        collectedInputs: ["Upload your image"],
        lastArtifact: null,
      },
      canvasState: createCanvasState(),
      expertEditSessionState: createExpertEditSessionState(),
    });

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.sessionId).toBe("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a");
    expect(snapshot.workspace.prompt).toBe("A cinematic portrait");
    expect(snapshot.workspace.standardPrompt).toBe("");
    expect(snapshot.workspace.pulsePrompt).toBe("A cinematic portrait");
    expect(snapshot.workspace.klingWorkflowMode).toBe("multi");
    expect(snapshot.workspace.expertCreateMode).toBe("pulse");
    expect(snapshot.workspace.activePulsePresetId).toBe("multi_shot");
    expect(snapshot.outputs.active[0]?.id).toBe("out-1");
    expect(snapshot.agent.messages).toEqual([]);
    expect(snapshot.agentRuntimes).toEqual({
      standard: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: false,
        pulseWorkflowSession: null,
      },
      pulsePresetId: "multi_shot",
      pulseSessionInstanceId: "pulse-session-multi-shot",
      pulse: {
        messages: [{ id: "a-1", role: "assistant", content: "Here is your prompt." }],
        input: "",
        latestAgentPrompt: "Here is your prompt.",
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: {
          presetId: "multi_shot",
          status: "awaiting_input",
          currentStepIndex: 2,
          currentStepLabel: "Action",
          currentStepPrompt: "Step 2 — Action: What should happen next?",
          collectedInputs: ["Upload your image"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
    });
    expect(snapshot.agent.pulseWorkflowSession).toBeNull();
    expect(snapshot.canvas?.viewports.main.zoom).toBe(1);
    expect(snapshot.expertEdit?.state.markup.strokes).toHaveLength(1);
    expect(snapshot.expertEdit?.state.layers.layers[1]?.imageUrl).toBeNull();
    expect(snapshot.expertEdit?.state.layers.layers[1]?.ownsImageUrl).toBe(false);
    expect(snapshot.meta.checksum.startsWith("fnv1a32:")).toBe(true);
  });

  it("serializes legacy image attachments into one canonical preview url", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "legacy-image-attachment-session",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "A cinematic portrait",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [
        {
          id: "u-1",
          role: "user",
          content: "",
          attachments: [
            {
              id: "img-1",
              kind: "image",
              imageUrl: null,
              referenceRenderUrl: "https://example.com/legacy-preview.png",
              imageFallbackUrls: ["https://example.com/repair-preview.png"],
              text: null,
            },
          ],
        },
      ],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
      canvasState: undefined,
      expertEditSessionState: null,
    });

    expect(snapshot.agentRuntimes?.standard.messages[0]?.attachments?.[0]).toMatchObject({
      imageUrl: "https://example.com/repair-preview.png",
      imageFallbackUrls: ["https://example.com/legacy-preview.png"],
    });
  });

  it("preserves apply_prompt workflow artifacts in Pulse session snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "pulse-apply-prompt-session",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Pulse draft",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      pulseSessionInstanceId: "pulse-session-image",
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: "final video prompt",
      promptOrigin: "agent",
      chatModeEnabled: true,
      pulseWorkflowSession: {
        presetId: "image",
        status: "completed",
        currentStepIndex: 5,
        currentStepLabel: "Final Prompt",
        currentStepPrompt: null,
        collectedInputs: ["Uploaded image attached", "360 orbit", "Bird launches into flight"],
        lastArtifact: "final video prompt",
        finalArtifactSource: "apply_prompt",
      },
    });

    expect(snapshot.agentRuntimes?.pulse.pulseWorkflowSession).toEqual(
      expect.objectContaining({
        finalArtifactSource: "apply_prompt",
      })
    );
  });

  it("persists durable video poster delivery authority in output snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "video",
      selectedTool: "video",
      prompt: "",
      model: "fal-ai/video",
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
          mode: "video",
          previewUrl: "https://signed.test/video.mp4",
          previewPosterUrl: "https://signed.test/poster.jpg",
          previewPosterStoragePath: "user-1/variants/videos/out-1/poster_720.jpg",
          previewStoragePath: "user-1/videos/out-1.mp4",
          fullStoragePath: "user-1/videos/out-1.mp4",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: ["out-1"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    expect(snapshot.outputs.active[0]?.previewPosterUrl).toBeUndefined();
    expect(snapshot.outputs.active[0]?.previewPosterStoragePath).toBe(
      "user-1/variants/videos/out-1/poster_720.jpg"
    );
    expect(snapshot.outputs.active[0]?.previewUrl).toBeUndefined();
  });

  it("normalizes legacy poster-backed video preview storage in snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "poster-backed-video-session",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "video",
      selectedTool: "video",
      prompt: "",
      model: "fal-ai/video",
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
          mode: "video",
          previewUrl: "https://signed.test/poster.jpg",
          previewStoragePath: "user-1/variants/videos/out-legacy/poster_720.jpg",
          fullStoragePath: "user-1/videos/out-legacy.mp4",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: ["out-1"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    expect(snapshot.outputs.active[0]?.previewStoragePath).toBe("user-1/videos/out-legacy.mp4");
    expect(snapshot.outputs.active[0]?.previewPosterStoragePath).toBe(
      "user-1/variants/videos/out-legacy/poster_720.jpg"
    );
  });

  it("prefers durable storage authority over temporary signed media urls in output snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "",
      model: "fal-ai/image",
      aspect: "1:1",
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
          previewUrl: "https://signed.test/image.png?token=preview",
          previewPosterUrl: "https://signed.test/poster.png?token=poster",
          resultUrls: ["https://signed.test/image.png?token=result"],
          previewPosterStoragePath: "user-1/variants/images/out-1/poster.png",
          previewStoragePath: "user-1/variants/images/out-1/preview.png",
          fullStoragePath: "user-1/images/out-1.png",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: ["out-1"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    expect(snapshot.outputs.active[0]?.previewUrl).toBeUndefined();
    expect(snapshot.outputs.active[0]?.previewPosterUrl).toBeUndefined();
    expect(snapshot.outputs.active[0]?.resultUrls).toBeUndefined();
    expect(snapshot.outputs.active[0]?.previewPosterStoragePath).toBe(
      "user-1/variants/images/out-1/poster.png"
    );
    expect(snapshot.outputs.active[0]?.previewStoragePath).toBe(
      "user-1/variants/images/out-1/preview.png"
    );
    expect(snapshot.outputs.active[0]?.fullStoragePath).toBe("user-1/images/out-1.png");
  });

  it("patches durable Expert Edit state without rebuilding the base snapshot shape", () => {
    const baseSnapshot = createAiStudioProjectWorkspaceSnapshot(
      buildAiStudioSessionSnapshot({
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
        agentMessages: [],
        agentInput: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
      })
    ) as AiStudioSessionSnapshotV2;
    const patchedSnapshot = patchAiStudioSessionSnapshotExpertEdit(
      baseSnapshot,
      createExpertEditSessionState()
    );

    expect(baseSnapshot.expertEdit).toBeUndefined();
    expect(patchedSnapshot.expertEdit?.state.markup.strokes).toHaveLength(1);
    expect(patchedSnapshot.workspace).toEqual(baseSnapshot.workspace);
    expect(patchedSnapshot.outputs).toEqual(baseSnapshot.outputs);
    expect(patchedSnapshot.meta.checksum).not.toBe(baseSnapshot.meta?.checksum);
  });

  it("serializes Standard and Pulse create prompts separately when both are provided", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image",
      selectedTool: "create",
      prompt: "Pulse artifact prompt",
      standardCreatePrompt: "Standard draft prompt",
      pulseCreatePrompt: "Pulse artifact prompt",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "pulse",
      activePulsePresetId: "multi_shot",
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    });

    expect(snapshot.workspace.prompt).toBe("Pulse artifact prompt");
    expect(snapshot.workspace.standardPrompt).toBe("Standard draft prompt");
    expect(snapshot.workspace.pulsePrompt).toBe("Pulse artifact prompt");
  });

  it("hard-drops inactive Pulse runtime state from Standard snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image",
      selectedTool: "create",
      prompt: "Standard draft prompt",
      standardCreatePrompt: "Standard draft prompt",
      pulseCreatePrompt: "stale Pulse artifact",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "standard",
      activePulsePresetId: null,
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [{ id: "standard-1", role: "assistant", content: "Standard prompt" }],
      agentInput: "",
      latestAgentPrompt: "Standard prompt",
      promptOrigin: "agent",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
      agentRuntimes: {
        standard: {
          messages: [{ id: "standard-1", role: "assistant", content: "Standard prompt" }],
          input: "",
          latestAgentPrompt: "Standard prompt",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
        pulse: {
          messages: [{ id: "pulse-1", role: "assistant", content: "Pulse-only text" }],
          input: "Pulse draft",
          latestAgentPrompt: "Pulse artifact",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "completed",
            currentStepIndex: 2,
            currentStepLabel: "Final",
            currentStepPrompt: null,
            collectedInputs: ["Pulse-only input"],
            lastArtifact: "Pulse artifact",
            finalArtifactSource: "chat_reply",
          },
        },
      },
    });

    expect(snapshot.workspace.expertCreateMode).toBe("standard");
    expect(snapshot.workspace.pulsePrompt).toBe("");
    expect(snapshot.agentRuntimes?.pulsePresetId).toBeNull();
    expect(snapshot.agentRuntimes?.pulse).toEqual({
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      pulseWorkflowSession: null,
    });
    expect(snapshot.agentRuntimes?.pulseSessionInstanceId).toBeNull();
  });

  it("hard-drops Pulse runtime state when the runtime preset does not match workspace authority", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image",
      selectedTool: "create",
      prompt: "Pulse draft prompt",
      standardCreatePrompt: "",
      pulseCreatePrompt: "Pulse draft prompt",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-story",
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
      agentRuntimes: {
        standard: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "multi_shot",
        pulseSessionInstanceId: "pulse-session-other",
        pulse: {
          messages: [{ id: "pulse-1", role: "assistant", content: "Other preset reply" }],
          input: "other preset draft",
          latestAgentPrompt: "Other preset artifact",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: {
            presetId: "multi_shot",
            status: "completed",
            currentStepIndex: 3,
            currentStepLabel: "Final",
            currentStepPrompt: null,
            collectedInputs: ["other preset input"],
            lastArtifact: "Other preset artifact",
            finalArtifactSource: "chat_reply",
          },
        },
      },
    });

    expect(snapshot.workspace.expertCreateMode).toBe("pulse");
    expect(snapshot.workspace.activePulsePresetId).toBe("story_builder");
    expect(snapshot.agentRuntimes?.pulsePresetId).toBe("story_builder");
    expect(snapshot.agentRuntimes?.pulseSessionInstanceId).toBe("pulse-session-story");
    expect(snapshot.agentRuntimes?.pulse).toEqual({
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      pulseWorkflowSession: null,
    });
  });

  it("preserves a Pulse draft separately from the completed workflow artifact", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "image",
      selectedTool: "create",
      prompt: "Pulse draft prompt",
      standardCreatePrompt: "Standard draft prompt",
      pulseCreatePrompt: "Pulse draft prompt",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-story",
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Completed artifact prompt",
        },
      ],
      agentInput: "",
      latestAgentPrompt: "Completed artifact prompt",
      promptOrigin: "agent",
      chatModeEnabled: true,
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "completed",
        currentStepIndex: 6,
        currentStepLabel: "Final Prompt",
        currentStepPrompt: null,
        collectedInputs: ["grimdark tone", "10 minute runtime"],
        lastArtifact: "Completed artifact prompt",
        finalArtifactSource: "chat_reply",
      },
    });

    expect(snapshot.workspace.prompt).toBe("Pulse draft prompt");
    expect(snapshot.workspace.standardPrompt).toBe("Standard draft prompt");
    expect(snapshot.workspace.pulsePrompt).toBe("Pulse draft prompt");
    expect(snapshot.agent.latestAgentPrompt).toBeNull();
    expect(snapshot.agent.pulseWorkflowSession).toBeNull();
    expect(snapshot.agentRuntimes?.pulse.latestAgentPrompt).toBe("Completed artifact prompt");
    expect(snapshot.agentRuntimes?.pulse.pulseWorkflowSession?.lastArtifact).toBe(
      "Completed artifact prompt"
    );
  });

  it("strips Pulse runtime and prompts from project workspace snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "A cinematic portrait",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "pulse",
      activePulsePresetId: "multi_shot",
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
      klingWorkflowMode: "multi",
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
      agentInput: "next shot",
      latestAgentPrompt: "Here is your prompt.",
      promptOrigin: "agent",
      chatModeEnabled: false,
      pulseWorkflowSession: {
        presetId: "multi_shot",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Action",
        currentStepPrompt: "Step 2 — Action: What should happen next?",
        collectedInputs: ["Upload your image"],
        lastArtifact: null,
      },
      canvasState: createCanvasState(),
      expertEditSessionState: createExpertEditSessionState(),
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);

    expect(projectSnapshot.workspace.expertCreateMode).toBe("standard");
    expect(projectSnapshot.workspace.selectedTool).toBe("create");
    expect(projectSnapshot.workspace.prompt).toBe("");
    expect(projectSnapshot.workspace.standardPrompt).toBe("");
    expect(projectSnapshot.workspace.pulsePrompt).toBe("");
    expect(projectSnapshot.workspace.activePulsePresetId).toBeNull();
    expect(projectSnapshot.workspace.pulseSessionInstanceId).toBeNull();
    expect(projectSnapshot.agent).toEqual({
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      pulseWorkflowSession: null,
    });
    expect("agentRuntimes" in projectSnapshot).toBe(false);
    expect(projectSnapshot.schemaVersion).toBe(2);
    if (projectSnapshot.schemaVersion === 2) {
      expect(projectSnapshot.meta.checksum.startsWith("fnv1a32:")).toBe(true);
    }
  });

  it("patches workspace-selected character state and recomputes snapshot metadata", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
      klingWorkflowMode: "single",
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    const patched = patchAiStudioSessionSnapshotWorkspace(snapshot, {
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "2",
    });

    expect(patched.workspace.selectedCharacterId).toBe("char-1");
    expect(patched.workspace.selectedCharacterLookId).toBe("2");
    expect(patched.meta.checksum).not.toBe(snapshot.meta.checksum);
  });

  it("patches page-owned canvas state onto an existing snapshot and recomputes metadata", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
      klingWorkflowMode: "single",
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
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    const patched = patchAiStudioSessionSnapshotCanvas(snapshot, createCanvasState());

    expect(patched.canvas?.scene.items).toEqual([]);
    expect(patched.canvas?.viewports.main.zoom).toBe(1);
    expect(patched.meta.checksum).not.toBe(snapshot.meta.checksum);
  });

  it("omits canvas payload when the canonical page does not own canvas session state", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
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
      klingWorkflowMode: "multi",
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
    });

    expect(snapshot.schemaVersion).toBe(2);
    expect("canvas" in snapshot).toBe(false);
    expect("expertEdit" in snapshot).toBe(false);
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

  it("defaults legacy custom Kling sessions to custom workflow mode when multi prompts exist", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "video",
      selectedTool: "video",
      prompt: "ignored",
      model: "kie-ai/kling-3.0",
      aspect: "16:9",
      referenceImageUrl: "https://cdn.shortpulse.dev/start.png",
      extraImageUrls: [null, null, null],
      editReferenceText: "",
      videoReferenceText: "ignored",
      videoReferenceMode: "standard",
      videoDurationSeconds: 6,
      videoResolution: "1080p",
      imageResolution: "model_default",
      videoGenerateAudio: true,
      videoCameraFixed: false,
      videoAutoFix: false,
      klingNegativePrompt: "",
      klingCfgScale: 0.5,
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [{ id: "shot-1", prompt: "Beat one", duration: 5 }],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      canvasState: createCanvasState(),
    });

    expect(snapshot.workspace.klingWorkflowMode).toBe("custom");
  });

  it("strips local blob/data workspace references from persisted session workspace", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "video",
      selectedTool: "video",
      prompt: "motion test",
      model: "kie-ai/kling-3.0",
      aspect: "16:9",
      referenceImageUrl: "blob:http://localhost/character-ref",
      extraImageUrls: ["data:image/png;base64,abc", "https://cdn.shortpulse.dev/extra.png", null],
      editReferenceText: "",
      videoReferenceText: "",
      videoReferenceMode: "motion",
      videoDurationSeconds: 10,
      videoResolution: "1080p",
      imageResolution: "model_default",
      videoGenerateAudio: true,
      videoCameraFixed: false,
      videoAutoFix: false,
      klingNegativePrompt: "",
      klingCfgScale: 0.5,
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [
        {
          id: "element-1",
          profileImageTransform: { zoom: 1.25, offsetX: 4, offsetY: -3 },
          frontalImageUrl: "data:image/png;base64,abc",
          referenceImageUrls: "blob:http://localhost/1, https://cdn.shortpulse.dev/ref-1.png",
          videoUrl: "blob:http://localhost/motion-element",
        },
      ],
      motionReferenceVideoUrl: "blob:http://localhost/motion-video",
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    expect(snapshot.workspace.referenceImageUrl).toBeNull();
    expect(snapshot.workspace.extraImageUrls).toEqual([
      null,
      "https://cdn.shortpulse.dev/extra.png",
      null,
    ]);
    expect(snapshot.workspace.motionReferenceVideoUrl).toBeNull();
    expect(snapshot.workspace.klingElements[0]).toEqual({
      id: "element-1",
      sourceKind: null,
      sourceElementId: null,
      sourceCharacterId: null,
      slotIndex: undefined,
      name: "",
      alias: "",
      description: "",
      profileImageUrl: null,
      profileImageTransform: { zoom: 1.25, offsetX: 4, offsetY: -3 },
      frontalImageUrl: "",
      referenceImageUrls: "https://cdn.shortpulse.dev/ref-1.png",
      videoUrl: "",
    });
  });

  it("preserves non-empty legacy element aliases in persisted session workspace", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      mode: "video",
      selectedTool: "video",
      prompt: "legacy token restore",
      model: "kie-ai/kling-3.0",
      aspect: "16:9",
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      editReferenceText: "",
      videoReferenceText: "",
      videoReferenceMode: "kling3",
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
      klingElements: [
        {
          id: "element-1",
          sourceKind: "element",
          sourceElementId: "element-red-lantern",
          sourceCharacterId: null,
          slotIndex: 0,
          name: "Red Lantern",
          alias: "legacylamp",
          description: "Warm lacquered lantern",
          profileImageUrl: "https://cdn.shortpulse.dev/red-lantern-profile.png",
          profileImageTransform: { zoom: 1.1, offsetX: 2, offsetY: -1 },
          frontalImageUrl: "https://cdn.shortpulse.dev/red-lantern-front.png",
          referenceImageUrls: "https://cdn.shortpulse.dev/red-lantern-side.png",
          videoUrl: "",
        },
      ],
      motionReferenceVideoUrl: null,
      outputs: [],
      archivedOutputs: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    expect(snapshot.workspace.klingElements[0]).toEqual({
      id: "element-1",
      sourceKind: "element",
      sourceElementId: "element-red-lantern",
      sourceCharacterId: null,
      slotIndex: 0,
      name: "Red Lantern",
      alias: "legacylamp",
      description: "Warm lacquered lantern",
      profileImageUrl: "https://cdn.shortpulse.dev/red-lantern-profile.png",
      profileImageTransform: { zoom: 1.1, offsetX: 2, offsetY: -1 },
      frontalImageUrl: "https://cdn.shortpulse.dev/red-lantern-front.png",
      referenceImageUrls: "https://cdn.shortpulse.dev/red-lantern-side.png",
      videoUrl: "",
    });
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
