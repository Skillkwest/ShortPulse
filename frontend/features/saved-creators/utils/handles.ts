/**
 * Handle formatting helpers for creator profiles.
 */
import { Platform } from "../types";

const profilePrefixes: Record<string, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
};

export const sanitizeHandle = (value: string) =>
  value
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "") // strip zero-width and nbsp
    .replace(/\s+/g, "") // remove all spaces/tabs
    .trim()
    .replace(/^@+/, ""); // drop leading @ symbols

export const getProfileUrl = (handle: string, platform: Platform | string) => {
  const clean = sanitizeHandle(handle);
  const normalized = (platform || "").toString().toLowerCase();
  const prefix = profilePrefixes[normalized] || profilePrefixes.instagram;
  const safeHandle = encodeURIComponent(clean);
  const baseUrl = `${prefix}${safeHandle}`;
  if (normalized === "tiktok") {
    return `${baseUrl}/?lang=en`;
  }
  return baseUrl;
};
