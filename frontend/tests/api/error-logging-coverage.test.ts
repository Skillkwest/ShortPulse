/**
 * API telemetry coverage guardrail.
 * Ensures API catch blocks either write structured error telemetry or are explicitly allowlisted.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type CatchLocation = {
  file: string;
  line: number;
};

const API_ROOT = path.join(process.cwd(), "pages", "api");
const LOOKAHEAD_LINES = 40;

const ALLOWLIST = new Set<string>([
  // This ingest route is the terminal error-logging path itself; catch failures here
  // return 500 and avoid recursive logging attempts.
  "log/client-error.ts",
]);

const ALLOWLIST_LOCATIONS = new Set<string>([
  // Helper-level validation catch that converts invalid client-supplied storage-path hints
  // into deterministic 4xx-safe field errors rather than route-fault telemetry.
  "media/copy-from-url.ts:187",
  "media/copy-from-url.ts:185",
  "media/copy-from-url.ts:190",
  "media/copy-from-url.ts:191",
  "media/copy-from-url.ts:194",
  "media/copy-from-url.ts:214",
  "media/copy-from-url.ts:220",
  "media/copy-from-url.ts:1090",
  "media/copy-from-url.ts:1115",
  "media/copy-from-url.ts:1277",
  "media/copy-from-url.ts:1302",
  "media/copy-from-url.ts:1357",
  "media/copy-from-url.ts:1379",
  // Redirect validation catch that normalizes invalid upstream locations into deterministic
  // request errors before the route-level handler decides the final response contract.
  "fal/upload-url.ts:211",
  // Upload-helper validation catches that convert expected client/upstream failures into
  // deterministic request errors before the route-level handler decides the response contract.
  "fal/upload-url.ts:315",
  "fal/upload-url.ts:445",
  "fal/upload-url.ts:665",
  "billing/subscription/change.ts:522",
  "billing/subscription/change.ts:582",
  "kie/upload-url.ts:571",
  "kie/upload-url.ts:674",
  "kie/upload-url.ts:702",
  "kie/upload-url.ts:813",
  // Storage-object verification fallback: if schema access fails, the helper falls back to
  // Storage API listing before deciding whether to throw a route-level error.
  "media/list.ts:631",
]);

const LOG_CALL_PATTERNS = [
  "logApiRouteException(",
  "logGenerationFailure(",
  "logVideoVariantHydrationFailure(",
  "writeAppErrorLog(",
  "respondAndLogError(",
];

const collectApiFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectApiFiles(absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!absolute.endsWith(".ts")) continue;
    files.push(absolute);
  }

  return files;
};

const findUninstrumentedCatches = (absoluteFile: string): CatchLocation[] => {
  const relative = path.relative(API_ROOT, absoluteFile).replaceAll(path.sep, "/");
  if (ALLOWLIST.has(relative)) return [];

  const content = fs.readFileSync(absoluteFile, "utf8");
  const lines = content.split(/\r?\n/);
  const misses: CatchLocation[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!/\bcatch\s*\(\s*error\s*\)\s*\{/.test(line)) continue;

    const blockPreview = lines.slice(index, index + LOOKAHEAD_LINES).join("\n");
    const hasLoggingCall = LOG_CALL_PATTERNS.some((pattern) => blockPreview.includes(pattern));
    if (!hasLoggingCall) {
      const locationKey = `${relative}:${index + 1}`;
      if (ALLOWLIST_LOCATIONS.has(locationKey)) continue;
      misses.push({
        file: relative,
        line: index + 1,
      });
    }
  }

  return misses;
};

describe("API error logging coverage", () => {
  it("keeps catch blocks instrumented for telemetry", () => {
    const files = collectApiFiles(API_ROOT);
    const uncovered = files.flatMap((file) => findUninstrumentedCatches(file));

    expect(uncovered).toEqual([]);
  });
});
