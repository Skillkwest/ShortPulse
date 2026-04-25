/**
 * Unit tests for the shared internal reference source contract.
 * Verifies app-owned references resolve to lazy blob authority without relying on preview URLs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import type { InternalReferenceDragPayload } from "../../../utils/dragDrop";
import { resolveInternalReferenceSource } from "../internalReferenceSource";

const { getSignedMediaUrlMock } = vi.hoisted(() => ({
  getSignedMediaUrlMock: vi.fn(),
}));

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
}));

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
    fullStoragePath: "user-1/generations/images/out-1-full.png",
    mediaSource: "generated",
    ...overrides,
  }) as StudioOutput;

describe("resolveInternalReferenceSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlMock.mockResolvedValue(null);
  });

  it("resolves app-owned output state into a shared authoritative source contract", async () => {
    const output = makeImageOutput();

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: true,
        mediaFileIds: [],
        delivery: null,
        error: null,
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "media-1",
        outputId: "out-1",
        mediaId: "media-1",
        mediaSource: "generated",
        previewStoragePath: "user-1/generations/images/out-1-preview.png",
        fullStoragePath: "user-1/generations/images/out-1-full.png",
        promptText: "cinematic portrait",
        preview: {
          url: "https://cdn.example.com/out-1-preview.png",
        },
      })
    );
    expect(resolved?.provenance).toEqual({
      origin: "ai-studio-reference-grid",
      outputId: "out-1",
      mediaId: "media-1",
      imageIndex: 0,
      sourceSurface: "all-refs",
      resolutionReason: "output_storage_path",
    });
    await expect(resolved?.loadBlob()).rejects.toBeTruthy();
  });

  it("awaits persistence metadata before falling back to weaker compatibility hints", async () => {
    const output = makeImageOutput({
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: true,
        mediaFileIds: ["media-1"],
        delivery: {
          previewStoragePath: "user-1/generations/images/out-1-preview.png",
          fullStoragePath: "user-1/generations/images/out-1-full.png",
          previewUrl: "https://cdn.example.com/signed/out-1-preview.png",
          fullUrl: "https://cdn.example.com/signed/out-1-full.png",
        },
        error: null,
      }),
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
    });

    expect(resolved?.sourceKind).toBe("generated_output");
    expect(resolved?.provenance.resolutionReason).toBe("persisted_delivery");
    expect(resolved?.previewStoragePath).toBe("user-1/generations/images/out-1-preview.png");
    expect(resolved?.fullStoragePath).toBe("user-1/generations/images/out-1-full.png");
  });

  it("passes the dragged image index through to persistence resolution", async () => {
    const output = makeImageOutput({
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
      resultUrls: [
        "https://cdn.example.com/out-1-result.png",
        "https://cdn.example.com/out-1-result-2.png",
      ],
    });
    const ensureOutputPersisted = vi.fn(async () => ({
      ok: true,
      mediaFileIds: ["media-1b"],
      delivery: {
        previewStoragePath: "user-1/generations/images/out-1-preview-2.png",
        fullStoragePath: "user-1/generations/images/out-1-full-2.png",
        previewUrl: "https://cdn.example.com/signed/out-1-preview-2.png",
        fullUrl: "https://cdn.example.com/signed/out-1-full-2.png",
      },
      error: null,
    }));

    await resolveInternalReferenceSource({
      payload: makePayload({ imageIndex: 1 }),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted,
      resolveSavedMediaIdFromOutput: (row) => row?.savedMediaIds?.[0] ?? null,
    });

    expect(ensureOutputPersisted).toHaveBeenCalledWith("out-1", { imageIndex: 1 });
  });

  it("preserves local upload authority through lazy blob fallback instead of preview-url ranking", async () => {
    const output = makeImageOutput({
      mediaSource: "upload",
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
      localObjectUrl: "blob:local-style-source",
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload({ mediaId: null }),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved?.sourceKind).toBe("local_file");
    expect(resolved?.provenance.resolutionReason).toBe("local_object_url");
  });

  it("fails closed for generated outputs missing durable generation identity", async () => {
    const output = makeImageOutput({
      mediaSource: "generated",
      savedMediaIds: [],
      previewStoragePath: null,
      fullStoragePath: null,
      generationId: undefined,
      taskId: "req-generated-missing-id",
      previewUrl: "https://cdn.example.com/generated-preview-only.png",
      resultUrls: ["https://cdn.example.com/generated-preview-only.png"],
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved).toBeNull();
  });

  it("keeps compatibility fallback for unresolved media-library-backed references", async () => {
    const resolved = await resolveInternalReferenceSource({
      payload: makePayload({
        outputId: "out-missing",
        mediaId: "media-lookup",
        referenceUrl: "https://cdn.example.com/stale-reference.png",
      }),
      getOutputById: () => null,
      getOutputSnapshot: () => ({
        outputOrder: [],
        archivedOutputOrder: [],
        outputById: {},
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        kind: "internal",
        sourceKind: "media_library",
        sourceId: "media-lookup",
        outputId: "out-missing",
        mediaId: "media-lookup",
      })
    );
    expect(resolved?.provenance.resolutionReason).toBe("payload_reference_url");
  });

  it("fails closed when only a stale generated reference url is present without internal identity", async () => {
    const matchingOutput = makeImageOutput({
      id: "out-stale-generated",
      savedMediaIds: ["media-1"],
      previewStoragePath: "user-1/generations/images/out-stale-preview.png",
      fullStoragePath: "user-1/generations/images/out-stale-full.png",
      previewUrl: "https://cdn.example.com/stale-reference.png",
      resultUrls: ["https://cdn.example.com/stale-reference.png"],
      mediaSource: "generated",
    });

    const resolved = await resolveInternalReferenceSource({
      payload: makePayload({
        outputId: null,
        referenceId: null,
        mediaId: null,
        referenceUrl: "https://cdn.example.com/stale-reference.png",
      }),
      getOutputById: () => null,
      getOutputSnapshot: () => ({
        outputOrder: ["out-stale-generated"],
        archivedOutputOrder: [],
        outputById: { "out-stale-generated": matchingOutput },
        archivedOutputById: {},
      }),
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved).toBeNull();
  });

  it("returns null when no internal identity or compatibility hint can be resolved", async () => {
    const resolved = await resolveInternalReferenceSource({
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
      ensureOutputPersisted: async () => ({
        ok: false,
        mediaFileIds: [],
        delivery: null,
        error: "missing",
      }),
      resolveSavedMediaIdFromOutput: () => null,
    });

    expect(resolved).toBeNull();
  });
});
