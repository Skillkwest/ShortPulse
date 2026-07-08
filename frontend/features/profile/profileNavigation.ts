/**
 * Canonical profile-navigation helpers.
 * Owns safe account-workspace return paths and section-link construction.
 */
import type { ProfileSection } from "./profilePageModel";

export type ProfileBackTarget = {
  href: string;
  label: string;
};

const PROFILE_RETURN_PATH_MAX_LENGTH = 1024;
const PROFILE_DEFAULT_RETURN_PATH = "/dashboard";
const PROFILE_RETURN_BASE_URL = "https://shortpulse.local";

const PROFILE_BACK_TO_DASHBOARD: ProfileBackTarget = {
  href: PROFILE_DEFAULT_RETURN_PATH,
  label: "Back to dashboard",
};

const toFirstString = (value: unknown): string | null => {
  if (Array.isArray(value)) return toFirstString(value[0]);
  return typeof value === "string" ? value : null;
};

const normalizeHash = (hash: string | null | undefined): string => {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
};

/**
 * Returns a safe same-app return path for profile navigation, or null.
 */
export const normalizeProfileReturnPath = (value: unknown): string | null => {
  const rawValue = toFirstString(value)?.trim();
  if (!rawValue) return null;
  if (rawValue.length > PROFILE_RETURN_PATH_MAX_LENGTH) return null;
  if (!rawValue.startsWith("/") || rawValue.startsWith("//") || rawValue.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(rawValue, PROFILE_RETURN_BASE_URL);
    if (parsed.origin !== PROFILE_RETURN_BASE_URL) return null;
    if (parsed.pathname !== "/dashboard" && parsed.pathname !== "/ai-studio") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

/**
 * Builds a profile section URL while preserving a safe return path.
 */
export const buildProfileSectionHref = ({
  section,
  fromPath,
  hash,
}: {
  section: ProfileSection;
  fromPath?: unknown;
  hash?: string | null;
}): string => {
  const query = new URLSearchParams({ section });
  const normalizedFromPath = normalizeProfileReturnPath(fromPath);
  if (normalizedFromPath) {
    query.set("from", normalizedFromPath);
  }
  return `/profile?${query.toString()}${normalizeHash(hash)}`;
};

/**
 * Resolves the profile shell back target from the safe return-path query.
 */
export const resolveProfileBackTarget = (value: unknown): ProfileBackTarget => {
  const normalizedFromPath = normalizeProfileReturnPath(value);
  if (!normalizedFromPath) return PROFILE_BACK_TO_DASHBOARD;
  if (normalizedFromPath.startsWith("/ai-studio")) {
    return {
      href: normalizedFromPath,
      label: "Back to AI Studio",
    };
  }
  return PROFILE_BACK_TO_DASHBOARD;
};
