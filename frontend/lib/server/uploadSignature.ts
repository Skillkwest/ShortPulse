/**
 * Server-side file signature helpers used by upload APIs.
 * Detects mime types from magic bytes so uploads do not trust client headers.
 */

const MIME_ALIAS_TO_CANONICAL: Record<string, string> = {
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/vnd.wave": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-aac": "audio/aac",
  "audio/x-flac": "audio/flac",
  "audio/x-m4a": "audio/mp4",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-mpeg-3": "audio/mpeg",
  "audio/x-ogg": "audio/ogg",
  "audio/x-pn-wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "application/ogg": "audio/ogg",
  "video/mov": "video/quicktime",
  "video/x-quicktime": "video/quicktime",
};

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

const readEbmlVint = (
  buffer: Buffer,
  offset: number,
  { preserveMarker }: { preserveMarker: boolean }
): { length: number; value: number } | null => {
  if (offset < 0 || offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  if (!firstByte) return null;

  let length = 1;
  let marker = 0x80;
  while (length <= 8 && (firstByte & marker) === 0) {
    marker >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > buffer.length) return null;

  let value = preserveMarker ? firstByte : firstByte & (marker - 1);
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + (buffer[offset + index] ?? 0);
  }
  return { length, value };
};

const WEBM_SEGMENT_ID = 0x18538067;
const WEBM_TRACKS_ID = 0x1654ae6b;
const WEBM_TRACK_ENTRY_ID = 0xae;
const WEBM_TRACK_TYPE_ID = 0x83;
const WEBM_TRACK_TYPE_VIDEO = 0x01;
const WEBM_TRACK_TYPE_AUDIO = 0x02;
const WEBM_PROBE_LIMIT_BYTES = 64 * 1024;

const collectWebmTrackTypes = (
  buffer: Buffer,
  startOffset: number,
  endOffset: number,
  trackTypes: Set<number>,
  depth = 0
): void => {
  if (depth > 6) return;
  let offset = startOffset;
  while (offset < endOffset) {
    const elementId = readEbmlVint(buffer, offset, { preserveMarker: true });
    if (!elementId) return;
    const sizeInfo = readEbmlVint(buffer, offset + elementId.length, { preserveMarker: false });
    if (!sizeInfo) return;

    const dataOffset = offset + elementId.length + sizeInfo.length;
    const dataEnd = Math.min(endOffset, dataOffset + sizeInfo.value);
    if (dataOffset > endOffset || dataEnd < dataOffset) return;

    if (
      elementId.value === WEBM_TRACK_TYPE_ID &&
      sizeInfo.value >= 1 &&
      dataOffset < buffer.length
    ) {
      trackTypes.add(buffer[dataOffset] ?? 0);
    }

    if (
      elementId.value === WEBM_SEGMENT_ID ||
      elementId.value === WEBM_TRACKS_ID ||
      elementId.value === WEBM_TRACK_ENTRY_ID
    ) {
      collectWebmTrackTypes(buffer, dataOffset, dataEnd, trackTypes, depth + 1);
    }

    if (dataEnd <= offset) return;
    offset = dataEnd;
  }
};

const resolveWebmTrackKind = (buffer: Buffer): "audio" | "video" | null => {
  if (!hasBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return null;
  const probe = buffer.subarray(0, Math.min(buffer.length, 128)).toString("ascii").toLowerCase();
  if (!probe.includes("webm")) return null;

  const trackTypes = new Set<number>();
  collectWebmTrackTypes(buffer, 0, Math.min(buffer.length, WEBM_PROBE_LIMIT_BYTES), trackTypes);

  if (trackTypes.has(WEBM_TRACK_TYPE_VIDEO)) return "video";
  if (trackTypes.has(WEBM_TRACK_TYPE_AUDIO)) return "audio";
  return null;
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

  const webmTrackKind = resolveWebmTrackKind(buffer);
  if (webmTrackKind) {
    return webmTrackKind === "video" ? "video/webm" : null;
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

export const detectAudioMimeType = (buffer: Buffer): string | null => {
  if (buffer.length < 4) return null;

  if (hasAsciiAt(buffer, 0, "fLaC")) return "audio/flac";

  if (hasAsciiAt(buffer, 0, "RIFF") && hasAsciiAt(buffer, 8, "WAVE")) {
    return "audio/wav";
  }

  if (hasAsciiAt(buffer, 0, "OggS")) return "audio/ogg";

  const webmTrackKind = resolveWebmTrackKind(buffer);
  if (webmTrackKind) {
    return webmTrackKind === "audio" ? "audio/webm" : null;
  }

  const brands = readIsoBaseMediaBrands(buffer).map((brand) => brand.trim().toLowerCase());
  if (brands.length) {
    const audioMp4Brands = new Set(["m4a", "m4b", "mp4a", "isom", "mp41", "mp42"]);
    if (brands.some((brand) => audioMp4Brands.has(brand))) {
      return "audio/mp4";
    }
  }

  if (hasAsciiAt(buffer, 0, "ID3")) return "audio/mpeg";
  if (buffer.length >= 2) {
    const first = buffer[0] ?? 0;
    const second = buffer[1] ?? 0;
    if (first === 0xff && (second & 0xe0) === 0xe0) {
      const layerBits = (second >> 1) & 0x03;
      if (layerBits !== 0) {
        return "audio/mpeg";
      }
    }
    if (first === 0xff && (second & 0xf6) === 0xf0) {
      return "audio/aac";
    }
  }

  return null;
};

export const normalizeSupportedMimeType = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  return MIME_ALIAS_TO_CANONICAL[normalized] ?? normalized;
};

export const areCompatibleMimeTypes = (
  declaredMimeType: string,
  detectedMimeType: string
): boolean => {
  const normalizedDeclaredMimeType = normalizeSupportedMimeType(declaredMimeType);
  const normalizedDetectedMimeType = normalizeSupportedMimeType(detectedMimeType);
  if (!normalizedDeclaredMimeType) return true;
  if (normalizedDeclaredMimeType === normalizedDetectedMimeType) return true;

  const equivalentSets: string[][] = [
    ["image/heic", "image/heif"],
    ["video/mp4", "video/x-m4v"],
  ];

  return equivalentSets.some(
    (set) => set.includes(normalizedDeclaredMimeType) && set.includes(normalizedDetectedMimeType)
  );
};
