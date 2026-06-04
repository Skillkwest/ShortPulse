/**
 * Unit coverage for Kie model-contract payload validation/normalization.
 */

import { describe, expect, it } from "vitest";
import {
  assertSupportedKieModelId,
  isSupportedKieModelId,
  normalizeKieSubmitPayloadForModel,
} from "../kieModelContracts";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../kieModelIds";
import {
  kieKlingCreateTaskRequestFixture,
  kieKlingMotionControlRequestFixture,
  kieVeoGenerateRequestFixture,
} from "./fixtures/kieContractFixtures";

describe("kieModelContracts", () => {
  it("tracks supported Kie model ids", () => {
    expect(isSupportedKieModelId(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId(KIE_KLING_30_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId(KIE_SEEDANCE_2_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId(KIE_SEEDANCE_2_FAST_MODEL_ID)).toBe(true);
    expect(isSupportedKieModelId("kie-ai/unknown")).toBe(false);
  });

  it("fails closed for unsupported Kie model ids", () => {
    expect(() => assertSupportedKieModelId("kie-ai/unknown")).toThrow(
      "Unsupported Kie model contract: kie-ai/unknown"
    );
  });

  it("normalizes VEO i2v payload and enforces required contract fields", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "make a short clip",
          imageUrls: ["https://example.com/ref.png"],
          aspect: "16:9",
          duration: "6",
        },
      })
    ).toEqual(
      expect.objectContaining({
        prompt: "make a short clip",
        image_url: "https://example.com/ref.png",
        imageUrls: ["https://example.com/ref.png"],
        aspect_ratio: "16:9",
        duration: 6,
        duration_seconds: 6,
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        model: "veo3_fast",
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: { image_url: "https://example.com/ref.png" },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit requires a prompt.");

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: { prompt: "text only" },
      })
    ).toEqual(
      expect.objectContaining({
        prompt: "text only",
        generationType: "TEXT_2_VIDEO",
      })
    );
  });

  it("normalizes VEO i2v optional fields to valid contract values", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          generationType: "TEXT_2_VIDEO",
        },
      })
    ).toEqual(
      expect.objectContaining({
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      })
    );

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          imageUrls: ["https://example.com/ref.png", "https://example.com/ref-2.png"],
          generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
          seeds: 12345,
          aspectRatio: "9:16",
        },
      })
    ).toEqual(
      expect.objectContaining({
        imageUrls: ["https://example.com/ref.png", "https://example.com/ref-2.png"],
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        seeds: 12345,
        aspect_ratio: "9:16",
      })
    );

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          duration: 5,
        },
      })
    ).toEqual(
      expect.objectContaining({
        duration: 6,
        duration_seconds: 6,
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          aspect_ratio: "1:1",
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit uses unsupported aspect ratio");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          seeds: 999,
        },
      })
    ).toThrow('Kie VEO 3.1 Fast I2V submit field "seeds" must be an integer');

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          imageUrls: [
            "https://example.com/ref-1.png",
            "https://example.com/ref-2.png",
            "https://example.com/ref-3.png",
          ],
          generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        },
      })
    ).toThrow("FIRST_AND_LAST_FRAMES_2_VIDEO supports 1-2 image URLs");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          resolution: "4k",
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V submit uses unsupported resolution");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          image_url: "https://example.com/ref.png",
          generate_audio: "yes",
        } as unknown as Record<string, unknown>,
      })
    ).toThrow('Kie VEO 3.1 Fast I2V submit field "generate_audio" must be boolean');

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: {
          prompt: "clip",
          generationType: "TEXT_2_VIDEO",
          image_url: "https://example.com/ref.png",
        },
      })
    ).toThrow("Kie VEO 3.1 Fast I2V TEXT_2_VIDEO does not accept image URLs.");
  });

  it("normalizes Kling payload and requires prompt", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "a cinematic pan shot",
          image_url: "https://example.com/ref.png",
          aspect: "9:16",
          duration: 10,
        },
      })
    ).toEqual(
      expect.objectContaining({
        model: "kling-3.0/video",
        input: expect.objectContaining({
          prompt: "a cinematic pan shot",
          image_urls: ["https://example.com/ref.png"],
          aspect_ratio: "9:16",
          duration: "10",
        }),
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: { duration: 10, image_url: "https://example.com/ref.png" },
      })
    ).toThrow("Kie Kling 3.0 submit requires a prompt.");
  });

  it("normalizes Seedance 2 payload for text, frame, and multimodal lanes", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        payload: {
          prompt: "A dramatic skyline reveal",
          aspect_ratio: "16:9",
          duration: 5,
          resolution: "1080p",
          generate_audio: true,
        },
      })
    ).toEqual({
      model: "bytedance/seedance-2",
      input: {
        prompt: "A dramatic skyline reveal",
        aspect_ratio: "16:9",
        resolution: "1080p",
        duration: "5",
        generate_audio: true,
      },
    });

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
        payload: {
          prompt: "Animate the storyboard frames",
          first_frame_url: "https://example.com/first.png",
          last_frame_url: "https://example.com/last.png",
          duration: 15,
          callbackUrl: "https://example.com/callback/seedance-fast",
        },
      })
    ).toEqual({
      model: "bytedance/seedance-2-fast",
      callBackUrl: "https://example.com/callback/seedance-fast",
      input: {
        prompt: "Animate the storyboard frames",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        aspect_ratio: "16:9",
        resolution: "720p",
        duration: "15",
      },
    });

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        payload: {
          prompt: "Use the references to match rhythm and palette",
          reference_image_urls: ["https://example.com/ref-image.png"],
          reference_video_urls: ["https://example.com/ref-video.mp4"],
          reference_audio_urls: ["https://example.com/ref-audio.mp3"],
          return_last_frame: true,
          web_search: false,
        },
      })
    ).toEqual({
      model: "bytedance/seedance-2",
      input: {
        prompt: "Use the references to match rhythm and palette",
        reference_image_urls: ["https://example.com/ref-image.png"],
        reference_video_urls: ["https://example.com/ref-video.mp4"],
        reference_audio_urls: ["https://example.com/ref-audio.mp3"],
        aspect_ratio: "16:9",
        resolution: "1080p",
        duration: "5",
        return_last_frame: true,
        web_search: false,
      },
    });

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        payload: {
          prompt: "bad mixed mode",
          first_frame_url: "https://example.com/first.png",
          reference_image_urls: ["https://example.com/ref-image.png"],
        },
      })
    ).toThrow("cannot mix frame URLs with multimodal reference URLs");
  });

  it("normalizes primary-source fixture payloads for Veo and Kling docs shapes", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
        payload: kieVeoGenerateRequestFixture,
      })
    ).toEqual(
      expect.objectContaining({
        prompt: "A dog playing in a park",
        imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
        model: "veo3_fast",
        generationType: "REFERENCE_2_VIDEO",
        aspect_ratio: "16:9",
        seeds: 12345,
      })
    );

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: kieKlingCreateTaskRequestFixture,
      })
    ).toEqual(
      expect.objectContaining({
        model: "kling-3.0/video",
        callBackUrl: "https://example.com/callback/kling",
        input: expect.objectContaining({
          mode: "pro",
          image_urls: ["https://example.com/first-frame.png"],
          prompt: "In a bright rehearsal room, sunlight streams through the window@element_dog",
          duration: "5",
          aspect_ratio: "16:9",
          multi_shots: false,
          sound: true,
        }),
      })
    );

    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: kieKlingMotionControlRequestFixture,
      })
    ).toEqual(
      expect.objectContaining({
        model: "kling-3.0/motion-control",
        callBackUrl: "https://example.com/callback/kling-motion",
        input: expect.objectContaining({
          prompt: "The cartoon character is dancing.",
          input_urls: ["https://example.com/character.png"],
          video_urls: ["https://example.com/motion.mp4"],
          mode: "720p",
          generate_audio: false,
          character_orientation: "image",
          background_source: "input_video",
        }),
      })
    );
  });

  it("enforces Kling optional field contracts", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref.png",
          duration: "10",
          cfg_scale: "0.6",
        },
      })
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          aspect_ratio: "16:9",
          duration: "10",
          cfg_scale: 0.6,
        }),
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref.png",
          aspect_ratio: "4:3",
        },
      })
    ).toThrow("Kie Kling 3.0 submit uses unsupported aspect ratio");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref.png",
          duration: 16,
        },
      })
    ).toThrow("Kie Kling 3.0 submit uses unsupported duration");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref.png",
          cfg_scale: "high",
        },
      })
    ).toThrow('Kie Kling 3.0 submit field "cfg_scale" must be numeric');

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref.png",
          generate_audio: "yes",
        } as unknown as Record<string, unknown>,
      })
    ).toThrow('Kie Kling 3.0 submit field "generate_audio" must be boolean');
  });

  it("normalizes Kling multi-shot and element payloads", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "kling prompt",
          image_url: "https://example.com/ref-a.png",
          image_urls: ["https://example.com/ref-a.png", "https://example.com/ref-b.png"],
          duration: 14,
          resolution: "1080p",
          mode: "pro",
          generate_audio: false,
          sound: false,
          multi_shots: false,
          multi_prompt: [
            { prompt: "Shot one", duration: 5 },
            { prompt: "Shot two", duration: 7 },
          ],
          kling_elements: [
            {
              name: "Element01",
              description: "Reference images for Element01",
              element_input_urls: [
                "https://example.com/element-a.png",
                "https://example.com/element-b.png",
              ],
            },
            {
              name: "Element02",
              description: "Reference video for Element02",
              element_input_video_urls: ["https://example.com/element-video.mp4"],
            },
          ],
        },
      })
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          duration: "14",
          image_urls: ["https://example.com/ref-a.png"],
          multi_shots: true,
          sound: true,
          multi_prompt: [
            { prompt: "Shot one", duration: 5 },
            { prompt: "Shot two", duration: 7 },
          ],
          kling_elements: [
            {
              name: "Element01",
              description: "Reference images for Element01",
              element_input_urls: [
                "https://example.com/element-a.png",
                "https://example.com/element-b.png",
              ],
            },
            {
              name: "Element02",
              description: "Reference video for Element02",
              element_input_video_urls: ["https://example.com/element-video.mp4"],
            },
          ],
        }),
      })
    );
  });

  it("validates Kling motion-control required inputs", () => {
    expect(
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "motion clip",
          image_url: "https://example.com/character.png",
          video_url: "https://example.com/motion.mp4",
          mode: "1080p",
          generate_audio: true,
        },
      })
    ).toEqual(
      expect.objectContaining({
        model: "kling-3.0/motion-control",
        input: expect.objectContaining({
          input_urls: ["https://example.com/character.png"],
          video_urls: ["https://example.com/motion.mp4"],
          mode: "1080p",
          generate_audio: true,
        }),
      })
    );

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "motion clip",
          image_url: "https://example.com/character.png",
          video_url: "https://example.com/motion.mp4",
          mode: "540p",
        },
      })
    ).toThrow("Kie Kling 3.0 motion-control submit uses unsupported mode");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "motion clip",
          image_url: "https://example.com/character.png",
          model: "kling-3.0/motion-control",
        },
      })
    ).toThrow("Kie Kling 3.0 motion-control submit requires one motion video URL.");

    expect(() =>
      normalizeKieSubmitPayloadForModel({
        modelId: KIE_KLING_30_MODEL_ID,
        payload: {
          prompt: "motion clip",
          image_url: "https://example.com/character.png",
          video_url: "https://example.com/motion.mp4",
          generate_audio: "yes",
        } as unknown as Record<string, unknown>,
      })
    ).toThrow('Kie Kling 3.0 submit field "generate_audio" must be boolean when provided.');
  });
});
