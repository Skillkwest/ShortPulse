import { describe, expect, it } from "vitest";
import {
  areCompatibleMimeTypes,
  detectAudioMimeType,
  detectImageMimeType,
  detectVideoMimeType,
} from "../../lib/server/uploadSignature";

const buildWebmTrackSignature = (trackType: number): Buffer =>
  Buffer.from([
    0x1a,
    0x45,
    0xdf,
    0xa3,
    0x87,
    0x42,
    0x82,
    0x84,
    0x77,
    0x65,
    0x62,
    0x6d,
    0x18,
    0x53,
    0x80,
    0x67,
    0x8a,
    0x16,
    0x54,
    0xae,
    0x6b,
    0x85,
    0xae,
    0x83,
    0x83,
    0x81,
    trackType,
  ]);

describe("upload signature helpers", () => {
  it("detects common image signatures", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    expect(detectImageMimeType(jpeg)).toBe("image/jpeg");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageMimeType(png)).toBe("image/png");

    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    expect(detectImageMimeType(webp)).toBe("image/webp");
  });

  it("detects common video signatures", () => {
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(detectVideoMimeType(mp4)).toBe("video/mp4");

    const mp4Iso6 = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x36, 0x00, 0x00, 0x00,
      0x00, 0x6d, 0x70, 0x34, 0x31,
    ]);
    expect(detectVideoMimeType(mp4Iso6)).toBe("video/mp4");

    const mov = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20,
    ]);
    expect(detectVideoMimeType(mov)).toBe("video/quicktime");
  });

  it("distinguishes audio-only WebM from video WebM", () => {
    const audioWebm = buildWebmTrackSignature(0x02);
    expect(detectAudioMimeType(audioWebm)).toBe("audio/webm");
    expect(detectVideoMimeType(audioWebm)).toBeNull();

    const videoWebm = buildWebmTrackSignature(0x01);
    expect(detectVideoMimeType(videoWebm)).toBe("video/webm");
    expect(detectAudioMimeType(videoWebm)).toBeNull();
  });

  it("treats compatible aliases as equivalent", () => {
    expect(areCompatibleMimeTypes("image/heif", "image/heic")).toBe(true);
    expect(areCompatibleMimeTypes("video/mp4", "video/x-m4v")).toBe(true);
    expect(areCompatibleMimeTypes("audio/x-m4a", "audio/mp4")).toBe(true);
    expect(areCompatibleMimeTypes("audio/wave", "audio/wav")).toBe(true);
    expect(areCompatibleMimeTypes("audio/vnd.wave", "audio/wav")).toBe(true);
    expect(areCompatibleMimeTypes("audio/mp3", "audio/mpeg")).toBe(true);
    expect(areCompatibleMimeTypes("audio/x-flac", "audio/flac")).toBe(true);
    expect(areCompatibleMimeTypes("application/ogg", "audio/ogg")).toBe(true);
    expect(areCompatibleMimeTypes("video/x-quicktime", "video/quicktime")).toBe(true);
    expect(areCompatibleMimeTypes("image/png", "image/jpeg")).toBe(false);
  });
});
