import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthCallbackPath,
  fetchCanonicalAuthCallbackUrl,
  isPaidPricingSignupNextPath,
  isPublicSignupEnabled,
  resolveAuthCallbackFlow,
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

  it("supports the sign-in callback flow for OAuth redirects", () => {
    expect(resolveAuthCallbackFlow("signin")).toBe("signin");
    expect(buildAuthCallbackPath({ flow: "signin", nextPath: "/profile?section=account" })).toBe(
      "/auth/callback?flow=signin&next=%2Fprofile%3Fsection%3Daccount"
    );
    expect(buildAuthCallbackPath({ flow: "signin", nextPath: "//evil.example" })).toBe(
      "/auth/callback?flow=signin&next=%2Fdashboard"
    );
  });

  it("fails closed for invalid next paths and auth self-redirects", () => {
    expect(resolveNextPath(undefined)).toBe("/dashboard");
    expect(resolveNextPath("https://evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("//evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/\\evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/\\/evil.example.com/character")).toBe("/dashboard");
    expect(resolveNextPath("/auth?next=%2Fcharacter")).toBe("/dashboard");
  });

  it("allows signup only for selected paid pricing plans", () => {
    expect(resolveSignupNextPath("/dashboard")).toBeNull();
    expect(resolveSignupNextPath("/ai-studio")).toBeNull();
    expect(resolveSignupNextPath("/pricing")).toBeNull();
    expect(resolveSignupNextPath("/pricing?plan=free")).toBeNull();
    expect(resolveSignupNextPath("/pricing?intent=create-project&plan=starter")).toBe(
      "/pricing?intent=create-project&plan=starter"
    );
    expect(isPaidPricingSignupNextPath("/pricing?intent=create-project&plan=studio")).toBe(true);
    expect(isPaidPricingSignupNextPath("/pricing?intent=create-project")).toBe(false);
  });

  it("keeps public signup disabled unless explicitly enabled", () => {
    expect(isPublicSignupEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "false");
    expect(isPublicSignupEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    expect(isPublicSignupEnabled()).toBe(true);
  });
});
