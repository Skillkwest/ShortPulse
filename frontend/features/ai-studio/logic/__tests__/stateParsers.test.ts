/**
 * Unit coverage for AI Studio status/result URL parsing helpers.
 * Focuses on provider payload shape drift for result URL arrays.
 */
import { describe, expect, it } from "vitest";
import { extractResultUrls } from "../stateParsers";

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
