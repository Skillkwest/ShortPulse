import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTrustedRemoteMediaUrl, TrustedRemoteMediaUrlError } from "../trustedRemoteMediaUrl";

const dnsLookupMock = vi.fn();

vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  return {
    ...actual,
    default: {
      ...actual,
      lookup: (...args: Parameters<typeof actual.lookup>) => dnsLookupMock(...args),
    },
    lookup: (...args: Parameters<typeof actual.lookup>) => dnsLookupMock(...args),
  };
});

describe("assertTrustedRemoteMediaUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    delete process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS;
    delete process.env.NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS;
    delete process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS;
    delete process.env.NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS;
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts trusted user-scoped media URLs", async () => {
    const result = await assertTrustedRemoteMediaUrl({
      rawUrl: "https://proj.supabase.co/storage/v1/object/sign/media_library/user-1/audio/demo.wav",
      req: { headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" } } as never,
      userId: "user-1",
      requireUserScope: true,
      label: "Voice changer source URL",
    });

    expect(result.toString()).toContain("/user-1/audio/demo.wav");
  });

  it("rejects trusted hosts when the path is not scoped to the current user", async () => {
    await expect(
      assertTrustedRemoteMediaUrl({
        rawUrl:
          "https://proj.supabase.co/storage/v1/object/sign/media_library/other-user/audio/demo.wav",
        req: { headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" } } as never,
        userId: "user-1",
        requireUserScope: true,
        label: "Voice changer source URL",
      })
    ).rejects.toMatchObject({
      message: "Voice changer source URL is not a trusted user-scoped media URL.",
    });
  });

  it("rejects hosts that resolve to private network addresses", async () => {
    process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS = "true";
    process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS = "trusted.example.com";
    dnsLookupMock.mockResolvedValue([{ address: "10.0.0.8" }]);

    await expect(
      assertTrustedRemoteMediaUrl({
        rawUrl: "https://trusted.example.com/audio/demo.wav",
        req: { headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" } } as never,
        userId: "user-1",
        requireUserScope: false,
        label: "Voice changer source URL",
      })
    ).rejects.toMatchObject({
      message: "Voice changer source URL host resolved to a private network address.",
    });
  });
});
