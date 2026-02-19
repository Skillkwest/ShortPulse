import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";

type Resolver = typeof import("../referenceGridMedia");

const importResolver = async (): Promise<Resolver> => {
  vi.resetModules();
  return import("../referenceGridMedia");
};

const FIXTURES: Array<{
  output: Pick<
    StudioOutput,
    "previewStoragePath" | "fullStoragePath" | "previewUrl" | "resultUrls"
  > & {
    mode?: StudioOutput["mode"] | null;
  };
  options: {
    strictPreviewLadder?: boolean;
    adaptivePreviewQuality?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
  };
}> = [
  {
    output: {
      mode: "image",
      previewStoragePath:
        "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/ref.png?token=abc",
      fullStoragePath:
        "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/ref.png?token=abc",
      previewUrl: "https://cdn.example.com/legacy.png",
      resultUrls: ["https://cdn.example.com/fallback.png"],
    },
    options: {
      strictPreviewLadder: true,
      adaptivePreviewQuality: true,
      pressureLevel: 1,
      cardLongEdgePx: 320,
      devicePixelRatio: 2,
    },
  },
  {
    output: {
      mode: "video",
      previewStoragePath: "/api/media/video/ref-1.mp4?token=abc",
      fullStoragePath: "/api/media/video/ref-1.mp4?token=abc",
      previewUrl: "",
      resultUrls: [],
    },
    options: {
      adaptivePreviewQuality: true,
      pressureLevel: 2,
    },
  },
  {
    output: {
      mode: "image",
      previewStoragePath: null,
      fullStoragePath: null,
      previewUrl: "https://cdn.example.com/preview.jpg",
      resultUrls: ["https://cdn.example.com/result.jpg"],
    },
    options: {
      strictPreviewLadder: false,
      adaptivePreviewQuality: true,
      pressureLevel: 0,
    },
  },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("referenceGridMedia parity", () => {
  it("matches legacy output when V2 is enabled in parity policy mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "reference-grid");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "false");
    const legacyModule = await importResolver();

    const legacyResults = FIXTURES.map((fixture) =>
      legacyModule.resolveReferenceCardUrls(fixture.output, fixture.options)
    );

    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES", "reference-grid");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY", "false");
    const v2Module = await importResolver();

    const v2Results = FIXTURES.map((fixture) =>
      v2Module.resolveReferenceCardUrls(fixture.output, {
        ...fixture.options,
        surface: "reference-grid",
      })
    );

    expect(v2Results).toEqual(legacyResults);
  });
});
