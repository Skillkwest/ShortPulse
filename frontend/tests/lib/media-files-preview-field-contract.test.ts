import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_DIRS = ["features", "lib", "pages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const readSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return readSourceFiles(fullPath);
    }
    return SOURCE_EXTENSIONS.has(path.extname(entry)) ? [fullPath] : [];
  });
};

describe("media_files preview field contract", () => {
  it("does not query preview_storage_path from media_files", () => {
    const root = process.cwd();
    const files = SOURCE_DIRS.flatMap((dir) => readSourceFiles(path.join(root, dir)));
    const forbiddenQueryPattern =
      /\.from\(\s*["']media_files["']\s*\)[\s\S]{0,1200}?\.select\(\s*(["'`])(?:(?!\1)[\s\S])*preview_storage_path(?:(?!\1)[\s\S])*\1\s*\)/;

    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenQueryPattern.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
