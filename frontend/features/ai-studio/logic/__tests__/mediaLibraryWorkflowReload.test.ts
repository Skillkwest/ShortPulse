import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MediaFileRow } from "../mediaLibraryModalModel";
import {
  resolveMediaMetadataLyricsText,
  resolveMediaMetadataMusicMode,
} from "../mediaLibraryModalModel";
import {
  canReloadMediaLibraryWorkflow,
  createMediaLibraryWorkflowReloadOutput,
  resolveMediaLibraryWorkflowReloadMediaKindHint,
} from "../mediaLibraryWorkflowReload";
import { resolveWorkflowReloadConfigForOutput } from "../workflowReload";

const MANUAL_WORKFLOW_RELOAD_FLAG = "NEXT_PUBLIC_AI_STUDIO_MANUAL_WORKFLOW_RELOAD_ENABLED";
const originalManualWorkflowReloadFlag = process.env[MANUAL_WORKFLOW_RELOAD_FLAG];

const workflowReload = {
  version: 1,
  source: "ai_studio_generation",
  capturedAt: "2026-06-06T14:00:00.000Z",
  originTool: "create",
  panelKind: "create",
  outputMode: "image",
  restoreBehavior: "navigate_and_hydrate",
  projectId: "project-1",
  createMode: "standard",
  pulse: null,
  prompt: {
    display: "A glass fox in a desert observatory",
  },
  model: {
    id: "fal-ai/imagen4/preview",
  },
  payload: {
    kind: "image",
    submitTool: "create",
    aspect: "16:9",
    imageResolution: "1K",
    referenceInputs: [],
    internalMediaRefs: [],
  },
} as const;

const generationReplay = {
  version: 1,
  mode: "image",
  submitTool: "create",
  modelId: "fal-ai/imagen4/preview",
  displayPrompt: "A glass fox in a desert observatory",
  submissionPrompt: "A glass fox in a desert observatory",
  aspect: "16:9",
  imageResolution: "1K",
  referenceInputs: [],
  capturedAt: "2026-06-06T14:00:00.000Z",
} as const;

const characterContext = {
  applied: true,
  characterId: "character-1",
  characterName: "Rózalin Belaroa",
  lookId: "main",
  lookName: "Main",
  characterProfileImageUrl: "https://cdn.test/character.png",
} as const;

const styleContext = {
  applied: true,
  styleId: "style-1",
  styleName: "Digicam Photorealism",
  stylePrompt: "photoreal editorial lighting",
  stylePreviewImageUrl: "https://cdn.test/style.png",
} as const;

