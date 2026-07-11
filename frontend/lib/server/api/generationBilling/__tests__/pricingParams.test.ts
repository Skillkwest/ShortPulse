import { describe, expect, it } from "vitest";

import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../../../../model-runtime/klingMotionControlPricing";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../../model-runtime/falModelIds";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../../model-runtime/providerModelIds";
import { buildPricingParams } from "../pricingParams";

describe("buildPricingParams", () => {
  it("counts provider URL-array image inputs for reference-aware billing", () => {
    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        input_urls: Array.from(
          { length: 10 },
          (_, index) => `https://example.com/ref-${index}.png`
        ),
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );

    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        image_urls: ["https://example.com/ref-1.png", null, "  ", "https://example.com/ref-2.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 2,
      })
    );
  });

  it("prefers explicit input image count when submission payload provides it", () => {
    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        input_image_count: 10,
        input_urls: ["https://example.com/ref-1.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );
  });

  it("maps Kling Motion Control mode resolution onto the canonical billing resolution", () => {
    expect(
      buildPricingParams(KIE_KLING_30_MODEL_ID, {
        model: "kling-3.0/motion-control",
        mode: "720p",
        generate_audio: true,
      })
    ).toEqual(
      expect.objectContaining({
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
        durationSeconds: 10,
        resolution: "720p",
        mode: "720p",
        audio: true,
      })
    );
  });

  it("keeps auto-duration sound effects on generation count instead of catalog duration", () => {
    expect(
      buildPricingParams("eleven_text_to_sound_v2", {
        generation_count: 1,
      })
    ).toEqual(
      expect.objectContaining({
        generationCount: 1,
      })
    );
    expect(
      buildPricingParams("eleven_text_to_sound_v2", {
        generation_count: 1,
      })
    ).not.toHaveProperty("durationSeconds");
  });

  it("keeps explicit-duration sound effects duration-based", () => {
    expect(
      buildPricingParams("eleven_text_to_sound_v2", {
        duration_seconds: 10,
      })
    ).toEqual(
      expect.objectContaining({
        durationSeconds: 10,
      })
    );
  });

  it("uses explicit video output duration evidence from submit context", () => {
    expect(
      buildPricingParams(
        KIE_SEEDANCE_2_MODEL_ID,
        {
          prompt: "Animate the reference clip",
          aspect_ratio: "9:16",
          resolution: "720p",
          reference_video_urls: ["https://example.com/reference.mp4"],
        },
        {
          shortpulseContext: {
            output_duration_seconds: 15,
            input_video_count: 1,
            input_video_duration_seconds: 4,
          },
        }
      )
    ).toEqual(
      expect.objectContaining({
        durationSeconds: 15,
        inputVideoCount: 1,
        inputVideoDurationSeconds: 4,
        sourceDurationSeconds: 4,
      })
    );
  });

  it("uses Lip Sync audio duration context when generic video output duration is absent", () => {
    expect(
      buildPricingParams(
        FAL_OMNIHUMAN_V15_MODEL_ID,
        {
          image_url: "https://example.com/character.png",
          audio_url: "https://example.com/voice.mp3",
          resolution: "720p",
        },
        {
          shortpulseContext: {
            audio_duration_seconds: 30,
            lip_sync_audio_duration_ms: 30_000,
          },
        }
      )
    ).toEqual(
      expect.objectContaining({
        durationSeconds: 30,
        resolution: "720p",
      })
    );
  });
});
