import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { getModelCatalogEntry } from "../../lib/model-runtime/modelCatalog";

const FAL_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "fal");
const OPENAI_ROUTES_DIR = path.join(process.cwd(), "pages", "api", "openai");
const PROVIDER_MODEL_IDS_PATH = path.join(
  process.cwd(),
  "lib",
  "model-runtime",
  "providerModelIds.ts"
);
const OPENAI_IMAGE_MODEL_ID = "gpt-image-2";
const OPENAI_IMAGE_ROUTE_FILES = ["image-generate.ts", "image-edit.ts"] as const;

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

  it("covers the GPT Image 2 OpenAI route family in the shared catalog", () => {
    expect(getModelCatalogEntry(OPENAI_IMAGE_MODEL_ID)).toBeTruthy();

    const missingContracts: string[] = [];

    for (const fileName of OPENAI_IMAGE_ROUTE_FILES) {
      const filePath = path.join(OPENAI_ROUTES_DIR, fileName);
      const contents = fs.readFileSync(filePath, "utf8");

      if (!contents.includes("OPENAI_GPT_IMAGE_2_MODEL_ID")) {
        missingContracts.push(`${fileName}: missing model id constant`);
      }
      if (!contents.includes("requireApiUser")) {
        missingContracts.push(`${fileName}: missing route auth`);
      }
      if (!contents.includes("chargeGenerationRequest")) {
        missingContracts.push(`${fileName}: missing shared billing`);
      }
    }

    expect(missingContracts).toEqual([]);
  });
});
