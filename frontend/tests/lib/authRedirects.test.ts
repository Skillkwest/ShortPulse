import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCanonicalAuthCallbackUrl,
  resolveNextPath,
  resolveSignupNextPath,
} from "../../lib/authRedirects";

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

  it("remaps deprecated character aliases to AI Studio after auth", () => {
    expect(resolveNextPath("/character")).toBe("/ai-studio");
    expect(resolveNextPath("/character-soon")).toBe("/ai-studio");
    expect(resolveNextPath("/character?tab=profile")).toBe("/ai-studio");
    expect(resolveNextPath("/character-soon#legacy")).toBe("/ai-studio");
  });

  it("fails closed for invalid next paths and auth self-redirects", () => {
    expect(resolveNextPath(undefined)).toBe("/dashboard");
    expect(resolveNextPath("https://evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("//evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/\\evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/\\/evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/auth?next=%2Fcharacter")).toBe("/dashboard");
  });

  it("routes signup returns to pricing while preserving selected pricing plans", () => {
    expect(resolveSignupNextPath("/dashboard")).toBe("/pricing");
    expect(resolveSignupNextPath("/ai-studio")).toBe("/pricing");
    expect(resolveSignupNextPath("/pricing")).toBe("/pricing");
    expect(resolveSignupNextPath("/pricing?intent=create-project&plan=starter")).toBe(
      "/pricing?intent=create-project&plan=starter"
    );
  });
});
