import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { resolveReferenceAudioDisplayTitle } from "../referenceAudioTitle";

const createAudioOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "audio-1",
  prompt: "Reference audio",
  mode: "audio",
  aspect: "1:1",
  model: "Upload",
  status: "ready",
  timestamp: "Now",
  mediaSource: "upload",
  ...overrides,
});

describe("resolveReferenceAudioDisplayTitle", () => {
  it("prefers explicit audio titles", () => {
    expect(
      resolveReferenceAudioDisplayTitle(
        createAudioOutput({
          prompt: "tree there 2.mp3",
          title: "Clean Room Take.wav",
        })
      )
    ).toBe("Clean Room Take.wav");
  });

  it("falls back to imported audio filenames stored in prompt", () => {
    expect(
      resolveReferenceAudioDisplayTitle(
        createAudioOutput({
          prompt: "tree there 2.mp3",
          title: null,
        })
      )
    ).toBe("tree there 2.mp3");
  });

  it("does not promote generated audio prompts into card titles", () => {
    expect(
      resolveReferenceAudioDisplayTitle(
        createAudioOutput({
          prompt: "A long cinematic music cue with rising percussion",
          title: null,
          mediaSource: "generated",
        })
      )
    ).toBeNull();
  });
});
