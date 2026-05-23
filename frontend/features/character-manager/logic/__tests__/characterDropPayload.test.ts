import { describe, expect, it } from "vitest";
import {
  extractFirstUriListEntry,
  hasDroppedImageReferenceTransfer,
  inferMimeTypeFromUrl,
  isTrustedDroppedImageUrl,
  parseDropMediaFileId,
  parseDropUrlCandidate,
} from "../characterDropPayload";

describe("characterDropPayload", () => {
  it("parses dropped URL candidates safely", () => {
    expect(parseDropUrlCandidate(" https://example.com/image.png ")).toBe(
      "https://example.com/image.png"
    );
    expect(parseDropUrlCandidate("data:image/png;base64,abc")).toContain("data:image/png");
    expect(parseDropUrlCandidate("data:video/mp4;base64,abc")).toBeNull();
    expect(parseDropUrlCandidate("ftp://example.com/file.png")).toBeNull();
  });

  it("parses dropped media ids", () => {
    expect(parseDropMediaFileId(" media-1 ")).toBe("media-1");
    expect(parseDropMediaFileId("")).toBeNull();
  });

  it("extracts first uri-list entry", () => {
    expect(
      extractFirstUriListEntry("#comment\n\nhttps://example.com/a.png\nhttps://example.com/b.png")
    ).toBe("https://example.com/a.png");
  });

  it("infers MIME type from URL shape", () => {
    expect(inferMimeTypeFromUrl("https://example.com/a.jpeg?x=1")).toBe("image/jpeg");
    expect(inferMimeTypeFromUrl("data:image/webp;base64,abc")).toBe("image/webp");
    expect(inferMimeTypeFromUrl("https://example.com/a.txt")).toBeNull();
  });

  it("keeps data/blob dropped URLs trusted", () => {
    expect(isTrustedDroppedImageUrl("data:image/png;base64,abc")).toBe(true);
    expect(isTrustedDroppedImageUrl("blob:https://example.com/123")).toBe(true);
  });

  it("treats native file drags as supported reference transfers", () => {
    const file = new File(["png"], "portrait.png", { type: "image/png" });
    const transfer = {
      files: [file],
      items: [],
      types: ["Files"],
      getData: () => "",
    } as unknown as DataTransfer;

    expect(hasDroppedImageReferenceTransfer(transfer)).toBe(true);
  });
});
