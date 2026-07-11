/**
 * Voice Changer submit-readiness contract tests.
 */
import { describe, expect, it } from "vitest";
import type { VoiceChangerSource } from "../VoiceChangerSourceDropzone";
import { canSubmitVoiceChangerSource } from "../voiceChangerSourceSubmit";

const buildSource = (overrides: Partial<VoiceChangerSource>): VoiceChangerSource =>
  ({
    id: "source-1",
    kind: "audio",
    displayKind: "audio",
    origin: "url",
    status: "ready",
    aspect: null,
    durationMs: 1_000,
    name: "source.wav",
    mimeType: "audio/wav",
    file: null,
    previewUrl: null,
    posterUrl: null,
    sourceUrl: "https://signed.example/source.wav",
    objectUrl: null,
    storagePath: null,
    referenceOutputId: null,
    referenceMediaId: null,
    errorMessage: null,
    extractedFrom: null,
    ...overrides,
  }) as VoiceChangerSource;

describe("canSubmitVoiceChangerSource", () => {
  it("keeps trusted audio-only URL sources eligible", () => {
    expect(canSubmitVoiceChangerSource(buildSource({}))).toBe(true);
  });

  it("rejects video-derived audio until both staged authorities are durable", () => {
    expect(
      canSubmitVoiceChangerSource(
        buildSource({
          displayKind: "video",
          storagePath: "user-1/voice-changer/staged-audio/source.wav",
          extractedFrom: {
            kind: "video",
            name: "source.mp4",
            mimeType: "video/mp4",
            previewUrl: "https://signed.example/source.mp4",
            sourceUrl: "https://signed.example/source.mp4",
            storagePath: null,
            aspect: "16:9",
            referenceOutputId: null,
            referenceMediaId: null,
          },
        })
      )
    ).toBe(false);
  });

  it("accepts video-derived audio with staged audio and canonical video storage", () => {
    expect(
      canSubmitVoiceChangerSource(
        buildSource({
          displayKind: "video",
          storagePath: "user-1/voice-changer/staged-audio/source.wav",
          extractedFrom: {
            kind: "video",
            name: "source.mp4",
            mimeType: "video/mp4",
            previewUrl: "https://signed.example/source.mp4",
            sourceUrl: "https://signed.example/source.mp4",
            storagePath: "user-1/voice-changer/source-video/source.mp4",
            aspect: "16:9",
            referenceOutputId: null,
            referenceMediaId: null,
          },
        })
      )
    ).toBe(true);
  });
});
