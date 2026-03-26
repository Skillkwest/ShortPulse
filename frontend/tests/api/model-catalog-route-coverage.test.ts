import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  listModelCatalogEntries,
  getModelCatalogEntry,
} from "../../lib/model-runtime/modelCatalog";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");

const listFalSubmitRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith("-submit.ts") || file === "submit.ts")
    .map((file) => path.join(FAL_ROUTES_DIR, file));

const listFalStatusRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith("-status.ts") || file === "status.ts")
    .map((file) => path.join(FAL_ROUTES_DIR, file));

const readModelId = (contents: string): string | null => {
  const match = contents.match(/modelId:\s*"([^"]+)"/);
  return match?.[1] ?? null;
};

describe("model catalog route coverage", () => {
  it("covers every Fal submit route model id in the shared catalog", () => {
    const missing: string[] = [];

    for (const filePath of listFalSubmitRouteFiles()) {
      const contents = fs.readFileSync(filePath, "utf8");
      const modelId = readModelId(contents);
      if (!modelId) {
        missing.push(`${path.basename(filePath)}: missing modelId`);
        continue;
      }
      if (!getModelCatalogEntry(modelId)) {
        missing.push(`${path.basename(filePath)}: ${modelId}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("wires payload validation on every Fal submit route", () => {
    const missingValidation = listFalSubmitRouteFiles()
      .filter((filePath) => !fs.readFileSync(filePath, "utf8").includes("validatePayload"))
      .map((filePath) => path.basename(filePath));

    expect(missingValidation).toEqual([]);
  });

  it("keeps every catalog Fal submit model discoverable from at least one route", () => {
    const routeModelIds = new Set<string>();
    for (const filePath of listFalSubmitRouteFiles()) {
      const modelId = readModelId(fs.readFileSync(filePath, "utf8"));
      if (modelId) routeModelIds.add(modelId);
    }

    const missingRoutes = listModelCatalogEntries()
      .filter((entry) => entry.provider === "fal" && entry.falSubmitUrl)
      .map((entry) => entry.modelId)
      .filter((modelId) => !routeModelIds.has(modelId));

    expect(missingRoutes).toEqual([]);
  });

  it("keeps queue URL literals isolated to legacy fallback routes", () => {
    const allowedFiles = new Set(["submit.ts", "status.ts"]);
    const filesWithQueueLiterals = [...listFalSubmitRouteFiles(), ...listFalStatusRouteFiles()]
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("queue.fal.run"))
      .map((filePath) => path.basename(filePath))
      .filter((fileName) => !allowedFiles.has(fileName));

    expect(filesWithQueueLiterals).toEqual([]);
  });

  it("pins Seedream status polling to the shared Bytedance queue root", () => {
    const seedreamModelIds = [
      "fal-ai/bytedance/seedream/v4.5/text-to-image",
      "fal-ai/bytedance/seedream/v4.5/edit",
      "fal-ai/bytedance/seedream/v5/lite/text-to-image",
      "fal-ai/bytedance/seedream/v5/lite/edit",
    ];

    for (const modelId of seedreamModelIds) {
      expect(getModelCatalogEntry(modelId)?.falStatusBaseUrls).toEqual([
        "https://queue.fal.run/fal-ai/bytedance/requests",
      ]);
    }
  });
});
