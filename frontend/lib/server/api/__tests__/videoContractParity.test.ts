import { describe, expect, it } from "vitest";
import { evaluateFalPayloadContractForModel } from "../falPayloadValidation";
import {
  normalizeVideoSubmitIngressPayload,
  type VideoContractSuccess,
} from "../videoSubmitContracts";
import { normalizeKieSubmitPayloadForModel } from "../../providerIntegration/kieModelContracts";

const assertNormalizedVideoPayload = (
  modelId: string,
  payload: Record<string, unknown>
): VideoContractSuccess => {
  const normalized = normalizeVideoSubmitIngressPayload({ modelId, payload });
  expect(normalized.ok).toBe(true);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  return normalized;
};

describe("video contract parity", () => {
  it("keeps Kie Veo ingress aliases aligned with route contract and provider normalizer", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/veo-3.1-fast-i2v", {
      prompt: "shoreline tracking shot",
      imageUrls: ["https://cdn.shortpulse.test/first.png", "https://cdn.shortpulse.test/last.png"],
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      callBackUrl: "https://api.shortpulse.test/callback",
      seeds: 12345,
      aspectRatio: "16:9",
      duration: 8,
      resolution: "720p",
      generateAudio: true,
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/veo-3.1-fast-i2v", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult.valid).toBe(true);
    if (!contractResult.valid) throw new Error(contractResult.error);

    const providerPayload = normalizeKieSubmitPayloadForModel({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: contractResult.projectedPayload,
    });
    expect(providerPayload).toEqual(
      expect.objectContaining({
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        callBackUrl: "https://api.shortpulse.test/callback",
        seeds: 12345,
      })
    );
  });

  it("keeps prompt-only Kie Veo text-to-video payloads aligned with route contract and provider normalizer", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/veo-3.1-fast-i2v", {
      prompt: "A cinematic drone shot over a neon city at dusk",
      generationType: "TEXT_2_VIDEO",
      aspectRatio: "9:16",
      duration: 5,
      resolution: "720p",
      generateAudio: true,
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/veo-3.1-fast-i2v", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult.valid).toBe(true);
    if (!contractResult.valid) throw new Error(contractResult.error);

    const providerPayload = normalizeKieSubmitPayloadForModel({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: contractResult.projectedPayload,
    });
    expect(providerPayload).toEqual(
      expect.objectContaining({
        prompt: "A cinematic drone shot over a neon city at dusk",
        generationType: "TEXT_2_VIDEO",
        aspect_ratio: "9:16",
        duration: 5,
        resolution: "720p",
        generate_audio: true,
      })
    );
  });

  it("keeps Kie Seedance 1.5 ingress aliases aligned with route contract and provider normalizer", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/seedance-1.5-pro", {
      prompt: "animate the portrait into a short fashion clip",
      inputUrls: ["https://cdn.shortpulse.test/first.png", "https://cdn.shortpulse.test/last.png"],
      aspectRatio: "9:16",
      duration: 12,
      resolution: "1080p",
      generateAudio: false,
      fixedLens: true,
      callbackUrl: "https://api.shortpulse.test/callback",
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/seedance-1.5-pro", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult.valid).toBe(true);
    if (!contractResult.valid) throw new Error(contractResult.error);

    const providerPayload = normalizeKieSubmitPayloadForModel({
      modelId: "kie-ai/seedance-1.5-pro",
      payload: contractResult.projectedPayload,
    });
    expect(providerPayload).toEqual({
      model: "bytedance/seedance-1.5-pro",
      callBackUrl: "https://api.shortpulse.test/callback",
      input: {
        prompt: "animate the portrait into a short fashion clip",
        input_urls: [
          "https://cdn.shortpulse.test/first.png",
          "https://cdn.shortpulse.test/last.png",
        ],
        aspect_ratio: "9:16",
        resolution: "1080p",
        duration: "12",
        generate_audio: false,
        fixed_lens: true,
      },
    });
  });

  it("keeps Kie Kling motion aliases aligned with route contract and provider normalizer", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/kling-3.0", {
      prompt: "motion transfer",
      imageUrl: "https://cdn.shortpulse.test/character.png",
      inputUrl: "https://cdn.shortpulse.test/character.png",
      videoUrl: "https://cdn.shortpulse.test/motion.mp4",
      callbackUrl: "https://api.shortpulse.test/callback",
      resolution: "1080p",
      mode: "1080p",
      generateAudio: true,
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/kling-3.0", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult.valid).toBe(true);
    if (!contractResult.valid) throw new Error(contractResult.error);

    const providerPayload = normalizeKieSubmitPayloadForModel({
      modelId: "kie-ai/kling-3.0",
      payload: contractResult.projectedPayload,
    });
    expect(providerPayload).toEqual(
      expect.objectContaining({
        model: "kling-3.0/motion-control",
        callBackUrl: "https://api.shortpulse.test/callback",
      })
    );
  });

  it("keeps Kie Kling advanced payload fields aligned with route contract and provider normalizer", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/kling-3.0", {
      prompt: "cinematic sequence",
      image_url: "https://cdn.shortpulse.test/start.png",
      image_urls: ["https://cdn.shortpulse.test/start.png", "https://cdn.shortpulse.test/end.png"],
      duration: 14,
      resolution: "1080p",
      mode: "pro",
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
            "https://cdn.shortpulse.test/element-a.png",
            "https://cdn.shortpulse.test/element-b.png",
          ],
        },
        {
          name: "Element02",
          description: "Reference video for Element02",
          element_input_video_urls: ["https://cdn.shortpulse.test/element-video.mp4"],
        },
      ],
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/kling-3.0", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult.valid).toBe(true);
    if (!contractResult.valid) throw new Error(contractResult.error);

    const providerPayload = normalizeKieSubmitPayloadForModel({
      modelId: "kie-ai/kling-3.0",
      payload: contractResult.projectedPayload,
    });
    expect(providerPayload).toEqual(
      expect.objectContaining({
        model: "kling-3.0/video",
        input: expect.objectContaining({
          duration: "14",
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
                "https://cdn.shortpulse.test/element-a.png",
                "https://cdn.shortpulse.test/element-b.png",
              ],
            },
            {
              name: "Element02",
              description: "Reference video for Element02",
              element_input_video_urls: ["https://cdn.shortpulse.test/element-video.mp4"],
            },
          ],
        }),
      })
    );
  });

  it("rejects unknown top-level video fields after canonical ingress normalization", () => {
    const normalized = assertNormalizedVideoPayload("kie-ai/veo-3.1-fast-i2v", {
      prompt: "city flyover",
      image_url: "https://cdn.shortpulse.test/frame.png",
      generation_type: "FIRST_FRAME_2_VIDEO",
      duration: 8,
      resolution: "720p",
      generate_audio: true,
      rogue_field: true,
    });

    const contractResult = evaluateFalPayloadContractForModel("kie-ai/veo-3.1-fast-i2v", {
      enforceAllowedTopLevelFields: true,
      projectAllowedTopLevelFields: true,
    })(normalized.payload);
    expect(contractResult).toEqual(
      expect.objectContaining({
        valid: false,
        code: "GENERATION_PAYLOAD_CONTRACT_VIOLATION",
      })
    );
  });
});
