/**
 * Shared media URL policy for Create agent vision payloads.
 * Keeps client and server URL filtering aligned for HTTPS and ephemeral data URLs.
 */

export const AGENT_MEDIA_MAX_ITEMS = 3;
export const AGENT_EPHEMERAL_IMAGE_MAX_BYTES = 400 * 1024;
export const AGENT_EPHEMERAL_MEDIA_TOTAL_MAX_BYTES = 1100 * 1024;

const AGENT_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i;

export const measureAgentMediaStringBytes = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
};

export const isAgentImageDataUrl = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || !AGENT_IMAGE_DATA_URL_PATTERN.test(normalized)) return false;
  return measureAgentMediaStringBytes(normalized) <= AGENT_EPHEMERAL_IMAGE_MAX_BYTES;
};

export const isSafeAgentImageMediaUrl = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("https://")) return true;
  return isAgentImageDataUrl(normalized);
};

export const pickSafeAgentImageMediaUrls = (
  values: Array<{ id: string; url: string; thumbnailAlt?: string | null }>
): Array<{ id: string; url: string; thumbnailAlt?: string | null }> => {
  const picked: Array<{ id: string; url: string; thumbnailAlt?: string | null }> = [];
  let dataUrlBytes = 0;
  for (const item of values) {
    if (picked.length >= AGENT_MEDIA_MAX_ITEMS) break;
    const url = item.url.trim();
    if (!isSafeAgentImageMediaUrl(url)) continue;
    if (isAgentImageDataUrl(url)) {
      const nextBytes = dataUrlBytes + measureAgentMediaStringBytes(url);
      if (nextBytes > AGENT_EPHEMERAL_MEDIA_TOTAL_MAX_BYTES) continue;
      dataUrlBytes = nextBytes;
    }
    picked.push({
      id: item.id,
      url,
      thumbnailAlt: item.thumbnailAlt ?? undefined,
    });
  }
  return picked;
};
