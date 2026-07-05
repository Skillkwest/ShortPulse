import { describe, expect, it } from "vitest";
import { mergeMediaListDurationMetadata } from "../mediaListDurationMetadata";

describe("mergeMediaListDurationMetadata", () => {
  it("mirrors top-level media duration seconds into card-readable metadata", () => {
    expect(mergeMediaListDurationMetadata({ metadata: null, durationSeconds: 15 })).toEqual({
      duration_ms: 15_000,
      duration_seconds: 15,
    });
  });

  it("preserves existing duration metadata as the card authority", () => {
    expect(
      mergeMediaListDurationMetadata({
        metadata: { duration_ms: 9_000, title: "Existing" },
        durationSeconds: 15,
      })
    ).toEqual({
      duration_ms: 9_000,
      title: "Existing",
    });
    expect(
      mergeMediaListDurationMetadata({
        metadata: { source_duration_seconds: 12, title: "Source duration" },
        durationSeconds: 15,
      })
    ).toEqual({
      source_duration_seconds: 12,
      title: "Source duration",
    });
    expect(
      mergeMediaListDurationMetadata({
        metadata: { audio_duration_seconds: 11, title: "Audio duration" },
        durationSeconds: 15,
      })
    ).toEqual({
      audio_duration_seconds: 11,
      title: "Audio duration",
    });
  });

  it("ignores invalid or zero duration column values", () => {
    expect(
      mergeMediaListDurationMetadata({ metadata: { title: "Clip" }, durationSeconds: 0 })
    ).toEqual({
      title: "Clip",
    });
    expect(
      mergeMediaListDurationMetadata({ metadata: { title: "Clip" }, durationSeconds: "nope" })
    ).toEqual({
      title: "Clip",
    });
  });
});
