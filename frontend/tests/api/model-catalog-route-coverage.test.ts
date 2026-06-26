import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  getModelCatalogEntry,
  listModelCatalogEntries,
} from "../../lib/model-runtime/modelCatalog";
import { FAL_ROUTE_INVENTORY } from "../../../scripts/lib/fal_route_inventory";
import {
  DIRECT_PROVIDER_ROUTE_INVENTORY,
  listDirectProviderRouteModelIds,
} from "../../../scripts/lib/direct_provider_route_inventory";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");
const PROVIDER_MODEL_IDS_PATH = path.join(
  process.cwd(),
  "lib",
  "model-runtime",
  "providerModelIds.ts"
);
const ALLOWED_DIRECT_ROUTE_KINDS: ReadonlySet<string> = new Set([
  "create",
  "edit",
  "audio-generate",
  "metadata-preview",
] as const);
const ALLOWED_DIRECT_ROUTE_AUTHORITIES: ReadonlySet<string> = new Set([
  "server-constant",
  "catalog-default-role-allowlist",
  "catalog-default-role-server-default",
] as const);
const RETIRED_FAL_VIDEO_MODEL_IDS = [
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
] as const;

const listFalSubmitRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith("-submit.ts") || file === "submit.ts")
    .map((file) => path.join(FAL_ROUTES_DIR, file))
    .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("createFalSubmitHandler"));

const listFalStatusRouteFiles = (): string[] =>
  fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith("-status.ts") || file === "status.ts")
    .map((file) => path.join(FAL_ROUTES_DIR, file));

const readProviderModelIdMap = (): Record<string, string> => {
  const contents = fs.readFileSync(PROVIDER_MODEL_IDS_PATH, "utf8");
  const entries: Array<[string, string]> = [];
  for (const match of contents.matchAll(/export const ([A-Z0-9_]+) = "([^"]+)";/g)) {
    entries.push([match[1], match[2]]);
  }
  return Object.fromEntries(entries);
};

const resolveModelId = (
  contents: string,
  providerModelIds: Record<string, string>
): string | null => {
  const literalMatch = contents.match(/modelId:\s*"([^"]+)"/);
  if (literalMatch?.[1]) return literalMatch[1];

  const identifierMatch = contents.match(/modelId:\s*([A-Z0-9_]+)/);
  if (!identifierMatch?.[1]) return null;

  return providerModelIds[identifierMatch[1]] ?? null;
};

