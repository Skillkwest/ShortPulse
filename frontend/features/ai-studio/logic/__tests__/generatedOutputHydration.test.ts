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
        timestamp: "Just now",
      }),
    ]);
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
});
