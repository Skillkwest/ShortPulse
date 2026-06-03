import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateElevenLabsSoundEffect } from "../../lib/server/elevenlabs";

const originalFetch = global.fetch;

describe("generateElevenLabsSoundEffect", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retries one transient 502 response before succeeding", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Bad Gateway" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "audio/mpeg",
            "character-cost": "42",
            "request-id": "provider-sfx-1",
          },
        })
      );
    global.fetch = fetchMock;

    const result = await generateElevenLabsSoundEffect({
      text: "heavy metal gate slam",
      outputFormat: "mp3_44100_128",
      body: {
        model_id: "eleven_text_to_sound_v2",
        loop: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      contentType: "audio/mpeg",
      characterCost: 42,
      providerRequestId: "provider-sfx-1",
    });
    expect(Array.from(result.buffer)).toEqual([1, 2, 3]);
  });

  it("does not retry non-transient upstream failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Prompt rejected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = fetchMock;

    await expect(
      generateElevenLabsSoundEffect({
        text: "heavy metal gate slam",
        outputFormat: "mp3_44100_128",
        body: {
          model_id: "eleven_text_to_sound_v2",
          loop: false,
        },
      })
    ).rejects.toThrow("Prompt rejected");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries one transient upstream 429 before succeeding", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: {
              message: "system_busy",
              code: "system_busy",
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "retry-after": "6",
            },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([4, 5, 6]), {
          status: 200,
          headers: {
            "content-type": "audio/mpeg",
            "character-cost": "18",
            "request-id": "provider-sfx-2",
          },
        })
      );
    global.fetch = fetchMock;

    const result = await generateElevenLabsSoundEffect({
      text: "heavy metal gate slam",
      outputFormat: "mp3_44100_128",
      body: {
        model_id: "eleven_text_to_sound_v2",
        loop: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      contentType: "audio/mpeg",
      characterCost: 18,
      providerRequestId: "provider-sfx-2",
    });
    expect(Array.from(result.buffer)).toEqual([4, 5, 6]);
  });
});
