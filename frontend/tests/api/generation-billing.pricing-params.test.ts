import { describe, expect, it } from "vitest";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
  FAL_OMNIHUMAN_V15_MODEL_ID,
} from "../../lib/model-runtime/falModelIds";
import { KIE_SEEDANCE_2_MODEL_ID } from "../../lib/model-runtime/providerModelIds";
import { buildPricingParams } from "../../lib/server/api/generationBilling/pricingParams";

describe("generationBilling pricing params normalization", () => {
  it("preserves explicit image dimensions for per-MP pricing models", () => {
    const params = buildPricingParams("fal-ai/bytedance/seedream/v4.5/edit", {
      image_size: { width: 4096, height: 4096 },
    });

    expect(params.imageWidth).toBe(4096);
    expect(params.imageHeight).toBe(4096);
    expect(params.aspect).toBe("1:1");
  });

  it("normalizes invalid seedance duration/resolution to safe billable values", () => {
    const params = buildPricingParams(KIE_SEEDANCE_2_MODEL_ID, {
      duration: 3,
      resolution: "ultra",
    });

    expect(params.durationSeconds).toBe(4);
    expect(params.resolution).toBe("1080p");
  });

  it("rebuilds OmniHuman Lip Sync pricing from submitted resolution and audio duration context", () => {
    const params = buildPricingParams(
      FAL_OMNIHUMAN_V15_MODEL_ID,
      {
        image_url: "https://fal.media/files/character.png",
        audio_url: "https://fal.media/files/voice.mp3",
        resolution: "720p",
      },
      {
        shortpulseContext: {
          lip_sync_audio_duration_ms: 12_400,
          audio_duration_seconds: 12.4,
        },
      }
    );

    expect(params.durationSeconds).toBe(12);
    expect(params.resolution).toBe("720p");
  });

  it("maps enable_google_search to webSearch for nano-banana pricing", () => {
    const params = buildPricingParams("fal-ai/nano-banana-pro", {
      enable_google_search: true,
    });

    expect(params.webSearch).toBe(true);
  });

  it("maps enable_web_search alias for nano-banana-2 pricing", () => {
    const params = buildPricingParams("fal-ai/nano-banana-2", {
      enable_web_search: true,
    });

    expect(params.webSearch).toBe(true);
  });

  it("maps Flux2 Klein style placeholder previews to the style-preview pricing variant", () => {
    const params = buildPricingParams(
      FAL_FLUX_2_KLEIN_9B_MODEL_ID,
      {
        image_size: { width: 1024, height: 1024 },
      },
      {
        shortpulseContext: {
          source_mode: "style_preview",
        },
      }
    );

    expect(params.variantBaseId).toBe(FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID);
    expect(params.aspect).toBe("1:1");
    expect(params.resolution).toBe("model_default");
  });

  it("maps Flux2 Klein audio companion art to the audio-reference background pricing variant", () => {
    const params = buildPricingParams(
      FAL_FLUX_2_KLEIN_9B_MODEL_ID,
      {
        image_size: { width: 1024, height: 1024 },
      },
      {
        shortpulseContext: {
          source_mode: "audio_companion_art",
        },
      }
    );

    expect(params.variantBaseId).toBe(FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID);
    expect(params.aspect).toBe("1:1");
    expect(params.resolution).toBe("model_default");
  });

  it("normalizes 0.5K resolution for nano-banana-2", () => {
    const params = buildPricingParams("fal-ai/nano-banana-2/edit", {
      resolution: "0.5k",
    });

    expect(params.resolution).toBe("0.5K");
  });

  it("preserves auto_3K resolution for seedream 5 lite", () => {
    const params = buildPricingParams("fal-ai/bytedance/seedream/v5/lite/edit", {
      image_size: "auto_3K",
    });

    expect(params.resolution).toBe("auto_3K");
  });

  it("infers auto_4K resolution from Seedream object image_size payloads", () => {
    const params = buildPricingParams("fal-ai/bytedance/seedream/v4.5/edit", {
      image_size: { width: 3840, height: 2160 },
    });

    expect(params.resolution).toBe("auto_4K");
  });

  it("falls back to shortpulse context image dimensions for per-MP edit pricing", () => {
    const params = buildPricingParams(
      "fal-ai/flux-pro/v1/fill",
      {
        prompt: "Fill the removed region",
      },
      {
        shortpulseContext: {
          image_width: 2048,
          image_height: 1024,
        },
      }
    );

    expect(params.imageWidth).toBe(2048);
    expect(params.imageHeight).toBe(1024);
  });

  it("normalizes gpt-image-2 size, quality, and count aliases into pricing params", () => {
    const params = buildPricingParams("gpt-image-2", {
      size: "1024x1536",
      quality: "HIGH",
      n: 2.4,
    });

    expect(params.size).toBe("1024x1536");
    expect(params.aspect).toBe("9:16");
    expect(params.resolution).toBe("high");
    expect(params.quality).toBe("high");
    expect(params.generationCount).toBe(2);
  });

  it("falls back to gpt-image-2 model defaults when size and quality are omitted", () => {
    const params = buildPricingParams("gpt-image-2", {});

    expect(params.aspect).toBe("1:1");
    expect(params.resolution).toBe("medium");
  });

  it("normalizes gpt-image-2 edit payload inputs into pricing params", () => {
    const params = buildPricingParams("gpt-image-2", {
      size: "1536x1024",
      quality: "MEDIUM",
      input_fidelity: "high",
      images: [
        { image_url: "https://example.com/base.png" },
        { image_url: "https://example.com/ref.png" },
      ],
      mask: { image_url: "https://example.com/mask.png" },
    });

    expect(params.size).toBe("1536x1024");
    expect(params.aspect).toBe("16:9");
    expect(params.quality).toBe("medium");
    expect(params.inputFidelity).toBe("high");
    expect(params.inputImageCount).toBe(2);
    expect(params.maskPresent).toBe(true);
  });
});
