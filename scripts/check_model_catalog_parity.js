// Model catalog parity checks for API docs and runtime governance.
// Run with: node scripts/check_model_catalog_parity.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const MODEL_CATALOG_PATH = path.join(
  FRONTEND_ROOT,
  "lib",
  "model-runtime",
  "modelCatalog.ts",
);
const FAL_ROUTES_DIR = path.join(FRONTEND_ROOT, "pages", "api", "fal");
const DOCS_API_DIR = path.join(REPO_ROOT, "docs", "api");
const DOCS_API_INDEX = path.join(DOCS_API_DIR, "README.md");
const DOCS_ROOT_INDEX = path.join(REPO_ROOT, "docs", "README.md");
const MAX_STALE_DAYS = Number(process.env.SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS || 45);

const MODEL_DOC_MAP = {
  "fal-ai/flux-2/klein/9b": "api-fal-flux-2-klein-9b.md",
  "fal/flux-2": "api-fal-flux-2.md",
  "fal/flux-2/edit": "api-fal-flux-2-edit.md",
  "fal/flux-2-pro": "api-fal-flux-2-pro.md",
  "fal/flux-2-pro/edit": "api-fal-flux-2-pro-edit.md",
  "fal-ai/nano-banana": "api-fal-nano-banana.md",
  "fal-ai/nano-banana/edit": "api-fal-nano-banana-edit.md",
  "fal-ai/nano-banana-pro": "api-fal-nano-banana-pro.md",
  "fal-ai/nano-banana-pro/edit": "api-fal-nano-banana-pro-edit.md",
  "fal-ai/bytedance/seedream/v4.5/text-to-image": "api-fal-seedream-4-5.md",
  "fal-ai/bytedance/seedream/v4.5/edit": "api-fal-seedream-4-5-edit.md",
  "fal-ai/kling-video/v3/pro/text-to-video": "api-fal-kling-3-pro-text-to-video.md",
  "fal-ai/kling-video/v3/pro/image-to-video": "api-fal-kling-3-pro-image-to-video.md",
  "fal-ai/veo3.1": "api-fal-veo3.md",
  "fal-ai/veo3.1/image-to-video": "api-fal-veo3-image-to-video.md",
  "fal-ai/veo3.1/first-last-frame-to-video": "api-fal-veo3-first-last-frame.md",
  "fal-ai/sora-2/text-to-video/pro": "api-fal-sora-2-pro.md",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": "api-fal-seedance-1-5-pro.md",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": "api-fal-seedance-1-5-pro-i2v.md",
  "gpt-5-nano": "api-responses.md",
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function loadTsModule(filePath) {
  const ts = require(path.join(FRONTEND_ROOT, "node_modules", "typescript"));
  const source = readText(filePath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    process,
    console,
  };
  sandbox.exports = sandbox.module.exports;

  new vm.Script(transpiled, { filename: filePath }).runInNewContext(sandbox);
  return sandbox.module.exports;
}

function daysBetween(startIso, endIso) {
  const ms = endIso.getTime() - startIso.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function listFalSubmitRouteModelIds() {
  const files = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((name) => name.endsWith("-submit.ts") || name === "submit.ts");

  const modelIds = new Set();
  for (const fileName of files) {
    const content = readText(path.join(FAL_ROUTES_DIR, fileName));
    const match = content.match(/modelId:\s*"([^"]+)"/);
    if (!match) continue;
    modelIds.add(match[1]);
  }
  return modelIds;
}

function run() {
  const errors = [];
  const warnings = [];
  const today = new Date();

  const modelCatalogModule = loadTsModule(MODEL_CATALOG_PATH);
  const listModelCatalogEntries = modelCatalogModule.listModelCatalogEntries;
  if (typeof listModelCatalogEntries !== "function") {
    throw new Error("listModelCatalogEntries export missing from modelCatalog.ts");
  }

  const entries = listModelCatalogEntries();
  if (!Array.isArray(entries) || !entries.length) {
    errors.push("Model catalog is empty.");
  }

  const seenIds = new Set();
  for (const entry of entries) {
    const modelId = String(entry.modelId || "").trim();
    if (!modelId) {
      errors.push("Encountered catalog entry without modelId.");
      continue;
    }
    if (seenIds.has(modelId)) {
      errors.push(`Duplicate modelId in catalog: ${modelId}`);
    }
    seenIds.add(modelId);

    const sourceUrl = String(entry.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`Catalog sourceUrl missing/invalid for ${modelId}`);
    }

    const verifiedAt = String(entry.verifiedAt || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
      errors.push(`verifiedAt must be YYYY-MM-DD for ${modelId}`);
    } else {
      const parsed = new Date(`${verifiedAt}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.push(`verifiedAt is not a valid date for ${modelId}: ${verifiedAt}`);
      } else {
        const ageDays = daysBetween(parsed, today);
        if (ageDays > MAX_STALE_DAYS) {
          warnings.push(
            `Catalog verification is stale for ${modelId}: ${verifiedAt} (${ageDays} days old; max ${MAX_STALE_DAYS}).`,
          );
        }
      }
    }

    if (entry.provider === "fal") {
      if (!String(entry.falSubmitUrl || "").trim()) {
        errors.push(`falSubmitUrl missing for Fal model ${modelId}`);
      }
      if (!Array.isArray(entry.falStatusBaseUrls) || entry.falStatusBaseUrls.length === 0) {
        errors.push(`falStatusBaseUrls missing for Fal model ${modelId}`);
      }
    }

    const mappedDoc = MODEL_DOC_MAP[modelId];
    if (!mappedDoc) {
      errors.push(`Missing MODEL_DOC_MAP entry for ${modelId}`);
      continue;
    }

    const docPath = path.join(DOCS_API_DIR, mappedDoc);
    if (!fs.existsSync(docPath)) {
      errors.push(`Missing mapped API doc for ${modelId}: docs/api/${mappedDoc}`);
      continue;
    }

    const docText = readText(docPath);
    if (!docText.includes(modelId) && !docText.includes(sourceUrl)) {
      errors.push(
        `Mapped doc docs/api/${mappedDoc} does not reference model id or source URL for ${modelId}`,
      );
    }
  }

  const falSubmitModelIds = listFalSubmitRouteModelIds();
  for (const modelId of falSubmitModelIds) {
    if (!seenIds.has(modelId)) {
      errors.push(`Fal submit route references unknown catalog model id: ${modelId}`);
    }
  }

  const falCatalogModelIds = entries
    .filter((entry) => entry.provider === "fal" && String(entry.falSubmitUrl || "").trim().length > 0)
    .map((entry) => entry.modelId);

  for (const modelId of falCatalogModelIds) {
    if (!falSubmitModelIds.has(modelId)) {
      errors.push(`Catalog Fal model missing submit route coverage: ${modelId}`);
    }
  }

  const apiIndexText = readText(DOCS_API_INDEX);
  const docsRootText = readText(DOCS_ROOT_INDEX);
  const mappedDocs = new Set(Object.values(MODEL_DOC_MAP));

  for (const fileName of mappedDocs) {
    if (!apiIndexText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/api/README.md missing entry for docs/api/${fileName}`);
    }
    if (!docsRootText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/README.md missing entry for docs/api/${fileName}`);
    }
  }

  if (warnings.length) {
    console.warn("Model catalog parity warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error("Model catalog parity checks failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Model catalog parity checks passed.");
}

run();
