import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AI_STUDIO_SOURCE_ROOT = path.join(process.cwd(), "features/ai-studio");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const BARE_PROFILE_SECTION_LINK_PATTERN = /\/profile\?section=/;

const collectSourceFiles = (directory: string): string[] => {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const relativePath = path.relative(AI_STUDIO_SOURCE_ROOT, entryPath);
    if (relativePath.split(path.sep).includes("__tests__")) return [];
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) return [];

    const stats = statSync(entryPath);
    if (stats.isDirectory()) return collectSourceFiles(entryPath);
    if (!stats.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entryPath))) return [];
    return [entryPath];
  });
};

describe("AI Studio profile navigation guard", () => {
  it("keeps Profile section links on the canonical origin-aware helper path", () => {
    const bareProfileLinks = collectSourceFiles(AI_STUDIO_SOURCE_ROOT)
      .map((filePath) => ({
        filePath,
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => BARE_PROFILE_SECTION_LINK_PATTERN.test(source))
      .map(({ filePath }) => path.relative(process.cwd(), filePath));

    expect(bareProfileLinks).toEqual([]);
  });
});
