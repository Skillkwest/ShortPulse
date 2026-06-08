/**
 * Unit coverage for GPT Image 2 provider payload shaping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editOpenAiImage, generateOpenAiImage } from "../../lib/server/openaiImageGeneration";
import {
  normalizeOpenAiGptImage2Quality,
  resolveOpenAiGptImage2OutputSize,
} from "../../lib/model-runtime/openAiImage2";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

describe("editOpenAiImage", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    if (originalOpenAiApiKey == null) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    vi.unstubAllGlobals();
  });

  it("omits input_fidelity for gpt-image-2 edit requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
        }),
        {
          status: 200,
          headers: { "x-request-id": "provider-request-1" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await editOpenAiImage({
      prompt: "make a subtle portrait edit",
      size: "1024x1024",
      quality: "medium",
      images: [{ kind: "url", imageUrl: "https://example.com/base.png" }],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(payload).toMatchObject({
      model: "gpt-image-2",
      prompt: "make a subtle portrait edit",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      moderation: "low",
      images: [{ image_url: "https://example.com/base.png" }],
    });
    expect(payload).not.toHaveProperty("input_fidelity");
  });

  it("uploads internal file inputs before editing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "file-internal-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "file-mask-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
          }),
          {
            status: 200,
            headers: { "x-request-id": "provider-request-2" },
          }
        )
      )
      .mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await editOpenAiImage({
      prompt: "make a subtle portrait edit",
      size: "1024x1024",
      quality: "medium",
      images: [
        {
          kind: "file",
          buffer: Buffer.from("internal-base"),
          contentType: "image/png",
          filename: "base.png",
        },
        {
          kind: "url",
          imageUrl: "https://example.com/reference.png",
        },
      ],
      mask: {
        kind: "file",
        buffer: Buffer.from("internal-mask"),
        contentType: "image/png",
        filename: "mask.png",
      },
    });

    const [, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadInit.method).toBe("POST");
    expect(uploadInit.body).toBeInstanceOf(FormData);

    const [, editInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    const payload = JSON.parse(String(editInit.body)) as Record<string, unknown>;

    expect(payload).toMatchObject({
      model: "gpt-image-2",
      prompt: "make a subtle portrait edit",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      moderation: "low",
      images: [{ file_id: "file-internal-1" }, { image_url: "https://example.com/reference.png" }],
      mask: { file_id: "file-mask-1" },
    });
    expect(fetchMock.mock.calls[3]?.[0]).toContain("/files/file-internal-1");
    expect(fetchMock.mock.calls[4]?.[0]).toContain("/files/file-mask-1");
  });
});

describe("generateOpenAiImage", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    if (originalOpenAiApiKey == null) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    vi.unstubAllGlobals();
  });

  it("uses low moderation by default for gpt-image-2 generation requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("generated-image").toString("base64") }],
        }),
        {
          status: 200,
          headers: { "x-request-id": "provider-request-create-1" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateOpenAiImage({
      prompt: "a cinematic portrait",
      size: "1024x1024",
      quality: "medium",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(payload).toMatchObject({
      model: "gpt-image-2",
      prompt: "a cinematic portrait",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      moderation: "low",
    });
  });

  it("maps UI resolution to quality while keeping provider size OpenAI-compatible", () => {
    expect(
      resolveOpenAiGptImage2OutputSize({
        aspect: "16:9",
        resolution: "4K",
      })
    ).toBe("1536x1024");
    expect(normalizeOpenAiGptImage2Quality("4K")).toBe("high");
  });
});
