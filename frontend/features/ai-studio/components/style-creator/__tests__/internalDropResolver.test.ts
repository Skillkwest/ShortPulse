import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import type { InternalReferenceDragPayload } from "../../../utils/dragDrop";
import { resolveStyleInternalDropCandidates } from "../internalDropResolver";

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  version: 1,
  origin: "ai-studio-reference-grid",
  referenceId: null,
  outputId: "out-1",
  imageIndex: 0,
  mediaId: null,
  referenceUrl: null,
  sourceSurface: "all-refs",
  ...overrides,
});

const makeImageOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "out-1",
    prompt: "cinematic portrait",
    mode: "image",
    aspect: "1:1",
    model: "model",
    status: "ready",
    timestamp: "now",
    previewUrl: "https://cdn.example.com/out-1-preview.png",
    resultUrls: ["https://cdn.example.com/out-1-result.png"],
    savedMediaIds: ["media-1"],
    previewStoragePath: "user-1/generations/images/out-1-preview.png",
    fullStoragePath: null,
    ...overrides,
  }) as StudioOutput;

describe("resolveStyleInternalDropCandidates", () => {
  it("resolves internal payload candidates from existing output state", async () => {
    const output = makeImageOutput();
    const saveReferenceToLibrary = vi.fn();

    const resolved = await resolveStyleInternalDropCandidates({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
      saveReferenceToLibrary,
      persistTimeoutMs: 3500,
      pollIntervalMs: 120,
      resolveSignedStorageUrl: async () => null,
    });

    expect(resolved).toBeTruthy();
    expect(resolved?.imageUrlCandidates).toContain("https://cdn.example.com/out-1-result.png");
    expect(resolved?.promptText).toBe("cinematic portrait");
    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });

  it("autosaves and prepends signed storage URL candidates once media id appears", async () => {
    let nowMs = 0;
    const output = makeImageOutput({
      savedMediaIds: [],
      previewStoragePath: "user-1/generations/images/out-1-preview.png",
      fullStoragePath: null,
      resultUrls: [],
    });
    const saveReferenceToLibrary = vi.fn();
    const sleep = vi.fn(async (ms: number) => {
      nowMs += ms;
      output.savedMediaIds = ["media-1"];
    });
    const resolveSignedStorageUrl = vi.fn(
      async () => "https://cdn.example.com/signed/out-1-preview.png"
    );

    const resolved = await resolveStyleInternalDropCandidates({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
      saveReferenceToLibrary,
      persistTimeoutMs: 3500,
      pollIntervalMs: 120,
      now: () => nowMs,
      sleep,
      resolveSignedStorageUrl,
    });

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalled();
    expect(resolveSignedStorageUrl).toHaveBeenCalledWith(
      "user-1/generations/images/out-1-preview.png"
    );
    expect(resolved?.imageUrlCandidates[0]).toBe(
      "https://cdn.example.com/signed/out-1-preview.png"
    );
  });

  it("returns null when no output or fallback reference URL can be resolved", async () => {
    const resolved = await resolveStyleInternalDropCandidates({
      payload: makePayload({
        outputId: null,
        referenceId: null,
        referenceUrl: null,
      }),
      getOutputById: () => null,
      getOutputSnapshot: () => ({
        outputOrder: [],
        archivedOutputOrder: [],
        outputById: {},
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: () => null,
      saveReferenceToLibrary: () => undefined,
      persistTimeoutMs: 3500,
      pollIntervalMs: 120,
    });

    expect(resolved).toBeNull();
  });

  it("uses media-id storage lookup fallback when output lacks canonical storage paths", async () => {
    const output = makeImageOutput({
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [],
      previewUrl: "https://provider.example.com/stale.png",
      savedMediaIds: ["media-lookup"],
    });

    const resolved = await resolveStyleInternalDropCandidates({
      payload: makePayload({ mediaId: "media-lookup" }),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
      saveReferenceToLibrary: () => undefined,
      persistTimeoutMs: 3500,
      pollIntervalMs: 120,
      resolveStoragePathFromMediaId: async (mediaId) =>
        mediaId === "media-lookup" ? "user-1/generations/images/lookup.png" : null,
      resolveSignedStorageUrl: async (path) =>
        path === "user-1/generations/images/lookup.png"
          ? "https://cdn.example.com/signed/lookup.png"
          : null,
    });

    expect(resolved?.imageUrlCandidates[0]).toBe("https://cdn.example.com/signed/lookup.png");
    expect(resolved?.resolutionReason).toBe("saved_media_lookup");
  });

  it("uses generation/task output-index fallback when media ids and storage paths are missing", async () => {
    const output = makeImageOutput({
      generationId: "gen-1",
      taskId: "req-1",
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: ["https://provider.example.com/result-index-0.png"],
      previewUrl: "https://provider.example.com/preview.png",
      savedMediaIds: [],
    });
    const resolveStoragePathFromGenerationOutput = vi.fn(
      async ({
        generationId,
        taskId,
        imageIndex,
      }: {
        generationId: string | null;
        taskId: string | null;
        imageIndex: number;
      }) => {
        if (generationId === "gen-1" && taskId === "req-1" && imageIndex === 0) {
          return "user-1/generations/images/generation-index-0.png";
        }
        return null;
      }
    );

    const resolved = await resolveStyleInternalDropCandidates({
      payload: makePayload({ mediaId: null }),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: () => null,
      saveReferenceToLibrary: () => undefined,
      persistTimeoutMs: 3500,
      pollIntervalMs: 120,
      resolveStoragePathFromGenerationOutput,
      resolveSignedStorageUrl: async (path) =>
        path === "user-1/generations/images/generation-index-0.png"
          ? "https://cdn.example.com/signed/generation-index-0.png"
          : null,
    });

    expect(resolveStoragePathFromGenerationOutput).toHaveBeenCalledWith({
      generationId: "gen-1",
      taskId: "req-1",
      imageIndex: 0,
    });
    expect(resolved?.imageUrlCandidates).toEqual([
      "https://cdn.example.com/signed/generation-index-0.png",
      "https://provider.example.com/result-index-0.png",
      "https://provider.example.com/preview.png",
    ]);
    expect(resolved?.resolutionReason).toBe("generation_index_lookup");
  });
});
