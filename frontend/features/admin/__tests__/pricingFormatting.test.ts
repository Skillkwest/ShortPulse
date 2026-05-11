import { describe, expect, it } from "vitest";
import { getModelTypeLabel } from "../pricingFormatting";
import type { AdminPricingModelRow } from "../types";

const buildModelRow = (overrides: Partial<AdminPricingModelRow>): AdminPricingModelRow =>
  ({
    id: "music_v1",
    label: "ElevenLabs Music",
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    workflowType: "Music",
    pricingStrategy: "elevenlabs-music-per-minute",
    pricingStrategyLabel: "Per minute",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultResolution: null,
    allowedResolutions: [],
    defaultDurationSeconds: 60,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: 8,
    maxDurationSeconds: 180,
    allowedDurations: [],
    defaultAudio: null,
    roundingIncrement: 1,
    pricingAuthority: "shared_policy",
    pricingPreview: null,
    pricingPreviewVariants: [],
    ...overrides,
  }) as AdminPricingModelRow;

describe("getModelTypeLabel", () => {
  it("maps explicit music and voiceover workflows to text-to-sound", () => {
    expect(getModelTypeLabel(buildModelRow({ workflowType: "Music" }))).toBe("text → sound");
    expect(getModelTypeLabel(buildModelRow({ workflowType: "Sound effect" }))).toBe("text → sound");
    expect(getModelTypeLabel(buildModelRow({ workflowType: "Voiceover" }))).toBe("text → sound");
    expect(getModelTypeLabel(buildModelRow({ workflowType: "Voice design" }))).toBe("text → sound");
  });

  it("maps explicit voice-changer workflows to sound-to-sound", () => {
    expect(
      getModelTypeLabel(
        buildModelRow({
          workflowType: "Voice changer",
          pricingStrategy: "elevenlabs-voice-changer-per-minute",
        })
      )
    ).toBe("sound → sound");
  });

  it("maps text-to-text workflow labels to text-to-text", () => {
    expect(
      getModelTypeLabel(
        buildModelRow({
          id: "gpt-5.4-nano",
          label: "GPT-5.4 Nano",
          provider: "openai",
          workflowType: "Text to text",
          pricingStrategy: "openai-text-token",
          pricingStrategyLabel: "Per 50,000 characters",
        })
      )
    ).toBe("text → text");
  });
});
