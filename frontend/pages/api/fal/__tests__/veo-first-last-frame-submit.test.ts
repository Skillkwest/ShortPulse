import { describe, expect, it } from "vitest";
import { validateVeoFirstLastPayload } from "../veo-first-last-frame-submit";

describe("validateVeoFirstLastPayload", () => {
  it("accepts a valid first/last frame payload", () => {
    expect(
      validateVeoFirstLastPayload({
        prompt: "Slow cinematic push from first frame to last frame.",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        aspect_ratio: "16:9",
        duration: "8s",
        resolution: "1080p",
        generate_audio: true,
      })
    ).toBeNull();
  });

  it("requires prompt, first frame, and last frame", () => {
    expect(validateVeoFirstLastPayload({})).toMatchObject({
      detail: { field: "prompt" },
    });
    expect(validateVeoFirstLastPayload({ prompt: "x" })).toMatchObject({
      detail: { field: "first_frame_url" },
    });
    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/first.png",
      })
    ).toMatchObject({
      detail: { field: "last_frame_url" },
    });
  });

  it("rejects obvious video sources in frame URLs", () => {
    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/input.mp4",
        last_frame_url: "https://example.com/last.png",
      })
    ).toMatchObject({
      detail: { field: "first_frame_url" },
    });

    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "data:video/mp4;base64,AAAA",
      })
    ).toMatchObject({
      detail: { field: "last_frame_url" },
    });
  });

  it("rejects invalid enum values", () => {
    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        aspect_ratio: "1:1",
      })
    ).toMatchObject({
      detail: { field: "aspect_ratio" },
    });

    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        duration: "10s",
      })
    ).toMatchObject({
      detail: { field: "duration" },
    });

    expect(
      validateVeoFirstLastPayload({
        prompt: "x",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        resolution: "480p",
      })
    ).toMatchObject({
      detail: { field: "resolution" },
    });
  });
});
