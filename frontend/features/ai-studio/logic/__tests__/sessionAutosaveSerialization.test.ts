/**
 * Regression tests for AI Studio autosave snapshot serialization and semantic hashing.
 */
import { describe, expect, it, vi } from "vitest";
import {
  prepareAiStudioSessionAutosaveSnapshot,
  utf8ByteLength,
} from "../sessionAutosaveSerialization";
import {
  createEmptyAiStudioSessionSnapshot,
  type AiStudioSessionSnapshot,
} from "../sessionSnapshot";

describe("sessionAutosaveSerialization", () => {
  it("keeps the semantic hash stable for volatile timestamp metadata", () => {
    const baseSnapshot = createEmptyAiStudioSessionSnapshot({
      sessionId: "session-1",
      updatedAt: "2026-07-04T12:00:00.000Z",
    });
    const rebuiltSnapshot = {
      ...baseSnapshot,
      updatedAt: "2026-07-04T12:00:05.000Z",
      meta: {
        generatedAt: "2026-07-04T12:00:05.000Z",
        checksum: "fnv1a32:bbbbbbbb",
      },
    } satisfies AiStudioSessionSnapshot;

    const preparedBase = prepareAiStudioSessionAutosaveSnapshot(baseSnapshot);
    const preparedRebuilt = prepareAiStudioSessionAutosaveSnapshot(rebuiltSnapshot);

    expect(preparedBase.hash).toMatch(/^fnv1a32:/);
    expect(preparedRebuilt.hash).toBe(preparedBase.hash);
  });

  it("reuses full snapshot serialization when deriving the semantic hash", () => {
    const workspaceToJson = vi.fn(() => ({
      mode: "text",
      selectedTool: "create",
      prompt: "Saved prompt",
    }));
    const snapshot = {
      ...createEmptyAiStudioSessionSnapshot({
        sessionId: "session-1",
        updatedAt: "2026-07-04T12:00:00.000Z",
      }),
      workspace: {
        toJSON: workspaceToJson,
      },
    } as unknown as AiStudioSessionSnapshot;

    const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(snapshot, {
      includeSerializedJson: true,
    });

    expect(workspaceToJson).toHaveBeenCalledTimes(1);
    expect(preparedSnapshot.serializedJson).toBe(JSON.stringify(snapshot));
    expect(preparedSnapshot.bytes).toBe(utf8ByteLength(preparedSnapshot.serializedJson ?? ""));
  });
});
