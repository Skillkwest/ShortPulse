import { describe, expect, it } from "vitest";
import {
  VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME,
  VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION,
  normalizeVideoQueueDispatchPayload,
  normalizeVideoSubmitIngressPayload,
  wrapQueueSubmitPayloadEnvelope,
} from "../videoSubmitContracts";

describe("videoSubmitContracts", () => {
  it("normalizes legacy alias fields for Kie Veo ingress payloads", () => {
    const result = normalizeVideoSubmitIngressPayload({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "clip",
        imageUrls: [
          "https://cdn.shortpulse.test/first.png",
          "https://cdn.shortpulse.test/last.png",
        ],
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        callBackUrl: "https://api.shortpulse.test/kie-callback",
        seeds: 12345,
      },
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        prompt: "clip",
        image_urls: [
          "https://cdn.shortpulse.test/first.png",
          "https://cdn.shortpulse.test/last.png",
        ],
        generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        callback_url: "https://api.shortpulse.test/kie-callback",
        seed: 12345,
      },
      aliasUsage: [
        { alias: "imageUrls", canonical: "image_urls" },
        { alias: "generationType", canonical: "generation_type" },
        { alias: "callBackUrl", canonical: "callback_url" },
        { alias: "seeds", canonical: "seed" },
      ],
      queueCompatibilityApplied: false,
      envelopeVersion: null,
    });
  });

  it("rejects alias collisions when alias and canonical values differ", () => {
    const result = normalizeVideoSubmitIngressPayload({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "clip",
        image_url: "https://cdn.shortpulse.test/a.png",
        imageUrl: "https://cdn.shortpulse.test/b.png",
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "VIDEO_ALIAS_COLLISION",
      error: "Conflicting alias and canonical fields provided: imageUrl and image_url.",
      detail: {
        alias: "imageUrl",
        canonical: "image_url",
      },
    });
  });

  it("rejects character-scoped media URLs", () => {
    const result = normalizeVideoSubmitIngressPayload({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "clip",
        image_urls: [
          "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
        ],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "VIDEO_CHARACTER_MEDIA_BLOCKED",
        detail: expect.objectContaining({
          reason: "character_url_segment",
        }),
      })
    );
    if (result.ok) throw new Error("Expected character URL to be blocked");
    const redactedValue = String((result.detail as { value?: unknown })?.value ?? "");
    expect(redactedValue).toContain("/characters/");
    expect(redactedValue).toContain("token=<redacted>");
    expect(redactedValue).not.toContain("token=abc");
  });

  it("allows character-scoped media URLs inside Kling element payloads", () => {
    const result = normalizeVideoSubmitIngressPayload({
      modelId: "kie-ai/kling-3.0",
      payload: {
        prompt: "@taylor walks into the scene",
        image_url: "https://cdn.shortpulse.test/ref.png",
        kling_elements: [
          {
            name: "taylor",
            description: "Reference images for Taylor",
            element_input_urls: [
              "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
            ],
          },
        ],
      },
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        prompt: "@taylor walks into the scene",
        image_url: "https://cdn.shortpulse.test/ref.png",
        kling_elements: [
          {
            name: "taylor",
            description: "Reference images for Taylor",
            element_input_urls: [
              "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
            ],
          },
        ],
      },
      aliasUsage: [],
      queueCompatibilityApplied: false,
      envelopeVersion: null,
    });
  });

  it("still rejects blocked character metadata fields inside Kling element payloads", () => {
    const result = normalizeVideoSubmitIngressPayload({
      modelId: "kie-ai/kling-3.0",
      payload: {
        prompt: "@taylor walks into the scene",
        image_url: "https://cdn.shortpulse.test/ref.png",
        kling_elements: [
          {
            name: "taylor",
            description: "Reference images for Taylor",
            profile_image_url:
              "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/ref.png?token=abc",
          },
        ],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "VIDEO_CHARACTER_MEDIA_BLOCKED",
        detail: expect.objectContaining({
          reason: "blocked_character_metadata_field",
        }),
      })
    );
  });

  it("unwraps queue envelope v2 payloads", () => {
    const envelope = wrapQueueSubmitPayloadEnvelope({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "queued clip",
        image_url: "https://cdn.shortpulse.test/ref.png",
      },
    });

    expect(envelope).toEqual({
      __contract: VIDEO_QUEUE_PAYLOAD_CONTRACT_NAME,
      contract_version: VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION,
      model_id: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "queued clip",
        image_url: "https://cdn.shortpulse.test/ref.png",
      },
    });

    const result = normalizeVideoQueueDispatchPayload({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: envelope,
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        prompt: "queued clip",
        image_url: "https://cdn.shortpulse.test/ref.png",
      },
      aliasUsage: [],
      queueCompatibilityApplied: false,
      envelopeVersion: VIDEO_QUEUE_PAYLOAD_CONTRACT_VERSION,
    });
  });

  it("treats legacy raw queue payloads as compatibility-normalized", () => {
    const result = normalizeVideoQueueDispatchPayload({
      modelId: "kie-ai/veo-3.1-fast-i2v",
      payload: {
        prompt: "queued clip",
        imageUrl: "https://cdn.shortpulse.test/ref.png",
      },
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        prompt: "queued clip",
        image_url: "https://cdn.shortpulse.test/ref.png",
      },
      aliasUsage: [{ alias: "imageUrl", canonical: "image_url" }],
      queueCompatibilityApplied: true,
      envelopeVersion: null,
    });
  });
});
