import { describe, expect, it } from "vitest";
import {
  buildAiStudioSessionSnapshot,
  createAiStudioProjectWorkspaceSnapshot,
  createAiStudioProjectWorkspaceAutosaveCandidates,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotExpertEdit,
  patchAiStudioSessionSnapshotWorkspace,
} from "../sessionSnapshot";
import { buildGenerationReplayConfigV2 } from "../generationReplay";
import type { AiStudioSessionSnapshotV2 } from "../sessionSnapshot";
import { buildAiStudioSessionHydrationPayload } from "../sessionSnapshotHydrator";
import { prepareAiStudioSessionAutosaveSnapshot } from "../sessionAutosaveSerialization";
import type { StudioOutput } from "../../types";
import {
  AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES,
  type AiStudioSessionCanvasState,
} from "../sessionSnapshotCanvas";
import type { ExpertEditSessionState } from "../../components/edit/expertEditSessionState";
import { buildPulseChatThreadSnapshot } from "../../pulseChats/pulseChatThread";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../chatModeDefaults";
import type { BuildAiStudioSessionSnapshotInput } from "../sessionSnapshot";

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

const createSnapshotInput = (
  overrides: Partial<BuildAiStudioSessionSnapshotInput> = {}
): BuildAiStudioSessionSnapshotInput => ({
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt: "2026-03-02T12:00:00.000Z",
  mode: "image",
  selectedTool: "create",
  prompt: "",
  standardCreatePrompt: "",
  pulseCreatePrompt: "",
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
  agentMessages: [],
  agentInput: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: false,
  ...overrides,
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
      outputs: [
        createOutput({
          createdAt: "2026-03-02T11:59:00.000Z",
          previewUrl: "https://cdn.example.com/out-1.png",
        }),
      ],
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
    expect(snapshot.outputs.active[0]?.createdAt).toBe("2026-03-02T11:59:00.000Z");
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

  it("canonicalizes hidden keyframes workspace state onto standard before persistence", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2b",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "video",
      selectedTool: "video",
      prompt: "Bridge shot morphing between frames",
      model: "kie-ai/veo-3.1-fast-i2v",
      aspect: "16:9",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
      referenceImageUrl: "https://example.com/first.png",
      extraImageUrls: ["https://example.com/last.png", null, null],
      editReferenceText: "",
      videoReferenceText: "",
      videoReferenceMode: "keyframes",
      videoDurationSeconds: 8,
      videoResolution: "1080p",
      imageResolution: "model_default",
      videoGenerateAudio: true,
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

    expect(snapshot.workspace.videoReferenceMode).toBe("standard");
  });

  it("persists generated output dimensions in the session snapshot", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "session-width-height",
      updatedAt: "2026-05-30T20:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Editorial portrait",
      model: "gpt-image-2",
      aspect: "16:9",
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
      imageResolution: "2K",
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
      outputs: [
        createOutput({
          id: "out-dimensions",
          width: 1792,
          height: 1008,
          previewUrl: "https://cdn.example.com/out-dimensions.png",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-dimensions",
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      pulseWorkflowSession: null,
      canvasState: createCanvasState(),
      expertEditSessionState: createExpertEditSessionState(),
    });

    expect(snapshot.outputs.active[0]).toMatchObject({
      id: "out-dimensions",
      width: 1792,
      height: 1008,
    });
  });

  it("keeps project-owned Pulse chats in sanitized project workspace snapshots", () => {
    const threadSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "pulse-session-1",
      pulsePrompt: "Build the next scene",
      updatedAt: "2026-06-03T16:00:00.000Z",
      runtime: {
        messages: [{ id: "pulse-msg-1", role: "assistant", content: "Saved Pulse reply" }],
        input: "Saved draft input",
        latestAgentPrompt: "Saved Pulse reply",
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
    });
    const snapshot = {
      ...buildAiStudioSessionSnapshot({
        sessionId: "project-session-1",
        updatedAt: "2026-06-03T16:00:00.000Z",
        mode: "text",
        selectedTool: "create",
        prompt: "",
        standardCreatePrompt: "",
        pulseCreatePrompt: "",
        model: null,
        aspect: "9:16",
        expertCreateMode: "pulse",
        activePulsePresetId: "preset-1",
        pulseSessionInstanceId: "pulse-session-1",
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
        agentMessages: [{ id: "visible-msg-1", role: "assistant", content: "Visible reply" }],
        agentInput: "Visible draft",
        latestAgentPrompt: "Visible reply",
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      }),
      pulseChats: {
        schemaVersion: 1,
        activeThreadId: "thread-1",
        threads: [
          {
            threadId: "thread-1",
            title: "My saved Pulse chat",
            presetId: "preset-1",
            presetLabel: "Story Builder",
            updatedAt: "2026-06-03T16:00:00.000Z",
            snapshot: threadSnapshot,
          },
        ],
      },
    } as AiStudioSessionSnapshotV2;

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(
      snapshot
    ) as AiStudioSessionSnapshotV2;

    expect(projectSnapshot.agent.messages).toEqual([]);
    expect(projectSnapshot.workspace.expertCreateMode).toBe("standard");
    expect(projectSnapshot.pulseChats).toEqual(snapshot.pulseChats);
  });

  it("persists canonical internal refs for signed workspace reference URLs", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "A portrait",
      model: "fal-ai/nano-banana",
      aspect: "1:1",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
      referenceImageUrl:
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/a.png?token=stub.invalid.token",
      extraImageUrls: [
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/b.png?token=stub.invalid.token",
        null,
        null,
      ],
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
      chatModeEnabled: false,
      pulseWorkflowSession: null,
      canvasState: undefined,
      expertEditSessionState: undefined,
    });

    expect(snapshot.workspace.referenceImageInternalMediaRefs).toEqual([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/a.png",
      },
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/b.png",
      },
      null,
      null,
    ]);
    expect(
      snapshot.workspace.createModeReferenceStates?.standard?.referenceImageInternalMediaRefs
    ).toEqual([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/a.png",
      },
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/references/b.png",
      },
      null,
      null,
    ]);
  });

  it("persists direct-request failure metadata when durable output payload exists", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "audio",
      selectedTool: "text-to-speech",
      prompt: "voiceover",
      model: "eleven_multilingual_v2",
      aspect: "audio",
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
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [
        createOutput({
          mode: "audio",
          aspect: "audio",
          model: "ElevenLabs Voiceover",
          modelId: "eleven_multilingual_v2",
          provider: "elevenlabs",
          mediaSource: "generated",
          submissionMode: "direct-request",
          taskState: "fail",
          errorMessage: "Unable to generate speech",
          errorMessageShort: "Unknown error",
          errorDetail: "Unknown error",
          previewUrl: "https://cdn.example.com/audio-preview.mp3",
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

    expect(snapshot.outputs.active[0]).toEqual(
      expect.objectContaining({
        submissionMode: "direct-request",
        errorMessage: "Unable to generate speech",
        errorMessageShort: "Unknown error",
        errorDetail: "Unknown error",
      })
    );
  });

  it("round-trips mixed media project outputs without changing newest-first order", () => {
    const snapshot = createAiStudioProjectWorkspaceSnapshot(
      buildAiStudioSessionSnapshot({
        sessionId: "session-mixed-order",
        updatedAt: "2026-03-02T12:00:00.000Z",
        mode: "image",
        selectedTool: "create",
        prompt: "Mixed order",
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
        outputs: [
          createOutput({
            id: "audio-newest",
            mode: "audio",
            aspect: "audio",
            mediaSource: "generated",
            generationId: "gen-audio-newest",
            taskId: "task-audio-newest",
            createdAt: "2026-03-02T11:59:00.000Z",
            timestamp: "Just now",
          }),
          createOutput({
            id: "image-middle",
            mode: "image",
            mediaSource: "library",
            previewStoragePath: "users/user-1/library/image-middle.png",
            fullStoragePath: "users/user-1/library/image-middle.png",
            createdAt: "2026-03-02T11:58:00.000Z",
            timestamp: "Library",
          }),
          createOutput({
            id: "video-oldest",
            mode: "video",
            mediaSource: "upload",
            previewStoragePath: "users/user-1/projects/project-1/video-oldest.mp4",
            fullStoragePath: "users/user-1/projects/project-1/video-oldest.mp4",
            createdAt: "2026-03-02T11:57:00.000Z",
            timestamp: "Uploaded",
          }),
        ],
        archivedOutputs: [],
        activeOutputId: "audio-newest",
        curatedReferenceIds: ["video-oldest", "audio-newest"],
        removedFromAllRefsIds: [],
        agentMessages: [],
        agentInput: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
        canvasState: undefined,
        expertEditSessionState: undefined,
      })
    );

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(payload.outputs.active.map((output) => output.id)).toEqual([
      "generated:gen-audio-newest",
      "image-middle",
      "video-oldest",
    ]);
    expect(payload.outputs.active.map((output) => output.createdAt)).toEqual([
      "2026-03-02T11:59:00.000Z",
      "2026-03-02T11:58:00.000Z",
      "2026-03-02T11:57:00.000Z",
    ]);
    expect(payload.outputs.activeOutputId).toBeNull();
    expect(payload.outputs.curatedReferenceIds).toEqual([
      "video-oldest",
      "generated:gen-audio-newest",
    ]);
  });

  it("keeps saved media-library Quick Slot references durable in project workspace snapshots", () => {
    const snapshot = createAiStudioProjectWorkspaceSnapshot(
      buildAiStudioSessionSnapshot({
        sessionId: "session-quick-slot-media-library",
        updatedAt: "2026-05-31T10:00:00.000Z",
        mode: "image",
        selectedTool: "create",
        prompt: "Reference setup",
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
        outputs: [
          createOutput({
            id: "library-output-1",
            mediaSource: "library",
            savedMediaIds: ["media-library-1"],
            previewUrl: "https://signed.example.com/preview.png",
            resultUrls: ["https://signed.example.com/full.png"],
            previewStoragePath: "users/user-1/library/media-library-1-preview.png",
            fullStoragePath: "users/user-1/library/media-library-1-full.png",
            timestamp: "Library",
          }),
        ],
        archivedOutputs: [],
        activeOutputId: "library-output-1",
        curatedReferenceIds: ["library-output-1"],
        removedFromAllRefsIds: [],
        agentMessages: [],
        agentInput: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
        canvasState: undefined,
        expertEditSessionState: undefined,
      })
    );

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(snapshot.outputs.curatedReferenceIds).toEqual(["library-output-1"]);
    expect(snapshot.outputs.active[0]).toEqual(
      expect.objectContaining({
        id: "library-output-1",
        mediaSource: "library",
        savedMediaIds: ["media-library-1"],
        previewStoragePath: "users/user-1/library/media-library-1-preview.png",
        fullStoragePath: "users/user-1/library/media-library-1-full.png",
      })
    );
    expect(payload.outputs.curatedReferenceIds).toEqual(["library-output-1"]);
    expect(payload.outputs.active[0]).toEqual(
      expect.objectContaining({
        id: "library-output-1",
        savedMediaIds: ["media-library-1"],
        previewStoragePath: "users/user-1/library/media-library-1-preview.png",
        fullStoragePath: "users/user-1/library/media-library-1-full.png",
      })
    );
  });

  it("preserves output duration metadata across session snapshot hydration", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "audio",
      selectedTool: "text-to-speech",
      prompt: "voiceover",
      model: "eleven_multilingual_v2",
      aspect: "audio",
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
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [
        createOutput({
          id: "audio-duration",
          mode: "audio",
          audioSourceMode: "music",
          durationMs: 4_000,
          waveformPeaks: [10, 30, 20],
          previewStoragePath: "user-1/audio/audio-duration.mp3",
          fullStoragePath: "user-1/audio/audio-duration.mp3",
        }),
        createOutput({
          id: "video-duration",
          mode: "video",
          durationMs: 9_000,
          previewUrl: "https://cdn.example.com/video-duration.mp4",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "audio-duration",
      curatedReferenceIds: ["audio-duration", "video-duration"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
      canvasState: undefined,
      expertEditSessionState: undefined,
    });

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(payload.outputs.active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "audio-duration",
          audioSourceMode: "music",
          durationMs: 4_000,
          waveformPeaks: [10, 30, 20],
        }),
        expect.objectContaining({
          id: "video-duration",
          durationMs: 9_000,
        }),
      ])
    );
  });

  it("omits unsettled failed generated audio outputs from persisted snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "audio",
      selectedTool: "text-to-speech",
      prompt: "voiceover",
      model: "eleven_multilingual_v2",
      aspect: "audio",
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
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
      outputs: [
        createOutput({
          id: "out-audio-fail",
          mode: "audio",
          aspect: "audio",
          model: "ElevenLabs Voiceover",
          modelId: "eleven_multilingual_v2",
          provider: "elevenlabs",
          mediaSource: "generated",
          taskState: "fail",
          taskId: "task-audio-fail",
          sourceRef: "source-audio-fail",
          errorMessage: "Unable to generate speech",
          errorMessageShort: "Unknown error",
          errorDetail: "Unknown error",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-audio-fail",
      curatedReferenceIds: ["out-audio-fail"],
      removedFromAllRefsIds: ["out-audio-fail"],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    expect(snapshot.outputs.active).toEqual([]);
    expect(snapshot.outputs.activeOutputId).toBeNull();
    expect(snapshot.outputs.curatedReferenceIds).toEqual([]);
    expect(snapshot.outputs.removedFromAllRefsIds).toEqual([]);
  });

  it("omits authority-empty media outputs from persisted snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot(
      createSnapshotInput({
        outputs: [
          createOutput({
            id: "blank-image-shell",
            mode: "image",
            mediaSource: "library",
            prompt: "",
            previewUrl: undefined,
            previewText: undefined,
            previewStoragePath: null,
            fullStoragePath: null,
            resultUrls: [],
            savedMediaIds: [],
          }),
          createOutput({
            id: "durable-image",
            mode: "image",
            mediaSource: "library",
            previewStoragePath: "user-1/images/durable-preview.png",
            fullStoragePath: "user-1/images/durable-full.png",
            savedMediaIds: ["media-durable-image"],
          }),
        ],
        activeOutputId: "blank-image-shell",
        curatedReferenceIds: ["blank-image-shell", "durable-image"],
        removedFromAllRefsIds: ["blank-image-shell"],
      })
    );

    expect(snapshot.outputs.active.map((output) => output.id)).toEqual(["durable-image"]);
    expect(snapshot.outputs.activeOutputId).toBeNull();
    expect(snapshot.outputs.curatedReferenceIds).toEqual(["durable-image"]);
    expect(snapshot.outputs.removedFromAllRefsIds).toEqual([]);
  });

  it("keeps recoverable generated outputs even before media payload settles", () => {
    const snapshot = buildAiStudioSessionSnapshot(
      createSnapshotInput({
        outputs: [
          createOutput({
            id: "recoverable-generated",
            mediaSource: "generated",
            generationId: "generation-recoverable",
            taskId: "task-recoverable",
            taskState: "pending",
            previewUrl: undefined,
            previewText: undefined,
            previewStoragePath: null,
            fullStoragePath: null,
            resultUrls: [],
            savedMediaIds: [],
          }),
        ],
        activeOutputId: "recoverable-generated",
        curatedReferenceIds: ["recoverable-generated"],
      })
    );

    expect(snapshot.outputs.active[0]).toEqual(
      expect.objectContaining({
        id: "recoverable-generated",
        generationId: "generation-recoverable",
        taskId: "task-recoverable",
        taskState: "pending",
      })
    );
    expect(snapshot.outputs.activeOutputId).toBe("recoverable-generated");
    expect(snapshot.outputs.curatedReferenceIds).toEqual(["recoverable-generated"]);
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

  it("preserves identity-only image attachments when no renderable preview url survives", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "agent-attachment-identity-only-session",
      updatedAt: "2026-03-02T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Test prompt",
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
              imageUrl: "blob:composer-owned-preview",
              imageFallbackUrls: [],
              previewStoragePath: "user-1/generated/preview.png",
              fullStoragePath: "user-1/generated/full.png",
              text: null,
              aspect: null,
              referenceId: "out-1",
              referenceUrl: null,
              referenceRenderUrl: null,
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
      kind: "image",
      imageUrl: null,
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceId: "out-1",
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

  it("does not misclassify preview-loop video storage as poster storage in snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "preview-loop-video-session",
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
          previewStoragePath: "user-1/variants/videos/out-preview-loop/preview_loop_360p.mp4",
          fullStoragePath: "user-1/videos/out-preview-loop.mp4",
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

    expect(snapshot.outputs.active[0]?.previewStoragePath).toBe(
      "user-1/variants/videos/out-preview-loop/preview_loop_360p.mp4"
    );
    expect(snapshot.outputs.active[0]?.previewPosterStoragePath).toBeNull();
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

  it("preserves authorized hidden Pulse runtime state on Standard snapshots", () => {
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
    expect(snapshot.workspace.activePulsePresetId).toBe("story_builder");
    expect(snapshot.workspace.pulseSessionInstanceId).toBe("pulse-session-story");
    expect(snapshot.workspace.pulsePrompt).toBe("stale Pulse artifact");
    expect(snapshot.agentRuntimes?.pulsePresetId).toBe("story_builder");
    expect(snapshot.agentRuntimes?.pulseSessionInstanceId).toBe("pulse-session-story");
    expect(snapshot.agentRuntimes?.standard).toEqual({
      messages: [{ id: "standard-1", role: "assistant", content: "Standard prompt" }],
      input: "",
      latestAgentPrompt: "Standard prompt",
      promptOrigin: "agent",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    });
    expect(snapshot.agentRuntimes?.pulse).toEqual({
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
    });
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

  it("resets project workspace shell state while keeping durable media and canvas content", () => {
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
      pulseSessionInstanceId: "pulse-session-1",
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
      chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
      pulseWorkflowSession: null,
    });
    expect(projectSnapshot.schemaVersion).toBe(2);
    if (projectSnapshot.schemaVersion === 2) {
      expect(projectSnapshot.agentRuntimes).toEqual({
        standard: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
          pulseWorkflowSession: null,
        },
        pulsePresetId: null,
        pulseSessionInstanceId: null,
        pulse: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
          pulseWorkflowSession: null,
        },
      });
      expect(projectSnapshot.canvas?.transient.draftTextEntry).toBeNull();
      expect(projectSnapshot.canvas?.transient.textEditSession).toBeNull();
      expect("expertEdit" in projectSnapshot).toBe(false);
      expect(projectSnapshot.meta.checksum.startsWith("fnv1a32:")).toBe(true);
    }
  });

  it("clears Create prompts and draft text from project workspace snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "standard-project-session",
      updatedAt: "2026-05-18T15:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Analyze this image",
      standardCreatePrompt: "Analyze this image",
      pulseCreatePrompt: "",
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      aspect: "9:16",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      editReferenceText: "Make the skyline teal with warm gold rim light.",
      videoReferenceText: "Make the camera move like a slow arc around the subject.",
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
      agentInput: "Analyze this image",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);

    expect(projectSnapshot.workspace.prompt).toBe("");
    expect(projectSnapshot.workspace.standardPrompt).toBe("");
    expect(projectSnapshot.workspace.pulsePrompt).toBe("");
    expect(projectSnapshot.workspace.editReferenceText).toBe("");
    expect(projectSnapshot.workspace.videoReferenceText).toBe("");
    expect(projectSnapshot.agent.input).toBe("");
  });

  it("dedupes parked Pulse-runtime autosave reductions once project snapshots already reset shell state", () => {
    const snapshot = createAiStudioProjectWorkspaceSnapshot(
      buildAiStudioSessionSnapshot({
        sessionId: "project-parked-pulse-runtime-candidate",
        updatedAt: "2026-03-02T12:00:00.000Z",
        mode: "image",
        selectedTool: "create",
        prompt: "Standard workspace prompt",
        standardCreatePrompt: "Standard workspace prompt",
        pulseCreatePrompt: "Pulse hidden prompt",
        model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        aspect: "9:16",
        expertCreateMode: "standard",
        activePulsePresetId: "multi_shot",
        pulseSessionInstanceId: "pulse-session-1",
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
        chatModeEnabled: false,
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
          pulseSessionInstanceId: "pulse-session-1",
          pulse: {
            messages: [{ id: "pulse-msg-1", role: "assistant", content: "Hidden Pulse reply" }],
            input: "long hidden pulse draft",
            latestAgentPrompt: "Hidden Pulse reply",
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: {
              presetId: "multi_shot",
              status: "awaiting_input",
              currentStepIndex: 2,
              currentStepLabel: "Action",
              currentStepPrompt: "What happens next?",
              collectedInputs: ["Close-up"],
              lastArtifact: null,
              finalArtifactSource: null,
            },
          },
        },
      })
    );

    const candidates = createAiStudioProjectWorkspaceAutosaveCandidates(snapshot);

    expect(candidates.map((candidate) => candidate.kind)).toEqual(["full"]);
  });

  it("keeps canvas as the only live v2 reduction once project sanitization has run", () => {
    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(
      patchAiStudioSessionSnapshotCanvas(
        buildAiStudioSessionSnapshot({
          sessionId: "project-canvas-candidate-session",
          updatedAt: "2026-05-26T18:00:00.000Z",
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
          outputs: [createOutput({ id: "out-1" })],
          archivedOutputs: [
            createOutput({
              id: "archived-1",
              prompt: "old archived output",
            }),
          ],
          activeOutputId: "out-1",
          curatedReferenceIds: ["out-1"],
          removedFromAllRefsIds: ["archived-1"],
          agentMessages: [],
          agentInput: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
        }),
        createCanvasState()
      )
    );

    const candidates = createAiStudioProjectWorkspaceAutosaveCandidates(projectSnapshot);

    expect(candidates.map((candidate) => candidate.kind)).toEqual(["full", "without_canvas"]);
  });

  it("dedupes identical v2 autosave candidates when reductions are no-ops", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-candidate-dedupe-session",
      updatedAt: "2026-05-25T20:00:00.000Z",
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
      outputs: [createOutput({ id: "out-1" })],
      archivedOutputs: [],
      activeOutputId: "out-1",
      curatedReferenceIds: ["out-1"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const candidates = createAiStudioProjectWorkspaceAutosaveCandidates(snapshot);

    expect(candidates.map((candidate) => candidate.kind)).toEqual(["full"]);
  });

  it("removes failed outputs from project workspace snapshots and prunes dependent ids", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-fail-filter-session",
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
      outputs: [
        createOutput({
          id: "out-success",
          taskState: "success",
          previewUrl: "https://cdn.example.com/success.png",
        }),
        createOutput({
          id: "out-fail-active",
          taskState: "fail",
          errorMessage: "Generation failed",
          errorMessageShort: "Generation failed",
        }),
      ],
      archivedOutputs: [
        createOutput({
          id: "out-fail-archived",
          taskState: "fail",
          errorMessage: "Generation failed",
          errorMessageShort: "Generation failed",
        }),
      ],
      activeOutputId: "out-fail-active",
      curatedReferenceIds: ["out-success", "out-fail-active", "out-fail-archived"],
      removedFromAllRefsIds: ["out-fail-active", "out-fail-archived"],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);

    expect(projectSnapshot.outputs.active).toHaveLength(1);
    expect(projectSnapshot.outputs.active[0]).toEqual(
      expect.objectContaining({
        id: "out-success",
      })
    );
    expect(projectSnapshot.outputs.archived).toEqual([]);
    expect(projectSnapshot.outputs.activeOutputId).toBeNull();
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual(["out-success"]);
    expect(projectSnapshot.outputs.removedFromAllRefsIds).toEqual([]);
  });

  it("removes local-only upload refs from project workspace snapshots while keeping durable and recoverable outputs", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-local-upload-filter-session",
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
      outputs: [
        createOutput({
          id: "out-local-upload",
          mediaSource: "upload",
          previewUrl: "blob:http://localhost/local-upload",
        }),
        createOutput({
          id: "out-durable-upload",
          mediaSource: "upload",
          previewStoragePath: "users/user-1/projects/project-1/reference-grid/durable-upload.png",
          fullStoragePath: "users/user-1/projects/project-1/reference-grid/durable-upload.png",
        }),
        createOutput({
          id: "out-generated-pending",
          mediaSource: "generated",
          taskId: "task-generated-pending",
          taskState: "pending",
          generationId: "gen-generated-pending",
          previewUrl: "blob:http://localhost/generated-preview",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-local-upload",
      curatedReferenceIds: ["out-local-upload", "out-durable-upload", "out-generated-pending"],
      removedFromAllRefsIds: ["out-local-upload", "out-generated-pending"],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: createCanvasState(),
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);

    expect(projectSnapshot.outputs.active.map((output) => output.id)).toEqual([
      "out-durable-upload",
      "generated:gen-generated-pending",
    ]);
    expect(projectSnapshot.outputs.activeOutputId).toBeNull();
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual([
      "out-durable-upload",
      "generated:gen-generated-pending",
    ]);
    expect(projectSnapshot.outputs.removedFromAllRefsIds).toEqual([
      "generated:gen-generated-pending",
    ]);
  });

  it("trims duplicated settled generated-output payload from project workspace snapshots", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-generated-trim-session",
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
      outputs: [
        createOutput({
          id: "out-generated-ready",
          mediaSource: "generated",
          generationId: "gen-generated-ready",
          taskId: "task-generated-ready",
          taskState: "success",
          prompt: "x".repeat(20_000),
          transcriptText: "y".repeat(20_000),
          previewUrl: "https://cdn.example.com/generated-ready.png",
          resultUrls: ["https://cdn.example.com/generated-ready.png"],
          previewStoragePath: "user-1/generated/generated-ready-preview.png",
          fullStoragePath: "user-1/generated/generated-ready-full.png",
          generationReplay:
            buildGenerationReplayConfigV2({
              mode: "image",
              submitTool: "create",
              modelId: "seedream-v4.5",
              displayPrompt: "A cinematic portrait",
              submissionPrompt: "A cinematic portrait",
              aspect: "9:16",
              imageResolution: "model_default",
              referenceInputs: [],
              capturedAt: "2026-03-02T12:00:00.000Z",
            }) ?? undefined,
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-generated-ready",
      curatedReferenceIds: ["out-generated-ready"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const outputRow = projectSnapshot.outputs.active[0] as Record<string, unknown>;

    expect(outputRow).toMatchObject({
      id: "generated:gen-generated-ready",
      generationId: "gen-generated-ready",
      taskId: "task-generated-ready",
      taskState: "success",
    });
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual(["generated:gen-generated-ready"]);
    expect(outputRow).not.toHaveProperty("prompt");
    expect(outputRow).not.toHaveProperty("transcriptText");
    expect(outputRow).not.toHaveProperty("previewUrl");
    expect(outputRow).not.toHaveProperty("resultUrls");
    expect(outputRow).not.toHaveProperty("generationReplay");
  });

  it("trims replay/context payload from pending generated outputs in project workspace snapshots", () => {
    const heavyPrompt = "A cinematic portrait with dramatic rim light. ".repeat(120).trim();
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-generated-pending-trim-session",
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
      outputs: [
        createOutput({
          id: "out-generated-pending-heavy",
          mediaSource: "generated",
          generationId: "gen-generated-pending-heavy",
          taskId: "task-generated-pending-heavy",
          taskState: "pending",
          prompt: heavyPrompt,
          previewUrl: "https://cdn.example.com/generated-pending-heavy.png",
          generationReplay:
            buildGenerationReplayConfigV2({
              mode: "image",
              submitTool: "create",
              modelId: "seedream-v4.5",
              displayPrompt: heavyPrompt,
              submissionPrompt: heavyPrompt,
              aspect: "9:16",
              imageResolution: "model_default",
              referenceInputs: Array.from(
                { length: 8 },
                (_, index) => `https://cdn.example.com/reference-${index + 1}.png`
              ),
              capturedAt: "2026-03-02T12:00:00.000Z",
            }) ?? undefined,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Zuri",
            lookId: "look-1",
            lookName: "Main",
            characterProfileImageUrl: "https://cdn.example.com/character-zuri.png",
          },
          styleContext: {
            applied: true,
            styleId: "style-1",
            styleName: "Painterly",
            stylePrompt: "Painterly diffusion".repeat(40),
            stylePreviewImageUrl: "https://cdn.example.com/style-painterly.png",
          },
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-generated-pending-heavy",
      curatedReferenceIds: ["out-generated-pending-heavy"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const outputRow = projectSnapshot.outputs.active[0] as Record<string, unknown>;

    expect(outputRow).toMatchObject({
      id: "generated:gen-generated-pending-heavy",
      generationId: "gen-generated-pending-heavy",
      taskId: "task-generated-pending-heavy",
      taskState: "pending",
      prompt: heavyPrompt,
      previewUrl: "https://cdn.example.com/generated-pending-heavy.png",
    });
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual([
      "generated:gen-generated-pending-heavy",
    ]);
    expect(outputRow).not.toHaveProperty("generationReplay");
    expect(outputRow).not.toHaveProperty("characterContext");
    expect(outputRow).not.toHaveProperty("styleContext");
  });

  it("keeps generated preview fallback URLs in project snapshots until durable preview storage exists", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-generated-preview-fallback-session",
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
      outputs: [
        createOutput({
          id: "out-generated-preview-fallback",
          mediaSource: "generated",
          generationId: "gen-generated-preview-fallback",
          taskId: "task-generated-preview-fallback",
          taskState: "success",
          prompt: "x".repeat(20_000),
          transcriptText: "y".repeat(20_000),
          previewUrl: "https://cdn.example.com/generated-preview-fallback.png",
          resultUrls: ["https://cdn.example.com/generated-preview-fallback.png"],
          generationReplay:
            buildGenerationReplayConfigV2({
              mode: "image",
              submitTool: "create",
              modelId: "seedream-v4.5",
              displayPrompt: "A cinematic portrait",
              submissionPrompt: "A cinematic portrait",
              aspect: "9:16",
              imageResolution: "model_default",
              referenceInputs: [],
              capturedAt: "2026-03-02T12:00:00.000Z",
            }) ?? undefined,
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-generated-preview-fallback",
      curatedReferenceIds: ["out-generated-preview-fallback"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const outputRow = projectSnapshot.outputs.active[0] as Record<string, unknown>;

    expect(outputRow).not.toHaveProperty("prompt");
    expect(outputRow).not.toHaveProperty("transcriptText");
    expect(outputRow).toMatchObject({
      id: "generated:gen-generated-preview-fallback",
      generationId: "gen-generated-preview-fallback",
    });
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual([
      "generated:gen-generated-preview-fallback",
    ]);
    expect(outputRow).toMatchObject({
      previewUrl: "https://cdn.example.com/generated-preview-fallback.png",
      resultUrls: ["https://cdn.example.com/generated-preview-fallback.png"],
    });
  });

  it("rewrites generated canvas output ids through canonical project snapshot identity", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-generated-canvas-identity-session",
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
      outputs: [
        createOutput({
          id: "out-generated-canvas",
          mediaSource: "generated",
          generationId: "gen-generated-canvas",
          taskId: "task-generated-canvas",
          taskState: "success",
          previewUrl: "https://cdn.example.com/generated-canvas.png",
          resultUrls: ["https://cdn.example.com/generated-canvas.png"],
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-generated-canvas",
      curatedReferenceIds: ["out-generated-canvas"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      canvasState: {
        ...createCanvasState(),
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 12,
            y: 24,
            z: 1,
            selected: true,
            outputId: "out-generated-canvas",
            sourceSurface: "curated",
            mediaId: null,
            src: "https://cdn.example.com/generated-canvas.png",
            alt: "Generated canvas image",
            width: 320,
            height: 180,
          },
        ],
      },
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const canvasSnapshot =
      "canvas" in projectSnapshot
        ? (projectSnapshot.canvas as {
            scene?: { items?: Array<Record<string, unknown>> };
          })
        : null;

    expect(projectSnapshot.outputs.active.map((output) => output.id)).toEqual([
      "generated:gen-generated-canvas",
    ]);
    expect(projectSnapshot.outputs.curatedReferenceIds).toEqual(["generated:gen-generated-canvas"]);
    expect(canvasSnapshot).not.toBeNull();
    const sceneItems = canvasSnapshot?.scene?.items ?? [];
    expect(sceneItems[0]).toMatchObject({
      id: "canvas-image-1",
      outputId: "generated:gen-generated-canvas",
    });
  });

  it("drops duplicated prompt text from prompt-only project references", () => {
    const promptReferenceText =
      "Art direction note with dense lighting guidance and composition constraints. "
        .repeat(80)
        .trim();
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-prompt-reference-trim-session",
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
      outputs: [
        createOutput({
          id: "out-prompt-reference-heavy",
          mode: "text",
          model: "Library prompt",
          mediaSource: "prompt",
          prompt: promptReferenceText,
          previewText: promptReferenceText,
          promptId: "prompt-1",
          status: "saved",
        }),
      ],
      archivedOutputs: [],
      activeOutputId: "out-prompt-reference-heavy",
      curatedReferenceIds: ["out-prompt-reference-heavy"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const outputRow = projectSnapshot.outputs.active[0] as Record<string, unknown>;

    expect(outputRow).toMatchObject({
      id: "out-prompt-reference-heavy",
      previewText: promptReferenceText,
      promptId: "prompt-1",
    });
    expect(outputRow).not.toHaveProperty("prompt");
  });

  it("keeps project autosave snapshots under the byte cap for accumulated pending generations and prompt refs", () => {
    const replayPrompt = "Cinematic fantasy portrait with layered atmospheric detail. "
      .repeat(80)
      .trim();
    const promptReferenceText =
      "Art direction note with dense lighting guidance and composition constraints. "
        .repeat(80)
        .trim();
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "project-autosave-size-regression-session",
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
      outputs: [
        ...Array.from({ length: 12 }, (_, index) =>
          createOutput({
            id: `out-generated-pending-${index + 1}`,
            mediaSource: "generated",
            generationId: `gen-generated-pending-${index + 1}`,
            taskId: `task-generated-pending-${index + 1}`,
            taskState: "pending",
            prompt: replayPrompt,
            generationReplay:
              buildGenerationReplayConfigV2({
                mode: "image",
                submitTool: "create",
                modelId: "seedream-v4.5",
                displayPrompt: replayPrompt,
                submissionPrompt: replayPrompt,
                aspect: "9:16",
                imageResolution: "model_default",
                referenceInputs: Array.from(
                  { length: 8 },
                  (_, referenceIndex) =>
                    `https://cdn.example.com/reference-${index + 1}-${referenceIndex + 1}.png`
                ),
                capturedAt: "2026-03-02T12:00:00.000Z",
              }) ?? undefined,
          })
        ),
        ...Array.from({ length: 86 }, (_, index) =>
          createOutput({
            id: `out-prompt-reference-${index + 1}`,
            mode: "text",
            model: "Library prompt",
            mediaSource: "prompt",
            prompt: promptReferenceText,
            previewText: promptReferenceText,
            promptId: `prompt-${index + 1}`,
            status: "saved",
          })
        ),
      ],
      archivedOutputs: [],
      activeOutputId: "out-generated-pending-1",
      curatedReferenceIds: ["out-generated-pending-1"],
      removedFromAllRefsIds: [],
      agentMessages: [],
      agentInput: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
    });

    const projectSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(projectSnapshot);

    expect(preparedSnapshot.bytes).toBeLessThanOrEqual(AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES);
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
      lipSyncAudioUrl: "blob:http://localhost/voice",
      lipSyncAudioDurationMs: 12_400,
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
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(snapshot.workspace.motionReferenceVideoUrl).toBeNull();
    expect(snapshot.workspace.lipSyncAudioUrl).toBeNull();
    expect(snapshot.workspace.lipSyncAudioDurationMs).toBeNull();
    expect(snapshot.workspace.klingElements[0]).toEqual({
      id: "element-1",
      sourceKind: null,
      sourceElementId: null,
      sourceCharacterId: null,
      sourceCharacterLookId: null,
      sourceCharacterLookLabel: null,
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
      sourceCharacterLookId: null,
      sourceCharacterLookLabel: null,
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

  it("preserves Seedance direct image reference slots in persisted session workspace", () => {
    const snapshot = buildAiStudioSessionSnapshot(
      createSnapshotInput({
        mode: "video",
        selectedTool: "video",
        prompt: "seedance direct image",
        model: "kie-ai/seedance-2",
        klingElements: [
          {
            id: "image-ref-1",
            sourceKind: "reference-image",
            sourceElementId: null,
            sourceCharacterId: null,
            slotIndex: 1,
            name: "Image reference",
            alias: "",
            description: "",
            profileImageUrl: "https://cdn.shortpulse.dev/direct-image.png",
            profileImageTransform: null,
            frontalImageUrl: "https://cdn.shortpulse.dev/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(snapshot.workspace.klingElements[0]).toEqual({
      id: "image-ref-1",
      sourceKind: "reference-image",
      sourceElementId: null,
      sourceCharacterId: null,
      sourceCharacterLookId: null,
      sourceCharacterLookLabel: null,
      slotIndex: 1,
      name: "Image reference",
      alias: "",
      description: "",
      profileImageUrl: "https://cdn.shortpulse.dev/direct-image.png",
      profileImageTransform: null,
      frontalImageUrl: "https://cdn.shortpulse.dev/direct-image.png",
      referenceImageUrls: "",
      videoUrl: "",
    });
  });

  it("preserves selected character look metadata in persisted Kling elements", () => {
    const snapshot = buildAiStudioSessionSnapshot(
      createSnapshotInput({
        mode: "video",
        selectedTool: "video",
        prompt: "character look video",
        model: "kie-ai/kling-3.0",
        klingElements: [
          {
            id: "character-taylor",
            sourceKind: "character",
            sourceElementId: null,
            sourceCharacterId: "character-taylor",
            sourceCharacterLookId: "2",
            sourceCharacterLookLabel: "Action",
            slotIndex: 0,
            name: "Taylor",
            alias: "",
            description: "Taylor in action look.",
            profileImageUrl: "https://cdn.shortpulse.dev/taylor-profile.png",
            profileImageTransform: null,
            frontalImageUrl: "https://cdn.shortpulse.dev/taylor-action-01.png",
            referenceImageUrls: "https://cdn.shortpulse.dev/taylor-action-02.png",
            videoUrl: "",
          },
        ],
      })
    );

    expect(snapshot.workspace.klingElements[0]).toEqual(
      expect.objectContaining({
        sourceKind: "character",
        sourceCharacterId: "character-taylor",
        sourceCharacterLookId: "2",
        sourceCharacterLookLabel: "Action",
        description: "Taylor in action look.",
        frontalImageUrl: "https://cdn.shortpulse.dev/taylor-action-01.png",
      })
    );
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
