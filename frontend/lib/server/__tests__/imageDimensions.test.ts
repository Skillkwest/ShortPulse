import { describe, expect, it } from "vitest";
import { extractImageDimensionsFromBuffer } from "../imageDimensions";

const pngBuffer = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(24, 0);
  buffer.writeUInt8(0x89, 0);
  buffer.write("PNG", 1, "ascii");
  buffer.writeUInt8(0x0d, 4);
  buffer.writeUInt8(0x0a, 5);
  buffer.writeUInt8(0x1a, 6);
  buffer.writeUInt8(0x0a, 7);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

const gifBuffer = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(10, 0);
  buffer.write("GIF89a", 0, "ascii");
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
};

const jpegBuffer = (width: number, height: number): Buffer => {
  const bytes = [
    0xff,
    0xd8, // SOI
    0xff,
    0xc0, // SOF0
    0x00,
    0x11, // length
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xd9, // EOI
  ];
  return Buffer.from(bytes);
};

const webpVp8xBuffer = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(30, 0);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  buffer[24] = widthMinusOne & 0xff;
  buffer[25] = (widthMinusOne >> 8) & 0xff;
  buffer[26] = (widthMinusOne >> 16) & 0xff;
  buffer[27] = heightMinusOne & 0xff;
  buffer[28] = (heightMinusOne >> 8) & 0xff;
  buffer[29] = (heightMinusOne >> 16) & 0xff;
  return buffer;
};

describe("extractImageDimensionsFromBuffer", () => {
  it("extracts dimensions from png", () => {
    expect(extractImageDimensionsFromBuffer(pngBuffer(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("extracts dimensions from gif", () => {
    expect(extractImageDimensionsFromBuffer(gifBuffer(320, 180))).toEqual({
      width: 320,
      height: 180,
    });
  });

  it("extracts dimensions from jpeg", () => {
    expect(extractImageDimensionsFromBuffer(jpegBuffer(1024, 768))).toEqual({
      width: 1024,
      height: 768,
    });
  });

  it("extracts dimensions from webp vp8x", () => {
    expect(extractImageDimensionsFromBuffer(webpVp8xBuffer(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("returns null for unsupported buffers", () => {
    expect(extractImageDimensionsFromBuffer(Buffer.from("not-an-image"))).toBeNull();
  });
});
