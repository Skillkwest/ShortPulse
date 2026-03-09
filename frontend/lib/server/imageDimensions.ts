/**
 * Server-side image-dimension parsing helpers.
 * Extracts width/height from common image formats without external dependencies.
 */
import type { ImageDimensions } from "../mediaDimensionMetadata";

const isPng = (buffer: Buffer): boolean =>
  buffer.length >= 24 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

const parsePngDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (!isPng(buffer)) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
};

const parseGifDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 10) return null;
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  if (!width || !height) return null;
  return { width, height };
};

const parseJpegDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) return null;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 1 >= buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;

    const isSofMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSofMarker && segmentLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (!width || !height) return null;
      return { width, height };
    }
    offset += segmentLength;
  }
  return null;
};

const readUInt24LE = (buffer: Buffer, offset: number): number => {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
};

const parseWebpDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 30) return null;
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  if (buffer.subarray(8, 12).toString("ascii") !== "WEBP") return null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkSize > buffer.length) return null;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      const width = readUInt24LE(buffer, chunkDataOffset + 4) + 1;
      const height = readUInt24LE(buffer, chunkDataOffset + 7) + 1;
      if (!width || !height) return null;
      return { width, height };
    }

    if (chunkType === "VP8L" && chunkSize >= 5) {
      const signature = buffer[chunkDataOffset];
      if (signature !== 0x2f) return null;
      const bits = buffer.readUInt32LE(chunkDataOffset + 1);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      if (!width || !height) return null;
      return { width, height };
    }

    if (chunkType === "VP8 " && chunkSize >= 10) {
      const startCode0 = buffer[chunkDataOffset + 3];
      const startCode1 = buffer[chunkDataOffset + 4];
      const startCode2 = buffer[chunkDataOffset + 5];
      if (startCode0 !== 0x9d || startCode1 !== 0x01 || startCode2 !== 0x2a) {
        return null;
      }
      const width = buffer.readUInt16LE(chunkDataOffset + 6) & 0x3fff;
      const height = buffer.readUInt16LE(chunkDataOffset + 8) & 0x3fff;
      if (!width || !height) return null;
      return { width, height };
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};

/**
 * Extracts image dimensions from binary content.
 * Supports PNG, JPEG, GIF, and WEBP. Returns null for unsupported or malformed buffers.
 */
export const extractImageDimensionsFromBuffer = (buffer: Buffer): ImageDimensions | null => {
  return (
    parsePngDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parseGifDimensions(buffer) ??
    parseWebpDimensions(buffer)
  );
};
