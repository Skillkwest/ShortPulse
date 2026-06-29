import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPECTED_STATUS_ROUTES,
  DEFAULT_FORBIDDEN_ROUTES,
  normalizePathLike,
  parseArgs,
  parseExpectedStatusRoute,
  pathMatchesRequired,
} from "../../../scripts/verify_deployment_route_parity.mjs";

const PAGE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

const toPageRouteCandidates = (route) => {
  const normalized = normalizePathLike(route);
  const relativeRoute = normalized.replace(/^\/+/, "");
  const pagesRoot = path.join(process.cwd(), "pages");
  return PAGE_EXTENSIONS.flatMap((extension) => [
    path.join(pagesRoot, `${relativeRoute}${extension}`),
    path.join(pagesRoot, relativeRoute, `index${extension}`),
  ]);
};

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

  it("probes source-present dev-only routes by expected anonymous status", () => {
    const args = parseArgs(["--base-url", "https://www.shortpulse.ai"]);

    expect(args.expectedStatusRoutes).toEqual(DEFAULT_EXPECTED_STATUS_ROUTES);
    expect(args.expectedStatusRoutes).toContainEqual({
      route: "/dev/ai-studio-stage-bakeoff",
      status: 404,
    });
    expect(args.forbiddenRoutes).not.toContain("/dev/ai-studio-stage-bakeoff");
  });

  it("allows expected-status route probes to be extended or bypassed", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--expected-status-route",
      "401:/api/custom-protected-route",
    ]);

    expect(args.expectedStatusRoutes).toEqual([
      ...DEFAULT_EXPECTED_STATUS_ROUTES,
      {
        route: "/api/custom-protected-route",
        status: 401,
      },
    ]);

    const bypassed = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--ignore-default-expected-status-routes",
    ]);
    expect(bypassed.expectedStatusRoutes).toEqual([]);
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

  it("parses expected-status routes", () => {
    expect(
      parseExpectedStatusRoute("404:https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff")
    ).toEqual({
      route: "/dev/ai-studio-stage-bakeoff",
      status: 404,
    });
    expect(() => parseExpectedStatusRoute("ok:/dev/ai-studio-stage-bakeoff")).toThrow(
      "Invalid --expected-status-route value"
    );
  });

  it("matches Vercel function outputs under canonical route paths", () => {
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-video.func")).toBe(true);
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-video/index.func")).toBe(true);
    expect(pathMatchesRequired("/api/upload-video", "/api/upload-audio.func")).toBe(false);
  });

  it("keeps default forbidden routes absent from local page/API source", () => {
    const presentRetiredRouteFiles = DEFAULT_FORBIDDEN_ROUTES.flatMap((route) =>
      toPageRouteCandidates(route)
        .filter((candidate) => fs.existsSync(candidate))
        .map((candidate) => path.relative(process.cwd(), candidate))
    );

    expect(presentRetiredRouteFiles).toEqual([]);
  });

  it("keeps expected-status source-present dev-only routes out of retired-route checks", () => {
    const expectedStatusRouteFiles = DEFAULT_EXPECTED_STATUS_ROUTES.flatMap(({ route }) =>
      toPageRouteCandidates(route)
        .filter((candidate) => fs.existsSync(candidate))
        .map((candidate) => path.relative(process.cwd(), candidate))
    );

    expect(expectedStatusRouteFiles).toContain("pages/dev/ai-studio-stage-bakeoff.tsx");
  });
});
