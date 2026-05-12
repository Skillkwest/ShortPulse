/**
 * Fal route inventory regression gate.
 * Prevents accidental route removals/renames while the generation pipeline is refactored.
 * Generic legacy routes are intentionally excluded; routes must declare the provider/model surface.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { listExpectedFalRouteFiles } = require("../../../scripts/lib/fal_route_inventory");

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");
const FAL_CLIENT_PATH = path.join(process.cwd(), "lib", "falClient.ts");

const listFalRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith(".ts"))
    .sort((a, b) => a.localeCompare(b));

const listGeneratedFalRouteFiles = (): string[] =>
  listExpectedFalRouteFiles().filter(
    (routeFile) => routeFile.endsWith("-submit.ts") || routeFile.endsWith("-status.ts")
  );

describe("fal route inventory regression", () => {
  it("keeps the expected Fal route file inventory intact", () => {
    expect(listFalRouteFiles()).toEqual(listExpectedFalRouteFiles());
  });

  it("keeps every generated Fal route module marked as a compatibility wrapper", () => {
    for (const routeFile of listGeneratedFalRouteFiles()) {
      const routePath = path.join(FAL_ROUTES_DIR, routeFile);
      const source = fs.readFileSync(routePath, "utf8");
      expect(source).toContain("// Generated compatibility wrapper. Do not hand edit.");
      expect(source).toContain("// Source of truth: scripts/lib/fal_route_inventory.js");
      expect(source).toContain("// Regenerate with: npm -C frontend run fal:routes:sync");
    }
  });

  it("keeps every expected route module default-exported", () => {
    for (const routeFile of listExpectedFalRouteFiles()) {
      const routePath = path.join(FAL_ROUTES_DIR, routeFile);
      const source = fs.readFileSync(routePath, "utf8");
      expect(source).toMatch(/\bexport\s+default\b/);
    }
  });

  it("keeps the client off retired generic Fal routes and compatibility fallbacks", () => {
    const source = fs.readFileSync(FAL_CLIENT_PATH, "utf8");
    expect(source).not.toContain("`${FAL_API_BASE}/submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/status`");
    expect(source).not.toContain("`${FAL_API_BASE}/image-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/image-status`");
    expect(source).not.toContain("`${FAL_API_BASE}/kling-v3-text-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/veo-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/veo-image-to-video-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/veo-first-last-frame-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/seedance-submit`");
    expect(source).not.toContain("`${FAL_API_BASE}/seedance-i2v-submit`");
    expect(source).not.toContain("fallbackGetOn405");
  });
});
