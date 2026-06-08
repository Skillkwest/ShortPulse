import { describe, expect, it } from "vitest";
import type { MediaFileRow } from "../mediaLibraryModalModel";
import {
  canReloadMediaLibraryWorkflow,
  createMediaLibraryWorkflowReloadOutput,
} from "../mediaLibraryWorkflowReload";

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

describe("mediaLibraryWorkflowReload", () => {
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
    });
    expect(canReloadMediaLibraryWorkflow(createRow())).toBe(true);
  });

  it("rejects uploaded media and mismatched saved workflow metadata", () => {
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
          file_type: "video/mp4",
        })
      )
    ).toBeNull();
  });
});
