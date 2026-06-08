import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { mergeCanonicalGeneratedOutputs } from "../generatedOutputHydration";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "Now",
  ...overrides,
});

describe("generatedOutputHydration", () => {
  it("merges canonical generated outputs into matching in-memory outputs", () => {
    const existing = [
      createOutput({
        id: "local-1",
        generationId: "gen-1",
        taskId: "req-1",
        createdAt: "2026-05-24T10:00:00.000Z",
        taskState: "running",
        queueState: "dispatched",
        mediaSource: "generated",
      }),
    ];

    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        queueState: "dispatched",
        mediaSource: "generated",
        previewUrl: "https://cdn.test/generated-preview.png",
        previewPosterUrl: "https://cdn.test/generated-poster.jpg",
        resultUrls: ["https://cdn.test/generated-full.png"],
        createdAt: "2026-05-24T12:00:00.000Z",
        timestamp: "Just now",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)).toEqual([
      expect.objectContaining({
        id: "local-1",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        previewUrl: "https://cdn.test/generated-preview.png",
        previewPosterUrl: "https://cdn.test/generated-poster.jpg",
        resultUrls: ["https://cdn.test/generated-full.png"],
        mediaSource: "generated",
        createdAt: "2026-05-24T12:00:00.000Z",
        timestamp: "Just now",
      }),
    ]);
  });

  it("replaces fallback generated timestamps with canonical hydrated createdAt", () => {
    const existing = [
      createOutput({
        id: "local-1",
        generationId: "gen-1",
        taskId: "req-1",
        createdAt: "2026-05-24T10:00:00.000Z",
        taskState: "running",
        mediaSource: "generated",
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        createdAt: "2026-05-24T12:00:00.000Z",
        taskState: "success",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)[0]).toEqual(
      expect.objectContaining({
        id: "local-1",
        createdAt: "2026-05-24T12:00:00.000Z",
      })
    );
  });

  it("preserves the optimistic createdAt while a matching output is still in flight", () => {
    const existing = [
      createOutput({
        id: "local-1",
        generationId: "gen-1",
        taskId: "req-1",
        createdAt: "2026-05-24T12:00:00.000Z",
        taskState: "running",
        mediaSource: "generated",
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        createdAt: "2026-05-24T10:00:00.000Z",
        taskState: "running",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)[0]).toEqual(
      expect.objectContaining({
        id: "local-1",
        createdAt: "2026-05-24T12:00:00.000Z",
      })
    );
  });

  it("preserves local reference-grid suppression until canonical hydration catches up", () => {
    const existing = [
      createOutput({
        id: "local-1",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        mediaSource: "generated",
        hiddenInReferenceGrid: true,
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        mediaSource: "generated",
        hiddenInReferenceGrid: false,
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)[0]).toEqual(
      expect.objectContaining({
        id: "local-1",
        hiddenInReferenceGrid: true,
      })
    );
  });

  it("hydrates workflow reload metadata onto matching generated outputs", () => {
    const workflowReload: StudioOutput["workflowReload"] = {
      version: 1,
      source: "ai_studio_generation",
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      restoreBehavior: "navigate_and_hydrate",
      createMode: null,
      pulse: null,
      prompt: { display: "A cinematic tracking shot" },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "standard",
        durationSeconds: 8,
        resolution: "1080p",
        generateAudio: true,
        cameraFixed: false,
        autoFix: true,
        referenceInputs: ["https://example.com/frame.png"],
      },
    };
    const existing = [
      createOutput({
        id: "local-1",
        mode: "video",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "running",
        mediaSource: "generated",
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        mode: "video",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        mediaSource: "generated",
        workflowReload,
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)[0]).toEqual(
      expect.objectContaining({
        id: "local-1",
        workflowReload,
      })
    );
  });

  it("prepends unseen canonical generated outputs", () => {
    const existing = [createOutput({ id: "local-existing" })];
    const hydrated = [
      createOutput({
        id: "generated:gen-2",
        generationId: "gen-2",
        taskId: "req-2",
        taskState: "success",
        mediaSource: "generated",
        previewUrl: "https://cdn.test/generated-2.png",
        resultUrls: ["https://cdn.test/generated-2.png"],
        timestamp: "Just now",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)[0]).toEqual(
      expect.objectContaining({
        id: "generated:gen-2",
        generationId: "gen-2",
        taskId: "req-2",
        mediaSource: "generated",
      })
    );
  });

  it("merges canonical generated outputs into id-only restored shells", () => {
    const existing = [
      createOutput({
        id: "generated:gen-1",
        prompt: "",
        generationId: undefined,
        taskId: undefined,
        sourceRef: undefined,
        taskState: undefined,
        mediaSource: "generated",
        previewUrl: undefined,
        resultUrls: [],
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        taskState: "success",
        mediaSource: "generated",
        previewUrl: "https://cdn.test/generated-preview.png",
        resultUrls: ["https://cdn.test/generated-full.png"],
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)).toEqual([
      expect.objectContaining({
        id: "generated:gen-1",
        generationId: "gen-1",
        taskId: "req-1",
        previewUrl: "https://cdn.test/generated-preview.png",
        resultUrls: ["https://cdn.test/generated-full.png"],
      }),
    ]);
  });

  it("keeps batched canonical generated outputs newest first", () => {
    const existing = [createOutput({ id: "local-existing" })];
    const hydrated = [
      createOutput({
        id: "generated:gen-newest",
        generationId: "gen-newest",
        taskId: "req-newest",
        taskState: "success",
        mediaSource: "generated",
      }),
      createOutput({
        id: "generated:gen-middle",
        generationId: "gen-middle",
        taskId: "req-middle",
        taskState: "success",
        mediaSource: "generated",
      }),
      createOutput({
        id: "generated:gen-oldest",
        generationId: "gen-oldest",
        taskId: "req-oldest",
        taskState: "success",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated).map((output) => output.id)).toEqual([
      "generated:gen-newest",
      "generated:gen-middle",
      "generated:gen-oldest",
      "local-existing",
    ]);
  });

  it("orders matched generated outputs by the canonical newest-first batch", () => {
    const existing = [
      createOutput({
        id: "local-oldest",
        generationId: "gen-oldest",
        taskId: "req-oldest",
        taskState: "running",
      }),
      createOutput({
        id: "local-newest",
        generationId: "gen-newest",
        taskId: "req-newest",
        taskState: "running",
      }),
      createOutput({ id: "local-upload" }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-newest",
        generationId: "gen-newest",
        taskId: "req-newest",
        taskState: "success",
        mediaSource: "generated",
      }),
      createOutput({
        id: "generated:gen-middle",
        generationId: "gen-middle",
        taskId: "req-middle",
        taskState: "success",
        mediaSource: "generated",
      }),
      createOutput({
        id: "generated:gen-oldest",
        generationId: "gen-oldest",
        taskId: "req-oldest",
        taskState: "success",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated).map((output) => output.id)).toEqual([
      "local-newest",
      "generated:gen-middle",
      "local-oldest",
      "local-upload",
    ]);
  });

  it("matches duplicate runtime identities in existing order without reusing a row", () => {
    const existing = [
      createOutput({
        id: "local-first",
        taskId: "req-shared",
        taskState: "running",
      }),
      createOutput({
        id: "local-second",
        taskId: "req-shared",
        taskState: "running",
      }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:first",
        taskId: "req-shared",
        generationId: "gen-first",
        taskState: "success",
        mediaSource: "generated",
      }),
      createOutput({
        id: "generated:second",
        taskId: "req-shared",
        generationId: "gen-second",
        taskState: "success",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated).map((output) => output.id)).toEqual([
      "local-first",
      "local-second",
    ]);
    expect(mergeCanonicalGeneratedOutputs(existing, hydrated)).toEqual([
      expect.objectContaining({ id: "local-first", generationId: "gen-first" }),
      expect.objectContaining({ id: "local-second", generationId: "gen-second" }),
    ]);
  });

  it("keeps unmatched failed generated outputs in the active workset", () => {
    const existing = [
      createOutput({
        id: "generated:gen-failed",
        generationId: "gen-failed",
        taskId: "req-failed",
        taskState: "fail",
        mediaSource: "generated",
      }),
      createOutput({ id: "local-upload" }),
    ];
    const hydrated = [
      createOutput({
        id: "generated:gen-success",
        generationId: "gen-success",
        taskId: "req-success",
        taskState: "success",
        mediaSource: "generated",
      }),
    ];

    expect(mergeCanonicalGeneratedOutputs(existing, hydrated).map((output) => output.id)).toEqual([
      "generated:gen-success",
      "generated:gen-failed",
      "local-upload",
    ]);
  });
});
