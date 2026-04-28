import { describe, expect, it } from "vitest";
import {
  resolveVoiceChangerOutputRemoteUrl,
  resolveVoiceChangerOutputStoragePath,
} from "../voiceChangerReferenceSource";
import type { StudioOutput } from "../../types";

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput => ({
  id: "output-1",
  prompt: "Reference source",
  mode: "audio",
  aspect: "1:1",
  model: "Test model",
  status: "ready",
  timestamp: "Now",
  resultUrls: [],
  ...overrides,
});

describe("voiceChangerReferenceSource", () => {
  it("rejects app-relative render URLs as storage paths", () => {
    const output = makeOutput({
      fullStoragePath: "/api/media/preview/ref-123.mp3?token=abc",
      previewStoragePath: "/api/media/preview/ref-123-preview.mp3?token=abc",
    });

    expect(resolveVoiceChangerOutputStoragePath(output)).toBeNull();
  });

  it("prefers canonical full storage paths over preview storage paths", () => {
    const output = makeOutput({
      fullStoragePath: "user-1/generations/audio/full.mp3",
      previewStoragePath: "user-1/generations/audio/preview.mp3",
    });

    expect(resolveVoiceChangerOutputStoragePath(output)).toBe("user-1/generations/audio/full.mp3");
  });

  it("uses source candidates before preview candidates for remote video sources", () => {
    const output = makeOutput({
      mode: "video",
      previewStoragePath: "https://cdn.example.com/reference-poster.jpg",
      resultUrls: ["https://cdn.example.com/reference-video.mp4"],
      previewUrl: "https://cdn.example.com/reference-preview.jpg",
    });

    expect(resolveVoiceChangerOutputRemoteUrl({ output, kind: "video" })).toBe(
      "https://cdn.example.com/reference-video.mp4"
    );
  });

  it("does not accept non-media-kind preview assets as remote source media", () => {
    const output = makeOutput({
      mode: "audio",
      previewStoragePath: "https://cdn.example.com/reference-waveform.jpg",
      previewUrl: "https://cdn.example.com/reference-card.jpg",
      resultUrls: [],
    });

    expect(resolveVoiceChangerOutputRemoteUrl({ output, kind: "audio" })).toBeNull();
  });

  it("accepts extensionless source candidates when the output mode matches", () => {
    const output = makeOutput({
      mode: "audio",
      fullStoragePath: "https://cdn.example.com/download?id=audio-123",
      resultUrls: [],
    });

    expect(resolveVoiceChangerOutputRemoteUrl({ output, kind: "audio" })).toBe(
      "https://cdn.example.com/download?id=audio-123"
    );
  });
});
