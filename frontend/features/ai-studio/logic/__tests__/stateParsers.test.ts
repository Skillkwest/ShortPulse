/**
 * Unit coverage for AI Studio status/result URL parsing helpers.
 * Focuses on provider payload shape drift for result URL arrays.
 */
import { describe, expect, it } from "vitest";
import {
  extractFalMediaUrls,
  extractResultUrls,
  resolveTaskPollingModelId,
  resolveTaskPollingProvider,
} from "../stateParsers";

describe("extractResultUrls", () => {
  it("extracts URL objects from nested data.response.resultUrls", () => {
    const result = extractResultUrls({
      data: {
        response: {
          resultUrls: [{ url: "https://cdn.shortpulse.test/nested-result.mp4" }],
        },
      },
    });

    expect(result).toEqual(["https://cdn.shortpulse.test/nested-result.mp4"]);
  });

  it("extracts snake_case result_urls object arrays", () => {
    const result = extractResultUrls({
      result_urls: [{ download_url: "https://cdn.shortpulse.test/snake-result.mp4" }],
    });

    expect(result).toEqual(["https://cdn.shortpulse.test/snake-result.mp4"]);
  });

  it("extracts object-array URLs from encoded result_json payloads", () => {
    const result = extractResultUrls({
      data: {
        result_json: JSON.stringify({
          resultUrls: [{ video_url: "https://cdn.shortpulse.test/encoded-result.mp4" }],
        }),
      },
    });

    expect(result).toEqual(["https://cdn.shortpulse.test/encoded-result.mp4"]);
  });
});

describe("extractFalMediaUrls", () => {
  it("returns image URLs by default when image and video payloads both exist", () => {
    const result = extractFalMediaUrls({
      status: "completed",
      data: {
        images: [{ url: "https://cdn.shortpulse.test/poster.png" }],
        videos: [{ url: "https://cdn.shortpulse.test/output.mp4" }],
      },
    });

    expect(result).toEqual(["https://cdn.shortpulse.test/poster.png"]);
  });

  it("prefers video URLs when requested for video-mode outputs", () => {
    const result = extractFalMediaUrls(
      {
        status: "completed",
        data: {
          images: [{ url: "https://cdn.shortpulse.test/poster.png" }],
          videos: [{ url: "https://cdn.shortpulse.test/output.mp4" }],
        },
      },
      { preferVideo: true }
    );

    expect(result).toEqual(["https://cdn.shortpulse.test/output.mp4"]);
  });
});

describe("resolveTaskPollingProvider", () => {
  it("resolves generic Fal outputs through the exact model route", () => {
    expect(
      resolveTaskPollingProvider({
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      })
    ).toBe("fal-seedream-edit");
  });

  it("rejects generic Fal polling when no active model route can be inferred", () => {
    expect(
      resolveTaskPollingProvider({
        provider: "fal",
        modelId: "unknown-model",
      })
    ).toBeNull();
  });

  it("keeps active Kie Seedance 2 polling routes exact", () => {
    expect(
      resolveTaskPollingProvider({
        provider: "kie-ai/seedance-2-fast",
        modelId: "kie-ai/seedance-2",
      })
    ).toBe("kie-seedance-2-fast");
  });
});

describe("resolveTaskPollingModelId", () => {
  it("resolves generic Fal outputs to the queued model id", () => {
    expect(
      resolveTaskPollingModelId({
        provider: "fal",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("resolves provider route slugs through catalog route metadata", () => {
    expect(
      resolveTaskPollingModelId({
        provider: "fal-flux2-klein",
      })
    ).toBe("fal-ai/flux-2/klein/9b");
  });

  it("resolves active Kie provider aliases to their catalog model ids", () => {
    expect(
      resolveTaskPollingModelId({
        provider: "kie-seedance-2-fast",
      })
    ).toBe("kie-ai/seedance-2-fast");
  });

  it("rejects provider/model pairs with no queued catalog route", () => {
    expect(
      resolveTaskPollingModelId({
        provider: "fal",
        modelId: "unknown-model",
      })
    ).toBeNull();
  });
});
