/**
 * Shared media URL policy for Create agent vision payloads.
 * Keeps client and server URL filtering aligned for HTTPS and ephemeral data URLs.
 */

import { AGENT_IMAGE_ATTACHMENT_MAX_ITEMS } from "./attachmentPolicy";

export const AGENT_MEDIA_MAX_ITEMS = AGENT_IMAGE_ATTACHMENT_MAX_ITEMS;
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

/**
 * Strict client projection used before transport. Unlike the server sanitizer,
 * this rejects invalid or over-cap product media instead of silently reducing it.
 */
export const requireSafeAgentImageMediaUrls = (
  values: Array<{ id: string; url: string; thumbnailAlt?: string | null }>
): Array<{ id: string; url: string; thumbnailAlt?: string | null }> => {
  if (values.length > AGENT_MEDIA_MAX_ITEMS) {
    throw new Error(`Create agent requests support up to ${AGENT_MEDIA_MAX_ITEMS} images.`);
  }
  let dataUrlBytes = 0;
  return values.map((item, index) => {
    const url = item.url.trim();
    if (!isSafeAgentImageMediaUrl(url)) {
      throw new Error(`Create agent image ${index + 1} has an unsupported media URL.`);
    }
    if (isAgentImageDataUrl(url)) {
      dataUrlBytes += measureAgentMediaStringBytes(url);
      if (dataUrlBytes > AGENT_EPHEMERAL_MEDIA_TOTAL_MAX_BYTES) {
        throw new Error("Create agent inline images exceed the request media budget.");
      }
    }
    return {
      id: item.id,
      url,
      thumbnailAlt: item.thumbnailAlt ?? undefined,
    };
  });
};