describe("mediaLibraryWorkflowReload", () => {
  beforeEach(() => {
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = "true";
  });

  afterEach(() => {
    if (originalManualWorkflowReloadFlag === undefined) {
      delete process.env[MANUAL_WORKFLOW_RELOAD_FLAG];
      return;
    }
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = originalManualWorkflowReloadFlag;
  });

  const createRow = (overrides: Partial<MediaFileRow> = {}): MediaFileRow => ({
    id: "media-1",
    filename: "glass-fox.png",
    storage_path: "user-1/media-library/glass-fox.png",
    file_type: "image/png",
    source: "ai_studio",
    source_ref: "generation-1",
    created_at: "2026-06-06T14:01:00.000Z",
    signedUrl: "https://cdn.example.com/glass-fox.png",
    metadata: {
      workflow_reload: workflowReload,
      generation_replay: generationReplay,
      character_context: characterContext,
      style_context: styleContext,
    },
    ...overrides,
  });

  it("creates a generated StudioOutput from explicit saved AI Studio workflow metadata", () => {
    const output = createMediaLibraryWorkflowReloadOutput(createRow());

    expect(output).toMatchObject({
      id: "media-library:media-1",
      prompt: "A glass fox in a desert observatory",
      mode: "image",
      aspect: "16:9",
      modelId: "fal-ai/imagen4/preview",
      mediaSource: "generated",
      generationId: "generation-1",
      workflowReload,
      generationReplay,
      characterContext,
      styleContext,
    });
    expect(canReloadMediaLibraryWorkflow(createRow())).toBe(true);
  });

  it("keeps saved workflow metadata readable while default launch availability hides reload", () => {
    delete process.env[MANUAL_WORKFLOW_RELOAD_FLAG];
    const row = createRow();
    const output = createMediaLibraryWorkflowReloadOutput(row);

    expect(output?.workflowReload).toEqual(workflowReload);
    expect(canReloadMediaLibraryWorkflow(row)).toBe(false);
  });

  it("derives the reload media-kind hint from the saved media file type", () => {
    expect(resolveMediaLibraryWorkflowReloadMediaKindHint(createRow())).toBe("image");
    expect(
      resolveMediaLibraryWorkflowReloadMediaKindHint(
        createRow({ filename: "wolf-motion.mp4", file_type: "video/mp4" })
      )
    ).toBe("video");
  });

  it("falls back to workflow metadata when saved media file type is missing", () => {
    const videoWorkflowReload = {
      ...workflowReload,
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "standard",
        durationSeconds: 6,
        resolution: "720p",
        generateAudio: false,
        cameraFixed: false,
        autoFix: false,
        referenceInputs: ["https://cdn.example.com/first-frame.png"],
        internalMediaRefs: [],
      },
    } as const;

    const row = createRow({
      filename: "wolf-motion.mp4",
      file_type: undefined,
      signedUrl: "https://cdn.example.com/wolf-motion.mp4",
      metadata: {
        workflow_reload: videoWorkflowReload,
      },
    });

    expect(resolveMediaLibraryWorkflowReloadMediaKindHint(row)).toBe("video");
    expect(createMediaLibraryWorkflowReloadOutput(row)).toMatchObject({
      mode: "video",
      modelId: "kie-ai/kling-3.0",
      workflowReload: videoWorkflowReload,
    });
  });

  it("does not reload saved video rows with legacy image-shaped workflow metadata", () => {
    const row = createRow({
      filename: "wolf-motion.mp4",
      file_type: "video/mp4",
      signedUrl: "https://cdn.example.com/wolf-motion",
      storage_path: "user-1/media-library/wolf-motion.mp4",
      metadata: {
        model_id: "kie-ai/kling-3.0",
        workflow_reload: workflowReload,
      },
    });
    const output = createMediaLibraryWorkflowReloadOutput(row);

    expect(resolveMediaLibraryWorkflowReloadMediaKindHint(row)).toBe("video");
    expect(output).toMatchObject({
      mode: "video",
      modelId: "kie-ai/kling-3.0",
      mimeType: "video/mp4",
      mediaSource: "generated",
      workflowReload,
    });
    expect(canReloadMediaLibraryWorkflow(row)).toBe(false);
    expect(
      output ? resolveWorkflowReloadConfigForOutput(output, { mediaKindHint: "video" }) : null
    ).toBeNull();
  });

  it("does not reload path-backed saved videos when workflow metadata is legacy image-shaped", () => {
    const row = createRow({
      filename: "wolf-motion.mp4",
      file_type: "image/png",
      signedUrl: "https://cdn.example.com/wolf-motion.mp4",
      storage_path: "user-1/media-library/wolf-motion.mp4",
      metadata: {
        model_id: "kie-ai/kling-3.0",
        workflow_reload: workflowReload,
      },
    });
    const output = createMediaLibraryWorkflowReloadOutput(row);

    expect(resolveMediaLibraryWorkflowReloadMediaKindHint(row)).toBe("video");
    expect(output).toMatchObject({
      mode: "video",
      modelId: "kie-ai/kling-3.0",
      mediaSource: "generated",
      workflowReload,
    });
    expect(canReloadMediaLibraryWorkflow(row)).toBe(false);
    expect(
      output ? resolveWorkflowReloadConfigForOutput(output, { mediaKindHint: "video" }) : null
    ).toBeNull();
  });

  it("preserves video workflow sidecar references from saved AI Studio media rows", () => {
    const videoWorkflowReload = {
      ...workflowReload,
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: {
        display: "Restore a wolf keyframe video",
      },
      model: {
        id: "kie-ai/kling-3.0",
      },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "keyframes",
        durationSeconds: 3,
        resolution: "720p",
        generateAudio: false,
        cameraFixed: false,
        autoFix: false,
        referenceInputs: ["https://cdn.example.com/legacy-first.png"],
        internalMediaRefs: [],
        videoReferences: {
          version: 1,
          firstFrame: {
            sourceUrl: "https://cdn.example.com/first-frame.png",
            internalMediaRef: {
              version: 1,
              kind: "storage_object",
              bucket: "media_library",
              storagePath: "user-1/video/first-frame.png",
            },
          },
          lastFrame: {
            sourceUrl: "https://cdn.example.com/last-frame.png",
            internalMediaRef: {
              version: 1,
              kind: "storage_object",
              bucket: "media_library",
              storagePath: "user-1/video/last-frame.png",
            },
          },
        },
      },
    } as const;

    const output = createMediaLibraryWorkflowReloadOutput(
      createRow({
        filename: "wolf-motion.mp4",
        file_type: "video/mp4",
        signedUrl: "https://cdn.example.com/wolf-motion.mp4",
        metadata: {
          workflow_reload: videoWorkflowReload,
        },
      })
    );

    expect(output).toMatchObject({
      id: "media-library:media-1",
      mode: "video",
      aspect: "16:9",
      modelId: "kie-ai/kling-3.0",
      mediaSource: "generated",
      workflowReload: videoWorkflowReload,
    });
    expect(output?.workflowReload?.payload.kind).toBe("video");
    if (output?.workflowReload?.payload.kind !== "video") {
      throw new Error("Expected video workflow reload payload");
    }
    expect(output.workflowReload.payload.videoReferences?.firstFrame?.sourceUrl).toBe(
      "https://cdn.example.com/first-frame.png"
    );
    expect(output.workflowReload.payload.videoReferences?.lastFrame?.sourceUrl).toBe(
      "https://cdn.example.com/last-frame.png"
    );
  });

  it("rejects uploaded media and rows without valid saved workflow metadata", () => {
    expect(
      createMediaLibraryWorkflowReloadOutput(
        createRow({
          source: "upload",
        })
      )
    ).toBeNull();
    expect(
      createMediaLibraryWorkflowReloadOutput(
        createRow({
          metadata: null,
        })
      )
    ).toBeNull();
  });

  it("resolves saved music lyrics from direct metadata and workflow reload payloads", () => {
    expect(
      resolveMediaMetadataLyricsText({
        lyrics_text: "  Direct saved lyric  ",
      })
    ).toBe("Direct saved lyric");

    expect(
      resolveMediaMetadataLyricsText({
        workflow_reload: {
          payload: {
            kind: "music",
            lyrics: "Workflow saved lyric",
          },
        },
      })
    ).toBe("Workflow saved lyric");
  });

  it("resolves saved music mode from direct metadata and workflow reload payloads", () => {
    expect(resolveMediaMetadataMusicMode({ music_mode: "instrumental" })).toBe("instrumental");
    expect(resolveMediaMetadataMusicMode({ musicMode: "vocal" })).toBe("vocal");
    expect(
      resolveMediaMetadataMusicMode({
        workflow_reload: {
          payload: {
            kind: "music",
            mode: "instrumental",
          },
        },
      })
    ).toBe("instrumental");
  });
});
