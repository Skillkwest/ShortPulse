import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAdaptiveMedia, type AdaptiveSurface, type AdaptiveResolvedMedia } from "../index";

const require = createRequire(import.meta.url);
const nextConfig = require("../../../next.config.js") as {
  images?: { qualities?: number[] };
};

const OPTIMIZED_PREVIEW_SOURCE_URL = "https://cdn.example.com/user-1/images/preview.jpg";
const OPTIMIZED_SURFACES: AdaptiveSurface[] = [
  "reference-grid",
  "quick-slot",
  "media-library-grid",
  "media-library-modal-grid",
  "media-library-panel-grid",
  "character-grid",
];
const PRESSURE_LEVELS = [0, 1, 2] as const;

const readOptimizerQuality = (url: string | null): number | null => {
  if (!url?.startsWith("/_next/image?")) return null;
  const parsed = new URL(url, "https://shortpulse.local");
  const quality = Number(parsed.searchParams.get("q"));
  return Number.isFinite(quality) ? quality : null;
};

const collectOptimizerQualities = (resolveMedia: typeof resolveAdaptiveMedia): number[] => {
  const emittedQualities = new Set<number>();

  for (const surface of OPTIMIZED_SURFACES) {
    for (const pressureLevel of PRESSURE_LEVELS) {
      const resolved: AdaptiveResolvedMedia = resolveMedia({
        surface,
        mediaKind: "image",
        source: "remote",
        urls: {
          previewUrl: OPTIMIZED_PREVIEW_SOURCE_URL,
          fullUrl: OPTIMIZED_PREVIEW_SOURCE_URL,
        },
        storage: {},
        adaptivePreviewQuality: true,
        pressureLevel,
        cardLongEdgePx: 320,
        devicePixelRatio: 1,
      });
      const quality = readOptimizerQuality(resolved.previewUrl);
      if (quality) emittedQualities.add(quality);
    }
  }

  return [...emittedQualities].sort((a, b) => a - b);
};

describe("adaptive media Next optimizer config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows every adaptive optimizer quality emitted by canonical media surfaces", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

    const allowedQualities = new Set(nextConfig.images?.qualities ?? []);
    const emittedQualities = collectOptimizerQualities(resolveAdaptiveMedia);

    expect(emittedQualities).toEqual([28, 30, 34]);
    for (const quality of emittedQualities) {
      expect(allowedQualities.has(quality)).toBe(true);
    }
  });

  it("allows tuned adaptive optimizer qualities when the tuned policy flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");
    vi.resetModules();
    const { resolveAdaptiveMedia: resolveTunedAdaptiveMedia } = await import("../index");

    const allowedQualities = new Set(nextConfig.images?.qualities ?? []);
    const emittedQualities = collectOptimizerQualities(resolveTunedAdaptiveMedia);

    expect(emittedQualities).toEqual([28, 30, 34, 50, 60, 70]);
    for (const quality of emittedQualities) {
      expect(allowedQualities.has(quality)).toBe(true);
    }
  });
});
