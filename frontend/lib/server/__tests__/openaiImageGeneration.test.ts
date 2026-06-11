import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editOpenAiImage, generateOpenAiImage } from "../openaiImageGeneration";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

describe("openaiImageGeneration transport timeouts", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails controlled when GPT Image 2 generation stalls", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = generateOpenAiImage({
      prompt: "cinematic portrait",
      size: "1024x1024",
      quality: "medium",
    });
    const rejection = expect(request).rejects.toThrow(
      "Image generation request timed out before a result was returned. Please retry."
    );

    await vi.advanceTimersByTimeAsync(240_000);

    await rejection;
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("fails controlled when direct edit file upload stalls", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = editOpenAiImage({
      prompt: "cinematic portrait edit",
      size: "1024x1024",
      quality: "medium",
      images: [
        {
          kind: "file",
          buffer: Buffer.from("image-data"),
          contentType: "image/png",
          filename: "base.png",
        },
      ],
    });
    const rejection = expect(request).rejects.toThrow(
      "Image reference upload timed out before the provider accepted it. Please retry."
    );

    await vi.advanceTimersByTimeAsync(60_000);

    await rejection;
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/files",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });
});
