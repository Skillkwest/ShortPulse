/**
 * Tests for YouTube tutorial embed URL normalization.
 */
import { describe, expect, it } from "vitest";
import { resolveYoutubeEmbedUrl, resolveYoutubeVideoId } from "../youtubeEmbed";

describe("youtube tutorial embed helpers", () => {
  it("extracts video ids from supported YouTube URL formats", () => {
    expect(resolveYoutubeVideoId("https://www.youtube.com/watch?v=abc_123-xyz")).toBe(
      "abc_123-xyz"
    );
    expect(resolveYoutubeVideoId("https://youtu.be/abc_123-xyz")).toBe("abc_123-xyz");
    expect(resolveYoutubeVideoId("https://www.youtube.com/embed/abc_123-xyz")).toBe("abc_123-xyz");
    expect(resolveYoutubeVideoId("https://www.youtube.com/shorts/abc_123-xyz")).toBe("abc_123-xyz");
  });

  it("rejects non-YouTube or malformed URLs", () => {
    expect(resolveYoutubeVideoId("https://example.com/watch?v=abc123")).toBeNull();
    expect(resolveYoutubeVideoId("not a url")).toBeNull();
    expect(resolveYoutubeVideoId("https://www.youtube.com/watch?v=bad id")).toBeNull();
  });

  it("builds a privacy-enhanced iframe URL", () => {
    expect(resolveYoutubeEmbedUrl("https://www.youtube.com/watch?v=abc_123-xyz")).toBe(
      "https://www.youtube-nocookie.com/embed/abc_123-xyz?rel=0&modestbranding=1&playsinline=1"
    );
  });
});
