/**
 * Protected API manifest parity tests.
 * Keeps proxy auth coverage aligned with route-level bearer/admin enforcement.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isProtectedApiPath, isWebhookPath } from "../../lib/server/api/protectedApiPaths";

const API_ROUTES_DIR = path.join(process.cwd(), "pages", "api");

const toRoutePath = (filePath: string): string => {
  let relativePath = path.relative(API_ROUTES_DIR, filePath).replace(/\\/g, "/");
  relativePath = `/${relativePath.replace(/\.tsx?$/, "")}`;
  relativePath = relativePath.replace(/\/index$/, "");
  relativePath = relativePath.replace(/\/\[\.\.\.[^/]+\]$/, "");
  return `/api${relativePath}`;
};

const collectApiRouteFiles = (): string[] => {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(absolutePath);
      }
    }
  };
  walk(API_ROUTES_DIR);
  return files;
};

describe("protected API manifest parity", () => {
  it("covers every API route that requires bearer or admin auth in the handler", () => {
    const uncoveredAuthRoutes = collectApiRouteFiles()
      .map((filePath) => ({
        filePath,
        routePath: toRoutePath(filePath),
        source: fs.readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => /requireApiUser\(|requireAdminUser\(/.test(source))
      .filter(({ routePath }) => !isProtectedApiPath(routePath) && !isWebhookPath(routePath))
      .map(({ filePath, routePath }) => ({
        routePath,
        filePath: path.relative(process.cwd(), filePath),
      }));

    expect(uncoveredAuthRoutes).toEqual([]);
  });
});
