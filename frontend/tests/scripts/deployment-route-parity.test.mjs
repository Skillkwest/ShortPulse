import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORBIDDEN_ROUTES,
  normalizePathLike,
  parseArgs,
  pathMatchesRequired,
} from "../../../scripts/verify_deployment_route_parity.mjs";

describe("deployment route parity launch gate", () => {
  it("enforces retired route defaults unless explicitly bypassed", () => {
    const args = parseArgs(["--base-url", "https://www.shortpulse.ai"]);

    expect(args.forbiddenRoutes).toEqual(DEFAULT_FORBIDDEN_ROUTES);
    expect(args.requiredRoutes).toContain("/api/internal/billing-contract-renewals/run");
    expect(args.forbiddenRoutes).toContain("/performance");
    expect(args.forbiddenRoutes).toContain("/performance-soon");
    expect(args.forbiddenRoutes).toContain("/onboarding");
    expect(args.forbiddenRoutes).toContain("/api/upload-video");
    expect(args.forbiddenRoutes).toContain("/api/upload-audio");
    expect(args.forbiddenRoutes).toContain("/api/media/upload");
    expect(args.forbiddenRoutes).toContain("/api/media/admit-image-asset");
  });

  it("keeps manual forbidden routes additive", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--forbidden-route",
      "/api/custom-retired-route",
    ]);

    expect(args.forbiddenRoutes).toEqual([
      ...DEFAULT_FORBIDDEN_ROUTES,
      "/api/custom-retired-route",
    ]);
  });

  it("allows older-deployment inspection without default retired-route enforcement", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--ignore-default-forbidden-routes",
    ]);

    expect(args.forbiddenRoutes).toEqual([]);
  });

  it("normalizes route-like values before parity comparison", () => {
    expect(normalizePathLike("https://www.shortpulse.ai/api/upload-video?x=1#frag")).toBe(
      "/api/upload-video"
    );
    expect(normalizePathLike("./api/media/admit-image-asset/")).toBe(
      "/api/media/admit-image-asset"
    );
  });

  it("matches Vercel function outputs under canonical route paths", () => {
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-video.func")).toBe(true);
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-video/index.func")).toBe(true);
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-audio.func")).toBe(false);
  });
});
