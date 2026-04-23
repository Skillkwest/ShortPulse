/**
 * Fal route inventory regression gate.
 * Prevents accidental route removals/renames while Phase 11 refactors internals.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");

const EXPECTED_FAL_ROUTE_FILES = [
  "bria-background-remove-status.ts",
  "bria-background-remove-submit.ts",
  "flux-kontext-inpaint-status.ts",
  "flux-kontext-inpaint-submit.ts",
  "flux-pro-fill-status.ts",
  "flux-pro-fill-submit.ts",
  "flux2klein-status.ts",
  "flux2klein-submit.ts",
  "image-status.ts",
  "image-submit.ts",
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
  "kling-status.ts",
  "kling-v3-image-to-video-status.ts",
  "kling-v3-image-to-video-submit.ts",
  "kling-v3-text-submit.ts",
  "nano-banana-2-edit-status.ts",
  "nano-banana-2-edit-submit.ts",
  "nano-banana-2-status.ts",
  "nano-banana-2-submit.ts",
  "nano-banana-edit-status.ts",
  "nano-banana-edit-submit.ts",
  "nano-banana-pro-edit-status.ts",
  "nano-banana-pro-edit-submit.ts",
  "nano-banana-pro-status.ts",
  "nano-banana-pro-submit.ts",
  "nano-banana-status.ts",
  "nano-banana-submit.ts",
  "queue-status.ts",
  "seedance-i2v-status.ts",
  "seedance-i2v-submit.ts",
  "seedance-status.ts",
  "seedance-submit.ts",
  "seedream-edit-status.ts",
  "seedream-edit-submit.ts",
  "seedream-status.ts",
  "seedream-submit.ts",
  "seedream-v5-lite-edit-status.ts",
  "seedream-v5-lite-edit-submit.ts",
  "seedream-v5-lite-status.ts",
  "seedream-v5-lite-submit.ts",
  "status.ts",
  "submit.ts",
  "veo-first-last-frame-submit.ts",
  "veo-image-to-video-status.ts",
  "veo-image-to-video-submit.ts",
  "veo-status.ts",
  "veo-submit.ts",
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
});
