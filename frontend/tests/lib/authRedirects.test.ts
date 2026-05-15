import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCanonicalAuthCallbackUrl } from "../../lib/authRedirects";

describe("auth redirect helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed in production when the canonical callback-url route is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("callback route unavailable")));

    await expect(
      fetchCanonicalAuthCallbackUrl({ flow: "recovery", nextPath: "/dashboard" })
    ).resolves.toBeNull();
  });

  it("falls back to the browser origin outside production when the callback-url route is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("callback route unavailable")));

    await expect(
      fetchCanonicalAuthCallbackUrl({ flow: "recovery", nextPath: "/dashboard" })
    ).resolves.toBe("http://localhost:3000/auth/callback?flow=recovery&next=%2Fdashboard");
  });

  it("treats preview-like browser contexts as non-production when NEXT_PUBLIC_VERCEL_ENV is absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", {
      location: new URL("https://preview.shortpulse.test/auth"),
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("callback route unavailable")));

    await expect(
      fetchCanonicalAuthCallbackUrl({ flow: "recovery", nextPath: "/dashboard" })
    ).resolves.toBe(
      "https://preview.shortpulse.test/auth/callback?flow=recovery&next=%2Fdashboard"
    );
  });
});
