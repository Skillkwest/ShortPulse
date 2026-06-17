import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd().endsWith("frontend")
  ? process.cwd()
  : path.join(process.cwd(), "frontend");
const workspaceRoot = path.dirname(repoRoot);

const SOURCE_PATHS = [
  ...["components", "features", "lib", "pages", "prefabs", "scripts", "styles", "types"].map(
    (entry) => path.join(repoRoot, entry)
  ),
  ...["next.config.js", "proxy.ts"].map((entry) => path.join(repoRoot, entry)),
  path.join(workspaceRoot, "scripts"),
].filter((entry) => existsSync(entry));
const IGNORE_SEGMENTS = new Set([
  ".next",
  ".tmp",
  ".vercel",
  "coverage",
  "node_modules",
  "__tests__",
]);
const RENDER_IMAGE_ALLOWLIST = new Set([
  path.join(repoRoot, "lib/mediaPreviewTrustPolicy.ts"),
  path.join(repoRoot, "features/media-library/logic/mediaPreviewSigningBatch.ts"),
]);

const walkSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    if (IGNORE_SEGMENTS.has(entry)) continue;
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
      continue;
    }
    if (/\.(cjs|js|mjs|ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
};

const collectSourceFiles = (entry: string): string[] => {
  const stat = statSync(entry);
  if (stat.isFile()) return [entry];
  if (stat.isDirectory()) return walkSourceFiles(entry);
  return [];
};

describe("supabase transform guard", () => {
  it("keeps production source from generating supabase render-image URLs", () => {
    const offenders = SOURCE_PATHS.flatMap(collectSourceFiles).filter((file) => {
      if (RENDER_IMAGE_ALLOWLIST.has(file)) return false;
      return readFileSync(file, "utf8").includes("/storage/v1/render/image/");
    });

    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
  });

  it("keeps media signing from passing transform options to Supabase", () => {
    const transformSigningPattern =
      /createSignedUrls?\([\s\S]{0,1200}\{[\s\S]{0,240}\btransform\s*:/;
    const offenders = SOURCE_PATHS.flatMap(collectSourceFiles).filter((file) =>
      transformSigningPattern.test(readFileSync(file, "utf8"))
    );

    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
  });

  it("keeps Supabase signing modules free of transform option keys", () => {
    const offenders = SOURCE_PATHS.flatMap(collectSourceFiles).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /createSignedUrls?\s*\(/.test(source) && /\btransform\s*:/.test(source);
    });

    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
  });
});
