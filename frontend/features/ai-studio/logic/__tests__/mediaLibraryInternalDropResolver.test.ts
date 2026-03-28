/**
 * Unit tests for Media Library internal-drop resolver autosave fallback behavior.
 */
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import { resolveMediaLibraryInternalDropResolver } from "../mediaLibraryInternalDropResolver";

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
    mode: "image",
    promptId: null,
    savedMediaIds: [],
    previewUrl: "https://cdn.example.com/out-1.png",
    resultUrls: ["https://cdn.example.com/out-1.png"],
    ...overrides,
  }) as unknown as StudioOutput;

describe("resolveMediaLibraryInternalDropResolver", () => {
  it("returns null when autosave persistence times out without ids", async () => {
    let nowMs = 0;
    const output = makeImageOutput();
    const saveReferenceToLibrary = vi.fn();
    const sleep = vi.fn(async (ms: number) => {
      nowMs += ms;
    });

    const result = await resolveMediaLibraryInternalDropResolver({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: () => null,
      saveReferenceToLibrary,
      persistTimeoutMs: 350,
      pollIntervalMs: 120,
      now: () => nowMs,
      sleep,
    });

    expect(result).toBeNull();
    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("out-1");
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 120);
  });

  it("returns null when autosave throws before polling", async () => {
    const output = makeImageOutput();
    const saveReferenceToLibrary = vi.fn(() => {
      throw new Error("save-failed");
    });
    const sleep = vi.fn(async () => undefined);

    const result = await resolveMediaLibraryInternalDropResolver({
      payload: makePayload(),
      getOutputById: () => output,
      getOutputSnapshot: () => ({
        outputOrder: ["out-1"],
        archivedOutputOrder: [],
        outputById: { "out-1": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: () => null,
      saveReferenceToLibrary,
      persistTimeoutMs: 350,
      pollIntervalMs: 120,
      sleep,
    });

    expect(result).toBeNull();
    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("fails closed when only a reference url is present without internal identity", async () => {
    const output = makeImageOutput({
      id: "out-stale",
      previewUrl: "https://cdn.example.com/stale-reference.png",
      resultUrls: ["https://cdn.example.com/stale-reference.png"],
    });
    const saveReferenceToLibrary = vi.fn();

    const result = await resolveMediaLibraryInternalDropResolver({
      payload: makePayload({
        outputId: null,
        referenceId: null,
        referenceUrl: "https://cdn.example.com/stale-reference.png",
      }),
      getOutputById: () => null,
      getOutputSnapshot: () => ({
        outputOrder: ["out-stale"],
        archivedOutputOrder: [],
        outputById: { "out-stale": output },
        archivedOutputById: {},
      }),
      resolveSavedMediaIdFromOutput: () => null,
      saveReferenceToLibrary,
      persistTimeoutMs: 350,
      pollIntervalMs: 120,
    });

    expect(result).toBeNull();
    expect(saveReferenceToLibrary).not.toHaveBeenCalled();
  });
});