describe("model catalog route coverage", () => {
  const providerModelIds = readProviderModelIdMap();

  it("covers every Fal submit route model id in the shared catalog", () => {
    const missing: string[] = [];

    for (const filePath of listFalSubmitRouteFiles()) {
      const contents = fs.readFileSync(filePath, "utf8");
      const modelId = resolveModelId(contents, providerModelIds);
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

  it("keeps provider routes free of direct queue URL literals", () => {
    const filesWithQueueLiterals = [...listFalSubmitRouteFiles(), ...listFalStatusRouteFiles()]
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("queue.fal.run"))
      .map((filePath) => path.basename(filePath));

    expect(filesWithQueueLiterals).toEqual([]);
  });

  it("keeps queued Fal/Kie route inventory aligned with route-owned catalog models", () => {
    const queuedRuntimeEntries = listModelCatalogEntries()
      .filter(
        (entry) =>
          entry.executionMode === "queued" &&
          (entry.provider === "fal" || entry.provider === "kie") &&
          ((entry.lifecycle === "active" && entry.surfaces?.includes("runtime")) ||
            (entry.lifecycle !== "active" && Boolean(entry.replacementModelId)))
      )
      .map((entry) => ({
        modelId: entry.modelId,
        provider: entry.provider,
        fileBase: entry.apiRouteSlug ?? null,
      }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId));

    const routeInventoryEntries = [...FAL_ROUTE_INVENTORY]
      .map((entry) => ({
        modelId: entry.modelId,
        provider: entry.provider,
        fileBase: entry.fileBase,
      }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId));

    expect(new Set(queuedRuntimeEntries.map((entry) => entry.fileBase)).size).toBe(
      queuedRuntimeEntries.length
    );
    expect(queuedRuntimeEntries).toEqual(routeInventoryEntries);
  });

  it("keeps direct provider route inventory aligned with active direct runtime catalog models", () => {
    const directRuntimeModelIds = listModelCatalogEntries()
      .filter(
        (entry) =>
          entry.lifecycle === "active" &&
          entry.surfaces?.includes("runtime") &&
          entry.executionMode === "direct" &&
          (entry.provider === "openai" || entry.provider === "elevenlabs")
      )
      .map((entry) => entry.modelId)
      .sort((a, b) => a.localeCompare(b));

    expect(listDirectProviderRouteModelIds()).toEqual(directRuntimeModelIds);
    expect(new Set(DIRECT_PROVIDER_ROUTE_INVENTORY.map((entry) => entry.routePath)).size).toBe(
      DIRECT_PROVIDER_ROUTE_INVENTORY.length
    );
    expect(
      new Set(
        DIRECT_PROVIDER_ROUTE_INVENTORY.map((entry) => `${entry.modelId}::${entry.directRouteKind}`)
      ).size
    ).toBe(DIRECT_PROVIDER_ROUTE_INVENTORY.length);
    expect(
      DIRECT_PROVIDER_ROUTE_INVENTORY.every((entry) =>
        ALLOWED_DIRECT_ROUTE_KINDS.has(entry.directRouteKind)
      )
    ).toBe(true);
    expect(
      DIRECT_PROVIDER_ROUTE_INVENTORY.every((entry) =>
        ALLOWED_DIRECT_ROUTE_AUTHORITIES.has(entry.authority)
      )
    ).toBe(true);
    expect(
      DIRECT_PROVIDER_ROUTE_INVENTORY.every(
        (entry) =>
          Array.isArray(entry.requiredSymbols) &&
          entry.requiredSymbols.length > 0 &&
          entry.requiredSymbols.every(
            (symbol) => typeof symbol === "string" && symbol.trim().length > 0
          )
      )
    ).toBe(true);

    const missingRoutes = DIRECT_PROVIDER_ROUTE_INVENTORY.filter(
      (entry: { routePath: string }) =>
        !fs.existsSync(path.join(process.cwd(), "..", entry.routePath))
    ).map((entry: { routePath: string }) => entry.routePath);

    expect(missingRoutes).toEqual([]);
  });

  it("keeps multi-alias Fal status entries anchored to the canonical status route", () => {
    const mismatches: string[] = [];

    for (const filePath of listFalStatusRouteFiles()) {
      const contents = fs.readFileSync(filePath, "utf8");
      const modelId = resolveModelId(contents, providerModelIds);
      if (!modelId) continue;
      const entry = getModelCatalogEntry(modelId);
      if (!entry?.falSubmitUrl) continue;
      const expectedStatusBase = `${entry.falSubmitUrl}/requests`;
      const statusBaseUrls = entry.falStatusBaseUrls ?? [];
      if (statusBaseUrls.length > 1 && !statusBaseUrls.includes(expectedStatusBase)) {
        mismatches.push(
          `${path.basename(filePath)}: expected catalog to include ${expectedStatusBase}, got ${JSON.stringify(
            statusBaseUrls
          )}`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("pins Seedream status polling to each model's canonical queue route", () => {
    expect(
      getModelCatalogEntry("fal-ai/bytedance/seedream/v4.5/text-to-image")?.falStatusBaseUrls
    ).toEqual(["https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests"]);
    expect(getModelCatalogEntry("fal-ai/bytedance/seedream/v4.5/edit")?.falStatusBaseUrls).toEqual([
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
    ]);
    expect(
      getModelCatalogEntry("fal-ai/bytedance/seedream/v5/lite/text-to-image")?.falStatusBaseUrls
    ).toEqual(["https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image/requests"]);
    expect(
      getModelCatalogEntry("fal-ai/bytedance/seedream/v5/lite/edit")?.falStatusBaseUrls
    ).toEqual(["https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/edit/requests"]);
  });

  it("keeps retired Fal video models out of executable provider routes", () => {
    for (const modelId of RETIRED_FAL_VIDEO_MODEL_IDS) {
      const entry = getModelCatalogEntry(modelId);
      expect(entry?.falSubmitUrl).toBeUndefined();
      expect(entry?.falStatusBaseUrls).toBeUndefined();
    }
  });

  it("keeps removed direct OpenAI image routes out of the executable model surface", () => {
    expect(getModelCatalogEntry("gpt-image-2")).toBeNull();
    expect(
      fs.existsSync(path.join(process.cwd(), "pages", "api", "openai", "image-generate.ts"))
    ).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "pages", "api", "openai", "image-edit.ts"))).toBe(
      false
    );
  });
});
