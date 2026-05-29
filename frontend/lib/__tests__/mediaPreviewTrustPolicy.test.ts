import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUseNextImageOptimizerForUrl,
  filterTrustedMediaDirectPreviewUrls,
  isTrustedMediaDirectPreviewUrl,
} from "../mediaPreviewTrustPolicy";

describe("mediaPreviewTrustPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows user-scoped supabase direct preview URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(
      isTrustedMediaDirectPreviewUrl(
        "https://project.supabase.co/storage/v1/object/sign/media_library/user-1/images/a.png?token=abc",
        { userId: "user-1", requireUserScope: true }
      )
    ).toBe(true);
  });

  it("blocks untrusted external direct preview hosts by default", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(
      isTrustedMediaDirectPreviewUrl("https://cdn.example.com/user-1/images/a.png", {
        userId: "user-1",
        requireUserScope: true,
      })
    ).toBe(false);
  });

  it("allows allowlisted external direct preview hosts only when enabled and user scoped", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

    expect(
      isTrustedMediaDirectPreviewUrl("https://cdn.example.com/user-1/images/a.png", {
        userId: "user-1",
        requireUserScope: true,
      })
    ).toBe(true);
    expect(
      isTrustedMediaDirectPreviewUrl("https://cdn.example.com/user-2/images/a.png", {
        userId: "user-1",
        requireUserScope: true,
      })
    ).toBe(false);
  });

  it("allows built-in trusted provider result hosts when external previews are enabled", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");

    expect(
      isTrustedMediaDirectPreviewUrl(
        "https://tempfile.redpandaai.co/user-1/generations/videos/a.mp4",
        { userId: "user-1", requireUserScope: false }
      )
    ).toBe(true);
    expect(
      canUseNextImageOptimizerForUrl("https://tempfile.redpandaai.co/user-1/images/a.png")
    ).toBe(true);
    expect(
      isTrustedMediaDirectPreviewUrl(
        "https://tempfile.aiquickdraw.com/user-1/generations/videos/a.mp4",
        { userId: "user-1", requireUserScope: false }
      )
    ).toBe(true);
    expect(
      canUseNextImageOptimizerForUrl("https://tempfile.aiquickdraw.com/user-1/images/a.png")
    ).toBe(true);
  });

  it("filters trusted direct preview URLs with dedupe", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

    const trusted = filterTrustedMediaDirectPreviewUrls(
      [
        "https://cdn.example.com/user-1/images/a.png",
        "https://cdn.example.com/user-1/images/a.png",
        "https://cdn.example.com/user-2/images/a.png",
      ],
      { userId: "user-1", requireUserScope: true }
    );

    expect(trusted).toEqual(["https://cdn.example.com/user-1/images/a.png"]);
  });

  it("limits Next image optimizer usage to trusted hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(canUseNextImageOptimizerForUrl("/api/media/preview/ref-1")).toBe(true);
    expect(
      canUseNextImageOptimizerForUrl(
        "https://project.supabase.co/storage/v1/object/sign/media_library/user-1/images/a.png?token=abc"
      )
    ).toBe(true);
    expect(canUseNextImageOptimizerForUrl("https://cdn.example.com/user-1/images/a.png")).toBe(
      false
    );
  });

  it("allows Next image optimizer usage for allowlisted external hosts when enabled", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.com");

    expect(canUseNextImageOptimizerForUrl("https://cdn.example.com/user-1/images/a.png")).toBe(
      true
    );
  });
});
