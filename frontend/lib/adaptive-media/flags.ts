import type { AdaptiveSurface } from "./types";

const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const parseSurfaceCsv = (value: string | undefined): Set<AdaptiveSurface> => {
  const raw = (value ?? "reference-grid").trim();
  if (!raw) return new Set();
  const allowed = new Set<AdaptiveSurface>([
    "reference-grid",
    "quick-slot",
    "media-library-grid",
    "media-library-modal-grid",
    "character-grid",
    "detail-modal",
  ]);
  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as AdaptiveSurface[];

  const set = new Set<AdaptiveSurface>();
  for (const surface of values) {
    if (allowed.has(surface)) {
      set.add(surface);
    }
  }
  return set;
};

const enabledSurfaces = parseSurfaceCsv(process.env.NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES);

export const ADAPTIVE_MEDIA_V2_ENABLED = asBool(
  process.env.NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED,
  false
);

export const ADAPTIVE_MEDIA_V2_SHADOW_COMPARE = asBool(
  process.env.NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE,
  false
);

export const ADAPTIVE_MEDIA_V2_TUNED_POLICY = asBool(
  process.env.NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY,
  false
);

export const ADAPTIVE_MEDIA_V2_FORCE_FULL_QUALITY = asBool(
  process.env.NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY,
  false
);

export const isAdaptiveSurfaceEnabled = (surface: AdaptiveSurface): boolean => {
  if (!ADAPTIVE_MEDIA_V2_ENABLED) return false;
  return enabledSurfaces.has(surface);
};

export const isAdaptiveShadowCompareEnabled = (): boolean =>
  ADAPTIVE_MEDIA_V2_ENABLED && ADAPTIVE_MEDIA_V2_SHADOW_COMPARE;
