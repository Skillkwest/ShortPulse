/**
 * Fal route inventory regression gate.
 * Prevents accidental route removals/renames while Phase 11 refactors internals.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");

const EXPECTED_FAL_ROUTE_FILES = [
  "flux2-edit-status.ts",
  "flux2-edit-submit.ts",
  "flux2-status.ts",
  "flux2-submit.ts",
  "flux2klein-status.ts",
  "flux2klein-submit.ts",
  "flux2pro-edit-status.ts",
  "flux2pro-edit-submit.ts",
  "flux2pro-status.ts",
  "flux2pro-submit.ts",
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
  "seedream-edit-submit.ts",
  "seedream-status.ts",
  "seedream-submit.ts",
  "sora-status.ts",
  "sora-submit.ts",
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

  it("keeps every expected route module default-exported", async () => {
    for (const routeFile of EXPECTED_FAL_ROUTE_FILES) {
      const modulePath = `../../pages/api/fal/${routeFile}`;
      const routeModule = await import(modulePath);
      expect(typeof routeModule.default).toBe("function");
    }
  });
});
