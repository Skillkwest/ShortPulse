/**
 * Unit coverage for Kie submit media guard diagnostics and validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildKieSubmitMediaDiagnostics,
  validateKieKlingSubmitMediaInputs,
} from "../kieSubmitMediaGuards";

const buildSignedToken = (expiresInSeconds: number): string => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.trunc(Date.now() / 1000) + expiresInSeconds })
  ).toString("base64url");
  return `${header}.${payload}.sig`;
};

describe("kieSubmitMediaGuards", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProbeOverride = process.env.SHORTPULSE_KIE_MEDIA_PROBE_ENABLED;

  beforeEach(() => {
    env.NODE_ENV = originalNodeEnv;
    env.SHORTPULSE_KIE_MEDIA_PROBE_ENABLED = originalProbeOverride;
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    env.SHORTPULSE_KIE_MEDIA_PROBE_ENABLED = originalProbeOverride;
    vi.unstubAllGlobals();
  });

  it("builds redacted diagnostics for standard Kling submits", () => {
    const diagnostics = buildKieSubmitMediaDiagnostics({
      model: "kling-3.0/video",
      input: {
        image_urls: ["https://cdn.example.com/renders/shot-1.png"],
      },
    });
    expect(diagnostics).toEqual({
      model: "kling-3.0/video",
      motion_control: false,
      media: [
        {
          kind: "image",
          host: "cdn.example.com",
          extension: "png",
          has_token: false,
          token_ttl_seconds: null,
          path_contains_characters: false,
        },
      ],
    });
  });

  it("builds redacted diagnostics for motion-control submits", () => {
    const diagnostics = buildKieSubmitMediaDiagnostics({
      model: "kling-3.0/motion-control",
      input: {
        input_urls: ["https://cdn.example.com/character.png"],
        video_urls: ["https://cdn.example.com/motion.mp4"],
      },
    });
    expect(diagnostics.motion_control).toBe(true);
    expect(diagnostics.media).toHaveLength(2);
    expect(diagnostics.media[0]).toMatchObject({
      kind: "image",
      extension: "png",
    });
    expect(diagnostics.media[1]).toMatchObject({
      kind: "video",
      extension: "mp4",
    });
  });

  it("includes Kling element media in diagnostics and validation", async () => {
    const payload = {
      model: "kling-3.0/motion-control",
      input: {
        input_urls: ["https://cdn.example.com/character.png"],
        video_urls: ["https://cdn.example.com/motion.mp4"],
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for element1",
            element_input_urls: [
              "https://cdn.example.com/element-a.png",
              "https://cdn.example.com/element-b.png",
            ],
          },
          {
            name: "element2",
            description: "Reference video for element2",
            element_input_video_urls: ["https://cdn.example.com/element-video.mp4"],
          },
        ],
      },
    };

    const diagnostics = buildKieSubmitMediaDiagnostics(payload);
    expect(diagnostics.motion_control).toBe(true);
    expect(diagnostics.media.map((media) => `${media.kind}:${media.extension}`)).toEqual([
      "image:png",
      "image:png",
      "image:png",
      "video:mp4",
      "video:mp4",
    ]);

    await expect(
      validateKieKlingSubmitMediaInputs({
        payload,
        signal: new AbortController().signal,
      })
    ).resolves.toEqual(expect.objectContaining({ ok: true }));
  });

  it("accepts valid Kling media URLs", async () => {
    const result = await validateKieKlingSubmitMediaInputs({
      payload: {
        model: "kling-3.0/video",
        input: {
          image_urls: ["https://cdn.example.com/renders/shot-1.png"],
        },
      },
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported media extensions", async () => {
    const result = await validateKieKlingSubmitMediaInputs({
      payload: {
        model: "kling-3.0/video",
        input: {
          image_urls: ["https://cdn.example.com/renders/shot-1.txt"],
        },
      },
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("KIE_MEDIA_INPUT_INVALID");
    expect(result.detail.reason).toBe("unsupported_extension");
  });

  it("rejects WebM motion-control videos before provider submit", async () => {
    const result = await validateKieKlingSubmitMediaInputs({
      payload: {
        model: "kling-3.0/motion-control",
        input: {
          input_urls: ["https://cdn.example.com/character.png"],
          video_urls: ["https://cdn.example.com/motion.webm"],
        },
      },
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("KIE_MEDIA_INPUT_INVALID");
    expect(result.detail.reason).toBe("unsupported_extension");
    expect(result.detail.expected_kind).toBe("video");
  });

  it("rejects signed URLs that are about to expire", async () => {
    const result = await validateKieKlingSubmitMediaInputs({
      payload: {
        model: "kling-3.0/video",
        input: {
          image_urls: [`https://cdn.example.com/renders/shot-1.png?token=${buildSignedToken(30)}`],
        },
      },
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("KIE_MEDIA_INPUT_INVALID");
    expect(result.detail.reason).toBe("expiring_signed_url");
  });

  it("rejects media URLs when remote probe returns non-success status", async () => {
    env.SHORTPULSE_KIE_MEDIA_PROBE_ENABLED = "true";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateKieKlingSubmitMediaInputs({
      payload: {
        model: "kling-3.0/video",
        input: {
          image_urls: ["https://cdn.example.com/renders/shot-1.png"],
        },
      },
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("KIE_MEDIA_INPUT_INVALID");
    expect(result.detail.reason).toBe("probe_http_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
