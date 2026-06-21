import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../../types";
import {
  areReferenceGridMediaOutputsEqual,
  projectReferenceGridMediaOutput,
} from "../referenceGridMediaOutput";

const createAudioOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "audio-1",
  prompt: "Launch voiceover",
  title: "Launch Voice",
  mode: "audio",
  aspect: "1:1",
  model: "Voiceover",
  status: "ready",
  timestamp: "Just now",
  taskState: "success",
  previewUrl: "https://media.test/voice.mp3",
  resultUrls: ["https://media.test/voice.mp3"],
  mediaSource: "generated",
  audioSourceMode: "voiceover",
  durationMs: 2000,
  waveformPeaks: [10, 40, 80],
  companionArtStatus: "pending",
  companionArtUrl: null,
  companionArtStoragePath: null,
  ...overrides,
});

describe("referenceGridMediaOutput", () => {
  it("treats generated audio title changes as card-rendering changes", () => {
    const previous = projectReferenceGridMediaOutput(createAudioOutput());
    const next = projectReferenceGridMediaOutput(
      createAudioOutput({
        title: "Fresh Launch Walkthrough",
      })
    );

    expect(areReferenceGridMediaOutputsEqual([previous], [next])).toBe(false);
  });

  it("treats generated audio companion-art changes as card-rendering changes", () => {
    const previous = projectReferenceGridMediaOutput(createAudioOutput());
    const next = projectReferenceGridMediaOutput(
      createAudioOutput({
        companionArtStatus: "ready",
        companionArtStoragePath: "user-1/generations/audio/audio-1/companion-art/cover.webp",
      })
    );

    expect(areReferenceGridMediaOutputsEqual([previous], [next])).toBe(false);
  });
});
