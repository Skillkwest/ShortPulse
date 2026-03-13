import { afterEach, describe, expect, it, vi } from "vitest";

const importResolver = async () => {
  vi.resetModules();
  return import("../mediaLibraryPanelPreviewResolver");
};

const signedImageUrl =
  "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/upload/cat.jpg?token=abc123";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveMediaLibraryPanelCardPreviewUrl", () => {
  it("keeps signed object URLs out of Next optimizer wrapping", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(signedImageUrl);
  });

  it("applies balanced-fast params for supabase render-image URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();
    const renderImageUrl =
      "https://example.supabase.co/storage/v1/render/image/public/media_library/user-1/cat.jpg?width=1200&quality=90";

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: renderImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toContain("/storage/v1/render/image/");
    expect(resolved).toContain("width=512");
    expect(resolved).toContain("quality=34");
    expect(resolved).not.toContain("/_next/image?");
  });

  it("keeps videos unchanged", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();
    const signedVideoUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/upload/clip.mp4?token=abc123";

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: signedVideoUrl,
      fileType: "video/mp4",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(signedVideoUrl);
  });

  it("keeps bypass/fallback rows unchanged", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      shouldBypassAdaptivePreview: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(signedImageUrl);
  });

  it("keeps untrusted URLs unchanged", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();
    const untrustedUrl = "https://untrusted-host.example.com/media/cat.jpg";

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: untrustedUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(untrustedUrl);
  });

  it("does not double-wrap already optimized URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();
    const alreadyOptimizedUrl =
      "/_next/image?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fupload%2Fcat.jpg%3Ftoken%3Dabc&w=750&q=70";

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: alreadyOptimizedUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: true,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(alreadyOptimizedUrl);
  });

  it("keeps baseline behavior when adaptive preview is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { resolveMediaLibraryPanelCardPreviewUrl } = await importResolver();

    const resolved = resolveMediaLibraryPanelCardPreviewUrl({
      signedUrl: signedImageUrl,
      fileType: "image/jpeg",
      pressureLevel: 1,
      adaptivePreviewQualityEnabled: false,
      constantCompressionEnabled: true,
    });

    expect(resolved).toBe(signedImageUrl);
  });
});
