import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  canRerollOutput,
  hasUnavailableWorkflowRerollReference,
  resolveWorkflowRerollConfigForOutput,
} from "../workflowReroll";
import { buildWorkflowReloadConfigV1 } from "../workflowReload";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  ...overrides,
});

describe("workflowReroll", () => {
  it("allows generated image reroll from legacy generation replay metadata", () => {
    const output = createOutput({
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        displayPrompt: "Visible prompt",
        submissionPrompt: "Submission prompt",
        aspect: "9:16",
        imageResolution: "2K",
        referenceInputs: [],
        capturedAt: "2026-06-23T00:00:00.000Z",
      },
    });

    const config = resolveWorkflowRerollConfigForOutput(output);

    expect(canRerollOutput(output)).toBe(true);
    expect(config?.payload).toEqual(
      expect.objectContaining({
        kind: "image",
        aspect: "9:16",
        imageResolution: "2K",
      })
    );
  });

  it("allows generated video and audio reroll from workflow reload metadata", () => {
    const videoReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "Video prompt" },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "standard",
        durationSeconds: 6,
        resolution: "1080p",
        generateAudio: false,
        cameraFixed: null,
        autoFix: null,
        referenceInputs: [],
        seedance2ReferenceImageUrls: [],
        seedance2ReferenceVideoUrls: [],
        seedance2ReferenceAudioUrls: [],
        klingElements: [],
      },
    });
    const musicReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "music",
      panelKind: "music",
      outputMode: "audio",
      prompt: { display: "Music prompt" },
      model: { id: "elevenlabs/music" },
      payload: {
        kind: "music",
        text: "Music prompt",
        durationSeconds: 30,
        mode: "instrumental",
      },
    });

    expect(
      canRerollOutput(createOutput({ mode: "video", workflowReload: videoReload ?? undefined }), {
        mediaKindHint: "video",
      })
    ).toBe(true);
    expect(
      canRerollOutput(createOutput({ mode: "audio", workflowReload: musicReload ?? undefined }), {
        mediaKindHint: "audio",
      })
    ).toBe(true);
  });

  it("rejects non-generated outputs and local-only references without internal authority", () => {
    const reload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "edit",
      panelKind: "edit",
      outputMode: "image",
      prompt: { display: "Edit prompt" },
      model: { id: "fal-ai/nano-banana/edit" },
      payload: {
        kind: "image",
        submitTool: "edit",
        aspect: "1:1",
        imageResolution: "2K",
        referenceInputs: ["blob:local-reference"],
        internalMediaRefs: [],
      },
    });
    const output = createOutput({
      workflowReload: reload ?? undefined,
    });

    expect(canRerollOutput({ ...output, mediaSource: "upload" })).toBe(false);
    expect(reload && hasUnavailableWorkflowRerollReference(reload)).toBe(true);
  });
});
