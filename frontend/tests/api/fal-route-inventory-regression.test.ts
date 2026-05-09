/**
 * Fal route inventory regression gate.
 * Prevents accidental route removals/renames while the generation pipeline is refactored.
 * Generic legacy routes are intentionally excluded; routes must declare the provider/model surface.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");
const FAL_CLIENT_PATH = path.join(process.cwd(), "lib", "falClient.ts");

const EXPECTED_FAL_ROUTE_FILES = [
  "bria-background-remove-status.ts",
  "bria-background-remove-submit.ts",
  "flux-kontext-inpaint-status.ts",
  "flux-kontext-inpaint-submit.ts",
  "flux-pro-fill-status.ts",
  "flux-pro-fill-submit.ts",
  "flux2klein-status.ts",
  "flux2klein-submit.ts",
  "kie-kling-status.ts",
  "kie-kling-submit.ts",
  "kie-seedance-2-fast-status.ts",
  "kie-seedance-2-fast-submit.ts",
  "kie-seedance-2-status.ts",
  "kie-seedance-2-submit.ts",
  "kie-seedance-status.ts",
  "kie-seedance-submit.ts",
  "kie-veo-status.ts",
  "kie-veo-submit.ts",
  "nano-banana-2-edit-status.ts",
  "nano-banana-2-edit-submit.ts",
  "nano-banana-2-status.ts",
  "nano-banana-2-submit.ts",
  "nano-banana-pro-edit-status.ts",
  "nano-banana-pro-edit-submit.ts",
  "nano-banana-pro-status.ts",
  "nano-banana-pro-submit.ts",
  "seedream-edit-status.ts",
  "seedream-edit-submit.ts",
  "seedream-status.ts",
  "seedream-submit.ts",
  "seedream-v5-lite-edit-status.ts",
  "seedream-v5-lite-edit-submit.ts",
  "seedream-v5-lite-status.ts",
  "seedream-v5-lite-submit.ts",
  "webhook.ts",
] as const;

const listFalRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith(".ts"))
    .sort((a, b) => a.localeCompare(b));

describe("fal route inventory regression", () => {
  it("keeps the expected Fal route file inventory intact", () => {
    expect(listFalRouteFiles()).toEqual([...EXPECTED_FAL_ROUTE_FILES]);
  });

  it("keeps every expected route module default-exported", () => {
    for (const routeFile of EXPECTED_FAL_ROUTE_FILES) {
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
