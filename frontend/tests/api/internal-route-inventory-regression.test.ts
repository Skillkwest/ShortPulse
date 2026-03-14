/**
 * Internal route inventory regression gate.
 * Prevents accidental removals/renames of critical internal operations routes.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const INTERNAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "internal");

const EXPECTED_INTERNAL_ROUTE_FILES = [
  "admin-user-health-fleet/run.ts",
  "generation-recovery/run.ts",
  "media-derivatives/run.ts",
] as const;

const toAbsoluteRoutePath = (relativeRoutePath: string): string =>
  path.join(INTERNAL_ROUTES_DIR, ...relativeRoutePath.split("/"));

describe("internal route inventory regression", () => {
  it("keeps the expected internal route modules present", () => {
    for (const routeFile of EXPECTED_INTERNAL_ROUTE_FILES) {
      expect(fs.existsSync(toAbsoluteRoutePath(routeFile))).toBe(true);
    }
  });

  it("keeps every expected internal route module default-exported", () => {
    for (const routeFile of EXPECTED_INTERNAL_ROUTE_FILES) {
      const source = fs.readFileSync(toAbsoluteRoutePath(routeFile), "utf8");
      expect(source).toMatch(/\bexport\s+default\b/);
    }
  });
});
