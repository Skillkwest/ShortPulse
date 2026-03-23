/**
 * Server-side file signature helpers used by upload APIs.
 * Detects mime types from magic bytes so uploads do not trust client headers.
 */

const hasBytes = (buffer: Buffer, bytes: number[]): boolean =>
  bytes.every((byte, index) => buffer[index] === byte);

const hasAsciiAt = (buffer: Buffer, offset: number, value: string): boolean => {
  if (buffer.length < offset + value.length) return false;
  return buffer.subarray(offset, offset + value.length).toString("ascii") === value;
};

const readAscii = (buffer: Buffer, offset: number, length: number): string => {
  if (buffer.length < offset + length) return "";
  return buffer.subarray(offset, offset + length).toString("ascii");
};

const readIsoBaseMediaMajorBrand = (buffer: Buffer): string | null => {
  if (buffer.length < 12) return null;
  if (!hasAsciiAt(buffer, 4, "ftyp")) return null;
  return readAscii(buffer, 8, 4);
};

const readIsoBaseMediaBrands = (buffer: Buffer): string[] => {
  const majorBrand = readIsoBaseMediaMajorBrand(buffer);
  if (!majorBrand) return [];
  const brands: string[] = [majorBrand];
  const declaredBoxSize = buffer.readUInt32BE(0);
  const maxBytesFromHeader = Number.isFinite(declaredBoxSize) ? declaredBoxSize : buffer.length;
  const upperBound = Math.min(buffer.length, Math.max(16, maxBytesFromHeader), 128);
  for (let offset = 16; offset + 4 <= upperBound; offset += 4) {
    const brand = readAscii(buffer, offset, 4);
    if (!brand.trim().length) continue;
    brands.push(brand);
  }
  return Array.from(new Set(brands));
};

export const detectImageMimeType = (buffer: Buffer): string | null => {
  if (hasBytes(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (hasAsciiAt(buffer, 0, "GIF87a") || hasAsciiAt(buffer, 0, "GIF89a")) return "image/gif";
  if (buffer.length < 12) return null;
  if (hasAsciiAt(buffer, 0, "RIFF") && hasAsciiAt(buffer, 8, "WEBP")) return "image/webp";

  const majorBrand = readIsoBaseMediaMajorBrand(buffer);
  if (!majorBrand) return null;

  if (majorBrand === "avif") return "image/avif";
  if (
    majorBrand === "heic" ||
    majorBrand === "heix" ||
    majorBrand === "hevc" ||
    majorBrand === "hevx"
  ) {
    return "image/heic";
  }
  if (majorBrand === "mif1" || majorBrand === "msf1") return "image/heif";

  return null;
};

export const detectVideoMimeType = (buffer: Buffer): string | null => {
  if (buffer.length < 12) return null;

  if (hasBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    const probe = buffer.subarray(0, Math.min(buffer.length, 128)).toString("ascii").toLowerCase();
    if (probe.includes("webm")) return "video/webm";
  }

  const brands = readIsoBaseMediaBrands(buffer);
  if (!brands.length) return null;
  const majorBrand = brands[0];
  const normalizedBrands = brands.map((brand) => brand.trim().toLowerCase());

  if (majorBrand === "qt  ") return "video/quicktime";
  if (majorBrand.trim().toUpperCase() === "M4V") return "video/x-m4v";

  const mp4LikeBrands = new Set([
    "isom",
    "iso2",
    "iso3",
    "iso4",
    "iso5",
    "iso6",
    "iso8",
    "iso9",
    "mp41",
    "mp42",
    "avc1",
    "hvc1",
    "hev1",
    "dash",
    "mmp4",
    "msnv",
    "3gp4",
    "3gp5",
    "f4v",
  ]);
  if (normalizedBrands.some((brand) => mp4LikeBrands.has(brand))) return "video/mp4";

  return null;
};

export const areCompatibleMimeTypes = (
  declaredMimeType: string,
  detectedMimeType: string
): boolean => {
  if (!declaredMimeType) return true;
  if (declaredMimeType === detectedMimeType) return true;

  const equivalentSets: string[][] = [
    ["image/heic", "image/heif"],
    ["video/mp4", "video/x-m4v"],
  ];

  return equivalentSets.some(
    (set) => set.includes(declaredMimeType) && set.includes(detectedMimeType)
  );
};
