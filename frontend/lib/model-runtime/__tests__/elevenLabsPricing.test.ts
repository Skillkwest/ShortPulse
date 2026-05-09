import { describe, expect, it } from "vitest";
import { buildDefaultPricingParams, computeCostForModel } from "../pricing";

describe("ElevenLabs runtime pricing", () => {
  it("prices voiceover from billed character count", () => {
    const breakdown = computeCostForModel("eleven_multilingual_v2", {
      textCharacters: 1000,
    });

    expect(breakdown).toMatchObject({
      usdRaw: 0.1,
    });
  });

  it("prices voice changer from processed source duration", () => {
    const breakdown = computeCostForModel("eleven_multilingual_sts_v2", {
      sourceDurationSeconds: 60,
    });

    expect(breakdown).toMatchObject({
      usdRaw: 0.12,
    });
  });

  it("prices auto-duration sound effects per generation", () => {
    const breakdown = computeCostForModel("eleven_text_to_sound_v2", {
      generationCount: 1,
    });

    expect(breakdown).toMatchObject({
      usdRaw: 0.01,
    });
  });

  it("prices sound effects from the 5s explicit-duration catalog default", () => {
    const breakdown = computeCostForModel(
      "eleven_text_to_sound_v2",
      buildDefaultPricingParams("eleven_text_to_sound_v2")
    );

    expect(breakdown).toMatchObject({
      usdRaw: 0.01,
    });
  });

  it("scales explicit-duration sound effects linearly by seconds", () => {
    const breakdown = computeCostForModel("eleven_text_to_sound_v2", {
      durationSeconds: 10,
    });

    expect(breakdown).toMatchObject({
      usdRaw: 0.02,
    });
  });

  it("prices music from requested duration", () => {
    const breakdown = computeCostForModel("music_v1", {
      durationSeconds: 30,
    });

    expect(breakdown).toMatchObject({
      usdRaw: 0.15,
    });
  });

  it("prices music from the 60s catalog default", () => {
    const breakdown = computeCostForModel("music_v1", {});

    expect(breakdown).toMatchObject({
      usdRaw: 0.3,
    });
  });
});
