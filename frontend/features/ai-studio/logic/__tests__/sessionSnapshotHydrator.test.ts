import { afterEach, describe, expect, it, vi } from "vitest";
import { KIE_SEEDANCE_2_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { buildAiStudioSessionSnapshot } from "../sessionSnapshot";
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
    expertCreateMode: "standard",
    activePulsePresetId: null,
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
    klingWorkflowMode: "single",
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
    pulseWorkflowSession: null,
  },
  ...overrides,
});

describe("sessionSnapshotHydrator", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds normalized payload for valid snapshot", () => {
    const payload = buildAiStudioSessionHydrationPayload(createSnapshot());

    expect(payload.workspace.mode).toBe("image");
    expect(payload.workspace.selectedTool).toBe("create");
    expect(payload.workspace.selectedCharacterId).toBeNull();
    expect(payload.workspace.selectedCharacterLookId).toBeNull();
    expect(payload.outputs.activeOutputId).toBe("out-1");
    expect(payload.outputs.curatedReferenceIds).toEqual(["out-1"]);
    expect(payload.outputs.removedFromAllRefsIds).toEqual(["out-2"]);
    expect(payload.agent.promptOrigin).toBe("manual");
    expect(payload.agent.chatModeEnabled).toBe(false);
    expect(payload.agent.pulseWorkflowSession).toBeNull();
    expect(payload.agentRuntimes.standard.promptOrigin).toBe("manual");
    expect(payload.agentRuntimes.pulsePresetId).toBeNull();
    expect(payload.agentRuntimes.pulseSessionInstanceId).toBeNull();
    expect(payload.agentRuntimes.pulse.messages).toEqual([]);
    expect(payload.workspace.klingWorkflowMode).toBe("single");
    expect(payload.workspace.expertCreateMode).toBe("standard");
    expect(payload.workspace.activePulsePresetId).toBeNull();
    expect(payload.canvas).toBeNull();
    expect(payload.expertEdit).toBeNull();
  });

  it("normalizes legacy image attachments into one restored preview url", () => {
    const payload = buildAiStudioSessionHydrationPayload({
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: createSnapshot().updatedAt,
        checksum: "test-checksum",
      },
      agentRuntimes: {
        standard: {
          messages: [
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
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: null,
        pulseSessionInstanceId: null,
        pulse: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    } as AiStudioSessionSnapshot);

    expect(payload.agentRuntimes.standard.messages[0]?.attachments?.[0]).toMatchObject({
      imageUrl: "https://example.com/repair-preview.png",
      imageFallbackUrls: ["https://example.com/legacy-preview.png"],
    });
  });

  it("hydrates video poster delivery fields from snapshots", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        outputs: {
          ...createSnapshot().outputs,
          active: [
            {
              id: "out-video",
              prompt: "video",
              mode: "video",
              aspect: "9:16",
              model: "fal:video",
              status: "ready",
              timestamp: "t1",
              previewUrl: "https://signed.test/video.mp4",
              previewPosterUrl: "https://signed.test/poster.jpg",
              previewPosterStoragePath: "user-1/variants/videos/out-video/poster_720.jpg",
              previewStoragePath: "user-1/videos/out-video.mp4",
              fullStoragePath: "user-1/videos/out-video.mp4",
            },
          ],
          activeOutputId: "out-video",
          curatedReferenceIds: ["out-video"],
        },
      })
    );

    expect(payload.outputs.active[0]?.previewPosterUrl).toBe("https://signed.test/poster.jpg");
    expect(payload.outputs.active[0]?.previewPosterStoragePath).toBe(
      "user-1/variants/videos/out-video/poster_720.jpg"
    );
  });

  it("hydrates pulse runtime workspace fields", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          expertCreateMode: "pulse",
          activePulsePresetId: "multi_shot",
        },
      })
    );

    expect(payload.workspace.expertCreateMode).toBe("pulse");
    expect(payload.workspace.activePulsePresetId).toBe("multi_shot");
    expect(payload.workspace.pulseSessionInstanceId).toMatch(/^pulse_restore_/);
    expect(payload.workspace.standardPrompt).toBe("");
    expect(payload.workspace.pulsePrompt).toBe("prompt");
    expect(payload.workspace.prompt).toBe("prompt");
  });

  it("hydrates selected character look id when present", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedCharacterId: "char-1",
          selectedCharacterLookId: "2",
        },
      })
    );

    expect(payload.workspace.selectedCharacterId).toBe("char-1");
    expect(payload.workspace.selectedCharacterLookId).toBe("2");
  });

  it("hydrates separate Standard and Pulse prompt ownership when both are persisted", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          prompt: "Pulse artifact prompt",
          standardPrompt: "Standard draft prompt",
          pulsePrompt: "Pulse artifact prompt",
          expertCreateMode: "pulse",
          activePulsePresetId: "multi_shot",
        },
      })
    );

    expect(payload.workspace.prompt).toBe("Pulse artifact prompt");
    expect(payload.workspace.standardPrompt).toBe("Standard draft prompt");
    expect(payload.workspace.pulsePrompt).toBe("Pulse artifact prompt");
  });

  it("does not restore an active Pulse from runtime metadata when workspace authority is missing", () => {
    const payload = buildAiStudioSessionHydrationPayload({
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: createSnapshot().updatedAt,
        checksum: "test-checksum",
      },
      workspace: {
        ...createSnapshot().workspace,
        expertCreateMode: "pulse",
        activePulsePresetId: null,
      },
      agentRuntimes: {
        standard: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
        pulse: {
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
              attachments: [],
            },
          ],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "awaiting_input",
            currentStepIndex: 2,
            currentStepLabel: "Plot Seed",
            currentStepPrompt: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
            collectedInputs: ["grimdark tone"],
            lastArtifact: null,
            finalArtifactSource: null,
          },
        },
      },
    } as AiStudioSessionSnapshot);

    expect(payload.workspace.expertCreateMode).toBe("pulse");
    expect(payload.workspace.activePulsePresetId).toBeNull();
    expect(payload.workspace.pulseSessionInstanceId).toBeNull();
    expect(payload.agentRuntimes.pulsePresetId).toBeNull();
    expect(payload.agentRuntimes.pulseSessionInstanceId).toBeNull();
    expect(payload.agentRuntimes.pulse.messages).toEqual([]);
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession).toBeNull();
  });

  it("forces Pulse runtime chat mode on during hydration", () => {
    const payload = buildAiStudioSessionHydrationPayload({
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: createSnapshot().updatedAt,
        checksum: "test-checksum",
      },
      workspace: {
        ...createSnapshot().workspace,
        expertCreateMode: "pulse",
        activePulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
      },
      agentRuntimes: {
        standard: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
        pulse: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    } as AiStudioSessionSnapshot);

    expect(payload.agentRuntimes.standard.chatModeEnabled).toBe(false);
    expect(payload.agentRuntimes.pulse.chatModeEnabled).toBe(true);
    expect(payload.agent.chatModeEnabled).toBe(true);
  });

  it("does not seed Pulse runtime from Standard legacy agent state during a Standard-first restore", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          expertCreateMode: "standard",
          activePulsePresetId: "story_builder",
        },
        agent: {
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: "Standard agent reply",
            },
          ],
          input: "standard draft",
          latestAgentPrompt: "Standard agent reply",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
      })
    );

    expect(payload.workspace.activePulsePresetId).toBeNull();
    expect(payload.workspace.pulseSessionInstanceId).toBeNull();
    expect(payload.agent.messages).toEqual([]);
    expect(payload.agentRuntimes.standard.messages).toEqual([]);
    expect(payload.agentRuntimes.pulse.messages).toEqual([]);
    expect(payload.agentRuntimes.pulse.input).toBe("");
    expect(payload.agentRuntimes.pulse.latestAgentPrompt).toBeNull();
  });

  it("ignores persisted Pulse runtime payloads during Standard hydration", () => {
    const payload = buildAiStudioSessionHydrationPayload({
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: createSnapshot().updatedAt,
        checksum: "test-checksum",
      },
      workspace: {
        ...createSnapshot().workspace,
        prompt: "Standard prompt",
        standardPrompt: "Standard prompt",
        pulsePrompt: "Stale Pulse artifact prompt",
        expertCreateMode: "standard",
        activePulsePresetId: null,
      },
      agentRuntimes: {
        standard: {
          messages: [
            {
              id: "standard-1",
              role: "assistant",
              content: "Standard reply",
              attachments: [],
            },
          ],
          input: "",
          latestAgentPrompt: "Standard reply",
          promptOrigin: "agent",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
        pulse: {
          messages: [
            {
              id: "pulse-1",
              role: "assistant",
              content: "Pulse-only reply",
              attachments: [],
            },
          ],
          input: "stale Pulse draft",
          latestAgentPrompt: "Pulse artifact",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "completed",
            currentStepIndex: 3,
            currentStepLabel: "Final",
            currentStepPrompt: null,
            collectedInputs: ["Pulse-only input"],
            lastArtifact: "Pulse artifact",
            finalArtifactSource: "chat_reply",
          },
        },
      },
    } as AiStudioSessionSnapshot);

    expect(payload.workspace.expertCreateMode).toBe("standard");
    expect(payload.workspace.prompt).toBe("Standard prompt");
    expect(payload.workspace.standardPrompt).toBe("Standard prompt");
    expect(payload.workspace.pulsePrompt).toBe("");
    expect(payload.agentRuntimes.pulsePresetId).toBeNull();
    expect(payload.agentRuntimes.pulse.messages).toEqual([]);
    expect(payload.agentRuntimes.pulse.input).toBe("");
    expect(payload.agentRuntimes.pulse.latestAgentPrompt).toBeNull();
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession).toBeNull();
    expect(payload.agent.messages[0]?.content).toBe("Standard reply");
  });

  it("ignores persisted Pulse runtime payloads with mismatched preset authority", () => {
    const payload = buildAiStudioSessionHydrationPayload({
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: createSnapshot().updatedAt,
        checksum: "test-checksum",
      },
      workspace: {
        ...createSnapshot().workspace,
        prompt: "Pulse prompt",
        pulsePrompt: "Pulse prompt",
        expertCreateMode: "pulse",
        activePulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-story",
      },
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
          messages: [
            {
              id: "pulse-1",
              role: "assistant",
              content: "Other preset reply",
              attachments: [],
            },
          ],
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
    } as AiStudioSessionSnapshot);

    expect(payload.workspace.expertCreateMode).toBe("pulse");
    expect(payload.workspace.activePulsePresetId).toBe("story_builder");
    expect(payload.agentRuntimes.pulsePresetId).toBe("story_builder");
    expect(payload.agentRuntimes.pulseSessionInstanceId).toBe("pulse-session-story");
    expect(payload.agentRuntimes.pulse.messages).toEqual([]);
    expect(payload.agentRuntimes.pulse.input).toBe("");
    expect(payload.agentRuntimes.pulse.latestAgentPrompt).toBeNull();
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession).toBeNull();
    expect(payload.agent.messages).toEqual([]);
  });

  it("hydrates selected character workspace state when present", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedCharacterId: "char-1",
        },
      })
    );

    expect(payload.workspace.selectedCharacterId).toBe("char-1");
  });

  it("ignores legacy generic-agent pulse workflow session state", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          expertCreateMode: "pulse",
          activePulsePresetId: "story_builder",
        },
        agent: {
          ...createSnapshot().agent,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "awaiting_input",
            currentStepIndex: 4,
            currentStepLabel: "Scene Review",
            currentStepPrompt: "Step 4 — Review scenes. What would you like to change?",
            collectedInputs: ["grimdark", "A knight enters a cursed forest", "5 min"],
            lastArtifact: null,
          },
        },
      })
    );

    expect(payload.agent.pulseWorkflowSession).toBeNull();
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession).toBeNull();
  });

  it("ignores legacy generic-agent completed pulse workflow artifacts", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        agent: {
          ...createSnapshot().agent,
          pulseWorkflowSession: {
            presetId: "story_builder",
            status: "completed",
            currentStepIndex: 6,
            currentStepLabel: "Dialogue Story",
            currentStepPrompt: null,
            collectedInputs: ["grimdark", "A knight enters a cursed forest", "5 min"],
            lastArtifact:
              "Scene 1: A grimdark knight stands at the cursed forest edge beneath cold moonlight.",
            finalArtifactSource: "chat_reply",
          },
        },
      })
    );

    expect(payload.agent.pulseWorkflowSession).toBeNull();
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession).toBeNull();
  });

  it("round-trips a completed pulse workflow session artifact through snapshot build and hydrate", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "story-builder-session",
      updatedAt: "2026-04-23T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Build a fantasy story sequence",
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
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "completed",
        currentStepIndex: 6,
        currentStepLabel: "Image Prompts",
        currentStepPrompt: null,
        collectedInputs: ["grimdark tone", "A knight enters a cursed forest", "10 min"],
        lastArtifact:
          "Scene 1: cinematic wide shot of the knight entering the ruined hall under torchlight.",
      },
    });

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(payload.agent.pulseWorkflowSession).toEqual({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["grimdark tone", "A knight enters a cursed forest", "10 min"],
      lastArtifact:
        "Scene 1: cinematic wide shot of the knight entering the ruined hall under torchlight.",
      finalArtifactSource: null,
    });
    expect(payload.agentRuntimes.pulsePresetId).toBe("story_builder");
    expect(payload.agentRuntimes.standard.messages).toEqual([]);
  });

  it("keeps a restored Pulse draft separate from the completed workflow artifact", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "story-builder-session",
      updatedAt: "2026-04-23T12:00:00.000Z",
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
        currentStepLabel: "Image Prompts",
        currentStepPrompt: null,
        collectedInputs: ["grimdark tone", "A knight enters a cursed forest", "10 min"],
        lastArtifact: "Completed artifact prompt",
        finalArtifactSource: "chat_reply",
      },
    });

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(payload.workspace.prompt).toBe("Pulse draft prompt");
    expect(payload.workspace.standardPrompt).toBe("Standard draft prompt");
    expect(payload.workspace.pulsePrompt).toBe("Pulse draft prompt");
    expect(payload.agent.latestAgentPrompt).toBe("Completed artifact prompt");
    expect(payload.agent.pulseWorkflowSession?.lastArtifact).toBe("Completed artifact prompt");
    expect(payload.agent.pulseWorkflowSession?.finalArtifactSource).toBe("chat_reply");
    expect(payload.agentRuntimes.pulse.latestAgentPrompt).toBe("Completed artifact prompt");
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession?.lastArtifact).toBe(
      "Completed artifact prompt"
    );
  });

  it("restores apply_prompt Pulse workflow artifacts without dropping the source type", () => {
    const snapshot = buildAiStudioSessionSnapshot({
      sessionId: "apply-prompt-restore-session",
      updatedAt: "2026-04-23T12:00:00.000Z",
      mode: "image",
      selectedTool: "create",
      prompt: "Pulse draft prompt",
      standardCreatePrompt: "",
      pulseCreatePrompt: "Pulse draft prompt",
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

    const payload = buildAiStudioSessionHydrationPayload(snapshot);

    expect(payload.agent.pulseWorkflowSession?.finalArtifactSource).toBe("apply_prompt");
    expect(payload.agentRuntimes.pulse.pulseWorkflowSession?.finalArtifactSource).toBe(
      "apply_prompt"
    );
  });

  it("preserves persisted custom Kling prompt workspace during hydration", () => {
    const snapshot = createSnapshot({
      workspace: {
        ...createSnapshot().workspace,
        klingWorkflowMode: undefined,
        klingMultiPrompts: [{ id: "shot-1", prompt: "Beat one", duration: 5 }],
      },
    });

    const payload = buildAiStudioSessionHydrationPayload(snapshot);
    expect(payload.workspace.klingWorkflowMode).toBe("custom");
    expect(payload.workspace.klingMultiPrompts).toEqual([
      { id: "shot-1", prompt: "Beat one", duration: 5 },
    ]);
  });

  it("keeps Seedance 2 models active during hydration by default", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          mode: "video",
          selectedTool: "video",
          model: KIE_SEEDANCE_2_MODEL_ID,
        },
      })
    );

    expect(payload.workspace.model).toBe(KIE_SEEDANCE_2_MODEL_ID);
  });

  it("keeps Seedance 2 models on Seedance 2 during hydration when the retired rollout flag is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_SEEDANCE_2_ENABLED", "false");
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          mode: "video",
          selectedTool: "video",
          model: KIE_SEEDANCE_2_MODEL_ID,
        },
      })
    );

    expect(payload.workspace.model).toBe(KIE_SEEDANCE_2_MODEL_ID);
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
              height: 180,
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

  it("hydrates expert edit payload for schema v2 snapshots", () => {
    const snapshotV2: AiStudioSessionSnapshot = {
      ...createSnapshot(),
      schemaVersion: 2,
      meta: {
        generatedAt: "2026-03-02T00:00:00.000Z",
        checksum: "fnv1a32:1234abcd",
      },
      expertEdit: {
        schemaVersion: 1,
        state: {
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
        },
      },
    };

    const payload = buildAiStudioSessionHydrationPayload(snapshotV2);
    expect(payload.expertEdit).not.toBeNull();
    expect(payload.expertEdit?.layers.layers).toHaveLength(2);
    expect(payload.expertEdit?.layers.layers[1]?.imageUrl).toBeNull();
    expect(payload.expertEdit?.markup.strokes).toHaveLength(1);
    expect(payload.expertEdit?.inpaint.snapshot.layers).toHaveLength(1);
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

  it("normalizes legacy pulse-presets snapshots into presets", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          // Legacy snapshots can still contain the removed tool id.
          selectedTool:
            "pulse-presets" as unknown as AiStudioSessionSnapshotV1["workspace"]["selectedTool"],
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

  it("demotes legacy canvas selected tool during hydration", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedTool: "canvas" as unknown as AiStudioSessionSnapshot["workspace"]["selectedTool"],
        } as AiStudioSessionSnapshotV1["workspace"],
      })
    );

    expect(payload.workspace.selectedTool).toBe("create");
  });

  it("keeps Sound child tools as valid restored selected tools", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          selectedTool: "music",
        },
      })
    );

    expect(payload.workspace.selectedTool).toBe("music");
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
              profileImageTransform: { zoom: 1.4, offsetX: 6, offsetY: -2 },
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
      sourceKind: null,
      sourceElementId: null,
      sourceCharacterId: null,
      slotIndex: undefined,
      name: "",
      alias: "",
      description: "",
      profileImageUrl: null,
      profileImageTransform: { zoom: 1.4, offsetX: 6, offsetY: -2 },
      frontalImageUrl: "",
      referenceImageUrls: "https://example.com/ref-2.png",
      videoUrl: "",
    });
  });

  it("preserves legacy element aliases during hydration for compatibility matching", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          klingElements: [
            {
              id: "element-1",
              slotIndex: 0,
              sourceKind: "element",
              sourceElementId: "element-red-lantern",
              sourceCharacterId: null,
              name: "Red Lantern",
              alias: "legacylamp",
              description: "Warm lacquered lantern",
              profileImageUrl: "https://example.com/red-lantern-profile.png",
              profileImageTransform: { zoom: 1.1, offsetX: 2, offsetY: -1 },
              frontalImageUrl: "https://example.com/red-lantern-front.png",
              referenceImageUrls: "https://example.com/red-lantern-side.png",
              videoUrl: "",
            },
          ],
        },
      })
    );

    expect(payload.workspace.klingElements[0]).toEqual({
      id: "element-1",
      slotIndex: 0,
      sourceKind: "element",
      sourceElementId: "element-red-lantern",
      sourceCharacterId: null,
      name: "Red Lantern",
      alias: "legacylamp",
      description: "Warm lacquered lantern",
      profileImageUrl: "https://example.com/red-lantern-profile.png",
      profileImageTransform: { zoom: 1.1, offsetX: 2, offsetY: -1 },
      frontalImageUrl: "https://example.com/red-lantern-front.png",
      referenceImageUrls: "https://example.com/red-lantern-side.png",
      videoUrl: "",
    });
  });

  it("keeps blank-name legacy alias payloads available for restore fallback", () => {
    const payload = buildAiStudioSessionHydrationPayload(
      createSnapshot({
        workspace: {
          ...createSnapshot().workspace,
          klingElements: [
            {
              id: "legacy-element-1",
              sourceKind: "element",
              sourceElementId: "element-legacy",
              sourceCharacterId: null,
              name: "",
              alias: "legacylamp",
              description: "",
              profileImageUrl: null,
              profileImageTransform: null,
              frontalImageUrl: "",
              referenceImageUrls: "",
              videoUrl: "",
            },
          ],
        },
      })
    );

    expect(payload.workspace.klingElements[0]).toEqual({
      id: "legacy-element-1",
      sourceKind: "element",
      sourceElementId: "element-legacy",
      sourceCharacterId: null,
      slotIndex: undefined,
      name: "",
      alias: "legacylamp",
      description: "",
      profileImageUrl: null,
      profileImageTransform: null,
      frontalImageUrl: "",
      referenceImageUrls: "",
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

    expect(payload.agent.messages).toEqual([]);
    expect(payload.agent.input).toBe("");
    expect(payload.agent.latestAgentPrompt).toBeNull();
    expect(payload.agent.promptOrigin).toBe("manual");
    expect(payload.agent.chatModeEnabled).toBe(false);
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
              sourceRef: "src-queued-restore",
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
    expect(payload.outputs.active[0]?.sourceRef).toBe("src-queued-restore");
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
